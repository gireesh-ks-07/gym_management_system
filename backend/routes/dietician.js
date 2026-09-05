const dieticianController = require('../controllers/dieticianController');
const { P } = require('../config/permissions');

function registerDieticianRoutes(app, deps) {
    const { authenticate, authorize, checkSubscriptionStatus, requireModule } = deps;

    // Resolve facility ID for superadmins (mirrors nutrition/gamification).
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

    const adminOnly = [authenticate, checkSubscriptionStatus, requireModule('dietician'), authorize(P.DIETICIAN_MANAGE), resolveFacilityId];
    const chartRead = [authenticate, checkSubscriptionStatus, requireModule('dietician'), authorize(P.CHART_READ), resolveFacilityId];
    const chartEdit = [authenticate, checkSubscriptionStatus, requireModule('dietician'), authorize(P.CHART_EDIT), resolveFacilityId];
    const chartDelete = [authenticate, checkSubscriptionStatus, requireModule('dietician'), authorize(P.CHART_DELETE), resolveFacilityId];
    const chartAuthor = [authenticate, checkSubscriptionStatus, requireModule('dietician'), authorize(P.CHART_AUTHOR)];
    const clientOnly = [authenticate, authorize(P.CLIENT_APP), requireModule('dietician')];

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
