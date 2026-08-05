import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'pulse_colors.dart';

class AppTheme {
  // Build a theme for the given [brightness]. PulseColors must already be
  // applied to the same brightness (see ClientApp) so the neutral tokens match.
  static ThemeData themeFor(Brightness brightness) {
    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: PulseColors.background,
      colorScheme: ColorScheme.fromSeed(
        seedColor: PulseColors.primary,
        brightness: brightness,
        primary: PulseColors.primary,
        secondary: PulseColors.accent,
        surface: PulseColors.background,
        error: PulseColors.destructive,
      ),
    );

    return base.copyWith(
      primaryColor: PulseColors.primary,
      textTheme: GoogleFonts.interTextTheme(base.textTheme).copyWith(
        displayLarge: GoogleFonts.inter(
          fontSize: 36,
          fontWeight: FontWeight.w900,
          color: PulseColors.foreground,
          letterSpacing: -1.0,
        ),
        displayMedium: GoogleFonts.inter(
          fontSize: 28,
          fontWeight: FontWeight.w800,
          color: PulseColors.foreground,
          letterSpacing: -0.5,
        ),
        headlineMedium: GoogleFonts.inter(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: PulseColors.foreground,
        ),
        titleLarge: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: PulseColors.foreground,
        ),
        titleMedium: GoogleFonts.inter(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: PulseColors.foreground,
        ),
        bodyLarge: GoogleFonts.inter(
          fontSize: 14,
          color: PulseColors.foreground,
        ),
        bodyMedium: GoogleFonts.inter(
          fontSize: 12,
          color: PulseColors.textMuted,
        ),
        labelLarge: GoogleFonts.inter(
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: Colors.transparent,
          foregroundColor: PulseColors.foreground,
          minimumSize: const Size.fromHeight(56),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: PulseColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: PulseColors.border, width: 1.0),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: PulseColors.input,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 18,
        ),
        labelStyle: GoogleFonts.inter(
          color: PulseColors.textMuted,
          fontSize: 14,
        ),
        hintStyle: GoogleFonts.inter(
          color: PulseColors.textMuted.withOpacity(0.5),
          fontSize: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: PulseColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: PulseColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: PulseColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: PulseColors.destructive, width: 1.5),
        ),
      ),
    );
  }

}

