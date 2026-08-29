import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

// ── Models ───────────────────────────────────────────────────────────────

class PtUsage {
  final String planName;
  final String period; // weekly | monthly
  final int allowed;
  final int used;
  final int remaining;
  final bool atLimit;

  PtUsage({
    required this.planName,
    required this.period,
    required this.allowed,
    required this.used,
    required this.remaining,
    required this.atLimit,
  });

  String get periodLabel => period == 'monthly' ? 'month' : 'week';

  factory PtUsage.fromJson(Map<String, dynamic> j) => PtUsage(
        planName: (j['planName'] ?? 'Personal Training').toString(),
        period: (j['period'] ?? 'weekly').toString(),
        allowed: (j['allowed'] as num?)?.toInt() ?? 0,
        used: (j['used'] as num?)?.toInt() ?? 0,
        remaining: (j['remaining'] as num?)?.toInt() ?? 0,
        atLimit: j['atLimit'] == true,
      );
}

class PtSession {
  final int id;
  final DateTime sessionDate;
  final String status; // scheduled | completed | cancelled | no_show
  final String? trainerName;
  final String? notes;
  final int? durationMinutes;

  PtSession({
    required this.id,
    required this.sessionDate,
    required this.status,
    this.trainerName,
    this.notes,
    this.durationMinutes,
  });

  factory PtSession.fromJson(Map<String, dynamic> j) {
    final trainer = j['trainer'] is Map ? Map<String, dynamic>.from(j['trainer']) : null;
    return PtSession(
      id: j['id'] as int,
      sessionDate: DateTime.tryParse((j['sessionDate'] ?? '').toString())?.toLocal() ?? DateTime.now(),
      status: (j['status'] ?? 'scheduled').toString(),
      trainerName: trainer?['name']?.toString(),
      notes: j['notes']?.toString(),
      durationMinutes: (j['durationMinutes'] as num?)?.toInt(),
    );
  }
}

class ClientPt {
  final bool hasPT;
  final PtUsage? usage;
  final List<PtSession> history;
  final List<PtSession> upcoming;

  ClientPt({required this.hasPT, this.usage, this.history = const [], this.upcoming = const []});

  factory ClientPt.fromJson(Map<String, dynamic> j) {
    if (j['hasPT'] != true) return ClientPt(hasPT: false);
    List<PtSession> parse(dynamic list) =>
        ((list as List?) ?? []).map((e) => PtSession.fromJson(Map<String, dynamic>.from(e))).toList();
    return ClientPt(
      hasPT: true,
      usage: j['usage'] is Map ? PtUsage.fromJson(Map<String, dynamic>.from(j['usage'])) : null,
      history: parse(j['history']),
      upcoming: parse(j['upcoming']),
    );
  }
}

// ── Repository + providers ────────────────────────────────────────────────

class PtRepository {
  Future<ClientPt> fetch() async {
    final res = await apiClient.dio.get('/client/pt');
    return ClientPt.fromJson(Map<String, dynamic>.from(res.data));
  }
}

final ptRepositoryProvider = Provider<PtRepository>((ref) => PtRepository());

final clientPtProvider = FutureProvider.autoDispose<ClientPt>((ref) async {
  return ref.watch(ptRepositoryProvider).fetch();
});
