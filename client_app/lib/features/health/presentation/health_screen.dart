import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../core/util/derive.dart';
import '../../../shared/widgets/pulse_glass_card.dart';
import '../../../shared/widgets/pulse_shell.dart';
import '../../../shared/widgets/pulse_ring.dart';
import '../../../shared/widgets/pulse_states.dart';
import '../../member/data/member_controller.dart';
import '../../member/data/member_model.dart';

class HealthScreen extends ConsumerWidget {
  const HealthScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(meProvider);
    return PulseShell(
      title: 'Health Profile',
      backRoute: '/dashboard',
      child: async.when(
        loading: () => const PulseLoading(),
        error: (e, _) => PulseError(error: e, onRetry: () => ref.invalidate(meProvider)),
        data: (me) => _content(context, me),
      ),
    );
  }

  Widget _content(BuildContext context, MemberMe me) {
    final c = me.client;
    final h = c.health;
    final bmi = Derive.bmi(h.height ?? c.height, h.currentWeight ?? c.weight);
    final weight = h.currentWeight ?? c.weight;

    if (h.isEmpty && bmi == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _summaryCard(c, h, 0),
          const SizedBox(height: 24),
          const PulseEmpty(
            icon: Iconsax.health,
            title: 'No health data yet',
            subtitle: 'When your trainer records your goals, weight and measurements, they\'ll appear here.',
          ),
        ],
      );
    }

    final progress = Derive.goalProgress(
      goalType: h.goalType,
      start: h.weeklyWeights.isNotEmpty ? (h.weeklyWeights.last['weight'] as num?) : weight,
      current: weight,
      target: h.targetWeight,
    );
    final muscle = h.latestComposition?['notes']?.toString().replaceAll('Muscle Mass: ', '').replaceAll('kg', '').trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _summaryCard(c, h, progress).animate().fadeIn().slideY(begin: 0.06, end: 0),
        const SizedBox(height: 24),
        _heading('Overview'),
        const SizedBox(height: 12),
        _overviewGrid(c, h, bmi, weight, muscle),
        if (h.targetWeight != null || h.currentWeight != null) ...[
          const SizedBox(height: 24),
          _heading('Goal'),
          const SizedBox(height: 12),
          _goalCard(c, h, progress),
        ],
        if (h.latestMeasurement != null) ...[
          const SizedBox(height: 24),
          _heading('Latest measurements'),
          const SizedBox(height: 12),
          _measurements(h.latestMeasurement!),
        ],
        if (h.weeklyWeights.length >= 2) ...[
          const SizedBox(height: 24),
          _heading('Weight history'),
          const SizedBox(height: 12),
          _weightChart(h.weeklyWeights),
        ],
        if (h.personalRecords.isNotEmpty) ...[
          const SizedBox(height: 24),
          _heading('Personal records'),
          const SizedBox(height: 12),
          _prList(h.personalRecords),
        ],
        if (h.fitnessTests.isNotEmpty) ...[
          const SizedBox(height: 24),
          _heading('Fitness tests'),
          const SizedBox(height: 12),
          _testList(h.fitnessTests),
        ],
      ],
    );
  }

  Widget _heading(String t) => Text(t,
      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: PulseColors.foreground));

  Widget _summaryCard(Client c, HealthProfile h, int progress) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: PulseColors.primaryGradient,
              shape: BoxShape.circle,
            ),
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
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
                const SizedBox(height: 2),
                Text(c.memberId, style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(color: PulseColors.accent.withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
                  child: Text(Derive.goalLabel(h.goalType).toUpperCase(),
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: PulseColors.accent)),
                ),
              ],
            ),
          ),
          if (!h.isEmpty)
            PulseRing(
              percent: progress.toDouble(),
              color: PulseColors.accent,
              size: 60,
              child: Text('$progress%',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
            ),
        ],
      ),
    );
  }

  Widget _overviewGrid(Client c, HealthProfile h, double? bmi, num? weight, String? muscle) {
    final items = <List<dynamic>>[
      ['Weight', weight != null ? '$weight kg' : '--', PulseColors.primary],
      ['BMI', bmi?.toString() ?? '--', PulseColors.accent],
      ['Body fat', h.bodyFatPercentage != null ? '${h.bodyFatPercentage}%' : '--', PulseColors.accent2],
      ['Muscle', (muscle != null && muscle.isNotEmpty) ? '$muscle kg' : '--', PulseColors.warning],
      ['Height', (h.height ?? c.height) != null ? '${h.height ?? c.height} cm' : '--', PulseColors.primary],
      ['Gender', Derive.titleCase(c.gender), PulseColors.accent],
    ];
    return PulseGlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        children: [
          for (var r = 0; r < items.length; r += 3)
            Padding(
              padding: EdgeInsets.only(top: r == 0 ? 0 : 18),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = r; i < r + 3 && i < items.length; i++)
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(items[i][0] as String,
                              style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
                          const SizedBox(height: 4),
                          Text(items[i][1] as String,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    ).animate().fadeIn(delay: 80.ms).slideY(begin: 0.05, end: 0);
  }

  Widget _goalCard(Client c, HealthProfile h, int progress) {
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          PulseRing(
            percent: progress.toDouble(),
            color: PulseColors.accent,
            size: 88,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$progress%',
                    style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800, height: 1, color: PulseColors.foreground)),
                const SizedBox(height: 3),
                const Text('ON TRACK',
                    style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: PulseColors.accent)),
              ],
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              children: [
                _goalRow('Current weight', h.currentWeight != null ? '${h.currentWeight} kg' : '--'),
                const SizedBox(height: 12),
                _goalRow('Target weight', h.targetWeight != null ? '${h.targetWeight} kg' : '--'),
                const SizedBox(height: 12),
                _goalRow('Goal', Derive.goalLabel(h.goalType)),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 120.ms).slideY(begin: 0.05, end: 0);
  }

  Widget _goalRow(String label, String value) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 14, color: PulseColors.textMuted)),
          Flexible(
            child: Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.right,
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
          ),
        ],
      );

  Widget _measurements(Map<String, dynamic> m) {
    final calves = m['notes']?.toString().replaceAll('Calves: ', '').trim();
    final items = <List<String>>[
      ['Arms', m['arms']?.toString() ?? '--'],
      ['Chest', m['chest']?.toString() ?? '--'],
      ['Waist', m['waist']?.toString() ?? '--'],
      ['Thighs', m['thighs']?.toString() ?? '--'],
      if (calves != null && calves.isNotEmpty) ['Calves', calves],
    ];
    return PulseGlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        children: [
          for (var r = 0; r < items.length; r += 3)
            Padding(
              padding: EdgeInsets.only(top: r == 0 ? 0 : 18),
              child: Row(
                children: [
                  for (var i = r; i < r + 3 && i < items.length; i++)
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Icon(Iconsax.ruler, size: 14, color: PulseColors.textMuted),
                            const SizedBox(width: 6),
                            Text(items[i][0], style: TextStyle(fontSize: 13, color: PulseColors.textMuted)),
                          ]),
                          const SizedBox(height: 4),
                          Text('${items[i][1]} cm',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: PulseColors.foreground)),
                        ],
                      ),
                    ),
                  for (var i = items.length; i < r + 3; i++) const Expanded(child: SizedBox()),
                ],
              ),
            ),
        ],
      ),
    ).animate().fadeIn(delay: 120.ms).slideY(begin: 0.05, end: 0);
  }

  Widget _weightChart(List<Map<String, dynamic>> weekly) {
    final points = weekly
        .map((e) => (e['weight'] as num?)?.toDouble())
        .whereType<double>()
        .toList();
    final now = points.isNotEmpty ? points.last : null;
    return PulseGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Weight', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
              Text(now != null ? '$now kg now' : '--',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: PulseColors.textMuted)),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(height: 90, width: double.infinity, child: CustomPaint(painter: _LinePainter(points, PulseColors.primary))),
        ],
      ),
    ).animate().fadeIn(delay: 120.ms).slideY(begin: 0.05, end: 0);
  }

  Widget _prList(List<Map<String, dynamic>> prs) {
    return Column(
      children: prs.take(5).map((p) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: PulseGlassCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(color: PulseColors.accent2.withOpacity(0.15), shape: BoxShape.circle),
                  child: const Icon(Iconsax.cup, color: PulseColors.accent2, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(p['exercise']?.toString() ?? 'Exercise',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                ),
                Text('${p['weight'] ?? '--'} kg × ${p['reps'] ?? '--'}',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: PulseColors.accent2)),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _testList(List<Map<String, dynamic>> tests) {
    return Column(
      children: tests.take(5).map((t) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: PulseGlassCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Expanded(
                  child: Text((t['label'] ?? t['type'] ?? 'Test').toString(),
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
                ),
                Text(t['score']?.toString() ?? '--',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: PulseColors.primary)),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _LinePainter extends CustomPainter {
  final List<double> values;
  final Color color;
  _LinePainter(this.values, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final minV = values.reduce((a, b) => a < b ? a : b);
    final maxV = values.reduce((a, b) => a > b ? a : b);
    final range = (maxV - minV).abs() < 0.001 ? 1.0 : (maxV - minV);
    final grid = Paint()
      ..color = PulseColors.border
      ..strokeWidth = 1;
    canvas.drawLine(Offset(0, size.height * 0.2), Offset(size.width, size.height * 0.2), grid);
    canvas.drawLine(Offset(0, size.height * 0.8), Offset(size.width, size.height * 0.8), grid);

    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * (i / (values.length - 1));
      final y = size.height * (0.85 - 0.7 * ((values[i] - minV) / range));
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        final px = size.width * ((i - 1) / (values.length - 1));
        final py = size.height * (0.85 - 0.7 * ((values[i - 1] - minV) / range));
        path.cubicTo((px + x) / 2, py, (px + x) / 2, y, x, y);
      }
    }
    final fill = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [color.withOpacity(0.22), color.withOpacity(0.0)],
        ).createShader(Offset.zero & size),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _LinePainter old) => old.values != values;
}
