import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/theme/pulse_colors.dart';

/// Circular progress ring with a centered [child].
class PulseRing extends StatelessWidget {
  final double percent;
  final Color color;
  final double size;
  final double stroke;
  final Widget child;

  const PulseRing({
    super.key,
    required this.percent,
    required this.color,
    required this.size,
    required this.child,
    this.stroke = 0,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _PulseRingPainter(percent, color, stroke == 0 ? size * 0.1 : stroke),
          ),
          child,
        ],
      ),
    );
  }
}

class _PulseRingPainter extends CustomPainter {
  final double percent;
  final Color color;
  final double stroke;
  _PulseRingPainter(this.percent, this.color, this.stroke);

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - stroke) / 2;
    canvas.drawCircle(center, radius, Paint()
      ..color = PulseColors.border
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke);
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      (percent / 100) * 2 * math.pi,
      false,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant _PulseRingPainter old) =>
      old.percent != percent || old.color != color || old.stroke != stroke;
}
