import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../shared/widgets/pulse_background.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PulseColors.background,
      body: Stack(
        children: [
          const Positioned.fill(child: PulseBackground()),
          SafeArea(
            child: Center(
              child: Container(
                constraints: const BoxConstraints(maxWidth: 390),
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const Spacer(flex: 5),
                    // Logo tile
                    Container(
                      width: 96,
                      height: 96,
                      decoration: BoxDecoration(
                        gradient: PulseColors.primaryGradient,
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: PulseColors.primary.withOpacity(0.45),
                            blurRadius: 40,
                            spreadRadius: 2,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      child: Transform.rotate(
                        angle: -math.pi / 4,
                        child: const Icon(
                          Iconsax.weight_15,
                          color: Colors.white,
                          size: 44,
                        ),
                      ),
                    )
                        .animate()
                        .scale(duration: 500.ms, curve: Curves.easeOutBack)
                        .fadeIn(),
                    const SizedBox(height: 28),
                    // PulseFit wordmark
                    const _PulseFitWordmark(fontSize: 40),
                    const SizedBox(height: 16),
                    // Subtitle
                    Text(
                      'Your gym in your pocket. Show up, lift heavy, and watch the numbers move.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        height: 1.5,
                        fontWeight: FontWeight.w400,
                        color: PulseColors.foreground.withOpacity(0.62),
                      ),
                    ).animate().fadeIn(delay: 150.ms),
                    const SizedBox(height: 20),
                    const _LoadingDots(),
                    const Spacer(flex: 7),
                    // Get started button
                    _GetStartedButton(
                      onTap: () => context.go('/login'),
                    ).animate().fadeIn(delay: 250.ms).slideY(begin: 0.2, end: 0),
                    const SizedBox(height: 18),
                    Text(
                      'Powered by PulseFit Gyms · Bengaluru',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: PulseColors.foreground.withOpacity(0.45),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PulseFitWordmark extends StatelessWidget {
  final double fontSize;
  const _PulseFitWordmark({required this.fontSize});

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontSize: fontSize,
      fontWeight: FontWeight.w900,
      letterSpacing: -1.2,
      height: 1.0,
    );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('Pulse', style: style.copyWith(color: PulseColors.foreground)),
        ShaderMask(
          shaderCallback: (bounds) => const LinearGradient(
            colors: [PulseColors.primary, PulseColors.primaryEnd],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ).createShader(bounds),
          child: Text('Fit', style: style.copyWith(color: Colors.white)),
        ),
      ],
    ).animate().fadeIn(delay: 80.ms);
  }
}

class _GetStartedButton extends StatelessWidget {
  final VoidCallback onTap;
  const _GetStartedButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 60,
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: PulseColors.primaryGradient,
          borderRadius: BorderRadius.circular(999),
          boxShadow: [
            BoxShadow(
              color: PulseColors.primary.withOpacity(0.45),
              blurRadius: 30,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Get started',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            SizedBox(width: 10),
            Icon(Iconsax.arrow_right_1, size: 20, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

class _LoadingDots extends StatefulWidget {
  const _LoadingDots();

  @override
  State<_LoadingDots> createState() => _LoadingDotsState();
}

class _LoadingDotsState extends State<_LoadingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))
        ..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (i) {
            final phase = (_c.value - i * 0.2) % 1.0;
            final t = (math.sin(phase * math.pi * 2) + 1) / 2;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Transform.translate(
                offset: Offset(0, -3 * t),
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: PulseColors.primary.withOpacity(0.35 + 0.55 * t),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}
