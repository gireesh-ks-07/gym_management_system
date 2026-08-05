import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../data/gamification_models.dart';
import '../data/gamification_repository.dart';
import 'widgets/gami_widgets.dart';

class GamificationScreen extends ConsumerWidget {
  const GamificationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(gamiSummaryProvider);
    return PulseShell(
      showBottomNav: true,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(gamiSummaryProvider)),
        data: (s) => _Content(summary: s),
      ),
    );
  }
}

class _Content extends ConsumerWidget {
  final GamiSummary summary;
  const _Content({required this.summary});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 4),
        Row(
          children: [
            const Text('Rewards', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
            const SizedBox(width: 8),
            const Icon(Iconsax.cup5, color: PulseColors.warning, size: 24),
            const Spacer(),
            PulseGlassCard(
              padding: EdgeInsets.zero,
              borderRadius: 14,
              onTap: () => context.go('/gamification/timeline'),
              child: const SizedBox(width: 42, height: 42, child: Icon(Iconsax.clock, size: 19)),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _HeroCard(summary: summary).animate().fadeIn().slideY(begin: 0.06, end: 0),
        const SizedBox(height: 22),
        const _TodayXp().animate().fadeIn(delay: 100.ms),
        const SizedBox(height: 22),
        const GamiSectionHeader('Daily Goals'),
        const SizedBox(height: 12),
        const _DailyGoals(),
        const SizedBox(height: 22),
        const GamiSectionHeader('Explore'),
        const SizedBox(height: 12),
        _NavTiles(),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _HeroCard extends StatelessWidget {
  final GamiSummary s;
  const _HeroCard({required GamiSummary summary}) : s = summary;

  @override
  Widget build(BuildContext context) {
    final leagueColor = s.league == null ? PulseColors.warning : hexColor(s.league!.color, PulseColors.warning);
    return PulseGlassCard(
      padding: const EdgeInsets.all(20),
      borderRadius: 24,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 58, height: 58,
                decoration: const BoxDecoration(gradient: PulseColors.primaryGradient, shape: BoxShape.circle),
                alignment: Alignment.center,
                child: Text('${s.level}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: Colors.white)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Level ${s.level}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                    Text(s.title.isEmpty ? 'Keep pushing to level up' : s.title,
                        style: TextStyle(color: PulseColors.textMuted, fontSize: 12.5)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  GamiCounter(s.totalXp, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: PulseColors.accent), suffix: ''),
                  Text('XP balance', style: TextStyle(color: PulseColors.textMuted, fontSize: 11)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${s.progress.xpIntoLevel} XP', style: TextStyle(fontSize: 11.5, color: PulseColors.textMuted)),
              Text('${s.progress.xpForNextLevel} XP to Lv ${s.level + 1}', style: TextStyle(fontSize: 11.5, color: PulseColors.textMuted)),
            ],
          ),
          const SizedBox(height: 6),
          GamiProgressBar(percent: s.progress.percent / 100),
          const SizedBox(height: 18),
          Row(
            children: [
              _stat(Iconsax.cup, s.league?.name ?? 'Unranked', 'League', leagueColor),
              _divider(),
              _stat(Iconsax.medal_star, s.weeklyRank == null ? '—' : '#${s.weeklyRank}', 'Weekly Rank', PulseColors.primary),
              _divider(),
              _stat(Iconsax.flash_1, '${s.currentStreak}', 'Day Streak', PulseColors.accent2),
            ],
          ),
          if (s.nextRewardName != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(14)),
              child: Row(children: [
                const Icon(Iconsax.gift, size: 18, color: PulseColors.accent),
                const SizedBox(width: 10),
                Expanded(child: Text('Next reward: ${s.nextRewardName}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600))),
                Text('${s.nextRewardCost} XP', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: PulseColors.accent)),
              ]),
            ),
          ],
        ],
      ),
    );
  }

  Widget _divider() => Container(width: 1, height: 34, color: Colors.white.withOpacity(0.08));

  Widget _stat(IconData icon, String value, String label, Color color) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 5),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
          Text(label, style: TextStyle(color: PulseColors.textMuted, fontSize: 10)),
        ],
      ),
    );
  }
}

