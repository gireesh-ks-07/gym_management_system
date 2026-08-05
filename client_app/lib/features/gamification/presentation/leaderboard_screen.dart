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

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});
  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen> {
  String period = 'weekly';
  static const periods = ['daily', 'weekly', 'monthly'];

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(leaderboardProvider(period));
    return PulseShell(
      title: 'Leaderboard',
      backRoute: '/gamification',
      showBottomNav: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _segmented(),
          const SizedBox(height: 18),
          async.when(
            loading: () => const PulseLoading(),
            error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(leaderboardProvider(period))),
            data: (rows) {
              if (rows.isEmpty) return const PulseEmpty(icon: Iconsax.ranking, title: 'No ranked members yet', subtitle: 'Be the first to earn XP this period.');
              final top3 = rows.take(3).toList();
              final rest = rows.skip(3).toList();
              return Column(
                children: [
                  _Podium(top3: top3),
                  const SizedBox(height: 16),
                  ...rest.map((r) => _row(r)),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _segmented() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(999)),
      child: Row(
        children: periods.map((p) {
          final sel = p == period;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => period = p),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 9),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: sel ? PulseColors.primaryGradient : null,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(p[0].toUpperCase() + p.substring(1),
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: sel ? Colors.white : PulseColors.textMuted)),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _row(LeaderEntry r) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: PulseGlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        borderRadius: 16,
        color: r.isCurrentUser ? PulseColors.primary.withOpacity(0.14) : null,
        child: Row(children: [
          SizedBox(width: 28, child: Text('${r.rank}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
          CircleAvatar(radius: 18, backgroundColor: PulseColors.surface2, child: Text(r.name.isNotEmpty ? r.name[0].toUpperCase() : '?', style: const TextStyle(fontWeight: FontWeight.w700))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              Row(children: [
                Text('Lv ${r.level}', style: TextStyle(color: PulseColors.textMuted, fontSize: 11)),
                if (r.currentStreak > 0) ...[
                  const SizedBox(width: 8),
                  const Icon(Iconsax.flash_1, size: 11, color: PulseColors.accent2),
                  Text(' ${r.currentStreak}', style: TextStyle(color: PulseColors.textMuted, fontSize: 11)),
                ],
              ]),
            ]),
          ),
          Text('${r.xp}', style: const TextStyle(fontWeight: FontWeight.w800, color: PulseColors.accent, fontSize: 14)),
          const SizedBox(width: 2),
          Text('XP', style: TextStyle(color: PulseColors.textMuted, fontSize: 10)),
        ]),
      ),
    ).animate().fadeIn(duration: 250.ms);
  }
}

class _Podium extends StatelessWidget {
  final List<LeaderEntry> top3;
  const _Podium({required this.top3});

  @override
  Widget build(BuildContext context) {
    LeaderEntry? at(int i) => i < top3.length ? top3[i] : null;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(child: _pillar(at(1), 2, 96, const Color(0xFFC0C0C0))),
        Expanded(child: _pillar(at(0), 1, 122, const Color(0xFFFFD700))),
        Expanded(child: _pillar(at(2), 3, 78, const Color(0xFFCD7F32))),
      ],
    );
  }

  Widget _pillar(LeaderEntry? r, int place, double height, Color medal) {
    if (r == null) return const SizedBox.shrink();
    return Column(
      children: [
        CircleAvatar(radius: place == 1 ? 30 : 24, backgroundColor: PulseColors.surface2,
            child: Text(r.name.isNotEmpty ? r.name[0].toUpperCase() : '?', style: TextStyle(fontWeight: FontWeight.w800, fontSize: place == 1 ? 22 : 18))),
        const SizedBox(height: 6),
        Text(r.name.split(' ').first, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
        Text('${r.xp} XP', style: const TextStyle(color: PulseColors.accent, fontWeight: FontWeight.w800, fontSize: 12)),
        const SizedBox(height: 6),
        Container(
          height: height,
          margin: const EdgeInsets.symmetric(horizontal: 6),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [medal.withOpacity(0.85), medal.withOpacity(0.35)], begin: Alignment.topCenter, end: Alignment.bottomCenter),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
          ),
          alignment: Alignment.topCenter,
          padding: const EdgeInsets.only(top: 8),
          child: Text('$place', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Colors.white)),
        ),
      ],
    ).animate().fadeIn(duration: 350.ms).slideY(begin: 0.2, end: 0);
  }
}
