import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../data/pt_repository.dart';

class PtScreen extends ConsumerWidget {
  const PtScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(clientPtProvider);
    return PulseShell(
      title: 'Personal Training',
      backRoute: '/dashboard',
      showBottomNav: false,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(clientPtProvider)),
        data: (d) => d.hasPT
            ? _Content(d: d)
            : const PulseEmpty(
                icon: Iconsax.weight_1,
                title: 'No Personal Training plan',
                subtitle: 'You\'re not on a PT plan right now. Talk to your gym to add personal training.',
              ),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  final ClientPt d;
  const _Content({required this.d});

  static const _statusColor = {
    'completed': PulseColors.success,
    'scheduled': PulseColors.accent,
    'cancelled': PulseColors.warning,
    'no_show': PulseColors.destructive,
  };

  String _fmt(DateTime dt) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final ampm = dt.hour < 12 ? 'AM' : 'PM';
    final m = dt.minute.toString().padLeft(2, '0');
    return '${dt.day} ${months[dt.month - 1]}, $h:$m $ampm';
  }

  String _statusLabel(String s) => s == 'no_show' ? 'No-show' : '${s[0].toUpperCase()}${s.substring(1)}';

  @override
  Widget build(BuildContext context) {
    final u = d.usage;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (u != null) _usageCard(u).animate().fadeIn().slideY(begin: 0.06, end: 0),
        const SizedBox(height: 24),
        if (d.upcoming.isNotEmpty) ...[
          Text('Upcoming sessions',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
          const SizedBox(height: 12),
          ...d.upcoming.asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _sessionCard(e.value).animate().fadeIn(delay: (60 + e.key * 40).ms).slideY(begin: 0.05, end: 0),
              )),
          const SizedBox(height: 24),
        ],
        Text('Session history',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
        const SizedBox(height: 12),
        if (d.history.isEmpty)
          const PulseEmpty(
            icon: Iconsax.clock,
            title: 'No sessions yet',
            subtitle: 'Your completed and past PT sessions will show up here.',
          )
        else
          ...d.history.asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _sessionCard(e.value).animate().fadeIn(delay: (60 + e.key * 30).ms),
              )),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _usageCard(PtUsage u) {
    final pct = u.allowed > 0 ? (u.used / u.allowed).clamp(0.0, 1.0) : 0.0;
    final barColor = u.atLimit ? PulseColors.destructive : (pct >= 0.75 ? PulseColors.warning : PulseColors.success);
    return PulseGlassCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: PulseColors.primary.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Iconsax.weight_1, size: 20, color: PulseColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(u.planName, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
                  Text('${u.allowed} sessions / ${u.periodLabel}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: PulseColors.textMuted)),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text('${u.used}', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: PulseColors.foreground)),
              Text(' / ${u.allowed} used',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: PulseColors.textMuted)),
              const Spacer(),
              Text('${u.remaining} remaining',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: barColor)),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: PulseColors.surface2,
              valueColor: AlwaysStoppedAnimation(barColor),
            ),
          ),
          const SizedBox(height: 8),
          Text('Resets every ${u.periodLabel}',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: PulseColors.textMuted)),
        ],
      ),
    );
  }

  Widget _sessionCard(PtSession s) {
    final color = _statusColor[s.status] ?? PulseColors.accent;
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
            child: Icon(
              s.status == 'completed' ? Iconsax.tick_circle : (s.status == 'scheduled' ? Iconsax.calendar_1 : Iconsax.close_circle),
              size: 19, color: color,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_fmt(s.sessionDate), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                const SizedBox(height: 2),
                Text(
                  [
                    if (s.trainerName != null && s.trainerName!.isNotEmpty) 'with ${s.trainerName}',
                    if (s.durationMinutes != null) '${s.durationMinutes} min',
                  ].join(' · '),
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: PulseColors.textMuted),
                ),
                if (s.notes != null && s.notes!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(s.notes!, style: TextStyle(fontSize: 12, color: PulseColors.foreground.withOpacity(0.8))),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
            child: Text(_statusLabel(s.status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color)),
          ),
        ],
      ),
    );
  }
}
