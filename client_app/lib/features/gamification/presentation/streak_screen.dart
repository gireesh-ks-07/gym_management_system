import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../data/gamification_models.dart';
import '../data/gamification_repository.dart';
import 'widgets/gami_widgets.dart';

class StreakScreen extends ConsumerWidget {
  const StreakScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(streakProvider);
    return PulseShell(
      title: 'Streak',
      backRoute: '/gamification',
      showBottomNav: false,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(streakProvider)),
        data: (d) => _Content(d: d),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  final StreakData d;
  const _Content({required this.d});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PulseGlassCard(
          borderRadius: 24,
          child: Column(children: [
            const Icon(Iconsax.flash_15, size: 64, color: PulseColors.accent2)
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .scaleXY(begin: 1, end: 1.12, duration: 800.ms, curve: Curves.easeInOut)
                .tint(color: PulseColors.warning, duration: 800.ms),
            const SizedBox(height: 8),
            GamiCounter(d.currentStreak, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 44)),
            Text('day streak', style: TextStyle(color: PulseColors.textMuted, fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            Row(children: [
              _mini('Longest', '${d.longestStreak} days', Iconsax.crown_1, PulseColors.warning),
              const SizedBox(width: 12),
              _mini('Next Goal', d.nextMilestone == null ? 'Maxed' : '${d.nextMilestone} days', Iconsax.flag, PulseColors.primary),
            ]),
          ]),
        ).animate().fadeIn().slideY(begin: 0.06, end: 0),
        if (d.nextMilestone != null && d.daysToMilestone != null) ...[
          const SizedBox(height: 16),
          PulseGlassCard(
            borderRadius: 16,
            child: Row(children: [
              const Icon(Iconsax.gift, color: PulseColors.accent, size: 20),
              const SizedBox(width: 10),
              Expanded(child: Text('${d.daysToMilestone} more day${d.daysToMilestone == 1 ? '' : 's'} to reach a ${d.nextMilestone}-day streak reward!',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
            ]),
          ),
        ],
        const SizedBox(height: 22),
        const GamiSectionHeader('Activity · Last 16 Weeks'),
        const SizedBox(height: 12),
        _Heatmap(days: d.heatmap),
      ],
    );
  }

  Widget _mini(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
        decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          Text(label, style: TextStyle(color: PulseColors.textMuted, fontSize: 11)),
        ]),
      ),
    );
  }
}

class _Heatmap extends StatelessWidget {
  final List<StreakDay> days;
  const _Heatmap({required this.days});

  @override
  Widget build(BuildContext context) {
    // Build a 112-day grid (16 weeks) ending today.
    final today = DateTime.now();
    final map = {for (final d in days) d.date: d.xp};
    final cells = <Widget>[];
    for (int i = 111; i >= 0; i--) {
      final day = today.subtract(Duration(days: i));
      final key = '${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
      final xp = map[key] ?? 0;
      cells.add(Container(
        decoration: BoxDecoration(
          color: _cellColor(xp),
          borderRadius: BorderRadius.circular(4),
        ),
      ));
    }
    return PulseGlassCard(
      borderRadius: 18,
      child: GridView.count(
        crossAxisCount: 16,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 5,
        crossAxisSpacing: 5,
        children: cells,
      ),
    );
  }

  Color _cellColor(int xp) {
    if (xp <= 0) return Colors.white.withOpacity(0.06);
    if (xp < 50) return PulseColors.accent.withOpacity(0.35);
    if (xp < 120) return PulseColors.accent.withOpacity(0.6);
    return PulseColors.accent;
  }
}
