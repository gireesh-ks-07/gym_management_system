const dieticianController = require('../controllers/dieticianController');

function registerDieticianRoutes(app, deps) {
    const { authenticate, authorize, checkSubscriptionStatus } = deps;

    // Resolve facility ID for superadmins (mirrors nutrition/gamification).
    const resolveFacilityId = (req, res, next) => {
        if (req.user.role === 'superadmin') {
            req.user.facilityId = req.query.facilityId || req.body?.facilityId || null;
        }
        next();
    };

    const adminOnly = [authenticate, checkSubscriptionStatus, authorize(['superadmin', 'admin']), resolveFacilityId];
    const adminOrDietician = [authenticate, checkSubscriptionStatus, authorize(['superadmin', 'admin', 'staff', 'dietician']), resolveFacilityId];
    const dieticianOnly = [authenticate, checkSubscriptionStatus, authorize(['dietician'])];
    const clientOnly = [authenticate, authorize(['client'])];

    // --- Dietician management (admin) ---
    app.get('/api/nutrition/dieticians', adminOnly, dieticianController.getDieticians);
    app.post('/api/nutrition/dieticians/:id/clients', adminOnly, dieticianController.assignClient);
    app.delete('/api/nutrition/dieticians/clients/:clientId', adminOnly, dieticianController.unassignClient);

    // --- Clients in the nutrition workspace (admin: all, dietician: assigned) ---
    app.get('/api/nutrition/dietician/clients', adminOrDietician, dieticianController.getClients);
    app.get('/api/nutrition/dietician/clients/:clientId/health', adminOrDietician, dieticianController.getClientHealthSource);

    // --- Diet charts ---
    app.get('/api/nutrition/charts', adminOrDietician, dieticianController.getCharts);
    app.get('/api/nutrition/charts/:id', adminOrDietician, dieticianController.getChart);
    app.post('/api/nutrition/charts', dieticianOnly, dieticianController.createChart);
    app.put('/api/nutrition/charts/:id', adminOrDietician, dieticianController.updateChart);
    app.delete('/api/nutrition/charts/:id', adminOrDietician, dieticianController.deleteChart);

    // --- Client app (member) ---
    app.get('/api/client/nutrition/chart', clientOnly, dieticianController.getClientChart);

    console.log('Dietician routes registered.');
}

module.exports = { registerDieticianRoutes };
