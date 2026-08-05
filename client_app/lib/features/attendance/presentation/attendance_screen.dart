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

class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key});

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  // First-of-month currently shown in the calendar. Null until data loads.
  DateTime? _month;

  static const _dark = Color(0xFF0F172A);

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(attendanceProvider);
    return PulseShell(
      title: 'Attendance',
      backRoute: '/dashboard',
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(attendanceProvider)),
        data: (data) => _content(data),
      ),
    );
  }

  Widget _content(AttendanceData data) {
    if (data.list.isEmpty) {
      return const PulseEmpty(
        icon: Iconsax.calendar_1,
        title: 'No check-ins yet',
        subtitle: 'Once you start visiting the gym, your attendance history will appear here.',
      );
    }

    // Map each recorded day → status.
    final byDay = <DateTime, String>{};
    for (final a in data.list) {
      if (a.date != null) {
        final d = a.date!.toLocal();
        byDay[DateTime(d.year, d.month, d.day)] = a.status;
      }
    }

    final latest = data.list.first.date?.toLocal() ?? DateTime.now();
    final month = _month ?? DateTime(latest.year, latest.month, 1);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _calendarCard(month, byDay).animate().fadeIn().slideY(begin: 0.06, end: 0),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(child: _statCard('Present', '${data.present}', PulseColors.accent)),
            const SizedBox(width: 12),
            Expanded(child: _statCard('Excused', '${data.excused}', PulseColors.warning)),
            const SizedBox(width: 12),
            Expanded(child: _statCard('Streak', '${data.streak}d', PulseColors.primary)),
          ],
        ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.06, end: 0),
        const SizedBox(height: 24),
        Text('Check-in history',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: PulseColors.foreground)),
        const SizedBox(height: 12),
        ...data.list.map(_row),
      ],
    );
  }

  // ── Calendar ──
  Widget _calendarCard(DateTime month, Map<DateTime, String> byDay) {
    const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    // Monday-first leading blanks: DateTime.weekday → Mon=1..Sun=7.
    final leadingBlanks = DateTime(month.year, month.month, 1).weekday - 1;
    final today = DateTime.now();
    final todayKey = DateTime(today.year, today.month, today.day);

    // % present for the visible month (over recorded days).
    int recorded = 0, present = 0;
    byDay.forEach((d, s) {
      if (d.year == month.year && d.month == month.month) {
        recorded++;
        if (s == 'present') present++;
      }
    });
    final pct = recorded == 0 ? null : ((present / recorded) * 100).round();

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
                Text('$pct% present',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: PulseColors.accent)),
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
          Row(
            children: [
              _legend(PulseColors.accent, 'Present'),
              const SizedBox(width: 16),
              _legend(PulseColors.destructive, 'Absent'),
              const SizedBox(width: 16),
              _legend(PulseColors.warning, 'Excused'),
              const SizedBox(width: 16),
              _legend(const Color(0xFF303B50), 'No visit'),
            ],
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
    Color bg = Colors.transparent;
    Color text = PulseColors.textMuted.withOpacity(isFuture ? 0.35 : 0.6);
    Border? border = Border.all(color: PulseColors.border, width: 1.4);

    switch (status) {
      case 'present':
        bg = PulseColors.accent;
        text = _dark;
        border = null;
        break;
      case 'absent':
        bg = PulseColors.destructive;
        text = Colors.white;
        border = null;
        break;
      case 'excused':
        bg = PulseColors.warning;
        text = _dark;
        border = null;
        break;
    }

    return Container(
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: isToday && status == null
            ? Border.all(color: PulseColors.primary, width: 1.6)
            : border,
      ),
      alignment: Alignment.center,
      child: Text('$day',
          style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isToday && status == null ? PulseColors.primary : text)),
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

  Widget _row(AttendanceEntry a) {
    final color = a.status == 'present'
        ? PulseColors.accent
        : a.status == 'excused'
            ? PulseColors.warning
            : PulseColors.destructive;
    final icon = a.status == 'absent' ? Iconsax.close_circle : Iconsax.tick_circle;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PulseGlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(Derive.date(a.date, pattern: 'EEE, dd MMM yyyy'),
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                  const SizedBox(height: 2),
                  Text(a.checkInTime != null ? 'Checked in ${a.checkInTime}' : 'No check-in time',
                      style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
                ],
              ),
            ),
            Text(Derive.titleCase(a.status),
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      ),
    );
  }
}
