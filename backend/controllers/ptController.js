const { PTSession, Client, Plan, User, Notification } = require('../models');
const { Op, fn, col } = require('sequelize');
const { P, isTrainerRole } = require('../config/permissions');

// ==========================================================================
// Period / usage helpers
// ==========================================================================

// Monday 00:00 of the week containing `d`.
const startOfWeekMonday = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay(); // 0 = Sun .. 6 = Sat
    const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
    date.setDate(date.getDate() + diff);
    return date;
};

const startOfMonth = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
    return date;
};

// Returns the [start, end) window for the period that `reference` falls into.
const getPeriodWindow = (period, reference = new Date()) => {
    const ref = new Date(reference);
    if (period === 'monthly') {
        const start = startOfMonth(ref);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        return { start, end };
    }
    // default: weekly (Mon–Sun)
    const start = startOfWeekMonday(ref);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
};

// Count completed sessions for a client within a given window, optionally
// excluding one session (used when re-validating an update).
const countCompletedInWindow = async (clientId, window, excludeId = null) => {
    const where = {
        clientId,
        status: 'completed',
        sessionDate: { [Op.gte]: window.start, [Op.lt]: window.end }
    };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    return PTSession.count({ where });
};

// Build a usage summary for a member's current PT plan and period.
// `plan` must be the member's active PT plan. `reference` picks the window.
const buildUsage = async (client, plan, reference = new Date()) => {
    const period = plan.ptSessionPeriod || 'weekly';
    const allowed = plan.ptSessionsCount || 0;
    const window = getPeriodWindow(period, reference);
    const used = await countCompletedInWindow(client.id, window);
    return {
        planId: plan.id,
        planName: plan.name,
        period,
        allowed,
        used,
        remaining: Math.max(0, allowed - used),
        atLimit: allowed > 0 && used >= allowed,
        periodStart: window.start,
        periodEnd: window.end
    };
};

// Resolve the facility scope for the request (superadmin may pass ?facilityId).
const facilityScope = (req) => req.user.facilityId;

// Validate a trainerId supplied by a client. Returns { ok, trainerId } or
// { ok: false, message }.
//
// Trainers are drawn from the facility's staff, but not *every* staff member is
// a trainer — dieticians are staff too, and they do not deliver training. This
// used to be unvalidated entirely, so whatever id the browser sent was stored
// and rendered as the session's trainer: a dietician picked from the shared
// /api/staff list, or a user id belonging to another facility altogether.
const resolveTrainerId = async (rawTrainerId, facilityId) => {
    if (rawTrainerId === null || rawTrainerId === undefined || rawTrainerId === '') {
        return { ok: true, trainerId: null };
    }
    const trainerId = parseInt(rawTrainerId, 10);
    if (!Number.isInteger(trainerId)) {
        return { ok: false, message: 'Invalid trainer' };
    }
    const trainer = await User.findOne({ where: { id: trainerId, facilityId } });
    if (!trainer) {
        return { ok: false, message: 'Trainer not found in this facility' };
    }
    if (!isTrainerRole(trainer.role)) {
        return { ok: false, message: `${trainer.name} cannot be assigned as a trainer` };
    }
    return { ok: true, trainerId };
};

// Only a member whose active plan is a PT plan is a "PT member".
const getClientWithPTPlan = async (clientId, facilityId) => {
    const client = await Client.findOne({
        where: { id: clientId, facilityId },
        include: [{ model: Plan }]
    });
    if (!client) return { error: 'not_found' };
    if (!client.Plan || client.Plan.planType !== 'pt') return { error: 'not_pt', client };
    return { client, plan: client.Plan };
};

// ==========================================================================
// ADMIN / TRAINER ENDPOINTS
// ==========================================================================