class _TodayXp extends ConsumerWidget {
  const _TodayXp();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(xpTodayProvider);
    return async.maybeWhen(
      data: (x) => PulseGlassCard(
        borderRadius: 20,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Iconsax.flash_1, color: PulseColors.accent2, size: 20),
              const SizedBox(width: 8),
              const Text("Today's XP", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              const Spacer(),
              GamiCounter(x.total, prefix: '+', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24, color: PulseColors.accent2)),
            ]),
            if (x.breakdown.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8, runSpacing: 8,
                children: x.breakdown.map((b) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.06), borderRadius: BorderRadius.circular(999)),
                  child: Text('${b.label} +${b.xp}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600)),
                )).toList(),
              ),
            ] else
              Padding(padding: EdgeInsets.only(top: 8), child: Text('No XP earned yet today — complete a goal!', style: TextStyle(color: PulseColors.textMuted, fontSize: 12.5))),
          ],
        ),
      ),
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _DailyGoals extends ConsumerWidget {
  const _DailyGoals();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(dailyGoalsProvider);
    return async.maybeWhen(
      data: (goals) => Column(
        children: goals.map((g) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: PulseGlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            borderRadius: 16,
            child: Row(children: [
              Container(
                width: 38, height: 38,
                decoration: BoxDecoration(
                  color: g.completed ? PulseColors.accent.withOpacity(0.18) : Colors.white.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(gamiIcon(g.icon), size: 18, color: g.completed ? PulseColors.accent : PulseColors.textMuted),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(g.label, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5, color: g.completed ? PulseColors.foreground : PulseColors.textMuted))),
              Text('+${g.xp}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: PulseColors.accent)),
              const SizedBox(width: 10),
              g.completed
                  ? const Icon(Iconsax.tick_circle5, color: PulseColors.accent, size: 22).animate().scale(duration: 300.ms, curve: Curves.elasticOut)
                  : Icon(Iconsax.tick_circle, color: PulseColors.textMuted, size: 22),
            ]),
          ),
        )).toList(),
      ),
      orElse: () => const PulseLoading(),
    );
  }
}

class _NavTiles extends StatelessWidget {
  final tiles = const [
    (_Tile(icon: Iconsax.ranking, label: 'Leaderboard', route: '/gamification/leaderboard', color: PulseColors.primary)),
    (_Tile(icon: Iconsax.cup, label: 'League', route: '/gamification/league', color: PulseColors.warning)),
    (_Tile(icon: Iconsax.designtools, label: 'Challenges', route: '/gamification/challenges', color: PulseColors.accent)),
    (_Tile(icon: Iconsax.medal_star, label: 'Achievements', route: '/gamification/achievements', color: PulseColors.accent2)),
    (_Tile(icon: Iconsax.flash_1, label: 'Streak', route: '/gamification/streak', color: PulseColors.destructive)),
    (_Tile(icon: Iconsax.gift, label: 'Store', route: '/gamification/rewards', color: PulseColors.accentEnd)),
  ];

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 0.92,
      children: tiles.map((t) => PulseGlassCard(
        borderRadius: 18,
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        onTap: () => context.go(t.route),
        // FittedBox guarantees the content scales down to fit any cell size,
        // so the grid can never overflow regardless of available width.
        child: Center(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 42, height: 42,
                  decoration: BoxDecoration(color: t.color.withOpacity(0.16), borderRadius: BorderRadius.circular(13)),
                  child: Icon(t.icon, color: t.color, size: 20),
                ),
                const SizedBox(height: 8),
                Text(t.label, maxLines: 1, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11)),
              ],
            ),
          ),
        ),
      )).toList(),
    );
  }
}

class _Tile {
  final IconData icon;
  final String label;
  final String route;
  final Color color;
  const _Tile({required this.icon, required this.label, required this.route, required this.color});
}
