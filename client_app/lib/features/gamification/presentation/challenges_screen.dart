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

class ChallengesScreen extends ConsumerWidget {
  const ChallengesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(challengesProvider);
    return PulseShell(
      title: 'Challenges',
      backRoute: '/gamification',
      showBottomNav: false,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(challengesProvider)),
        data: (list) {
          if (list.isEmpty) return const PulseEmpty(icon: Iconsax.designtools, title: 'No active challenges', subtitle: 'Check back tomorrow for new challenges!');
          final byType = <String, List<ChallengeItem>>{};
          for (final c in list) {
            byType.putIfAbsent(c.type, () => []).add(c);
          }
          const order = ['daily', 'weekly', 'monthly', 'seasonal'];
          final types = byType.keys.toList()..sort((a, b) => order.indexOf(a).compareTo(order.indexOf(b)));
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final t in types) ...[
                GamiSectionHeader('${t[0].toUpperCase()}${t.substring(1)} Challenges'),
                const SizedBox(height: 12),
                ...byType[t]!.map((c) => _ChallengeCard(c: c)),
                const SizedBox(height: 14),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _ChallengeCard extends ConsumerStatefulWidget {
  final ChallengeItem c;
  const _ChallengeCard({required this.c});
  @override
  ConsumerState<_ChallengeCard> createState() => _ChallengeCardState();
}

class _ChallengeCardState extends ConsumerState<_ChallengeCard> {
  bool _busy = false;

  Future<void> _claim() async {
    setState(() => _busy = true);
    try {
      final xp = await ref.read(gamificationRepositoryProvider).claimChallenge(widget.c.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          backgroundColor: PulseColors.accent,
          content: Text('🎉 +$xp XP claimed!', style: const TextStyle(fontWeight: FontWeight.w700)),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not claim reward')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    final diff = difficultyColors[c.difficulty] ?? PulseColors.textMuted;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PulseGlassCard(
        borderRadius: 18,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text(c.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: diff.withOpacity(0.16), borderRadius: BorderRadius.circular(8)),
                child: Text(c.difficulty, style: TextStyle(color: diff, fontSize: 10.5, fontWeight: FontWeight.w700)),
              ),
            ]),
            if (c.description.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(c.description, style: TextStyle(color: PulseColors.textMuted, fontSize: 12.5)),
            ],
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: GamiProgressBar(percent: c.percent / 100, gradient: PulseColors.accentGradient, height: 8)),
              const SizedBox(width: 10),
              Text('${c.progress}/${c.target}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: PulseColors.textMuted)),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              const Icon(Iconsax.flash_1, size: 15, color: PulseColors.accent),
              const SizedBox(width: 4),
              Text('+${c.xpReward} XP', style: const TextStyle(fontWeight: FontWeight.w800, color: PulseColors.accent, fontSize: 13)),
              const Spacer(),
              _actionButton(c),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _actionButton(ChallengeItem c) {
    if (c.claimed) {
      return const Row(children: [
        Icon(Iconsax.tick_circle5, size: 16, color: PulseColors.success),
        SizedBox(width: 4),
        Text('Claimed', style: TextStyle(color: PulseColors.success, fontWeight: FontWeight.w700, fontSize: 12.5)),
      ]);
    }
    if (c.completed) {
      return GestureDetector(
        onTap: _busy ? null : _claim,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(gradient: PulseColors.accentGradient, borderRadius: BorderRadius.circular(999)),
          child: _busy
              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Claim', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12.5)),
        ),
      ).animate(onPlay: (con) => con.repeat(reverse: true)).scaleXY(begin: 1, end: 1.05, duration: 700.ms);
    }
    return Text('In progress', style: TextStyle(color: PulseColors.textMuted, fontSize: 12));
  }
}
