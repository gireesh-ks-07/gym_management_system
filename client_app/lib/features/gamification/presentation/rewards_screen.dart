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

class RewardsScreen extends ConsumerWidget {
  const RewardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(rewardsProvider);
    return PulseShell(
      title: 'Rewards Store',
      backRoute: '/gamification',
      showBottomNav: false,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(rewardsProvider)),
        data: (store) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PulseGlassCard(
              borderRadius: 18,
              color: PulseColors.accent.withOpacity(0.14),
              child: Row(children: [
                const Icon(Iconsax.wallet_3, color: PulseColors.accent, size: 26),
                const SizedBox(width: 12),
                const Text('Your Balance', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                const Spacer(),
                GamiCounter(store.balance, suffix: ' XP', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: PulseColors.accent)),
              ]),
            ).animate().fadeIn(),
            const SizedBox(height: 20),
            if (store.rewards.isEmpty)
              const PulseEmpty(icon: Iconsax.gift, title: 'No rewards available yet', subtitle: 'Check back soon for new rewards!')
            else
              ...store.rewards.map((r) => _RewardCard(reward: r)),
          ],
        ),
      ),
    );
  }
}

class _RewardCard extends ConsumerStatefulWidget {
  final RewardItem reward;
  const _RewardCard({required this.reward});
  @override
  ConsumerState<_RewardCard> createState() => _RewardCardState();
}

class _RewardCardState extends ConsumerState<_RewardCard> {
  bool _busy = false;

  Future<void> _redeem() async {
    final r = widget.reward;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: PulseColors.surface,
        title: const Text('Redeem reward?'),
        content: Text('Spend ${r.xpCost} XP on "${r.name}"? Your request will be sent to staff for collection.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Redeem', style: TextStyle(color: PulseColors.accent, fontWeight: FontWeight.w700))),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(gamificationRepositoryProvider).redeemReward(r.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          backgroundColor: PulseColors.accent,
          content: Text('🎁 Redeemed! Pending collection.', style: TextStyle(fontWeight: FontWeight.w700)),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not redeem reward')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.reward;
    final canRedeem = r.available && r.affordable && !_busy;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PulseGlassCard(
        borderRadius: 18,
        child: Row(children: [
          Container(
            width: 54, height: 54,
            decoration: BoxDecoration(gradient: PulseColors.accentGradient, borderRadius: BorderRadius.circular(14)),
            child: const Icon(Iconsax.gift, color: Colors.white, size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
              if (r.description.isNotEmpty)
                Text(r.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: PulseColors.textMuted, fontSize: 12)),
              const SizedBox(height: 4),
              Text('${r.xpCost} XP', style: const TextStyle(fontWeight: FontWeight.w800, color: PulseColors.accent, fontSize: 13)),
            ]),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: canRedeem ? _redeem : null,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
              decoration: BoxDecoration(
                gradient: canRedeem ? PulseColors.primaryGradient : null,
                color: canRedeem ? null : Colors.white.withOpacity(0.06),
                borderRadius: BorderRadius.circular(999),
              ),
              child: _busy
                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(!r.available ? 'Sold out' : (r.affordable ? 'Redeem' : 'Locked'),
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: canRedeem ? Colors.white : PulseColors.textMuted)),
            ),
          ),
        ]),
      ),
    );
  }
}
