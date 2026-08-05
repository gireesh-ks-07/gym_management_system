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

class AchievementsScreen extends ConsumerWidget {
  const AchievementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(achievementsProvider);
    return PulseShell(
      title: 'Achievements',
      backRoute: '/gamification',
      showBottomNav: false,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(achievementsProvider)),
        data: (list) {
          if (list.isEmpty) return const PulseEmpty(icon: Iconsax.medal_star, title: 'No achievements available yet.');
          final unlocked = list.where((a) => a.unlocked).length;
          final byCat = <String, List<AchievementItem>>{};
          for (final a in list) {
            byCat.putIfAbsent(a.category, () => []).add(a);
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PulseGlassCard(
                borderRadius: 18,
                child: Row(children: [
                  const Icon(Iconsax.medal_star5, color: PulseColors.accent2, size: 30),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('$unlocked of ${list.length} unlocked', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    const SizedBox(height: 6),
                    GamiProgressBar(percent: list.isEmpty ? 0 : unlocked / list.length, gradient: PulseColors.flameGradient, height: 8),
                  ])),
                ]),
              ),
              const SizedBox(height: 20),
              for (final entry in byCat.entries) ...[
                GamiSectionHeader(_titleCase(entry.key)),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 3,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.82,
                  children: entry.value.map((a) => _badge(a)).toList(),
                ),
                const SizedBox(height: 18),
              ],
            ],
          );
        },
      ),
    );
  }

  String _titleCase(String s) => s.isEmpty ? s : s.split('_').map((w) => w[0].toUpperCase() + w.substring(1)).join(' ');

  Widget _badge(AchievementItem a) {
    final locked = !a.unlocked;
    return Opacity(
      opacity: locked ? 0.45 : 1,
      child: PulseGlassCard(
        padding: const EdgeInsets.all(10),
        borderRadius: 16,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(
                gradient: locked ? null : PulseColors.flameGradient,
                color: locked ? Colors.white.withOpacity(0.06) : null,
                shape: BoxShape.circle,
              ),
              child: Icon(locked ? Iconsax.lock : gamiIcon(a.icon), size: 22, color: locked ? PulseColors.textMuted : Colors.white),
            ),
            const SizedBox(height: 8),
            Text(a.name, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700)),
            if (a.rewardXp > 0)
              Text('+${a.rewardXp}', style: const TextStyle(fontSize: 10, color: PulseColors.accent, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 250.ms).scale(begin: const Offset(0.9, 0.9), curve: Curves.easeOut);
  }
}
