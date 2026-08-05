import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import 'gamification_models.dart';

const _base = '/client/gamification';

// ---- Read providers ---------------------------------------------------------
final gamiSummaryProvider = FutureProvider<GamiSummary>((ref) async {
  final res = await apiClient.dio.get('$_base/summary');
  return GamiSummary.fromJson(Map<String, dynamic>.from(res.data));
});

final dailyGoalsProvider = FutureProvider<List<DailyGoal>>((ref) async {
  final res = await apiClient.dio.get('$_base/daily-goals');
  return (res.data as List).map((e) => DailyGoal.fromJson(Map<String, dynamic>.from(e))).toList();
});

final xpTodayProvider = FutureProvider<XpToday>((ref) async {
  final res = await apiClient.dio.get('$_base/xp/today');
  return XpToday.fromJson(Map<String, dynamic>.from(res.data));
});

// period: daily | weekly | monthly
final leaderboardProvider = FutureProvider.family<List<LeaderEntry>, String>((ref, period) async {
  final res = await apiClient.dio.get('$_base/leaderboard', queryParameters: {'period': period});
  return (res.data as List).map((e) => LeaderEntry.fromJson(Map<String, dynamic>.from(e))).toList();
});

final leagueProvider = FutureProvider<LeagueStanding>((ref) async {
  final res = await apiClient.dio.get('$_base/league');
  return LeagueStanding.fromJson(Map<String, dynamic>.from(res.data));
});

final challengesProvider = FutureProvider<List<ChallengeItem>>((ref) async {
  final res = await apiClient.dio.get('$_base/challenges');
  return (res.data as List).map((e) => ChallengeItem.fromJson(Map<String, dynamic>.from(e))).toList();
});

final achievementsProvider = FutureProvider<List<AchievementItem>>((ref) async {
  final res = await apiClient.dio.get('$_base/achievements');
  return (res.data as List).map((e) => AchievementItem.fromJson(Map<String, dynamic>.from(e))).toList();
});

final streakProvider = FutureProvider<StreakData>((ref) async {
  final res = await apiClient.dio.get('$_base/streak');
  return StreakData.fromJson(Map<String, dynamic>.from(res.data));
});

final rewardsProvider = FutureProvider<RewardStore>((ref) async {
  final res = await apiClient.dio.get('$_base/rewards');
  return RewardStore.fromJson(Map<String, dynamic>.from(res.data));
});

final timelineProvider = FutureProvider<List<TimelineEvent>>((ref) async {
  final res = await apiClient.dio.get('$_base/timeline', queryParameters: {'limit': 50});
  return (res.data as List).map((e) => TimelineEvent.fromJson(Map<String, dynamic>.from(e))).toList();
});

// ---- Actions ----------------------------------------------------------------
class GamificationRepository {
  final Ref ref;
  GamificationRepository(this.ref);

  Future<String> checkin() async {
    final res = await apiClient.dio.post('$_base/checkin');
    _refreshCore();
    return res.data['message']?.toString() ?? 'Checked in';
  }

  Future<int> claimChallenge(int id) async {
    final res = await apiClient.dio.post('$_base/challenges/$id/claim');
    ref.invalidate(challengesProvider);
    _refreshCore();
    return (res.data['xp'] is int) ? res.data['xp'] : int.tryParse('${res.data['xp']}') ?? 0;
  }

  Future<void> redeemReward(int id) async {
    await apiClient.dio.post('$_base/rewards/$id/redeem');
    ref.invalidate(rewardsProvider);
    _refreshCore();
  }

  void _refreshCore() {
    ref.invalidate(gamiSummaryProvider);
    ref.invalidate(dailyGoalsProvider);
    ref.invalidate(xpTodayProvider);
    ref.invalidate(timelineProvider);
  }
}

final gamificationRepositoryProvider = Provider((ref) => GamificationRepository(ref));
