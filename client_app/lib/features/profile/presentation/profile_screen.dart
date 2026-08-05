import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../core/util/derive.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../member/data/member_controller.dart';
import '../../member/data/member_model.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(meProvider);
    return PulseShell(
      title: 'Profile',
      backRoute: '/dashboard',
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(meProvider)),
        data: (me) => _content(context, ref, me.client),
      ),
    );
  }

  Widget _content(BuildContext context, WidgetRef ref, Client c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _summary(c).animate().fadeIn().slideY(begin: 0.06, end: 0),
        const SizedBox(height: 24),
        _heading('Contact details'),
        const SizedBox(height: 12),
        _contactCard(c),
        const SizedBox(height: 24),
        _heading('Membership'),
        const SizedBox(height: 12),
        _membershipCard(c),
        if (c.customFields.isNotEmpty) ...[
          const SizedBox(height: 24),
          _heading('More details'),
          const SizedBox(height: 12),
          _customFields(c.customFields),
        ],
        const SizedBox(height: 24),
        _heading('Appearance'),
        const SizedBox(height: 12),
        _appearance(ref),
        const SizedBox(height: 24),
        _logout(context, ref),
        const SizedBox(height: 12),
        Center(
          child: Text('PulseFit · v1.0.0', style: TextStyle(fontSize: 12, color: PulseColors.textMuted)),
        ),
      ],
    );
  }

  Widget _heading(String t) => Text(t,
      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: PulseColors.foreground));

  // System / Light / Dark segmented selector, persisted via themeModeProvider.
  Widget _appearance(WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    const options = [
      (ThemeMode.system, 'System', Iconsax.mobile),
      (ThemeMode.light, 'Light', Iconsax.sun_1),
      (ThemeMode.dark, 'Dark', Iconsax.moon),
    ];
    return PulseGlassCard(
      borderRadius: 18,
      padding: const EdgeInsets.all(6),
      child: Row(
        children: options.map((o) {
          final selected = mode == o.$1;
          return Expanded(
            child: GestureDetector(
              onTap: () => ref.read(themeModeProvider.notifier).setMode(o.$1),
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.all(2),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  gradient: selected ? PulseColors.primaryGradient : null,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  children: [
                    Icon(o.$3, size: 20, color: selected ? Colors.white : PulseColors.textMuted),
                    const SizedBox(height: 6),
                    Text(o.$2,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: selected ? Colors.white : PulseColors.textMuted,
                        )),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _summary(Client c) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(gradient: PulseColors.primaryGradient, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text(Derive.initials(c.name),
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(c.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
                const SizedBox(height: 2),
                Text(c.memberId, style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    if (c.plan != null) _pill(c.plan!.name.toUpperCase(), PulseColors.accent2),
                    if (c.plan != null) const SizedBox(width: 8),
                    _pill(c.status.replaceAll('_', ' ').toUpperCase(),
                        c.isActive ? PulseColors.accent : (c.hasDue ? PulseColors.warning : PulseColors.destructive)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
        child: Text(text,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.3, color: color)),
      );

  Widget _contactCard(Client c) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _row(Iconsax.call, PulseColors.primary, 'Mobile', c.phone ?? '--'),
          if (c.email != null && c.email!.isNotEmpty) ...[
            const SizedBox(height: 18),
            _row(Iconsax.sms, PulseColors.accent, 'Email', c.email!),
          ],
          if (c.address != null && c.address!.isNotEmpty) ...[
            const SizedBox(height: 18),
            _row(Iconsax.location, PulseColors.accent2, 'Address', c.address!),
          ],
        ],
      ),
    ).animate().fadeIn(delay: 80.ms).slideY(begin: 0.05, end: 0);
  }

  Widget _membershipCard(Client c) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _row(Iconsax.building_3, PulseColors.primary, 'Gym branch', c.facility?.name ?? '--'),
          const SizedBox(height: 18),
          _row(Iconsax.card, PulseColors.accent2, 'Plan',
              c.plan != null ? '${c.plan!.name} · ${Derive.money(c.plan!.price)}/${c.plan!.duration}mo' : 'No plan'),
          const SizedBox(height: 18),
          _row(Iconsax.calendar_1, PulseColors.accent, 'Member since', Derive.date(c.joiningDate, pattern: 'dd MMM yyyy')),
        ],
      ),
    ).animate().fadeIn(delay: 120.ms).slideY(begin: 0.05, end: 0);
  }

  Widget _customFields(Map<String, dynamic> fields) {
    final entries = fields.entries.where((e) => e.value != null && e.value.toString().isNotEmpty).toList();
    if (entries.isEmpty) return const SizedBox.shrink();
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          for (var i = 0; i < entries.length; i++) ...[
            if (i > 0) const SizedBox(height: 18),
            _row(Iconsax.document_text, PulseColors.primary, Derive.titleCase(entries[i].key),
                entries[i].value is bool ? (entries[i].value ? 'Yes' : 'No') : entries[i].value.toString()),
          ],
        ],
      ),
    );
  }

  Widget _row(IconData icon, Color color, String label, String value) {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
              const SizedBox(height: 2),
              Text(value,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _logout(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () async {
        await ref.read(authControllerProvider.notifier).logout();
        ref.invalidate(meProvider);
        if (context.mounted) context.go('/login');
      },
      child: Container(
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: PulseColors.destructive.withOpacity(0.08),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: PulseColors.destructive.withOpacity(0.4)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Iconsax.logout, size: 20, color: PulseColors.destructive),
            SizedBox(width: 10),
            Text('Log out', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: PulseColors.destructive)),
          ],
        ),
      ),
    ).animate().fadeIn(delay: 160.ms);
  }
}
