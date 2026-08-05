import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../core/util/derive.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_ring.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../../member/data/member_controller.dart';
import '../../member/data/member_model.dart';

class WorkoutScreen extends ConsumerWidget {
  const WorkoutScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(meProvider);
    return PulseShell(
      title: 'My Workout',
      backRoute: '/dashboard',
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(meProvider)),
        data: (me) => _content(context, me),
      ),
    );
  }

  Widget _content(BuildContext context, MemberMe me) {
    final h = me.client.health;
    final schedule = h.currentSchedule;
    final plans = me.client.workoutPlans;

    if (schedule == null && plans.isEmpty) {
      return const PulseEmpty(
        icon: Iconsax.weight_1,
        title: 'No workout plan yet',
        subtitle: 'Your trainer will assign a program and it will show up here.',
      );
    }

    final days = (schedule?['days'] as List?)?.whereType<Map>().toList() ?? [];
    final done = h.workoutCalendar.where((e) => e['status'] == 'done').length;
    final missed = h.workoutCalendar.where((e) => e['status'] == 'missed').length;
    final total = done + missed;
    final progress = total == 0 ? 0 : ((done / total) * 100).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (schedule != null) ...[
          _scheduleCard(schedule, progress, done, days.length).animate().fadeIn().slideY(begin: 0.06, end: 0),
          const SizedBox(height: 24),
          _heading('Program'),
          const SizedBox(height: 12),
          ...days.asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _dayCard(Map<String, dynamic>.from(e.value)),
              )),
        ],
        if (plans.isNotEmpty) ...[
          const SizedBox(height: 12),
          _heading('Scheduled sessions'),
          const SizedBox(height: 12),
          ...plans.whereType<Map>().take(6).map((p) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _sessionCard(Map<String, dynamic>.from(p)),
              )),
        ],
      ],
    );
  }

  Widget _heading(String t) => Text(t,
      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: PulseColors.foreground));

  Widget _scheduleCard(Map<String, dynamic> s, int progress, int done, int dayCount) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          PulseRing(
            percent: progress.toDouble(),
            color: PulseColors.primary,
            size: 92,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$progress%',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, height: 1, color: PulseColors.foreground)),
                const SizedBox(height: 3),
                Text('DONE',
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1, color: PulseColors.textMuted)),
              ],
            ),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(s['name']?.toString() ?? 'Program',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
                const SizedBox(height: 4),
                Text('$dayCount training days · started ${Derive.date(s['startDate'], pattern: 'dd MMM')}',
                    style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
                const SizedBox(height: 8),
                Text('$done sessions completed',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: PulseColors.primary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _dayCard(Map<String, dynamic> day) {
    final exercises = (day['exercises'] as List?)?.whereType<Map>().toList() ?? [];
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: PulseColors.primary.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                child: Text('Day ${day['dayNumber'] ?? '?'}',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PulseColors.primary)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(day['focus']?.toString() ?? 'Workout',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
              ),
            ],
          ),
          if (exercises.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...exercises.map((ex) {
              final e = Map<String, dynamic>.from(ex);
              final detail = <String>[
                if (e['sets'] != null) '${e['sets']} sets',
                if ((e['reps']?.toString() ?? '').isNotEmpty) '${e['reps']} reps',
                if (e['weight'] != null) '${e['weight']} kg',
              ].join(' · ');
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      margin: const EdgeInsets.only(right: 10),
                      decoration: const BoxDecoration(color: PulseColors.primary, shape: BoxShape.circle),
                    ),
                    Expanded(
                      child: Text(e['name']?.toString() ?? '',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: PulseColors.foreground)),
                    ),
                    Text(detail, style: TextStyle(fontSize: 12, color: PulseColors.textMuted)),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _sessionCard(Map<String, dynamic> p) {
    final status = p['status']?.toString() ?? 'scheduled';
    final color = status == 'completed' ? PulseColors.accent : PulseColors.primary;
    return PulseGlassCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
            child: Icon(Iconsax.calendar_1, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p['title']?.toString() ?? 'Session',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                Text(Derive.date(p['scheduledFor'], pattern: 'EEE, dd MMM'),
                    style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
              ],
            ),
          ),
          Text(Derive.titleCase(status),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
        ],
      ),
    );
  }
}
