const nutritionController = require('../controllers/nutritionController');
const { P } = require('../config/permissions');

function registerNutritionRoutes(app, deps) {
    const { authenticate, authorize, checkSubscriptionStatus } = deps;

    // Resolve facility ID similar to gamification
    // Superadmins are not bound to one facility, so they must name the facility
    // they are acting on. Falling through with a null facilityId made the
    // controllers query `where: { facilityId: null }` and return an empty list —
    // a superadmin who forgot the parameter saw an empty module and concluded
    // the data was gone.
    const resolveFacilityId = (req, res, next) => {
        if (req.user.role === 'superadmin') {
            const facilityId = req.query.facilityId || req.body?.facilityId || null;
            if (!facilityId) {
                return res.status(400).json({ message: 'facilityId is required when acting as superadmin' });
            }
            req.user.facilityId = facilityId;
        }
        next();
    };

    const adminOnly = [authenticate, authorize(P.NUTRITION_MANAGE), resolveFacilityId];
    // Dieticians may also manage the food database (to build their diet charts).
    const foodEditors = [authenticate, authorize(P.FOOD_DB), resolveFacilityId];
    const clientOnly = [authenticate, authorize(P.CLIENT_APP)];

    // ==========================================
    // ADMIN / TRAINER ROUTES
    // ==========================================
    
    // Food Database
    app.get('/api/nutrition/foods', foodEditors, nutritionController.getFoods);
    app.post('/api/nutrition/foods', foodEditors, nutritionController.createFood);
    app.put('/api/nutrition/foods/:id', foodEditors, nutritionController.updateFood);
    app.delete('/api/nutrition/foods/:id', foodEditors, nutritionController.deleteFood);

    // Diet Plans
    app.get('/api/nutrition/plans', adminOnly, nutritionController.getDietPlans);
    app.post('/api/nutrition/plans', adminOnly, nutritionController.createDietPlan);
    app.put('/api/nutrition/plans/:id', adminOnly, nutritionController.updateDietPlan);
    app.put('/api/nutrition/plans/:id/meals', adminOnly, nutritionController.updateDietPlanMeals);
    app.post('/api/nutrition/plans/:id/duplicate', adminOnly, nutritionController.duplicateDietPlan);
    app.delete('/api/nutrition/plans/:id', adminOnly, nutritionController.deleteDietPlan);

    // Assignments
    app.get('/api/nutrition/assignments', adminOnly, nutritionController.getAssignments);
    app.post('/api/nutrition/assign', adminOnly, nutritionController.assignDietPlan);
    app.put('/api/nutrition/assignments/:id', adminOnly, nutritionController.updateAssignment);
    app.delete('/api/nutrition/assignments/:id', adminOnly, nutritionController.deleteAssignment);

    // Analytics
    app.get('/api/nutrition/analytics', adminOnly, nutritionController.getAnalytics);


    // ==========================================
    // CLIENT APP ROUTES
    // ==========================================

    // Client Fetching
    app.get('/api/client/nutrition/today', clientOnly, nutritionController.getClientTodayPlan);

    // Client Logging
    app.post('/api/client/nutrition/log-meal', clientOnly, nutritionController.logMeal);
    app.post('/api/client/nutrition/log-water', clientOnly, nutritionController.logWater);
    
    console.log('Nutrition routes registered.');
}

module.exports = { registerNutritionRoutes };
