import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

// ── Models ───────────────────────────────────────────────────────────────

class MealFood {
  final String name;
  final double quantity;
  final String unit;
  final double calories;
  MealFood({required this.name, required this.quantity, required this.unit, required this.calories});

  factory MealFood.fromJson(Map<String, dynamic> j) {
    final food = j['Food'] is Map ? Map<String, dynamic>.from(j['Food']) : const {};
    return MealFood(
      name: (food['name'] ?? 'Food').toString(),
      quantity: (j['quantity'] as num?)?.toDouble() ?? 0,
      unit: (j['unit'] ?? 'g').toString(),
      calories: (j['calories'] as num?)?.toDouble() ?? 0,
    );
  }
}

class PlanMeal {
  final int id;
  final String name;
  final String? time;
  final List<MealFood> foods;
  PlanMeal({required this.id, required this.name, this.time, required this.foods});

  double get calories => foods.fold(0.0, (s, f) => s + f.calories);

  factory PlanMeal.fromJson(Map<String, dynamic> j) => PlanMeal(
        id: j['id'] as int,
        name: (j['mealName'] ?? 'Meal').toString(),
        time: j['mealTime']?.toString(),
        foods: ((j['foods'] as List?) ?? []).map((e) => MealFood.fromJson(Map<String, dynamic>.from(e))).toList(),
      );
}

class DietToday {
  final int? planId;
  final String? planName;
  final String? goalType;
  final double targetCalories;
  final int waterGoal; // ml
  final List<PlanMeal> meals;
  final List<int> completedMealIds;
  final int waterLogged; // ml
  final int mealStreak;
  final int waterStreak;

  DietToday({
    required this.planId,
    required this.planName,
    required this.goalType,
    required this.targetCalories,
    required this.waterGoal,
    required this.meals,
    required this.completedMealIds,
    required this.waterLogged,
    required this.mealStreak,
    required this.waterStreak,
  });

  bool get hasPlan => planId != null;
  double get loggedCalories => meals.where((m) => completedMealIds.contains(m.id)).fold(0.0, (s, m) => s + m.calories);

  factory DietToday.fromJson(Map<String, dynamic> j) {
    final plan = j['dietPlan'] is Map ? Map<String, dynamic>.from(j['dietPlan']) : null;
    final streak = j['streak'] is Map ? Map<String, dynamic>.from(j['streak']) : const {};
    return DietToday(
      planId: plan?['id'] as int?,
      planName: plan?['name']?.toString(),
      goalType: plan?['goalType']?.toString(),
      targetCalories: (plan?['targetCalories'] as num?)?.toDouble() ?? 0,
      waterGoal: (plan?['waterGoal'] as num?)?.toInt() ?? 3000,
      meals: ((plan?['meals'] as List?) ?? []).map((e) => PlanMeal.fromJson(Map<String, dynamic>.from(e))).toList(),
      completedMealIds: ((j['completedMealIds'] as List?) ?? []).map((e) => e as int).toList(),
      waterLogged: (j['waterLogged'] as num?)?.toInt() ?? 0,
      mealStreak: (streak['mealStreak'] as num?)?.toInt() ?? 0,
      waterStreak: (streak['waterStreak'] as num?)?.toInt() ?? 0,
    );
  }
}

// ── Diet Chart (dietician-authored per-client plan; read-only for members) ──

class DietFoodItem {
  final String food; // free text, always optional
  final num? calories;
  final num? protein;

  DietFoodItem({required this.food, this.calories, this.protein});

  factory DietFoodItem.fromJson(Map<String, dynamic> j) => DietFoodItem(
        food: (j['food'] ?? '').toString(),
        calories: j['calories'] is num ? j['calories'] as num : null,
        protein: j['protein'] is num ? j['protein'] as num : null,
      );

  bool get isEmpty => food.trim().isEmpty && calories == null && protein == null;
}

class DietMealOption {
  final List<DietFoodItem> items;
  final String note;

  DietMealOption({required this.items, required this.note});

  num get calories => items.fold<num>(0, (s, it) => s + (it.calories ?? 0));
  num get protein => items.fold<num>(0, (s, it) => s + (it.protein ?? 0));
  bool get isEmpty => items.every((it) => it.isEmpty) && note.trim().isEmpty;

  factory DietMealOption.fromJson(Map<String, dynamic> j) => DietMealOption(
        items: ((j['items'] as List?) ?? [])
            .map((e) => DietFoodItem.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        note: (j['note'] ?? '').toString(),
      );
}

class DietChartMeal {
  final String time;
  final String mealType;
  final List<DietMealOption> options;

  DietChartMeal({required this.time, required this.mealType, required this.options});

