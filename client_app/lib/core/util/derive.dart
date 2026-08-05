import 'package:intl/intl.dart' show DateFormat, NumberFormat;

/// Client-side derivations for values the backend does not precompute.
class Derive {
  static String firstName(String? full) {
    if (full == null || full.trim().isEmpty) return 'there';
    return full.trim().split(RegExp(r'\s+')).first;
  }

  static String initials(String? full) {
    if (full == null || full.trim().isEmpty) return '?';
    final parts = full.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  /// BMI from height(cm) + weight(kg). Null if either missing.
  static double? bmi(num? heightCm, num? weightKg) {
    if (heightCm == null || weightKg == null || heightCm <= 0 || weightKg <= 0) {
      return null;
    }
    final m = heightCm / 100.0;
    return double.parse((weightKg / (m * m)).toStringAsFixed(1));
  }

  static String bmiCategory(double? bmi) {
    if (bmi == null) return '--';
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  }

  /// Whole days from now until [date]. Negative if past. Null if no date.
  static int? daysLeft(DateTime? date) {
    if (date == null) return null;
    final now = DateTime.now();
    final a = DateTime(date.year, date.month, date.day);
    final b = DateTime(now.year, now.month, now.day);
    return a.difference(b).inDays;
  }

  /// Goal progress % from goalType + start/current/target weight.
  static int goalProgress({
    String? goalType,
    num? start,
    num? current,
    num? target,
  }) {
    if (start == null || current == null || target == null) return 0;
    double pct = 0;
    switch (goalType) {
      case 'weight_loss':
        final denom = (start - target).abs();
        pct = denom == 0 ? 0 : ((start - current) / denom) * 100;
        break;
      case 'weight_gain':
      case 'muscle_gain':
        final denom = (target - start).abs();
        pct = denom == 0 ? 0 : ((current - start) / denom) * 100;
        break;
      default:
        return 0;
    }
    return pct.clamp(0, 100).round();
  }

  static String goalLabel(String? goalType) {
    switch (goalType) {
      case 'weight_loss':
        return 'Weight loss';
      case 'weight_gain':
        return 'Weight gain';
      case 'muscle_gain':
        return 'Muscle gain';
      case 'strength':
        return 'Strength';
      case 'sports_performance':
        return 'Sports performance';
      default:
        return 'General fitness';
    }
  }

  static DateTime? parseDate(dynamic v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    return DateTime.tryParse(v.toString());
  }

  static String date(dynamic v, {String pattern = 'dd MMM yyyy'}) {
    final d = parseDate(v);
    if (d == null) return '--';
    return DateFormat(pattern).format(d.toLocal());
  }

  static String money(num? amount) {
    if (amount == null) return '₹0';
    final f = NumberFormat.decimalPattern('en_IN');
    return '₹${f.format(amount)}';
  }

  static String titleCase(String? s) {
    if (s == null || s.isEmpty) return '';
    return s
        .split(RegExp(r'[_\s]+'))
        .where((w) => w.isNotEmpty)
        .map((w) => w[0].toUpperCase() + w.substring(1))
        .join(' ');
  }
}