// GET /api/pt/trainers — the facility's trainer roster.
//
// Deliberately separate from /api/staff, which lists everyone the admin manages
// (staff *and* dieticians) for the Staff page. Reusing that list here is what
// made dieticians show up as trainers.
exports.getTrainers = async (req, res) => {
    try {
        const facilityId = facilityScope(req);
        const trainers = await User.findAll({
            where: { facilityId, role: { [Op.in]: P.PT_TRAINER } },
            attributes: ['id', 'name', 'email', 'role'],
            order: [['name', 'ASC']]
        });
        res.json(trainers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/pt/members — every member on a PT plan, with current-period usage.
exports.getPTMembers = async (req, res) => {
    try {
        const facilityId = facilityScope(req);
        const clients = await Client.findAll({
            where: { facilityId },
            include: [{ model: Plan, where: { planType: 'pt' }, required: true }],
            order: [['name', 'ASC']]
        });

        const members = await Promise.all(clients.map(async (client) => {
            const usage = await buildUsage(client, client.Plan);
            return {
                id: client.id,
                name: client.name,
                phone: client.phone,
                email: client.email,
                status: client.status,
                planExpiresAt: client.planExpiresAt,
                usage
            };
        }));

        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/pt/members/:clientId — usage + full session history for one member.
exports.getPTMemberDetail = async (req, res) => {
    try {
        const facilityId = facilityScope(req);
        const { client, plan, error } = await getClientWithPTPlan(req.params.clientId, facilityId);
        if (error === 'not_found') return res.status(404).json({ message: 'Member not found' });

        const sessions = await PTSession.findAll({
            where: { clientId: req.params.clientId, facilityId },
            include: [{ model: User, as: 'trainer', attributes: ['id', 'name'] }],
            order: [['sessionDate', 'DESC']]
        });

        const usage = plan ? await buildUsage(client, plan) : null;

        res.json({
            member: { id: client.id, name: client.name, phone: client.phone, email: client.email, status: client.status },
            isPTMember: !!plan,
            usage,
            sessions
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/pt/sessions — filterable session list (clientId, trainerId, status, from, to, mine).
exports.getSessions = async (req, res) => {
    try {
        const facilityId = facilityScope(req);
        const where = { facilityId };

        if (req.query.clientId) where.clientId = req.query.clientId;
        if (req.query.status) where.status = req.query.status;
        // "mine" lets a trainer (staff) scope to their own assigned sessions.
        if (req.query.mine === 'true') {
            where.trainerId = req.user.id;
        } else if (req.query.trainerId) {
            where.trainerId = req.query.trainerId;
        }
        if (req.query.from || req.query.to) {
            where.sessionDate = {};
            if (req.query.from) where.sessionDate[Op.gte] = new Date(req.query.from);
            if (req.query.to) where.sessionDate[Op.lte] = new Date(req.query.to);
        }

        const sessions = await PTSession.findAll({
            where,
            include: [
                { model: User, as: 'trainer', attributes: ['id', 'name'] },
                { model: Client, attributes: ['id', 'name', 'phone'] }
            ],
            order: [['sessionDate', 'DESC']]
        });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/pt/sessions — log/schedule a session.
exports.createSession = async (req, res) => {
    try {
        const facilityId = facilityScope(req);
        const { clientId, trainerId, sessionDate, durationMinutes, notes, status, override } = req.body;

        if (!clientId || !sessionDate) {
            return res.status(400).json({ message: 'clientId and sessionDate are required' });
        }

        const { client, plan, error } = await getClientWithPTPlan(clientId, facilityId);
        if (error === 'not_found') return res.status(404).json({ message: 'Member not found' });
        if (error === 'not_pt') return res.status(400).json({ message: 'Member is not on a Personal Training plan' });

        const trainer = await resolveTrainerId(trainerId, facilityId);
        if (!trainer.ok) return res.status(400).json({ message: trainer.message });

        const requestedStatus = ['scheduled', 'completed', 'cancelled', 'no_show'].includes(status) ? status : 'scheduled';
        const when = new Date(sessionDate);

        let overrideUsed = false;
        if (requestedStatus === 'completed') {
            const limit = await enforceLimit({ req, client, plan, sessionDate: when, override });
            if (!limit.ok) return res.status(limit.code).json({ message: limit.message, code: 'PT_LIMIT_REACHED', usage: limit.usage });
            overrideUsed = limit.overrideUsed;
        }

        const session = await PTSession.create({
            facilityId,
            clientId,
            planId: plan.id,
            trainerId: trainer.trainerId,
            sessionDate: when,
            durationMinutes: durationMinutes || null,
            notes: notes || null,
            status: requestedStatus,
            completedAt: requestedStatus === 'completed' ? new Date() : null,
            overrideUsed,
            createdBy: req.user.id
        });

        await notifyMemberSession(session, client, requestedStatus);

        const full = await PTSession.findByPk(session.id, {
            include: [
                { model: User, as: 'trainer', attributes: ['id', 'name'] },
                { model: Client, attributes: ['id', 'name', 'phone'] }
            ]
        });
        res.json(full);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PUT /api/pt/sessions/:id — update status / details.
exports.updateSession = async (req, res) => {
    try {
        const facilityId = facilityScope(req);
        const session = await PTSession.findOne({ where: { id: req.params.id, facilityId } });
        if (!session) return res.status(404).json({ message: 'Session not found' });

        const { trainerId, sessionDate, durationMinutes, notes, status, override } = req.body;
        const nextStatus = status !== undefined ? status : session.status;
        const nextDate = sessionDate !== undefined ? new Date(sessionDate) : session.sessionDate;

        // Enforce the limit only on a *transition into* completed (not when a
        // session is already completed and merely being edited).
        const becomingCompleted = nextStatus === 'completed' && session.status !== 'completed';
        if (becomingCompleted) {
            const { client, plan, error } = await getClientWithPTPlan(session.clientId, facilityId);
            if (error) return res.status(400).json({ message: 'Member is no longer on a Personal Training plan' });
            const limit = await enforceLimit({ req, client, plan, sessionDate: nextDate, override, excludeId: session.id });
            if (!limit.ok) return res.status(limit.code).json({ message: limit.message, code: 'PT_LIMIT_REACHED', usage: limit.usage });
            session.overrideUsed = limit.overrideUsed;
            session.completedAt = new Date();
        }
        if (nextStatus !== 'completed') session.completedAt = null;

        if (trainerId !== undefined) {
            const trainer = await resolveTrainerId(trainerId, facilityId);
            if (!trainer.ok) return res.status(400).json({ message: trainer.message });
            session.trainerId = trainer.trainerId;
        }
        if (sessionDate !== undefined) session.sessionDate = nextDate;
        if (durationMinutes !== undefined) session.durationMinutes = durationMinutes || null;
        if (notes !== undefined) session.notes = notes;
        session.status = nextStatus;

        await session.save();

        const full = await PTSession.findByPk(session.id, {
            include: [
                { model: User, as: 'trainer', attributes: ['id', 'name'] },
                { model: Client, attributes: ['id', 'name', 'phone'] }
            ]
        });
        res.json(full);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/pt/sessions/:id
exports.deleteSession = async (req, res) => {
    try {
        const facilityId = facilityScope(req);
        const session = await PTSession.findOne({ where: { id: req.params.id, facilityId } });
        if (!session) return res.status(404).json({ message: 'Session not found' });
        await session.destroy();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/pt/reports — trainer-wise + status breakdown for the facility.
exports.getReports = async (req, res) => {
    try {
        const facilityId = facilityScope(req);
        const where = { facilityId };
        if (req.query.from || req.query.to) {
            where.sessionDate = {};
            if (req.query.from) where.sessionDate[Op.gte] = new Date(req.query.from);
            if (req.query.to) where.sessionDate[Op.lte] = new Date(req.query.to);
        }

        const statusRows = await PTSession.findAll({
            where,
            attributes: ['status', [fn('COUNT', col('id')), 'count']],
            group: ['status'],
            raw: true
        });
        const byStatus = { scheduled: 0, completed: 0, cancelled: 0, no_show: 0 };
        statusRows.forEach((r) => { byStatus[r.status] = Number(r.count); });

        const trainerRows = await PTSession.findAll({
            where,
            attributes: ['trainerId', [fn('COUNT', col('PTSession.id')), 'total']],
            include: [{ model: User, as: 'trainer', attributes: ['id', 'name'] }],
            group: ['trainerId', 'trainer.id', 'trainer.name'],
            raw: true,
            nest: true
        });

        // Completed count per trainer (separate query keeps it dialect-safe).
        const completedRows = await PTSession.findAll({
            where: { ...where, status: 'completed' },
            attributes: ['trainerId', [fn('COUNT', col('id')), 'completed']],
            group: ['trainerId'],
            raw: true
        });
        const completedMap = {};
        completedRows.forEach((r) => { completedMap[r.trainerId] = Number(r.completed); });

        const byTrainer = trainerRows.map((r) => ({
            trainerId: r.trainerId,
            trainerName: r.trainer?.name || 'Unassigned',
            total: Number(r.total),
            completed: completedMap[r.trainerId] || 0
        }));

        const activePTMembers = await Client.count({
            where: { facilityId },
            include: [{ model: Plan, where: { planType: 'pt' }, required: true }]
        });

        res.json({
            totals: {
                sessions: Object.values(byStatus).reduce((a, b) => a + b, 0),
                ...byStatus,
                activePTMembers
            },
            byStatus,
            byTrainer
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================================================
// CLIENT APP ENDPOINT
// ==========================================================================

// GET /api/client/pt — the logged-in member's PT plan, usage, history, upcoming.
exports.getClientPT = async (req, res) => {
    try {
        const clientId = req.user.id;
        const client = await Client.findByPk(clientId, { include: [{ model: Plan }] });
        if (!client) return res.status(404).json({ message: 'Member not found' });

        const isPTMember = client.Plan && client.Plan.planType === 'pt';
        if (!isPTMember) return res.json({ hasPT: false });

        const usage = await buildUsage(client, client.Plan);

        const now = new Date();
        const history = await PTSession.findAll({
            where: { clientId, sessionDate: { [Op.lt]: now } },
            include: [{ model: User, as: 'trainer', attributes: ['id', 'name'] }],
            order: [['sessionDate', 'DESC']],
            limit: 50
        });
        const upcoming = await PTSession.findAll({
            where: { clientId, status: 'scheduled', sessionDate: { [Op.gte]: now } },
            include: [{ model: User, as: 'trainer', attributes: ['id', 'name'] }],
            order: [['sessionDate', 'ASC']]
        });

        res.json({ hasPT: true, usage, history, upcoming });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================================================
// Internal helpers (limit enforcement + notifications)
// ==========================================================================

// Enforce the plan's per-period session limit. Returns { ok, code, message,
// usage, overrideUsed }. An admin may pass override=true to bypass the cap.
async function enforceLimit({ req, client, plan, sessionDate, override, excludeId = null }) {
    const period = plan.ptSessionPeriod || 'weekly';
    const allowed = plan.ptSessionsCount || 0;
    const window = getPeriodWindow(period, sessionDate);
    const used = await countCompletedInWindow(client.id, window, excludeId);
    const usage = { allowed, used, remaining: Math.max(0, allowed - used), period };

    if (allowed > 0 && used >= allowed) {
        const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        if (override && isAdmin) {
            return { ok: true, overrideUsed: true, usage };
        }
        return {
            ok: false,
            code: 403,
            overrideUsed: false,
            usage,
            message: `PT session limit reached (${used}/${allowed} for this ${period === 'monthly' ? 'month' : 'week'}).` +
                (isAdmin ? ' Enable override to complete anyway.' : ' An admin override is required.')
        };
    }
    return { ok: true, overrideUsed: false, usage };
}

// Notify the member (client app) about a PT session update via the existing
// Notification system. Best-effort — never blocks the request.
async function notifyMemberSession(session, client, status) {
    try {
        const when = new Date(session.sessionDate).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
        const messages = {
            scheduled: `Your Personal Training session is scheduled for ${when}.`,
            completed: `Your Personal Training session on ${when} was marked completed.`,
            cancelled: `Your Personal Training session on ${when} was cancelled.`,
            no_show: `You were marked no-show for the Personal Training session on ${when}.`
        };
        await Notification.create({
            message: messages[status] || `Your Personal Training session was updated.`,
            type: status === 'cancelled' || status === 'no_show' ? 'warning' : 'success',
            audience: 'client',
            clientId: client.id,
            facilityId: session.facilityId,
            path: '/personal-training'
        });
    } catch (e) {
        console.error('[pt] notification failed:', e.message);
    }
}
