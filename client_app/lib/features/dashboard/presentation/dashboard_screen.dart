import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../core/util/derive.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_ring.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../../member/data/member_controller.dart';
import '../../member/data/member_model.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(meProvider);
    return PulseShell(
      showBottomNav: true,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(meProvider)),
        data: (me) => _Content(me: me),
      ),
    );
  }
}

class _Content extends ConsumerWidget {
  final MemberMe me;
  const _Content({required this.me});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = me.client;
    final bmi = Derive.bmi(c.height, c.weight);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _header(context, c),
        const SizedBox(height: 20),
        _memberCard(context, c).animate().fadeIn().slideY(begin: 0.08, end: 0),
        const SizedBox(height: 24),
        _sectionTitle('Overview'),
        const SizedBox(height: 12),
        _statGrid(c, bmi),
        const SizedBox(height: 24),
        _sectionHeader('Quick actions', null, null),
        const SizedBox(height: 12),
        _quickActions(context),
        const SizedBox(height: 24),
        _sectionHeader('Health overview', 'Details', () => context.go('/health')),
        const SizedBox(height: 12),
        _healthOverview(context, c, bmi),
        const SizedBox(height: 24),
        _sectionHeader('Recent check-ins', 'All', () => context.go('/attendance')),
        const SizedBox(height: 12),
        _recentAttendance(),
        if (c.hasDue) ...[
          const SizedBox(height: 24),
          _dueBanner(context),
        ],
        const SizedBox(height: 24),
        _startWorkout(context, c),
      ],
    );
  }

  // ── Header ──
  Widget _header(BuildContext context, Client c) {
    return Row(
      children: [
        GestureDetector(
          onTap: () => context.go('/profile'),
          child: Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: PulseColors.primaryGradient,
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Text(
              Derive.initials(c.name),
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Welcome back",
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: PulseColors.textMuted)),
              Row(
                children: [
                  Flexible(
                    child: Text(
                      Derive.firstName(c.name),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: PulseColors.foreground),
                    ),
                  ),
                  if (c.plan != null) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: PulseColors.accent2.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        c.plan!.name.toUpperCase(),
                        style: const TextStyle(
                            fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: PulseColors.accent2),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Member card ──
  Widget _memberCard(BuildContext context, Client c) {
    return Container(
      decoration: BoxDecoration(
        gradient: PulseColors.primaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: PulseColors.primary.withOpacity(0.3), blurRadius: 24, offset: const Offset(0, 8)),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('MEMBER ID',
                    style: TextStyle(
                        fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 2, color: Colors.white.withOpacity(0.7))),
                const SizedBox(height: 2),
                Text(c.memberId,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white)),
                const SizedBox(height: 12),
                Text(
                  c.plan != null
                      ? '${c.plan!.name} · Expires ${Derive.date(c.planExpiresAt)}'
                      : 'Expires ${Derive.date(c.planExpiresAt)}',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white.withOpacity(0.85)),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: c.isActive ? PulseColors.accent : (c.hasDue ? PulseColors.warning : PulseColors.destructive),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        c.status.replaceAll('_', ' ').toUpperCase(),
                        style: TextStyle(
                            fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: Colors.white.withOpacity(0.9)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(16)),
            padding: const EdgeInsets.all(8),
            child: Column(
              children: [
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4)),
                  padding: const EdgeInsets.all(4),
                  child: Image.network(
                    'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${c.memberId}',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Icon(Icons.qr_code_2, color: Colors.black, size: 52),
                  ),
                ),
                const SizedBox(height: 4),
                Text('MEMBER QR',
                    style: TextStyle(
                        fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: Colors.white.withOpacity(0.7))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Stat grid (all real) ──
  Widget _statGrid(Client c, double? bmi) {
    final days = Derive.daysLeft(c.planExpiresAt);
    final last = me.recentAttendance.isNotEmpty ? me.recentAttendance.first : null;
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.35,
      children: [
        _statCard(
          label: 'Membership',
          value: days == null ? '--' : (days < 0 ? 'Expired' : '$days d'),
          sub: 'Renews ${Derive.date(c.planExpiresAt)}',
          icon: Iconsax.timer_1,
          tone: days != null && days < 0 ? PulseColors.destructive : PulseColors.warning,
        ),
        _statCard(
          label: 'Plan',
          value: c.plan?.name ?? '--',
          sub: c.plan != null ? '${Derive.money(c.plan!.price)} / ${c.plan!.duration} mo' : 'No plan',
          icon: Iconsax.card,
          tone: PulseColors.primary,
        ),
        _statCard(
          label: 'Last check-in',
          value: last == null ? '--' : Derive.titleCase(last.status),
          sub: last == null ? 'No visits yet' : Derive.date(last.date, pattern: 'dd MMM'),
          icon: Iconsax.login_1,
          tone: PulseColors.accent,
        ),
        _statCard(
          label: 'BMI',
          value: bmi == null ? '--' : bmi.toString(),
          sub: bmi == null ? 'Add height & weight' : Derive.bmiCategory(bmi),
          icon: Iconsax.chart_2,
          tone: PulseColors.accent2,
        ),
      ],
    ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.06, end: 0);
  }

  Widget _statCard({
    required String label,
    required String value,
    required String sub,
    required IconData icon,
    required Color tone,
  }) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: PulseColors.textMuted)),
              ),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(color: tone.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, color: tone, size: 14),
              ),
            ],
          ),
          const Spacer(),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: PulseColors.foreground)),
          const SizedBox(height: 2),
          Text(sub,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: tone)),
        ],
      ),
    );
  }

  // ── Quick actions ──
  Widget _quickActions(BuildContext context) {
    final actions = [
      (_QA('Workout', Iconsax.weight_1, '/workout', PulseColors.primary)),
      (_QA('Health', Iconsax.heart, '/health', PulseColors.accent)),
      (_QA('Attendance', Iconsax.calendar_tick, '/attendance', PulseColors.accent2)),
      (_QA('Payments', Iconsax.card, '/payments', PulseColors.warning)),
    ];
    return Row(
      children: actions.map((a) {
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 5),
            child: PulseGlassCard(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
              onTap: () => context.go(a.route),
              child: Column(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(color: a.tone.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
                    child: Icon(a.icon, color: a.tone, size: 18),
                  ),
                  const SizedBox(height: 8),
                  Text(a.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    ).animate().fadeIn(delay: 150.ms).slideY(begin: 0.06, end: 0);
  }

  // ── Health overview ──
  Widget _healthOverview(BuildContext context, Client c, double? bmi) {
    final h = c.health;
    if (h.isEmpty && bmi == null) {
      return const PulseEmpty(
        icon: Iconsax.health,
        title: 'No health data yet',
        subtitle: 'Your trainer will add your goals and measurements here.',
      );
    }
    final progress = Derive.goalProgress(
      goalType: h.goalType,
      start: h.weeklyWeights.isNotEmpty ? (h.weeklyWeights.last['weight'] as num?) : (h.currentWeight ?? c.weight),
      current: h.currentWeight ?? c.weight,
      target: h.targetWeight,
    );
    final muscle = h.latestComposition?['notes'];
    final weight = h.currentWeight ?? c.weight;
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          PulseRing(
            percent: progress.toDouble(),
            color: PulseColors.accent,
            size: 96,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$progress%',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, height: 1, color: PulseColors.foreground)),
                const SizedBox(height: 4),
                Text('GOAL',
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 1, color: PulseColors.textMuted)),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              children: [
                Row(children: [
                  Expanded(child: _metric('Weight', weight == null ? '--' : '$weight kg')),
                  const SizedBox(width: 12),
                  Expanded(child: _metric('BMI', bmi?.toString() ?? '--')),
                ]),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: _metric('Body fat', h.bodyFatPercentage != null ? '${h.bodyFatPercentage}%' : '--')),
                  const SizedBox(width: 12),
                  Expanded(child: _metric('Goal', Derive.goalLabel(h.goalType))),
                ]),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.06, end: 0);
  }

  Widget _metric(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: PulseColors.textMuted)),
        const SizedBox(height: 2),
        Text(value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
      ],
    );
  }

  // ── Recent attendance ──
  Widget _recentAttendance() {
    if (me.recentAttendance.isEmpty) {
      return const PulseEmpty(
        icon: Iconsax.calendar_1,
        title: 'No check-ins yet',
        subtitle: 'Your gym visits will show up here.',
      );
    }
    return Column(
      children: me.recentAttendance.take(4).map((a) {
        final color = a.status == 'present'
            ? PulseColors.accent
            : a.status == 'excused'
                ? PulseColors.warning
                : PulseColors.destructive;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: PulseGlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
                  child: Icon(Iconsax.tick_circle, color: color, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(Derive.date(a.date, pattern: 'EEE, dd MMM'),
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                      if (a.checkInTime != null)
                        Text('In ${a.checkInTime}',
                            style: TextStyle(fontSize: 12, color: PulseColors.textMuted)),
                    ],
                  ),
                ),
                Text(Derive.titleCase(a.status),
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
              ],
            ),
          ),
        );
      }).toList(),
    ).animate().fadeIn(delay: 250.ms).slideY(begin: 0.06, end: 0);
  }

  // ── Due banner ──
  Widget _dueBanner(BuildContext context) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      color: PulseColors.warning.withOpacity(0.05),
      border: BorderSide(color: PulseColors.warning.withOpacity(0.3)),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: PulseColors.warning.withOpacity(0.15), borderRadius: BorderRadius.circular(16)),
            child: const Icon(Iconsax.card, color: PulseColors.warning, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Payment due',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                Text('Please renew at your gym counter.',
                    style: TextStyle(fontSize: 11, color: PulseColors.textMuted)),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => context.go('/payments'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(gradient: PulseColors.flameGradient, borderRadius: BorderRadius.circular(12)),
              child: const Text('View',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  // ── Start workout shortcut ──
  Widget _startWorkout(BuildContext context, Client c) {
    final hasSchedule = c.health.currentSchedule != null;
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      onTap: () => context.go('/workout'),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: PulseColors.primary.withOpacity(0.15), borderRadius: BorderRadius.circular(14)),
            child: const Icon(Iconsax.weight_1, color: PulseColors.primary, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('My workout',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                Text(hasSchedule ? 'View today\'s plan' : 'No plan assigned yet',
                    style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
              ],
            ),
          ),
          Icon(Iconsax.arrow_right_3, size: 18, color: PulseColors.textMuted),
        ],
      ),
    ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.06, end: 0);
  }

  // ── Section helpers ──
  Widget _sectionTitle(String t) => Text(t,
      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: PulseColors.foreground));

  Widget _sectionHeader(String title, String? action, VoidCallback? onAction) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _sectionTitle(title),
        if (action != null)
          GestureDetector(
            onTap: onAction,
            child: Text(action,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: PulseColors.primary)),
          ),
      ],
    );
  }
}

class _QA {
  final String label;
  final IconData icon;
  final String route;
  final Color tone;
  _QA(this.label, this.icon, this.route, this.tone);
}
