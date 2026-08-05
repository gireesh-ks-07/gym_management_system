import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../core/util/derive.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../../member/data/member_controller.dart';
import '../../member/data/member_model.dart';

class PaymentsScreen extends ConsumerWidget {
  const PaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(meProvider);
    return PulseShell(
      title: 'Payments',
      backRoute: '/dashboard',
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(meProvider)),
        data: (me) => _content(me),
      ),
    );
  }

  Widget _content(MemberMe me) {
    final c = me.client;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _planCard(c).animate().fadeIn().slideY(begin: 0.06, end: 0),
        if (c.hasDue) ...[
          const SizedBox(height: 16),
          _dueBanner(),
        ],
        const SizedBox(height: 24),
        Text('Payment history',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: PulseColors.foreground)),
        const SizedBox(height: 12),
        if (me.recentPayments.isEmpty)
          const PulseEmpty(
            icon: Iconsax.receipt_1,
            title: 'No payments yet',
            subtitle: 'Your invoices and receipts will appear here.',
          )
        else
          ...me.recentPayments.map(_paymentRow),
      ],
    );
  }

  Widget _planCard(Client c) {
    return Container(
      decoration: BoxDecoration(
        gradient: PulseColors.primaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: PulseColors.primary.withOpacity(0.3), blurRadius: 24, offset: const Offset(0, 8))],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('CURRENT PLAN',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.5, color: Colors.white.withOpacity(0.7))),
                    const SizedBox(height: 6),
                    Text(c.plan?.name ?? 'No plan',
                        style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white)),
                    const SizedBox(height: 4),
                    if (c.plan != null)
                      Text('${Derive.money(c.plan!.price)} · ${c.plan!.duration} month${c.plan!.duration == 1 ? '' : 's'}',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white.withOpacity(0.85))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(color: Colors.black.withOpacity(0.22), borderRadius: BorderRadius.circular(999)),
                child: Text(c.status.replaceAll('_', ' ').toUpperCase(),
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: Colors.white)),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Divider(color: Colors.white.withOpacity(0.2), height: 1),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _kv('Expires on', Derive.date(c.planExpiresAt))),
              Expanded(child: _kv('Member since', Derive.date(c.joiningDate, pattern: 'MMM yyyy'))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _kv(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: Colors.white.withOpacity(0.75))),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
        ],
      );

  Widget _dueBanner() {
    return PulseGlassCard(
      padding: const EdgeInsets.all(14),
      color: PulseColors.warning.withOpacity(0.05),
      border: BorderSide(color: PulseColors.warning.withOpacity(0.3)),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: PulseColors.warning.withOpacity(0.15), shape: BoxShape.circle),
            child: const Icon(Iconsax.clock, color: PulseColors.warning, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Payment due',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                Text('Please renew at your gym counter to stay active.',
                    style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _paymentRow(PaymentEntry p) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PulseGlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: PulseColors.accent.withOpacity(0.15), shape: BoxShape.circle),
              child: const Icon(Iconsax.tick_circle, color: PulseColors.accent, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.invoiceNumber ?? 'Payment',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                  const SizedBox(height: 2),
                  Text('${Derive.date(p.date)} · ${Derive.titleCase(p.method)}',
                      style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
                ],
              ),
            ),
            Text(Derive.money(p.amount),
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
          ],
        ),
      ),
    );
  }
}
