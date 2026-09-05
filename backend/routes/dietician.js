const dieticianController = require('../controllers/dieticianController');
const { P } = require('../config/permissions');

function registerDieticianRoutes(app, deps) {
    const { authenticate, authorize, checkSubscriptionStatus } = deps;

    // Resolve facility ID for superadmins (mirrors nutrition/gamification).
    const resolveFacilityId = (req, res, next) => {
        if (req.user.role === 'superadmin') {
            req.user.facilityId = req.query.facilityId || req.body?.facilityId || null;
        }
        next();
    };

    const adminOnly = [authenticate, checkSubscriptionStatus, authorize(P.DIETICIAN_MANAGE), resolveFacilityId];
    const chartRead = [authenticate, checkSubscriptionStatus, authorize(P.CHART_READ), resolveFacilityId];
    const chartEdit = [authenticate, checkSubscriptionStatus, authorize(P.CHART_EDIT), resolveFacilityId];
    const chartDelete = [authenticate, checkSubscriptionStatus, authorize(P.CHART_DELETE), resolveFacilityId];
    const chartAuthor = [authenticate, checkSubscriptionStatus, authorize(P.CHART_AUTHOR)];
    const clientOnly = [authenticate, authorize(P.CLIENT_APP)];

    // --- Dietician management (admin) ---
    app.get('/api/nutrition/dieticians', adminOnly, dieticianController.getDieticians);
    app.post('/api/nutrition/dieticians/:id/clients', adminOnly, dieticianController.assignClient);
    app.delete('/api/nutrition/dieticians/clients/:clientId', adminOnly, dieticianController.unassignClient);

    // --- Clients in the nutrition workspace (admin: all, dietician: assigned) ---
    app.get('/api/nutrition/dietician/clients', chartRead, dieticianController.getClients);
    app.get('/api/nutrition/dietician/clients/:clientId/health', chartRead, dieticianController.getClientHealthSource);

    // --- Diet charts ---
    app.get('/api/nutrition/charts', chartRead, dieticianController.getCharts);
    app.get('/api/nutrition/charts/:id', chartRead, dieticianController.getChart);
    app.post('/api/nutrition/charts', chartAuthor, dieticianController.createChart);
    app.put('/api/nutrition/charts/:id', chartEdit, dieticianController.updateChart);
    app.delete('/api/nutrition/charts/:id', chartDelete, dieticianController.deleteChart);

    // --- Client app (member) ---
    app.get('/api/client/nutrition/chart', clientOnly, dieticianController.getClientChart);

    console.log('Dietician routes registered.');
}

module.exports = { registerDieticianRoutes };
