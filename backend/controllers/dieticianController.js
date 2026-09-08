const { User, Client, DietChart, Notification } = require('../models');
const { Op } = require('sequelize');
const { isUnscoped, canAuthorPlan } = require('../config/permissions');

// Diet-plan sections that only a dietician may author. On an admin edit these
// keys are stripped from the incoming payload before merging, so admins can
// maintain the health-assessment portions without touching the meal plan.
const DIETICIAN_ONLY_KEYS = ['mealPlan', 'mealSpec', 'guidelines', 'nutritionGoals'];

// Roles that see the whole facility rather than only their assigned members.
// They may edit the health-assessment sections of a chart, but never the
// diet-plan sections — those stay with the authoring dietician.
//
// This is deliberately *only* about scoping. It used to double as the check for
// destructive authority, which is how a front-desk staff member ended up able
// to delete any member's diet chart. Who may delete is now decided by the
// CHART_DELETE capability at the route layer, which excludes staff.

// Return the id list of clients a dietician is allowed to act on. Admins are
// not scoped (returns null → "no restriction").
const scopedClientIds = async (req) => {
    if (isUnscoped(req.user.role)) return null;
    const clients = await Client.findAll({
        where: { facilityId: req.user.facilityId, dieticianId: req.user.id },
        attributes: ['id']
    });
    return clients.map((c) => c.id);
};