  factory DietChartMeal.fromJson(Map<String, dynamic> j) {
    // New shape: { time, mealType, options: [{ items:[{food,calories,protein}], note }] }.
    if (j['options'] is List) {
      return DietChartMeal(
        time: (j['time'] ?? '').toString(),
        mealType: (j['mealType'] ?? '').toString(),
        options: (j['options'] as List)
            .map((e) => DietMealOption.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
    }
    // Legacy flat shape: { time, mealType, food, calories, protein, otherNutrients }.
    return DietChartMeal(
      time: (j['time'] ?? '').toString(),
      mealType: (j['mealType'] ?? '').toString(),
      options: [
        DietMealOption(
          items: [
            DietFoodItem(
              food: (j['food'] ?? '').toString(),
              calories: j['calories'] is num ? j['calories'] as num : null,
              protein: j['protein'] is num ? j['protein'] as num : null,
            )
          ],
          note: (j['otherNutrients'] ?? '').toString(),
        )
      ],
    );
  }

  bool get isEmpty => options.every((o) => o.isEmpty) && mealType.trim().isEmpty && time.trim().isEmpty;
}

class DietChart {
  final int id;
  final String title;
  final String? dieticianName;
  final String? primaryGoal;
  final String? assessmentDate;
  final String status;
  final Map<String, dynamic> goals; // nutritionGoals
  final List<DietChartMeal> meals; // mealPlan
  final Map<String, dynamic> mealSpec;
  final List<String> foodGuidelines;
  final List<String> lifestyleGuidelines;
  final String remarks;
  final String? nextFollowUp;

  DietChart({
    required this.id,
    required this.title,
    this.dieticianName,
    this.primaryGoal,
    this.assessmentDate,
    required this.status,
    required this.goals,
    required this.meals,
    required this.mealSpec,
    required this.foodGuidelines,
    required this.lifestyleGuidelines,
    required this.remarks,
    this.nextFollowUp,
  });

  static List<String> _lines(dynamic v) => ((v as List?) ?? [])
      .map((e) => e.toString().trim())
      .where((e) => e.isNotEmpty)
      .toList();

  factory DietChart.fromJson(Map<String, dynamic> j) {
    final data = j['data'] is Map ? Map<String, dynamic>.from(j['data']) : <String, dynamic>{};
    final dietician = j['dietician'] is Map ? Map<String, dynamic>.from(j['dietician']) : null;
    final guidelines = data['guidelines'] is Map ? Map<String, dynamic>.from(data['guidelines']) : const {};
    return DietChart(
      id: j['id'] as int,
      title: (j['title'] ?? 'Diet Plan').toString(),
      dieticianName: dietician?['name']?.toString(),
      primaryGoal: j['primaryGoal']?.toString(),
      assessmentDate: j['assessmentDate']?.toString(),
      status: (j['status'] ?? 'active').toString(),
      goals: data['nutritionGoals'] is Map ? Map<String, dynamic>.from(data['nutritionGoals']) : {},
      meals: ((data['mealPlan'] as List?) ?? [])
          .map((e) => DietChartMeal.fromJson(Map<String, dynamic>.from(e)))
          .where((m) => !m.isEmpty)
          .toList(),
      mealSpec: data['mealSpec'] is Map ? Map<String, dynamic>.from(data['mealSpec']) : {},
      foodGuidelines: _lines(guidelines['food']),
      lifestyleGuidelines: _lines(guidelines['lifestyle']),
      remarks: (data['dietitianRemarks'] ?? '').toString(),
      nextFollowUp: data['nextFollowUpDate']?.toString(),
    );
  }
}

// ── Repository + providers ────────────────────────────────────────────────

class NutritionRepository {
  Future<DietToday> today() async {
    final res = await apiClient.dio.get('/client/nutrition/today');
    return DietToday.fromJson(Map<String, dynamic>.from(res.data));
  }

  Future<void> logMeal(int mealId) async {
    await apiClient.dio.post('/client/nutrition/log-meal', data: {'mealId': mealId});
  }

  Future<void> logWater(int amountMl) async {
    await apiClient.dio.post('/client/nutrition/log-water', data: {'amountMl': amountMl});
  }

  Future<DietChart?> chart() async {
    final res = await apiClient.dio.get('/client/nutrition/chart');
    final data = Map<String, dynamic>.from(res.data);
    if (data['chart'] == null) return null;
    return DietChart.fromJson(Map<String, dynamic>.from(data['chart']));
  }
}

final nutritionRepositoryProvider = Provider<NutritionRepository>((ref) => NutritionRepository());

final dietTodayProvider = FutureProvider.autoDispose<DietToday>((ref) async {
  return ref.watch(nutritionRepositoryProvider).today();
});

final dietChartProvider = FutureProvider.autoDispose<DietChart?>((ref) async {
  return ref.watch(nutritionRepositoryProvider).chart();
});
