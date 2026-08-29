const {
    Food, DietPlan, DietPlanMeal, DietPlanFood, MemberDietAssignment,
    MealLog, WaterLog, NutritionXP, Badge, Streak, Client
} = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;
const gamification = require('../gamification/engine');

// Sum a diet plan's macros from its meals' foods.
const sumPlanMacros = (meals = []) => {
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    meals.forEach((m) => (m.foods || []).forEach((f) => {
        calories += parseFloat(f.calories || 0);
        protein += parseFloat(f.protein || 0);
        carbs += parseFloat(f.carbs || 0);
        fat += parseFloat(f.fat || 0);
    }));
    return { calories, protein, carbs, fat };
};

// ==========================================
// FOOD DATABASE
// ==========================================
exports.getFoods = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const foods = await Food.findAll({
            where: {
                [Op.or]: [{ facilityId: null }, { facilityId }]
            },
            order: [['name', 'ASC']]
        });
        res.json(foods);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createFood = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const food = await Food.create({ ...req.body, facilityId });
        res.status(201).json(food);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateFood = async (req, res) => {
    try {
        const food = await Food.findByPk(req.params.id);
        if (!food || (food.facilityId && food.facilityId !== req.user.facilityId)) {
            return res.status(403).json({ error: 'Unauthorized or not found' });
        }
        await food.update(req.body);
        res.json(food);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteFood = async (req, res) => {
    try {
        const food = await Food.findByPk(req.params.id);
        if (!food || (food.facilityId && food.facilityId !== req.user.facilityId)) {
            return res.status(403).json({ error: 'Unauthorized or not found' });
        }
        await food.destroy();
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// DIET PLANS
// ==========================================
exports.getDietPlans = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const plans = await DietPlan.findAll({
            where: { facilityId },
            include: [{
                model: DietPlanMeal,
                as: 'meals',
                include: [{ model: DietPlanFood, as: 'foods', include: [Food] }]
            }]
        });
        res.json(plans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createDietPlan = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const facilityId = req.user.facilityId;
        const { meals, ...planData } = req.body;
        
        const plan = await DietPlan.create({ ...planData, facilityId }, { transaction: t });

        if (meals && meals.length > 0) {
            for (let i = 0; i < meals.length; i++) {
                const meal = await DietPlanMeal.create({
                    dietPlanId: plan.id,
                    mealName: meals[i].mealName,
                    mealOrder: i,
                    mealTime: meals[i].mealTime
                }, { transaction: t });

                if (meals[i].foods && meals[i].foods.length > 0) {
                    const foods = meals[i].foods.map(f => ({
                        ...f,
                        mealId: meal.id
                    }));
                    await DietPlanFood.bulkCreate(foods, { transaction: t });
                }
            }
            // Keep the plan's macro totals in sync with its meals.
            const totals = sumPlanMacros(meals);
            await plan.update({
                targetCalories: totals.calories || plan.targetCalories,
                protein: totals.protein, carbs: totals.carbs, fat: totals.fat
            }, { transaction: t });
        }
        await t.commit();
        res.status(201).json(plan);
    } catch (err) {
        await t.rollback();
        res.status(400).json({ error: err.message });
    }
};

// Edit a diet plan's details (name, goal, duration, targets, water goal).
exports.updateDietPlan = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const plan = await DietPlan.findOne({ where: { id: req.params.id, facilityId } });
        if (!plan) return res.status(404).json({ error: 'Plan not found or unauthorized' });
        const { meals, ...planData } = req.body; // never overwrite meals here
        await plan.update(planData);
        res.json(plan);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteDietPlan = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const plan = await DietPlan.findOne({ where: { id: req.params.id, facilityId } });
        if (!plan) return res.status(404).json({ error: 'Plan not found or unauthorized' });
        const activeCount = await MemberDietAssignment.count({ where: { dietPlanId: plan.id, status: 'active' } });
        if (activeCount > 0) {
            return res.status(400).json({ error: `Cannot delete — ${activeCount} member(s) are actively assigned this plan.` });
        }
        await plan.destroy(); // meals + foods cascade
        res.json({ message: 'Diet plan deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Clone a plan (with all meals + foods) into a new "(Copy)" plan.
exports.duplicateDietPlan = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const facilityId = req.user.facilityId;
        const source = await DietPlan.findOne({
            where: { id: req.params.id, facilityId },
            include: [{ model: DietPlanMeal, as: 'meals', include: [{ model: DietPlanFood, as: 'foods' }] }]
        });
        if (!source) { await t.rollback(); return res.status(404).json({ error: 'Plan not found' }); }

        const copy = await DietPlan.create({
            facilityId, name: `${source.name} (Copy)`, description: source.description,
            goalType: source.goalType, durationWeeks: source.durationWeeks,
            targetCalories: source.targetCalories, protein: source.protein,
            carbs: source.carbs, fat: source.fat, fiber: source.fiber, waterGoal: source.waterGoal
        }, { transaction: t });

        for (const meal of (source.meals || [])) {
            const newMeal = await DietPlanMeal.create({
                dietPlanId: copy.id, mealName: meal.mealName, mealOrder: meal.mealOrder, mealTime: meal.mealTime
            }, { transaction: t });
            const foods = (meal.foods || []).map((f) => ({
                mealId: newMeal.id, foodId: f.foodId, quantity: f.quantity, unit: f.unit,
                calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat
            }));
            if (foods.length) await DietPlanFood.bulkCreate(foods, { transaction: t });
        }
        await t.commit();
        res.status(201).json(copy);
    } catch (err) {
        await t.rollback();
        res.status(400).json({ error: err.message });
    }
};

exports.updateDietPlanMeals = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const facilityId = req.user.facilityId;
        const planId = req.params.id;
        const { meals } = req.body;
        
        // Verify plan exists and belongs to facility
        const plan = await DietPlan.findOne({ where: { id: planId, facilityId } });
        if (!plan) throw new Error('Plan not found or unauthorized');

        // Delete existing meals (will cascade delete foods)
        await DietPlanMeal.destroy({ where: { dietPlanId: planId }, transaction: t });

        // Insert new meals and foods
        if (meals && meals.length > 0) {
            for (let i = 0; i < meals.length; i++) {
                const meal = await DietPlanMeal.create({
                    dietPlanId: plan.id,
                    mealName: meals[i].mealName,
                    mealOrder: i,
                    mealTime: meals[i].mealTime || null
                }, { transaction: t });

                if (meals[i].foods && meals[i].foods.length > 0) {
                    const foods = meals[i].foods.map(f => ({
                        mealId: meal.id,
                        foodId: f.foodId,
                        quantity: f.quantity,
                        unit: f.unit,
                        calories: f.calories,
                        protein: f.protein,
                        carbs: f.carbs,
                        fat: f.fat
                    }));
                    await DietPlanFood.bulkCreate(foods, { transaction: t });
                }
            }
        }
        
        // Calculate total plan macros and update plan
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
        if (meals && meals.length > 0) {
            meals.forEach(m => {
                if (m.foods) {
                    m.foods.forEach(f => {
                        totalCalories += parseFloat(f.calories || 0);
                        totalProtein += parseFloat(f.protein || 0);
                        totalCarbs += parseFloat(f.carbs || 0);
                        totalFat += parseFloat(f.fat || 0);
                    });
                }
            });
        }
        
        await plan.update({
            targetCalories: totalCalories,
            protein: totalProtein,
            carbs: totalCarbs,
            fat: totalFat
        }, { transaction: t });

        await t.commit();
        res.json({ message: 'Meals updated successfully', plan });
    } catch (err) {
        await t.rollback();
        res.status(400).json({ error: err.message });
    }
};


// ==========================================
// ASSIGNMENTS
// ==========================================
exports.assignDietPlan = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { clientIds, dietPlanId, startDate, endDate, replaceExisting } = req.body;
        
        for (const clientId of clientIds) {
            if (replaceExisting) {
                await MemberDietAssignment.update(
                    { status: 'expired' },
                    { where: { clientId, status: 'active' }, transaction: t }
                );
            }
            
            const activePlan = await MemberDietAssignment.findOne({
                where: { clientId, status: 'active' },
                transaction: t
            });

            if (activePlan && !replaceExisting) {
                throw new Error(`Client ${clientId} already has an active plan.`);
            }

            await MemberDietAssignment.create({
                clientId,
                dietPlanId,
                startDate,
                endDate,
                status: 'active'
            }, { transaction: t });
        }
        await t.commit();
        res.json({ message: 'Assigned successfully' });
    } catch (err) {
        await t.rollback();
        res.status(400).json({ error: err.message });
    }
};

