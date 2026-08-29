const { DataTypes } = require('sequelize');

function defineNutritionModels(sequelize, models = {}) {
    const { Client, Facility, User } = models;

    const Food = sequelize.define('Food', {
        facilityId: { type: DataTypes.INTEGER, allowNull: true }, // null = global food, integer = facility specific
        name: { type: DataTypes.STRING, allowNull: false },
        category: {
            type: DataTypes.ENUM('Protein', 'Carbohydrate', 'Vegetable', 'Fruit', 'Dairy', 'Beverage', 'Healthy Fat', 'Supplement', 'Other'),
            allowNull: false
        },
        servingSize: { type: DataTypes.FLOAT, allowNull: false },
        servingUnit: {
            type: DataTypes.STRING,
            allowNull: false
        },
        calories: { type: DataTypes.FLOAT, allowNull: false },
        protein: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        carbs: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        fat: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        fiber: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        sugar: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        sodium: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        imageUrl: { type: DataTypes.STRING, allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
    });

    const DietPlan = sequelize.define('DietPlan', {
        facilityId: { type: DataTypes.INTEGER, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        goalType: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'weight_loss'
        },
        durationWeeks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
        targetCalories: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 2000 },
        protein: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
        carbs: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
        fat: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
        fiber: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
        waterGoal: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 3000 }
    });

    const DietPlanMeal = sequelize.define('DietPlanMeal', {
        dietPlanId: { type: DataTypes.INTEGER, allowNull: false },
        mealName: { type: DataTypes.STRING, allowNull: false }, // Breakfast, Lunch, etc.
        mealOrder: { type: DataTypes.INTEGER, allowNull: false },
        mealTime: { type: DataTypes.TIME, allowNull: true } // e.g., '08:00:00'
    });

    const DietPlanFood = sequelize.define('DietPlanFood', {
        mealId: { type: DataTypes.INTEGER, allowNull: false },
        foodId: { type: DataTypes.INTEGER, allowNull: false },
        quantity: { type: DataTypes.FLOAT, allowNull: false },
        unit: { type: DataTypes.STRING, allowNull: false },
        calories: { type: DataTypes.FLOAT, allowNull: false },
        protein: { type: DataTypes.FLOAT, allowNull: false },
        carbs: { type: DataTypes.FLOAT, allowNull: false },
        fat: { type: DataTypes.FLOAT, allowNull: false }
    });

    const MemberDietAssignment = sequelize.define('MemberDietAssignment', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        dietPlanId: { type: DataTypes.INTEGER, allowNull: false },
        startDate: { type: DataTypes.DATEONLY, allowNull: false },
        endDate: { type: DataTypes.DATEONLY, allowNull: true },
        status: { type: DataTypes.ENUM('active', 'expired', 'paused'), defaultValue: 'active' }
    });

    const MealLog = sequelize.define('MealLog', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        mealId: { type: DataTypes.INTEGER, allowNull: false },
        date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
        completedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    });

    const WaterLog = sequelize.define('WaterLog', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        amountMl: { type: DataTypes.INTEGER, allowNull: false },
        date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
        loggedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    });

    const NutritionXP = sequelize.define('NutritionXP', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        xp: { type: DataTypes.INTEGER, allowNull: false },
        reason: { type: DataTypes.STRING, allowNull: false }
    });

    const Badge = sequelize.define('Badge', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        badgeName: { type: DataTypes.STRING, allowNull: false },
        earnedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    });

    const Streak = sequelize.define('Streak', {
        clientId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
        mealStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
        waterStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
        nutritionStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
        lastMealDate: { type: DataTypes.DATEONLY, allowNull: true },
        lastWaterDate: { type: DataTypes.DATEONLY, allowNull: true },
        longestMealStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
        longestWaterStreak: { type: DataTypes.INTEGER, defaultValue: 0 }
    });

    // ── DietChart ──────────────────────────────────────────────────────────
    // A per-client nutrition assessment + individualized diet plan, authored by
    // a dietician (User). Queryable columns for scoping/listing + one rich JSON
    // `data` blob holding the full 14-section assessment template. Foods are
    // always optional: every meal row in data.mealPlan is free-text, and linking
    // a Food DB item (foodId) is opt-in.
    const DietChart = sequelize.define('DietChart', {
        facilityId: { type: DataTypes.INTEGER, allowNull: false },
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        dieticianId: { type: DataTypes.INTEGER, allowNull: true }, // authoring dietician (User)
        title: { type: DataTypes.STRING, allowNull: true },
        assessmentDate: { type: DataTypes.DATEONLY, allowNull: true },
        primaryGoal: { type: DataTypes.STRING, allowNull: true }, // weight_loss, weight_gain, maintenance, muscle_gain, performance, therapeutic
        status: { type: DataTypes.ENUM('draft', 'active', 'archived'), defaultValue: 'draft' },
        // Full assessment template (sections 1-14). Sensible empty default so the
        // controller can shallow-merge partial updates safely.
        data: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {
                personalInfo: {},
                bodyComposition: [],
                bodyCompositionNotes: '',
                biochemical: [],
                medicalHistory: {},
                familyHistory: [],
                exerciseChart: [],
                activitySummary: {},
                medications: [],
                supplements: [],
                dietaryPreferences: {},
                dietRecall: [],
                dietRecallSummary: {},
                dietTracker: [],
                nutritionGoals: {},
                mealPlan: [],
                mealSpec: {},
                guidelines: { food: [], lifestyle: [] },
                followUp: [],
                dietitianRemarks: '',
                nextFollowUpDate: null
            }
        }
    });

    // Associations
    if (Facility) {
        Facility.hasMany(Food, { foreignKey: 'facilityId' });
        Food.belongsTo(Facility, { foreignKey: 'facilityId' });

        Facility.hasMany(DietPlan, { foreignKey: 'facilityId' });
        DietPlan.belongsTo(Facility, { foreignKey: 'facilityId' });

        Facility.hasMany(DietChart, { foreignKey: 'facilityId' });
        DietChart.belongsTo(Facility, { foreignKey: 'facilityId' });
    }

    if (Client) {
        Client.hasMany(DietChart, { foreignKey: 'clientId' });
        DietChart.belongsTo(Client, { foreignKey: 'clientId' });
    }

    if (User) {
        User.hasMany(DietChart, { as: 'authoredCharts', foreignKey: 'dieticianId' });
        DietChart.belongsTo(User, { as: 'dietician', foreignKey: 'dieticianId' });
    }

    DietPlan.hasMany(DietPlanMeal, { foreignKey: 'dietPlanId', onDelete: 'CASCADE', as: 'meals' });
    DietPlanMeal.belongsTo(DietPlan, { foreignKey: 'dietPlanId' });

    DietPlanMeal.hasMany(DietPlanFood, { foreignKey: 'mealId', onDelete: 'CASCADE', as: 'foods' });
    DietPlanFood.belongsTo(DietPlanMeal, { foreignKey: 'mealId' });

    Food.hasMany(DietPlanFood, { foreignKey: 'foodId' });
    DietPlanFood.belongsTo(Food, { foreignKey: 'foodId' });

    if (Client) {
        Client.hasMany(MemberDietAssignment, { foreignKey: 'clientId' });
        MemberDietAssignment.belongsTo(Client, { foreignKey: 'clientId' });

        Client.hasMany(MealLog, { foreignKey: 'clientId' });
        MealLog.belongsTo(Client, { foreignKey: 'clientId' });

        Client.hasMany(WaterLog, { foreignKey: 'clientId' });
        WaterLog.belongsTo(Client, { foreignKey: 'clientId' });

        Client.hasMany(NutritionXP, { foreignKey: 'clientId' });
        NutritionXP.belongsTo(Client, { foreignKey: 'clientId' });

        Client.hasMany(Badge, { foreignKey: 'clientId' });
        Badge.belongsTo(Client, { foreignKey: 'clientId' });

        Client.hasOne(Streak, { foreignKey: 'clientId' });
        Streak.belongsTo(Client, { foreignKey: 'clientId' });
    }

    DietPlan.hasMany(MemberDietAssignment, { foreignKey: 'dietPlanId' });
    MemberDietAssignment.belongsTo(DietPlan, { foreignKey: 'dietPlanId', as: 'dietPlan' });

    DietPlanMeal.hasMany(MealLog, { foreignKey: 'mealId' });
    MealLog.belongsTo(DietPlanMeal, { foreignKey: 'mealId' });

    return {
        Food,
        DietPlan,
        DietPlanMeal,
        DietPlanFood,
        MemberDietAssignment,
        MealLog,
        WaterLog,
        NutritionXP,
        Badge,
        Streak,
        DietChart
    };
}

module.exports = { defineNutritionModels };
