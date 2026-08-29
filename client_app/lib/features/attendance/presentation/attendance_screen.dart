import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax/iconsax.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../../../core/theme/pulse_colors.dart';
import '../../../core/util/derive.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../../member/data/member_controller.dart';
import '../../member/data/member_model.dart';

/// Training status theme — mirrors the web admin's workout calendar
/// (STATUS_THEME in HealthProfile.jsx): Completed / Missed / Off Day / Cardio.
class _StatusInfo {
  final String label;
  final Color color;
  final IconData icon;
  const _StatusInfo(this.label, this.color, this.icon);
}

const Map<String, _StatusInfo> _kStatus = {
  'done': _StatusInfo('Completed', PulseColors.success, Iconsax.tick_circle),
  'missed': _StatusInfo('Missed', PulseColors.destructive, Iconsax.close_circle),
  'off_day': _StatusInfo('Off Day', PulseColors.warning, Iconsax.moon),
  'cardio': _StatusInfo('Cardio', PulseColors.primary, Iconsax.activity),
};

class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key});

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  DateTime? _month;
  static const _dark = Color(0xFF0F172A);

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(meProvider);
    return PulseShell(
      title: 'Attendance',
      backRoute: '/dashboard',
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(meProvider)),
        data: (me) => _content(me),
      ),
    );
  }

  Widget _content(MemberMe me) {
    // Build day → training status from the workout calendar.
    final byDay = <DateTime, String>{};
    DateTime? latest;
    for (final e in me.client.health.workoutCalendar) {
      final d = Derive.parseDate(e['date']);
      final s = e['status']?.toString();
      if (d != null && s != null && _kStatus.containsKey(s)) {
        final key = DateTime(d.year, d.month, d.day);
        byDay[key] = s;
        if (latest == null || key.isAfter(latest)) latest = key;
      }
    }

    if (byDay.isEmpty) {
      return const PulseEmpty(
        icon: Iconsax.calendar_1,
        title: 'No training logged yet',
        subtitle: 'Your completed workouts, cardio and rest days will show up here.',
      );
    }

    int completed = 0, missed = 0, cardio = 0;
    byDay.forEach((_, s) {
      if (s == 'done') completed++;
      if (s == 'missed') missed++;
      if (s == 'cardio') cardio++;
    });

    final month = _month ?? DateTime(latest!.year, latest.month, 1);

    // Recent events, newest first.
    final events = me.client.health.workoutCalendar
        .where((e) => Derive.parseDate(e['date']) != null && _kStatus.containsKey(e['status']?.toString()))
        .toList()
      ..sort((a, b) => Derive.parseDate(b['date'])!.compareTo(Derive.parseDate(a['date'])!));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _calendarCard(month, byDay).animate().fadeIn().slideY(begin: 0.06, end: 0),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(child: _statCard('Completed', '$completed', PulseColors.success)),
            const SizedBox(width: 12),
            Expanded(child: _statCard('Cardio', '$cardio', PulseColors.primary)),
            const SizedBox(width: 12),
            Expanded(child: _statCard('Missed', '$missed', PulseColors.destructive)),
          ],
        ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.06, end: 0),
        const SizedBox(height: 24),
        Text('Training history',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: PulseColors.foreground)),
        const SizedBox(height: 12),
        ...events.take(20).map(_row),
      ],
    );
  }

  // ── Calendar ──
  Widget _calendarCard(DateTime month, Map<DateTime, String> byDay) {
    const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final leadingBlanks = DateTime(month.year, month.month, 1).weekday - 1;
    final today = DateTime.now();
    final todayKey = DateTime(today.year, today.month, today.day);

    int done = 0, tracked = 0;
    byDay.forEach((d, s) {
      if (d.year == month.year && d.month == month.month) {
        tracked++;
        if (s == 'done' || s == 'cardio') done++;
      }
    });
    final pct = tracked == 0 ? null : ((done / tracked) * 100).round();

    final cells = <Widget>[];
    for (var i = 0; i < leadingBlanks; i++) {
      cells.add(const SizedBox.shrink());
    }
    for (var day = 1; day <= daysInMonth; day++) {
      final key = DateTime(month.year, month.month, day);
      cells.add(_dayCircle(day, byDay[key], isToday: key == todayKey, isFuture: key.isAfter(todayKey)));
    }

    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Iconsax.calendar_1, color: PulseColors.primary, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Text(DateFormat('MMMM yyyy').format(month),
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
              ),
              if (pct != null)
                Text('$pct% done',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: PulseColors.success)),
              const SizedBox(width: 6),
              _navBtn(Iconsax.arrow_left_2, () => setState(() => _month = DateTime(month.year, month.month - 1, 1))),
              const SizedBox(width: 4),
              _navBtn(Iconsax.arrow_right_3,
                  today.year == month.year && today.month == month.month
                      ? null
                      : () => setState(() => _month = DateTime(month.year, month.month + 1, 1))),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: weekdays
                .map((d) => Expanded(
                      child: Center(
                        child: Text(d,
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: PulseColors.textMuted)),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 6,
            mainAxisSpacing: 10,
            childAspectRatio: 1,
            children: cells,
          ),
          const SizedBox(height: 16),
          Divider(color: PulseColors.border, height: 1),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 10,
            children: _kStatus.values.map((s) => _legend(s.color, s.label)).toList(),
          ),
        ],
      ),
    );
  }

  Widget _navBtn(IconData icon, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(color: PulseColors.input, borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, size: 15, color: onTap == null ? PulseColors.textMuted.withOpacity(0.3) : PulseColors.foreground),
      ),
    );
  }

  Widget _dayCircle(int day, String? status, {required bool isToday, required bool isFuture}) {
    final info = status == null ? null : _kStatus[status];
    Color bg = Colors.transparent;
    Color text = PulseColors.textMuted.withOpacity(isFuture ? 0.35 : 0.6);
    Border? border = Border.all(color: PulseColors.border, width: 1.4);

    if (info != null) {
      bg = info.color;
      // Missed uses white text (dark-red bg); the lighter greens/ambers use dark text.
      text = status == 'missed' ? Colors.white : _dark;
      border = null;
    }

    return Container(
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: isToday && info == null ? Border.all(color: PulseColors.primary, width: 1.6) : border,
      ),
      alignment: Alignment.center,
      child: Text('$day',
          style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isToday && info == null ? PulseColors.primary : text)),
    );
  }

  Widget _legend(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 9, height: 9, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: PulseColors.textMuted)),
      ],
    );
  }

  // ── Stats + history ──
  Widget _statCard(String label, String value, Color color) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: color)),
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> e) {
    final status = e['status']?.toString() ?? '';
    final info = _kStatus[status] ?? _StatusInfo('—', PulseColors.textMuted, Iconsax.minus);
    final date = Derive.parseDate(e['date']);
    final focus = (e['focus'] ?? '').toString();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PulseGlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: info.color.withOpacity(0.15), shape: BoxShape.circle),
              child: Icon(info.icon, color: info.color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(Derive.date(date, pattern: 'EEE, dd MMM yyyy'),
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                  const SizedBox(height: 2),
                  Text(focus.isNotEmpty ? focus : info.label,
                      style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: info.color.withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
              child: Text(info.label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: info.color)),
            ),
          ],
        ),
      ),
    );
  }
}
