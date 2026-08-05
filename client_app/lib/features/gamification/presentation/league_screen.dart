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

class LeagueScreen extends ConsumerWidget {
  const LeagueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(leagueProvider);
    return PulseShell(
      title: 'League',
      backRoute: '/gamification',
      showBottomNav: false,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(leagueProvider)),
        data: (d) => _Content(d: d),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  final LeagueStanding d;
  const _Content({required this.d});

  @override
  Widget build(BuildContext context) {
    final color = d.league == null ? PulseColors.warning : hexColor(d.league!.color, PulseColors.warning);
    final total = d.standings.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PulseGlassCard(
          borderRadius: 22,
          child: Column(children: [
            Container(
              width: 72, height: 72,
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [color, color.withOpacity(0.5)]),
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: color.withOpacity(0.5), blurRadius: 24)],
              ),
              child: const Icon(Iconsax.cup5, color: Colors.white, size: 34),
            ),
            const SizedBox(height: 12),
            Text('${d.league?.name ?? 'Unranked'} League', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20)),
            Text(d.myRank == null ? 'Earn XP this week to rank up' : 'You are ranked #${d.myRank} this week',
                style: TextStyle(color: PulseColors.textMuted, fontSize: 13)),
            const SizedBox(height: 14),
            Row(children: [
              _zoneChip(Iconsax.arrow_up_3, 'Top ${d.promotionZone} promote', PulseColors.success),
              const SizedBox(width: 10),
              _zoneChip(Iconsax.arrow_down, 'Bottom ${d.relegationZone} relegate', PulseColors.destructive),
            ]),
          ]),
        ).animate().fadeIn().slideY(begin: 0.06, end: 0),
        const SizedBox(height: 20),
        const GamiSectionHeader('This Week\'s Standings'),
        const SizedBox(height: 12),
        if (d.standings.isEmpty)
          const PulseEmpty(icon: Iconsax.cup, title: 'No members in your league yet', subtitle: 'Earn XP this week to populate your league.')
        else
          ...List.generate(d.standings.length, (i) {
            final r = d.standings[i];
            final inPromo = i < d.promotionZone;
            final inRelegation = i >= total - d.relegationZone && d.relegationZone > 0;
            final edge = inPromo ? PulseColors.success : (inRelegation ? PulseColors.destructive : Colors.transparent);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: PulseGlassCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                borderRadius: 16,
                color: r.isCurrentUser ? PulseColors.primary.withOpacity(0.14) : null,
                child: Row(children: [
                  Container(width: 4, height: 34, decoration: BoxDecoration(color: edge, borderRadius: BorderRadius.circular(4))),
                  const SizedBox(width: 12),
                  SizedBox(width: 24, child: Text('${r.rank}', style: const TextStyle(fontWeight: FontWeight.w800))),
                  Expanded(child: Text(r.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: r.isCurrentUser ? PulseColors.foreground : null))),
                  Text('${r.xp} XP', style: const TextStyle(fontWeight: FontWeight.w800, color: PulseColors.accent)),
                ]),
              ),
            );
          }),
      ],
    );
  }

  Widget _zoneChip(IconData icon, String label, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
        decoration: BoxDecoration(color: color.withOpacity(0.14), borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color))),
        ]),
      ),
    );
  }
}