exports.getAssignments = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const statusFilter = req.query.status; // 'active' | 'paused' | 'expired' | undefined (all)
        const where = statusFilter ? { status: statusFilter } : {};

        const assignments = await MemberDietAssignment.findAll({
            include: [
                { model: Client, where: { facilityId }, attributes: ['id', 'name', 'phone'] },
                { model: DietPlan, as: 'dietPlan', include: [{ model: DietPlanMeal, as: 'meals', attributes: ['id'] }] }
            ],
            where,
            order: [['createdAt', 'DESC']]
        });

        const today = new Date();
        const withCompliance = await Promise.all(assignments.map(async (a) => {
            const json = a.toJSON();
            const mealIds = (json.dietPlan?.meals || []).map((m) => m.id);
            const mealCount = mealIds.length;
            const start = new Date(json.startDate);
            const end = json.endDate ? new Date(json.endDate) : today;
            const rangeEnd = today < end ? today : end;
            const daysElapsed = Math.max(1, Math.ceil((rangeEnd - start) / 86400000) + 1);
            let complianceScore = 0;
            if (mealCount > 0 && mealIds.length) {
                const logged = await MealLog.count({
                    where: {
                        clientId: json.clientId, mealId: { [Op.in]: mealIds },
                        date: { [Op.between]: [json.startDate, rangeEnd.toISOString().split('T')[0]] }
                    }
                });
                const expected = mealCount * daysElapsed;
                complianceScore = expected > 0 ? Math.min(100, Math.round((logged / expected) * 100)) : 0;
            }
            // Trim the meals array we only pulled for counting.
            if (json.dietPlan) delete json.dietPlan.meals;
            return { ...json, complianceScore };
        }));

        res.json(withCompliance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update an assignment's status (pause/resume/expire) or dates.
exports.updateAssignment = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const assignment = await MemberDietAssignment.findOne({
            where: { id: req.params.id },
            include: [{ model: Client, where: { facilityId }, attributes: ['id'] }]
        });
        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
        const { status, startDate, endDate } = req.body;
        if (status && ['active', 'paused', 'expired'].includes(status)) assignment.status = status;
        if (startDate) assignment.startDate = startDate;
        if (endDate !== undefined) assignment.endDate = endDate;
        await assignment.save();
        res.json(assignment);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteAssignment = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const assignment = await MemberDietAssignment.findOne({
            where: { id: req.params.id },
            include: [{ model: Client, where: { facilityId }, attributes: ['id'] }]
        });
        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
        await assignment.destroy();
        res.json({ message: 'Assignment removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// CLIENT APP
// ==========================================
exports.getClientTodayPlan = async (req, res) => {
    try {
        const clientId = req.user.id; // Using req.user (since client auth uses req.user mapping)
        const today = new Date().toISOString().split('T')[0];

        // Get Active Plan
        const assignment = await MemberDietAssignment.findOne({
            where: { clientId, status: 'active' },
            include: [{
                model: DietPlan,
                as: 'dietPlan',
                include: [{
                    model: DietPlanMeal,
                    as: 'meals',
                    include: [{ model: DietPlanFood, as: 'foods', include: [Food] }]
                }]
            }]
        });

        // Get completed meals for today
        const completedMeals = await MealLog.findAll({
            where: { clientId, date: today }
        });
        const completedMealIds = completedMeals.map(m => m.mealId);

        // Get water log for today
        const waterLogs = await WaterLog.findAll({
            where: { clientId, date: today }
        });
        const waterLogged = waterLogs.reduce((acc, log) => acc + log.amountMl, 0);

        // Get Streak
        let streak = await Streak.findOne({ where: { clientId } });
        if (!streak) {
            streak = await Streak.create({ clientId });
        }

        res.json({
            dietPlan: assignment ? assignment.dietPlan : null,
            completedMealIds,
            waterLogged,
            streak
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Award a nutrition badge once (idempotent by name).
const awardBadge = async (clientId, badgeName) => {
    const existing = await Badge.findOne({ where: { clientId, badgeName } });
    if (!existing) await Badge.create({ clientId, badgeName });
};

exports.logMeal = async (req, res) => {
    try {
        const clientId = req.user.id;
        const facilityId = req.user.facilityId;
        const { mealId } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        const existing = await MealLog.findOne({ where: { clientId, mealId, date: today } });
        if (existing) return res.status(400).json({ error: 'Meal already logged for today' });

        const log = await MealLog.create({ clientId, mealId, date: today });

        // Nutrition-specific XP ledger.
        await NutritionXP.create({ clientId, xp: 15, reason: 'Meal Completed' });

        // Streak: advance only on the first meal logged for a new day.
        let streak = await Streak.findOne({ where: { clientId } });
        if (!streak) streak = await Streak.create({ clientId });
        let milestoneHit = null;
        if (streak.lastMealDate !== today) {
            streak.mealStreak = streak.lastMealDate === yesterday ? (streak.mealStreak || 0) + 1 : 1;
            streak.longestMealStreak = Math.max(streak.longestMealStreak || 0, streak.mealStreak);
            streak.nutritionStreak = streak.mealStreak;
            streak.lastMealDate = today;
            await streak.save();
            if ([7, 30, 90].includes(streak.mealStreak)) {
                milestoneHit = streak.mealStreak;
                await awardBadge(clientId, `${streak.mealStreak}-Day Meal Streak`);
            }
        }

        // Feed the member's MAIN gamification (once/day via the nutrition_logged rule).
        gamification.awardActivity(clientId, facilityId, [{ code: 'nutrition_logged' }],
            { sourceType: 'meal_log', sourceId: mealId, date: today });

        res.json({ log, mealStreak: streak.mealStreak, milestone: milestoneHit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.logWater = async (req, res) => {
    try {
        const clientId = req.user.id;
        const facilityId = req.user.facilityId;
        const { amountMl } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        const log = await WaterLog.create({ clientId, amountMl, date: today });

        // Water streak (advances once per day on first log).
        let streak = await Streak.findOne({ where: { clientId } });
        if (!streak) streak = await Streak.create({ clientId });
        if (streak.lastWaterDate !== today) {
            streak.waterStreak = streak.lastWaterDate === yesterday ? (streak.waterStreak || 0) + 1 : 1;
            streak.longestWaterStreak = Math.max(streak.longestWaterStreak || 0, streak.waterStreak);
            streak.lastWaterDate = today;
            await streak.save();
        }
        await NutritionXP.create({ clientId, xp: 5, reason: 'Water Logged' });
        gamification.awardActivity(clientId, facilityId, [{ code: 'water_logged' }],
            { sourceType: 'water_log', sourceId: `${today}`, date: today });

        const totalToday = await WaterLog.sum('amountMl', { where: { clientId, date: today } });
        res.json({ log, totalToday: totalToday || 0, waterStreak: streak.waterStreak });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// ADMIN ANALYTICS
// ==========================================
exports.getAnalytics = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const today = new Date().toISOString().split('T')[0];
        const sevenAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

        const clients = await Client.findAll({ where: { facilityId }, attributes: ['id', 'name'] });
        const clientIds = clients.map((c) => c.id);
        const idFilter = clientIds.length ? clientIds : [0];
        const nameMap = new Map(clients.map((c) => [c.id, c.name]));

        const [totalFoods, totalPlans, activePlans, pausedPlans, mealsToday, activeAssignments] = await Promise.all([
            Food.count({ where: { [Op.or]: [{ facilityId: null }, { facilityId }] } }),
            DietPlan.count({ where: { facilityId } }),
            MemberDietAssignment.count({ where: { clientId: { [Op.in]: idFilter }, status: 'active' } }),
            MemberDietAssignment.count({ where: { clientId: { [Op.in]: idFilter }, status: 'paused' } }),
            MealLog.count({ where: { clientId: { [Op.in]: idFilter }, date: today } }),
            MemberDietAssignment.findAll({
                where: { clientId: { [Op.in]: idFilter }, status: 'active' },
                include: [{ model: DietPlan, as: 'dietPlan', include: [{ model: DietPlanMeal, as: 'meals', attributes: ['id'] }] }]
            })
        ]);

        // Plans by goal (distribution chart)
        const goalRows = await DietPlan.findAll({
            where: { facilityId },
            attributes: ['goalType', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['goalType'], raw: true
        });
        const plansByGoal = goalRows.map((r) => ({ goal: r.goalType, count: Number(r.count) }));

        // Facility adherence over the last 7 days (logged meals vs expected).
        const expectedWeekly = activeAssignments.reduce((s, a) => s + ((a.dietPlan?.meals || []).length * 7), 0);
        const loggedWeekly = clientIds.length
            ? await MealLog.count({ where: { clientId: { [Op.in]: idFilter }, date: { [Op.between]: [sevenAgo, today] } } })
            : 0;
        const avgCompliance = expectedWeekly > 0 ? Math.min(100, Math.round((loggedWeekly / expectedWeekly) * 100)) : 0;

        // Water goal completion today = share of active members who logged water.
        const waterMembersToday = clientIds.length
            ? (await WaterLog.findAll({ where: { clientId: { [Op.in]: idFilter }, date: today }, attributes: ['clientId'], group: ['clientId'] })).length
            : 0;
        const waterGoalCompletion = activePlans > 0 ? Math.round((waterMembersToday / activePlans) * 100) : 0;

        // Top performers by current meal streak.
        const streaks = clientIds.length
            ? await Streak.findAll({ where: { clientId: { [Op.in]: idFilter }, mealStreak: { [Op.gt]: 0 } }, order: [['mealStreak', 'DESC']], limit: 5 })
            : [];
        const topPerformers = streaks.map((s) => ({
            name: nameMap.get(s.clientId) || 'Member', mealStreak: s.mealStreak, waterStreak: s.waterStreak
        }));

        res.json({
            totalFoods, totalPlans, activePlans, pausedPlans,
            mealsToday, avgCompliance, waterGoalCompletion,
            plansByGoal, topPerformers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
