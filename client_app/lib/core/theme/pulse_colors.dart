import 'package:flutter/material.dart';

/// Pulse design-system palette.
///
/// Vibrant/accent colors are theme-invariant `const` (they read well on both
/// light and dark surfaces). The neutral surface/text colors are runtime
/// swappable — call [PulseColors.apply] with the active [Brightness] and they
/// flip between the dark and light value sets. This keeps `PulseColors.x` call
/// sites unchanged while enabling a real light mode.
class PulseColors {
  PulseColors._();

  // ---- Theme-invariant accents (unchanged in light & dark) ----------------
  // Palette ported 1:1 from the PulseFit reference (vigor-member-suite):
  // primary = blue, accent = green, accent2 = flame.
  static const Color primary = Color(0xFF3B82F6);
  static const Color primaryEnd = Color(0xFF52A9FE); // --primary-glow
  static const Color accent = Color(0xFF22C55E);
  static const Color accentEnd = Color(0xFF00C3BB); // --gradient-accent end (teal)
  static const Color accent2 = Color(0xFFFD6D20);
  static const Color accent2End = Color(0xFFF59E0B);
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color destructive = Color(0xFFEF4444);

  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primary, primaryEnd],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient accentGradient = LinearGradient(
    colors: [accent, accentEnd],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient flameGradient = LinearGradient(
    colors: [accent2, accent2End],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient surfaceGradient = LinearGradient(
    colors: [Color(0x1AFFFFFF), Color(0x08FFFFFF)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  // ---- Neutral surfaces & text (runtime swappable) ------------------------
  // Dark defaults (also the initial values before apply() runs).
  static Color background = _darkBackground;
  static Color foreground = _darkForeground;
  static Color surface = _darkSurface;
  static Color surface2 = _darkSurface2;
  static Color popover = _darkPopover;
  static Color card = _darkCard;
  static Color border = _darkBorder;
  static Color input = _darkInput;
  static Color textMuted = _darkTextMuted;

  /// True when the light value set is active — lets widgets tweak overlays.
  static bool isLight = false;

  /// Swap the neutral palette to match [brightness]. Call this before building
  /// the widget tree whenever the active brightness changes.
  static void apply(Brightness brightness) {
    final light = brightness == Brightness.light;
    isLight = light;
    background = light ? _lightBackground : _darkBackground;
    foreground = light ? _lightForeground : _darkForeground;
    surface = light ? _lightSurface : _darkSurface;
    surface2 = light ? _lightSurface2 : _darkSurface2;
    popover = light ? _lightPopover : _darkPopover;
    card = light ? _lightCard : _darkCard;
    border = light ? _lightBorder : _darkBorder;
    input = light ? _lightInput : _darkInput;
    textMuted = light ? _lightTextMuted : _darkTextMuted;
  }

  // Dark value set — ported from the PulseFit reference tokens.
  static const Color _darkBackground = Color(0xFF0F172A); // --background
  static const Color _darkForeground = Color(0xFFF6F9FC); // --foreground
  static const Color _darkSurface = Color(0xFF1B2437); // --surface
  static const Color _darkSurface2 = Color(0xFF273043); // --surface-2
  static const Color _darkPopover = Color(0xFF161F31); // --popover (solid menus)
  static const Color _darkCard = Color(0x0FFFFFFF); // --card = white / .06 (glass over background)
  static const Color _darkBorder = Color(0x1AFFFFFF); // white / .10
  static const Color _darkInput = Color(0x1FFFFFFF); // white / .12
  static const Color _darkTextMuted = Color(0xFF99A6B8); // --muted-foreground

  // Light value set (aligned with the React admin's [data-theme='light'] tokens)
  static const Color _lightBackground = Color(0xFFF1F5F9); // slate-100
  static const Color _lightForeground = Color(0xFF1E293B); // slate-800
  static const Color _lightSurface = Color(0xFFFFFFFF);
  static const Color _lightSurface2 = Color(0xFFE2E8F0); // slate-200
  static const Color _lightPopover = Color(0xFFFFFFFF);
  static const Color _lightCard = Color(0xF2FFFFFF); // white ~95% (glass over light)
  static const Color _lightBorder = Color(0x1A0F172A); // slate-900 / .10
  static const Color _lightInput = Color(0x0F0F172A); // slate-900 / .06
  static const Color _lightTextMuted = Color(0xFF64748B); // slate-500
}
