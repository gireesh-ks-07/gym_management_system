import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax/iconsax.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../data/gamification_models.dart';
import '../data/gamification_repository.dart';
import 'widgets/gami_widgets.dart';

class TimelineScreen extends ConsumerWidget {
  const TimelineScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(timelineProvider);
    return PulseShell(
      title: 'Activity',
      backRoute: '/gamification',
      showBottomNav: false,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(timelineProvider)),
        data: (events) {
          if (events.isEmpty) return const PulseEmpty(icon: Iconsax.clock, title: 'No activity yet', subtitle: 'Start earning XP to see your history!');
          return Column(
            children: List.generate(events.length, (i) => _tile(events[i], i)),
          );
        },
      ),
    );
  }

  Color _colorFor(String type) {
    switch (type) {
      case 'level_up': return PulseColors.primary;
      case 'badge_unlocked': return PulseColors.accent2;
      case 'challenge_completed': return PulseColors.accent;
      case 'league_promoted': return PulseColors.success;
      case 'league_relegated': return PulseColors.destructive;
      case 'reward_redeemed': return PulseColors.accentEnd;
      default: return PulseColors.warning;
    }
  }

  Widget _tile(TimelineEvent e, int i) {
    final color = _colorFor(e.type);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: PulseGlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        borderRadius: 16,
        child: Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: color.withOpacity(0.16), borderRadius: BorderRadius.circular(12)),
            child: Icon(gamiIcon(e.icon), color: color, size: 19),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(e.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              if (e.description.isNotEmpty)
                Text(e.description, style: TextStyle(color: PulseColors.textMuted, fontSize: 12)),
              Text(DateFormat('MMM d · h:mm a').format(e.createdAt.toLocal()), style: TextStyle(color: PulseColors.textMuted, fontSize: 10.5)),
            ]),
          ),
          if (e.xp != 0)
            Text('${e.xp > 0 ? '+' : ''}${e.xp}', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: e.xp > 0 ? PulseColors.accent : PulseColors.destructive)),
        ]),
      ),
    ).animate().fadeIn(delay: (i * 30).ms, duration: 250.ms).slideX(begin: 0.05, end: 0);
  }
}
