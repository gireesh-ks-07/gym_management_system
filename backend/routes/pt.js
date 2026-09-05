const ptController = require('../controllers/ptController');
const { P } = require('../config/permissions');

function registerPTRoutes(app, deps) {
    const { authenticate, authorize, checkSubscriptionStatus } = deps;

    // Superadmin scopes to a facility via ?facilityId (mirrors nutrition/gamification).
    const resolveFacilityId = (req, res, next) => {
        if (req.user.role === 'superadmin') {
            req.user.facilityId = req.query.facilityId || req.body?.facilityId || null;
        }
        next();
    };

    // Trainers are existing staff; admins and staff both manage PT sessions.
    const staffAccess = [authenticate, checkSubscriptionStatus, authorize(P.PT_MANAGE), resolveFacilityId];
    const clientOnly = [authenticate, authorize(P.CLIENT_APP)];

    // ==========================================
    // ADMIN / TRAINER ROUTES
    // ==========================================
    app.get('/api/pt/trainers', staffAccess, ptController.getTrainers);
    app.get('/api/pt/members', staffAccess, ptController.getPTMembers);
    app.get('/api/pt/members/:clientId', staffAccess, ptController.getPTMemberDetail);

    app.get('/api/pt/sessions', staffAccess, ptController.getSessions);
    app.post('/api/pt/sessions', staffAccess, ptController.createSession);
    app.put('/api/pt/sessions/:id', staffAccess, ptController.updateSession);
    app.delete('/api/pt/sessions/:id', staffAccess, ptController.deleteSession);

    app.get('/api/pt/reports', staffAccess, ptController.getReports);

    // ==========================================
    // CLIENT APP ROUTE
    // ==========================================
    app.get('/api/client/pt', clientOnly, ptController.getClientPT);

    console.log('Personal Training routes registered.');
}

module.exports = { registerPTRoutes };
