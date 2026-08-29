import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../data/nutrition_repository.dart';

const _goalLabels = {
  'weight_loss': 'Weight Loss',
  'weight_gain': 'Weight Gain',
  'maintenance': 'Maintenance',
  'muscle_gain': 'Muscle Gain',
  'performance': 'Performance',
  'therapeutic': 'Therapeutic',
};

class DietChartScreen extends ConsumerWidget {
  const DietChartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(dietChartProvider);
    return PulseShell(
      title: 'Diet Plan',
      backRoute: '/dashboard',
      showBottomNav: false,
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(dietChartProvider)),
        data: (chart) => chart == null
            ? const PulseEmpty(
                icon: Iconsax.document_text,
                title: 'No diet plan yet',
                subtitle: 'Your dietician hasn\'t shared a diet plan with you yet. It will appear here once ready.',
              )
            : _Content(c: chart),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  final DietChart c;
  const _Content({required this.c});

  @override
  Widget build(BuildContext context) {
    final specEntries = _specEntries(c.mealSpec);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _headerCard().animate().fadeIn().slideY(begin: 0.06, end: 0),
        const SizedBox(height: 24),

        if (_hasGoals) ...[
          _sectionTitle('Your goals'),
          const SizedBox(height: 12),
          _goalsCard().animate().fadeIn(delay: 40.ms).slideY(begin: 0.05, end: 0),
          const SizedBox(height: 24),
        ],

        _sectionTitle('Meal plan'),
        const SizedBox(height: 12),
        if (c.meals.isEmpty)
          const PulseEmpty(
            icon: Iconsax.reserve,
            title: 'No meals listed',
            subtitle: 'Your dietician will add your meals here.',
          )
        else
          ...c.meals.asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _mealCard(e.value).animate().fadeIn(delay: (60 + e.key * 30).ms).slideY(begin: 0.05, end: 0),
              )),

        if (specEntries.isNotEmpty) ...[
          const SizedBox(height: 12),
          _sectionTitle('Daily targets'),
          const SizedBox(height: 12),
          _specCard(specEntries).animate().fadeIn().slideY(begin: 0.05, end: 0),
        ],

        if (c.foodGuidelines.isNotEmpty) ...[
          const SizedBox(height: 24),
          _sectionTitle('Food guidelines'),
          const SizedBox(height: 12),
          _guidelinesCard(c.foodGuidelines, Iconsax.reserve, PulseColors.success),
        ],

        if (c.lifestyleGuidelines.isNotEmpty) ...[
          const SizedBox(height: 24),
          _sectionTitle('Lifestyle guidelines'),
          const SizedBox(height: 12),
          _guidelinesCard(c.lifestyleGuidelines, Iconsax.heart, PulseColors.accent2),
        ],

        if (c.remarks.isNotEmpty || (c.nextFollowUp != null && c.nextFollowUp!.isNotEmpty)) ...[
          const SizedBox(height: 24),
          _sectionTitle('Dietician\'s note'),
          const SizedBox(height: 12),
          _remarksCard(),
        ],
        const SizedBox(height: 20),
      ],
    );
  }

  bool get _hasGoals => c.goals.values.any((v) => v != null && v.toString().trim().isNotEmpty);

  Widget _sectionTitle(String t) =>
      Text(t, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: PulseColors.foreground));

  Widget _headerCard() {
    final goal = c.primaryGoal != null ? (_goalLabels[c.primaryGoal] ?? c.primaryGoal!) : null;
    return PulseGlassCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: PulseColors.accent.withOpacity(0.15), borderRadius: BorderRadius.circular(13)),
              child: const Icon(Iconsax.document_text, size: 22, color: PulseColors.accent),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c.title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
                  if (c.dieticianName != null && c.dieticianName!.isNotEmpty)
                    Text('by ${c.dieticianName}',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: PulseColors.textMuted)),
                ],
              ),
            ),
          ]),
          if (goal != null || (c.assessmentDate != null && c.assessmentDate!.isNotEmpty)) ...[
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: [
              if (goal != null) _chip(goal, PulseColors.primary),
              if (c.assessmentDate != null && c.assessmentDate!.isNotEmpty)
                _chip('Assessed ${c.assessmentDate}', PulseColors.textMuted),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _goalsCard() {
    final targets = <List<String>>[
      ['Target weight', _g('targetWeight'), 'kg'],
      ['Target body fat', _g('targetBodyFat'), '%'],
      ['Target protein', _g('targetProtein'), 'g/day'],
      ['Target water', _g('targetWater'), 'L/day'],
    ].where((t) => t[1].isNotEmpty).toList();

    return PulseGlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_g('primary').isNotEmpty) ...[
            Text(_g('primary'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: PulseColors.foreground)),
            if (targets.isNotEmpty) const SizedBox(height: 14),
          ],
          if (targets.isNotEmpty)
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: targets
                  .map((t) => _statPill(t[0], '${t[1]} ${t[2]}'))
                  .toList(),
            ),
        ],
      ),
    );
  }

  String _g(String k) => (c.goals[k] ?? '').toString().trim();

  Widget _mealCard(DietChartMeal m) {
    final title = m.mealType.isNotEmpty ? m.mealType : 'Meal';
    final options = m.options.where((o) => !o.isEmpty).toList();
    final showOptionLabels = options.length > 1;
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: PulseColors.accent2.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
                child: const Icon(Iconsax.reserve, size: 19, color: PulseColors.accent2),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
              ),
              if (m.time.isNotEmpty)
                Text(m.time, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: PulseColors.textMuted)),
            ],
          ),
          ...options.asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(top: 12),
                child: _optionBlock(e.value, showOptionLabels ? 'Option ${e.key + 1}' : null),
              )),
        ],
      ),
    );
  }

  Widget _optionBlock(DietMealOption o, String? label) {
    final items = o.items.where((it) => !it.isEmpty).toList();
    final totals = <String>[
      if (o.calories > 0) '${_num(o.calories)} kcal',
      if (o.protein > 0) '${_num(o.protein)} g protein',
    ];
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: PulseColors.surface2, borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (label != null || totals.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  if (label != null)
                    Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: PulseColors.accent)),
                  const Spacer(),
                  if (totals.isNotEmpty)
                    Text(totals.join(' · '), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PulseColors.textMuted)),
                ],
              ),
            ),
          ...items.map((it) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 6, right: 8),
                      child: Container(width: 5, height: 5, decoration: const BoxDecoration(color: PulseColors.accent, shape: BoxShape.circle)),
                    ),
                    Expanded(
                      child: Text(
                        it.food.isNotEmpty ? it.food : 'Food',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: PulseColors.foreground),
                      ),
                    ),
                    if (it.calories != null || it.protein != null)
                      Text(
                        [
                          if (it.calories != null) '${_num(it.calories!)} kcal',
                          if (it.protein != null) '${_num(it.protein!)}g',
                        ].join(' · '),
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: PulseColors.textMuted),
                      ),
                  ],
                ),
              )),
          if (o.note.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(o.note, style: TextStyle(fontSize: 12, color: PulseColors.textMuted)),
          ],
        ],
      ),
    );
  }

  Widget _specCard(List<List<String>> entries) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: entries.map((e) => _statPill(e[0], e[1])).toList(),
      ),
    );
  }

  Widget _guidelinesCard(List<String> items, IconData icon, Color color) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: items
            .map((g) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(icon, size: 15, color: color),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(g, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: PulseColors.foreground)),
                      ),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }

  Widget _remarksCard() {
    return PulseGlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (c.remarks.isNotEmpty)
            Text(c.remarks, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: PulseColors.foreground)),
          if (c.nextFollowUp != null && c.nextFollowUp!.isNotEmpty) ...[
            if (c.remarks.isNotEmpty) const SizedBox(height: 12),
            Row(children: [
              const Icon(Iconsax.calendar_1, size: 15, color: PulseColors.primary),
              const SizedBox(width: 8),
              Text('Next follow-up: ${c.nextFollowUp}',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: PulseColors.primary)),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _chip(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color)),
      );

  Widget _statPill(String label, String value) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(color: PulseColors.surface2, borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: PulseColors.foreground)),
            Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: PulseColors.textMuted)),
          ],
        ),
      );

  static List<List<String>> _specEntries(Map<String, dynamic> ms) {
    final defs = <List<String>>[
      ['Calories', 'calories', 'kcal'],
      ['Protein', 'protein', 'g'],
      ['Carbs', 'carbs', 'g'],
      ['Fat', 'fat', 'g'],
      ['Fiber', 'fiber', 'g'],
      ['Water', 'water', 'L'],
    ];
    return defs
        .where((d) => (ms[d[1]] ?? '').toString().trim().isNotEmpty)
        .map((d) => [d[0], '${ms[d[1]].toString().trim()} ${d[2]}'])
        .toList();
  }

  static String _num(num n) => n == n.roundToDouble() ? n.toInt().toString() : n.toString();
}
