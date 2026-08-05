import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import '../../core/theme/pulse_colors.dart';

class PulseLoading extends StatelessWidget {
  const PulseLoading({super.key});
  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.only(top: 120),
        child: Center(
          child: SizedBox(
            width: 34,
            height: 34,
            child: CircularProgressIndicator(strokeWidth: 3, color: PulseColors.primary),
          ),
        ),
      );
}

class PulseError extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;
  const PulseError({super.key, required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final msg = error.toString().contains('401') || error.toString().toLowerCase().contains('unauth')
        ? 'Your session expired. Please log in again.'
        : 'Couldn\'t load your data. Check your connection and try again.';
    return Padding(
      padding: const EdgeInsets.only(top: 100, left: 24, right: 24),
      child: Column(
        children: [
          const Icon(Iconsax.warning_2, color: PulseColors.warning, size: 40),
          const SizedBox(height: 14),
          Text(msg,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15, color: PulseColors.textMuted, height: 1.4)),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: onRetry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                gradient: PulseColors.primaryGradient,
                borderRadius: BorderRadius.circular(999),
              ),
              child: const Text('Retry',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Inline empty-state block for a section with no data yet.
class PulseEmpty extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  const PulseEmpty({super.key, required this.icon, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 34, horizontal: 20),
      decoration: BoxDecoration(
        color: PulseColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: PulseColors.border),
      ),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: PulseColors.primary.withOpacity(0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: PulseColors.primary, size: 24),
          ),
          const SizedBox(height: 14),
          Text(title,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: PulseColors.foreground)),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(subtitle!,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, height: 1.4, color: PulseColors.textMuted)),
          ],
        ],
      ),
    );
  }
}
