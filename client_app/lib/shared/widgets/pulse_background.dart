import 'package:flutter/material.dart';
import '../../core/theme/pulse_colors.dart';

/// Replicates the reference `--gradient-hero`: three accent radial glows layered
/// over the solid `--background`. The glows are softened in light mode so the
/// light surface stays clean.
class PulseBackground extends StatelessWidget {
  const PulseBackground({super.key});

  @override
  Widget build(BuildContext context) {
    // Lower glow opacity on light backgrounds.
    final primaryGlow = PulseColors.isLight ? const Color(0x243B82F6) : const Color(0x733B82F6);
    final accentGlow = PulseColors.isLight ? const Color(0x1A22C55E) : const Color(0x4722C55E);
    final flameGlow = PulseColors.isLight ? const Color(0x14FD6D20) : const Color(0x38FD6D20);

    return IgnorePointer(
      child: Stack(
        children: [
          Positioned.fill(child: ColoredBox(color: PulseColors.background)),
          // Top-left primary glow
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(-0.8, -1.0),
                  radius: 1.25,
                  colors: [primaryGlow, primaryGlow.withOpacity(0)],
                  stops: const [0.0, 0.62],
                ),
              ),
            ),
          ),
          // Top-right accent glow
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.95, -0.8),
                  radius: 1.1,
                  colors: [accentGlow, accentGlow.withOpacity(0)],
                  stops: const [0.0, 0.62],
                ),
              ),
            ),
          ),
          // Bottom flame glow
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.0, 1.0),
                  radius: 1.15,
                  colors: [flameGlow, flameGlow.withOpacity(0)],
                  stops: const [0.0, 0.66],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
