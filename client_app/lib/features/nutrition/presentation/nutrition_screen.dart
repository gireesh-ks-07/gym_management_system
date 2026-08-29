import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../data/nutrition_repository.dart';

class NutritionScreen extends ConsumerWidget {
  const NutritionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(dietTodayProvider);
    return PulseShell(
      title: 'Diet',
      backRoute: '/dashboard',
      showBottomNav: false,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(dietTodayProvider)),
        data: (d) => d.hasPlan
            ? _Content(d: d)
            : const PulseEmpty(
                icon: Iconsax.reserve,
                title: 'No diet plan yet',
                subtitle: 'Your coach hasn\'t assigned a diet plan. Check back soon!',
              ),
      ),
    );
  }
}

class _Content extends ConsumerStatefulWidget {
  final DietToday d;
  const _Content({required this.d});
  @override
  ConsumerState<_Content> createState() => _ContentState();
}

class _ContentState extends ConsumerState<_Content> {
  final Set<int> _busy = {};
  bool _water = false;

  String _goalLabel(String? g) {
    if (g == null) return '';
    return g.replaceAll('_', ' ').split(' ').map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.d;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Plan header
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(d.planName ?? 'Diet Plan',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
                  const SizedBox(height: 4),
                  Text(_goalLabel(d.goalType),
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: PulseColors.textMuted)),
                ],
              ),
            ),
            if (d.mealStreak > 0) _streakChip(Iconsax.flash_1, '${d.mealStreak}d', PulseColors.accent2),
          ],
        ).animate().fadeIn(),
        const SizedBox(height: 20),

        // Calories + water summary
        Row(
          children: [
            Expanded(child: _calorieCard(d)),
            const SizedBox(width: 12),
            Expanded(child: _waterCard(d)),
          ],
        ).animate().fadeIn(delay: 60.ms).slideY(begin: 0.06, end: 0),
        const SizedBox(height: 24),

        Text('Today\'s Meals',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
        const SizedBox(height: 12),

        if (d.meals.isEmpty)
          const PulseEmpty(icon: Iconsax.reserve, title: 'No meals in this plan', subtitle: 'Meals will appear once your coach adds them.')
        else
          ...d.meals.asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _mealCard(e.value).animate().fadeIn(delay: (80 + e.key * 40).ms).slideY(begin: 0.05, end: 0),
              )),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _streakChip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 15, color: color),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color)),
      ]),
    );
  }

  Widget _calorieCard(DietToday d) {
    final target = d.targetCalories <= 0 ? 1 : d.targetCalories;
    final pct = (d.loggedCalories / target).clamp(0.0, 1.0);
    return PulseGlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 34, height: 34,
              decoration: BoxDecoration(color: PulseColors.accent2.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
              child: const Icon(Iconsax.flash_1, size: 17, color: PulseColors.accent2),
            ),
            const Spacer(),
          ]),
          const SizedBox(height: 14),
          Text('${d.loggedCalories.toStringAsFixed(0)}',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
          Text('of ${d.targetCalories.toStringAsFixed(0)} kcal',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: PulseColors.textMuted)),
          const SizedBox(height: 12),
          _bar(pct, PulseColors.accent2),
        ],
      ),
    );
  }

  Widget _waterCard(DietToday d) {
    final pct = (d.waterLogged / (d.waterGoal <= 0 ? 1 : d.waterGoal)).clamp(0.0, 1.0);
    return PulseGlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 34, height: 34,
              decoration: BoxDecoration(color: PulseColors.accent.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
              child: const Icon(Iconsax.drop, size: 17, color: PulseColors.accent),
            ),
            const Spacer(),
            if (d.waterStreak > 0)
              Text('${d.waterStreak}d', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: PulseColors.accent)),
          ]),
          const SizedBox(height: 14),
          Text('${(d.waterLogged / 1000).toStringAsFixed(1)}L',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
          Text('of ${(d.waterGoal / 1000).toStringAsFixed(1)}L goal',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: PulseColors.textMuted)),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _bar(pct, PulseColors.accent)),
            const SizedBox(width: 10),
            _addWater(),
          ]),
        ],
      ),
    );
  }

  Widget _addWater() {
    return GestureDetector(
      onTap: _water ? null : () => _logWater(250),
      child: Container(
        width: 30, height: 30,
        decoration: BoxDecoration(gradient: PulseColors.accentGradient, borderRadius: BorderRadius.circular(9)),
        child: _water
            ? const Padding(padding: EdgeInsets.all(7), child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Icon(Iconsax.add, size: 18, color: Colors.white),
      ),
    );
  }

  Widget _bar(double pct, Color color) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: LinearProgressIndicator(
        value: pct,
        minHeight: 7,
        backgroundColor: PulseColors.surface2,
        valueColor: AlwaysStoppedAnimation(color),
      ),
    );
  }

  Widget _mealCard(PlanMeal m) {
    final done = widget.d.completedMealIds.contains(m.id);
    final busy = _busy.contains(m.id);
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(m.name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
                    if (m.time != null && m.time!.isNotEmpty)
                      Text(m.time!, style: TextStyle(fontSize: 12, color: PulseColors.textMuted)),
                  ],
                ),
              ),
              Text('${m.calories.toStringAsFixed(0)} kcal',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: PulseColors.accent2)),
            ],
          ),
          if (m.foods.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...m.foods.map((f) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(children: [
                    Container(width: 5, height: 5, decoration: BoxDecoration(color: PulseColors.textMuted, shape: BoxShape.circle)),
                    const SizedBox(width: 8),
                    Expanded(child: Text(f.name, style: TextStyle(fontSize: 13, color: PulseColors.foreground.withOpacity(0.85)))),
                    Text('${f.quantity.toStringAsFixed(0)}${f.unit}', style: TextStyle(fontSize: 12, color: PulseColors.textMuted)),
                  ]),
                )),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: GestureDetector(
              onTap: (done || busy) ? null : () => _logMeal(m.id),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: BoxDecoration(
                  gradient: done ? null : PulseColors.accentGradient,
                  color: done ? PulseColors.success.withOpacity(0.15) : null,
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(done ? Iconsax.tick_circle : Iconsax.add_circle, size: 18, color: done ? PulseColors.success : Colors.white),
                        const SizedBox(width: 6),
                        Text(done ? 'Logged' : 'Log meal',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: done ? PulseColors.success : Colors.white)),
                      ]),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _logMeal(int mealId) async {
    setState(() => _busy.add(mealId));
    try {
      await ref.read(nutritionRepositoryProvider).logMeal(mealId);
      ref.invalidate(dietTodayProvider);
    } catch (_) {
      if (mounted) _toast('Could not log meal');
    } finally {
      if (mounted) setState(() => _busy.remove(mealId));
    }
  }

  Future<void> _logWater(int amount) async {
    setState(() => _water = true);
    try {
      await ref.read(nutritionRepositoryProvider).logWater(amount);
      ref.invalidate(dietTodayProvider);
    } catch (_) {
      if (mounted) _toast('Could not log water');
    } finally {
      if (mounted) setState(() => _water = false);
    }
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating));
  }
}