// ==========================================
// DIETICIANS (admin)
// ==========================================
exports.getDieticians = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const dieticians = await User.findAll({
            where: { facilityId, role: 'dietician' },
            attributes: ['id', 'name', 'email', 'phone'],
            order: [['name', 'ASC']]
        });
        // Attach assigned-client counts.
        const ids = dieticians.map((d) => d.id);
        const counts = {};
        if (ids.length) {
            const clients = await Client.findAll({
                where: { facilityId, dieticianId: { [Op.in]: ids } },
                attributes: ['dieticianId']
            });
            clients.forEach((c) => { counts[c.dieticianId] = (counts[c.dieticianId] || 0) + 1; });
        }
        res.json(dieticians.map((d) => ({ ...d.toJSON(), clientCount: counts[d.id] || 0 })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Assign a client to a dietician (admin). Body: { clientId }
exports.assignClient = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const dieticianId = parseInt(req.params.id, 10);
        const { clientId } = req.body;

        const dietician = await User.findOne({ where: { id: dieticianId, facilityId, role: 'dietician' } });
        if (!dietician) return res.status(404).json({ error: 'Dietician not found' });

        const client = await Client.findOne({ where: { id: clientId, facilityId } });
        if (!client) return res.status(404).json({ error: 'Client not found' });

        client.dieticianId = dieticianId;
        await client.save();

        // Addressed to the dietician alone — this message is written in the
        // second person, so a facility-wide audience would read wrong to
        // everyone except its intended recipient.
        await Notification.create({
            message: `You have been assigned a new client: "${client.name}".`,
            type: 'info',
            audience: 'user',
            userId: dieticianId,
            facilityId,
            path: '/nutrition'
        });

        res.json({ message: 'Client assigned', client: { id: client.id, name: client.name, dieticianId } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Unassign a client from a dietician (admin).
exports.unassignClient = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const clientId = parseInt(req.params.clientId, 10);
        const client = await Client.findOne({ where: { id: clientId, facilityId } });
        if (!client) return res.status(404).json({ error: 'Client not found' });
        client.dieticianId = null;
        await client.save();
        res.json({ message: 'Client unassigned' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// List clients for the nutrition workspace. Dietician → own clients; admin → all
// facility clients with their dietician (for the assignment UI).
exports.getClients = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const where = { facilityId };
        if (!isUnscoped(req.user.role)) where.dieticianId = req.user.id;

        const clients = await Client.findAll({
            where,
            attributes: ['id', 'name', 'email', 'phone', 'gender', 'height', 'weight', 'dieticianId', 'status'],
            include: [{ model: User, as: 'dietician', attributes: ['id', 'name'] }],
            order: [['name', 'ASC']]
        });
        res.json(clients);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// A compact "health source" pulled from the client's health profile, used to
// pre-fill / sync the diet chart (supplements, metrics, body composition).
exports.getClientHealthSource = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const clientId = parseInt(req.params.clientId, 10);
        const client = await Client.findOne({ where: { id: clientId, facilityId } });
        if (!client) return res.status(404).json({ error: 'Client not found' });
        if (!isUnscoped(req.user.role) && client.dieticianId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const hp = (client.healthProfile && typeof client.healthProfile === 'object') ? client.healthProfile : {};

        // Latest tracked weight (weeklyWeights sorted ascending by date).
        const weeklyWeights = Array.isArray(hp.weeklyWeights) ? hp.weeklyWeights : [];
        const sortedW = weeklyWeights.filter((w) => w && w.date).sort((a, b) => new Date(a.date) - new Date(b.date));
        const latestWeight = sortedW.length ? sortedW[sortedW.length - 1].weight : null;

        const height = client.height ?? hp.height ?? null;
        const weight = hp.currentWeight ?? latestWeight ?? client.weight ?? null;
        const heightM = height ? Number(height) / 100 : 0;
        const bmi = (heightM > 0 && weight) ? Number((Number(weight) / (heightM * heightM)).toFixed(1)) : null;

        // Latest measurement (measurementLogs are newest-first) → waist.
        const measurementLogs = Array.isArray(hp.measurementLogs) ? hp.measurementLogs : [];
        const waist = measurementLogs.length ? (measurementLogs[0].waist ?? null) : null;

        // Latest body composition entry → body fat & muscle mass (parsed from notes).
        const bcHist = Array.isArray(hp.bodyCompositionHistory) ? hp.bodyCompositionHistory : [];
        const latestBC = bcHist[0] || {};
        let muscleMass = null;
        if (latestBC.notes) {
            const m = /Muscle Mass:\s*([\d.]+)/i.exec(latestBC.notes);
            if (m) muscleMass = m[1];
        }
        const bodyFat = latestBC.bodyFat ?? hp.bodyFatPercentage ?? null;

        const supplements = (Array.isArray(hp.supplements) ? hp.supplements : [])
            .map((s) => ({ name: s.name, type: s.type, dosage: s.dosage }))
            .filter((s) => s.name);

        // The member's active training week, as programmed by their trainer.
        // Section 5 of the diet chart ("Exercise / Physical Activity") asks for
        // exactly this, day by day — without it the dietician retypes a
        // schedule the system already holds, and the copy drifts the moment the
        // trainer changes the program.
        const cs = hp.currentSchedule;
        let workoutSchedule = null;
        if (cs && Array.isArray(cs.days)) {
            const offDays = (Array.isArray(cs.offDays) ? cs.offDays : ['sunday'])
                .map((d) => String(d).toLowerCase());
            const WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const training = [...cs.days].sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0));
            // Lay the programmed days onto the week, skipping the rest days.
            let i = 0;
            const days = WEEK.map((weekday) => {
                const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
                if (offDays.includes(weekday)) return { day: label, activity: 'Rest', exercises: 0 };
                const d = training[i % training.length];
                i += 1;
                return {
                    day: label,
                    activity: d?.focus || '',
                    exercises: Array.isArray(d?.exercises) ? d.exercises.length : 0
                };
            });
            workoutSchedule = { name: cs.name || '', offDays, days };
        }

        res.json({
            height, weight, bmi, waist,
            targetWeight: hp.targetWeight ?? null,
            goalType: hp.goalType ?? null,
            bodyFat, muscleMass, bodyCompWeight: latestBC.weight ?? null,
            supplements,
            workoutSchedule
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// DIET CHARTS
// ==========================================
exports.getCharts = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const where = { facilityId };
        if (req.query.clientId) where.clientId = req.query.clientId;

        const allowedIds = await scopedClientIds(req);
        if (allowedIds !== null) {
            where.clientId = where.clientId
                ? (allowedIds.includes(parseInt(where.clientId, 10)) ? where.clientId : -1)
                : { [Op.in]: allowedIds.length ? allowedIds : [-1] };
        }

        const charts = await DietChart.findAll({
            where,
            attributes: ['id', 'clientId', 'dieticianId', 'title', 'assessmentDate', 'primaryGoal', 'status', 'createdAt', 'updatedAt'],
            include: [
                { model: Client, attributes: ['id', 'name'] },
                { model: User, as: 'dietician', attributes: ['id', 'name'] }
            ],
            order: [['updatedAt', 'DESC']]
        });
        res.json(charts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getChart = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const chart = await DietChart.findOne({
            where: { id: req.params.id, facilityId },
            include: [
                { model: Client, attributes: ['id', 'name', 'email', 'phone', 'gender', 'height', 'weight'] },
                { model: User, as: 'dietician', attributes: ['id', 'name'] }
            ]
        });
        if (!chart) return res.status(404).json({ error: 'Diet chart not found' });

        const allowedIds = await scopedClientIds(req);
        if (allowedIds !== null && !allowedIds.includes(chart.clientId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json(chart);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Create a diet chart (dietician only). Client must be assigned to this dietician.
exports.createChart = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const { clientId, title, assessmentDate, primaryGoal, status, data } = req.body;
        if (!clientId) return res.status(400).json({ error: 'clientId is required' });

        const client = await Client.findOne({ where: { id: clientId, facilityId } });
        if (!client) return res.status(404).json({ error: 'Client not found' });
        // A dietician may only author for their own assigned members. Admins are
        // unscoped, and the chart is attributed to the member's assigned
        // dietician (if any) rather than to the admin who opened it.
        if (!isUnscoped(req.user.role) && client.dieticianId !== req.user.id) {
            return res.status(403).json({ error: 'This client is not assigned to you' });
        }

        const chart = await DietChart.create({
            facilityId,
            clientId,
            dieticianId: isUnscoped(req.user.role) ? (client.dieticianId || null) : req.user.id,
            title: title || null,
            assessmentDate: assessmentDate || null,
            primaryGoal: primaryGoal || null,
            status: status || 'draft',
            data: data && typeof data === 'object' ? data : undefined
        });
        res.status(201).json(chart);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Update a diet chart. Dietician (owner) → full edit. Admin → health-assessment
// sections only (diet-plan keys stripped from the payload).
exports.updateChart = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const chart = await DietChart.findOne({ where: { id: req.params.id, facilityId } });
        if (!chart) return res.status(404).json({ error: 'Diet chart not found' });

        // Who may write the diet-plan sections, as opposed to merely the
        // health-assessment ones.
        const mayAuthorPlan = canAuthorPlan(req.user.role);
        if (!isUnscoped(req.user.role)) {
            // Dietician must own the client this chart belongs to.
            const client = await Client.findOne({ where: { id: chart.clientId, facilityId } });
            if (!client || client.dieticianId !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }

        const { title, assessmentDate, primaryGoal, status, data } = req.body;
        if (title !== undefined) chart.title = title;
        if (assessmentDate !== undefined) chart.assessmentDate = assessmentDate;
        if (primaryGoal !== undefined) chart.primaryGoal = primaryGoal;
        if (status !== undefined) chart.status = status;

        if (data && typeof data === 'object') {
            const incoming = { ...data };
            if (!mayAuthorPlan) {
                // Staff maintain the assessment sections; the diet plan itself
                // stays with the dietician (or the admin standing in for one).
                DIETICIAN_ONLY_KEYS.forEach((k) => delete incoming[k]);
            }
            chart.data = { ...(chart.data || {}), ...incoming };
            chart.changed('data', true);
        }
        await chart.save();
        res.json(chart);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteChart = async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const chart = await DietChart.findOne({ where: { id: req.params.id, facilityId } });
        if (!chart) return res.status(404).json({ error: 'Diet chart not found' });

        if (!isUnscoped(req.user.role)) {
            const client = await Client.findOne({ where: { id: chart.clientId, facilityId } });
            if (!client || client.dieticianId !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }
        await chart.destroy();
        res.json({ message: 'Diet chart deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// CLIENT APP (member) — read-only
// ==========================================
exports.getClientChart = async (req, res) => {
    try {
        const clientId = req.user.id;
        // Prefer an active chart; fall back to the most recently updated one.
        let chart = await DietChart.findOne({
            where: { clientId, status: 'active' },
            include: [{ model: User, as: 'dietician', attributes: ['id', 'name'] }],
            order: [['updatedAt', 'DESC']]
        });
        if (!chart) {
            chart = await DietChart.findOne({
                where: { clientId, status: { [Op.ne]: 'draft' } },
                include: [{ model: User, as: 'dietician', attributes: ['id', 'name'] }],
                order: [['updatedAt', 'DESC']]
            });
        }
        res.json({ chart: chart || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
