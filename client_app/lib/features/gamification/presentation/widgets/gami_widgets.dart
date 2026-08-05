import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import '../../../../core/theme/pulse_colors.dart';

/// Parse a '#RRGGBB' hex string into a Color, with a safe fallback.
Color hexColor(String hex, [Color fallback = PulseColors.primary]) {
  var h = hex.replaceAll('#', '').trim();
  if (h.length == 6) h = 'FF$h';
  final v = int.tryParse(h, radix: 16);
  return v == null ? fallback : Color(v);
}

const Map<String, Color> difficultyColors = {
  'easy': PulseColors.success,
  'medium': PulseColors.warning,
  'hard': PulseColors.destructive,
};

/// Animated integer counter — counts up to [value] when it changes.
class GamiCounter extends StatelessWidget {
  final int value;
  final TextStyle? style;
  final String prefix;
  final String suffix;
  final Duration duration;
  const GamiCounter(this.value, {super.key, this.style, this.prefix = '', this.suffix = '', this.duration = const Duration(milliseconds: 900)});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<int>(
      tween: IntTween(begin: 0, end: value),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (_, v, _) => Text('$prefix$v$suffix', style: style),
    );
  }
}

/// Animated gradient progress bar.
class GamiProgressBar extends StatelessWidget {
  final double percent; // 0..1
  final Gradient gradient;
  final double height;
  const GamiProgressBar({super.key, required this.percent, this.gradient = PulseColors.primaryGradient, this.height = 10});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: Stack(
        children: [
          Container(height: height, color: Colors.white.withOpacity(0.08)),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: percent.clamp(0, 1)),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutCubic,
            builder: (_, v, _) => FractionallySizedBox(
              widthFactor: v == 0 ? 0.001 : v,
              child: Container(
                height: height,
                decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(999)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Section header with optional trailing action.
class GamiSectionHeader extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  const GamiSectionHeader(this.title, {super.key, this.actionLabel, this.onAction});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        if (actionLabel != null)
          GestureDetector(
            onTap: onAction,
            child: Row(children: [
              Text(actionLabel!, style: TextStyle(color: PulseColors.textMuted, fontWeight: FontWeight.w600, fontSize: 13)),
              Icon(Iconsax.arrow_right_3, size: 14, color: PulseColors.textMuted),
            ]),
          ),
      ],
    );
  }
}

/// Maps a lucide-ish icon name (from the backend) to an Iconsax icon.
IconData gamiIcon(String name) {
  switch (name) {
    case 'Zap': return Iconsax.flash_1;
    case 'Flame': return Iconsax.flash_circle;
    case 'Dumbbell': return Iconsax.weight;
    case 'CalendarCheck': return Iconsax.calendar_tick;
    case 'MapPin': return Iconsax.location;
    case 'HeartPulse': return Iconsax.heart;
    case 'Apple': return Iconsax.reserve;
    case 'Droplet': return Iconsax.drop;
    case 'Trophy': return Iconsax.cup;
    case 'Target': return Iconsax.designtools;
    case 'Award': return Iconsax.medal_star;
    case 'Gift': return Iconsax.gift;
    case 'TrendingUp': return Iconsax.trend_up;
    case 'ChevronsUp': return Iconsax.arrow_up_3;
    case 'ChevronsDown': return Iconsax.arrow_down;
    case 'Sunrise': return Iconsax.sun_1;
    case 'CalendarCheck2': return Iconsax.calendar_tick;
    default: return Iconsax.star_1;
  }
}
