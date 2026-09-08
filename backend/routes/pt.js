const ptController = require('../controllers/ptController');
const { P } = require('../config/permissions');

function registerPTRoutes(app, deps) {
    const { authenticate, authorize, checkSubscriptionStatus, requireModule } = deps;

    // Superadmin scopes to a facility via ?facilityId (mirrors nutrition/gamification).
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

    // Trainers are existing staff; admins and staff both manage PT sessions.
    const staffAccess = [authenticate, checkSubscriptionStatus, requireModule('pt'), authorize(P.PT_MANAGE), resolveFacilityId];
    // Mirrors every other member-facing route: a member of a facility whose
    // subscription has lapsed does not keep reading their PT plan.
    const clientOnly = [authenticate, authorize(P.CLIENT_APP), checkSubscriptionStatus, requireModule('pt')];

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
