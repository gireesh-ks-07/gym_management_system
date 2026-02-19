const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sequelize, User, Facility, Client, Plan, Payment, SubscriptionPlan, Attendance, Notification, FacilityType, FacilityAutoPayEvent } = require('./models');
const { Op } = require('sequelize');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'supersecretkey'; // Use env variable in production
const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

app.use(cors());
app.use(bodyParser.json({
    verify: (req, res, buf) => {
        req.rawBody = buf?.toString('utf8') || '';
    }
}));

// Logger for all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Middleware for auth
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        console.log(`[AUTH] No token for ${req.path}`);
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.log(`[AUTH] Invalid token for ${req.path}: ${err.message}`);
            return res.status(403).json({ message: 'Forbidden' });
        }
        req.user = user;
        next();
    });
};

const authorize = (roles = []) => {
    return (req, res, next) => {
        console.log(`[AUTH] Authorizing path ${req.path} for role ${req.user.role}, required: ${roles}`);
        if (!roles.includes(req.user.role)) {
            console.log(`[AUTH] Authorization FAILED for ${req.user.role} on ${req.path}`);
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    };
};

const formatDisplayDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/');
};

const parseDateValue = (value) => {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addMonthsClamped = (baseDateValue, monthsToAdd) => {
    const baseDate = parseDateValue(baseDateValue);
    if (!baseDate) return null;

    const totalMonths = baseDate.getMonth() + Number(monthsToAdd || 0);
    const year = baseDate.getFullYear() + Math.floor(totalMonths / 12);
    const month = ((totalMonths % 12) + 12) % 12;
    const day = baseDate.getDate();
    const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();

    const result = new Date(baseDate);
    result.setFullYear(year, month, Math.min(day, lastDayOfTargetMonth));
    return result;
};

const calculateClientPlanExpiry = (baseDateValue, monthsToAdd) => {
    const expiry = addMonthsClamped(baseDateValue, monthsToAdd);
    if (!expiry) return null;
    expiry.setDate(expiry.getDate() - 1);
    return expiry;
};

const toDateOnlyString = (value) => {
    const date = parseDateValue(value);
    if (!date) return null;
    return date.toISOString().split('T')[0];
};

const createLimitExceededNotification = async (facility, type, limit, currentCount) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existingNote = await Notification.findOne({
        where: {
            role: 'superadmin',
            path: '/facilities',
            createdAt: { [Op.gte]: todayStart },
            message: {
                [Op.like]: `%${facility.name}%${type}%limit%`
            }
        }
    });

    if (!existingNote) {
        await Notification.create({
            message: `Facility "${facility.name}" exceeded ${type} limit (${currentCount}/${limit}) for its SaaS plan.`,
            type: 'warning',
            role: 'superadmin',
            path: '/facilities'
        });
    }
};

const getFacilityPlanContext = async (facilityId) => {
    if (!facilityId) return null;
    return Facility.findByPk(facilityId, { include: [SubscriptionPlan] });
};

const isRazorpayConfigured = () => Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

const mapDurationToRazorpayPeriod = (months) => {
    const normalizedMonths = Math.max(1, Number(months) || 1);
    if (normalizedMonths % 12 === 0) {
        return {
            period: 'yearly',
            interval: Math.max(1, normalizedMonths / 12),
            label: normalizedMonths === 12 ? 'Yearly' : `Every ${normalizedMonths / 12} years`
        };
    }
    return {
        period: 'monthly',
        interval: normalizedMonths,
        label: normalizedMonths === 1 ? 'Monthly' : `Every ${normalizedMonths} months`
    };
};

const callRazorpayApi = async (path, method = 'GET', payload = null) => {
    if (!isRazorpayConfigured()) {
        throw new Error('Razorpay keys are not configured');
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch(`${RAZORPAY_BASE_URL}${path}`, {
        method,
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json'
        },
        body: payload ? JSON.stringify(payload) : undefined
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
        const reason = data?.error?.description || data?.error?.reason || response.statusText;
        throw new Error(`Razorpay API error (${response.status}): ${reason}`);
    }

    return data;
};

const revokeFacilityAutoPay = async (facility, reason = 'Plan changed') => {
    if (!facility.razorpaySubscriptionId) return;

    try {
        await callRazorpayApi(
            `/subscriptions/${facility.razorpaySubscriptionId}/cancel`,
            'POST',
            { cancel_at_cycle_end: false }
        );
    } catch (error) {
        console.error(`[RAZORPAY] Failed to cancel subscription ${facility.razorpaySubscriptionId}: ${error.message}`);
    }

    facility.subscriptionStatus = 'pending';
    facility.subscriptionExpiresAt = null;
    facility.razorpaySubscriptionStatus = 'cancelled';
    facility.autopayCancelledAt = new Date();
    facility.lastAutopayFailureReason = reason;
    facility.lastAutopayFailureAt = new Date();
    facility.razorpaySubscriptionId = null;
    facility.razorpayPlanId = null;
    facility.autopayAuthorizedAt = null;
};

const setFacilityBlocked = async (facility, reason = 'AutoPay unavailable', razorpayStatus = 'cancelled') => {
    facility.subscriptionStatus = 'blocked';
    facility.subscriptionExpiresAt = null;
    facility.razorpaySubscriptionStatus = razorpayStatus;
    facility.autopayCancelledAt = new Date();
    facility.lastAutopayFailureAt = new Date();
    facility.lastAutopayFailureReason = reason;
    await facility.save();
};

const syncFacilitySubscriptionFromRazorpay = async (facility) => {
    if (!facility?.razorpaySubscriptionId || !isRazorpayConfigured()) return facility;

    try {
        const remote = await callRazorpayApi(`/subscriptions/${facility.razorpaySubscriptionId}`);
        const remoteStatus = remote?.status || null;
        if (!remoteStatus) return facility;
        const previousRazorpayStatus = facility.razorpaySubscriptionStatus;

        const successStatuses = new Set(['active', 'authenticated']);
        const blockedStatuses = new Set(['cancelled', 'halted', 'paused']);

        let changed = false;
        facility.razorpaySubscriptionStatus = remoteStatus;

        if (successStatuses.has(remoteStatus) && facility.subscriptionStatus !== 'active') {
            facility.subscriptionStatus = 'active';
            facility.autopayAuthorizedAt = facility.autopayAuthorizedAt || new Date();
            facility.autopayCancelledAt = null;
            facility.lastAutopayFailureAt = null;
            facility.lastAutopayFailureReason = null;
            changed = true;
        } else if (blockedStatuses.has(remoteStatus) && facility.subscriptionStatus !== 'blocked') {
            facility.subscriptionStatus = 'blocked';
            facility.subscriptionExpiresAt = null;
            facility.autopayCancelledAt = new Date();
            facility.lastAutopayFailureAt = new Date();
            facility.lastAutopayFailureReason = `Razorpay status: ${remoteStatus}`;
            changed = true;
        } else if (previousRazorpayStatus !== remoteStatus) {
            changed = true;
        }

        if (changed) {
            await facility.save();
        }
    } catch (error) {
        console.error(`[RAZORPAY] Subscription sync failed for facility ${facility?.id}: ${error.message}`);
    }

    return facility;
};

const parseRazorpayUnixTimestamp = (value) => {
    if (!value) return null;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return null;
    return new Date(numeric * 1000);
};

const logAutoPayEvent = async (facility, eventType, subscriptionEntity = null, paymentEntity = null, rawPayload = null) => {
    if (!facility) return;

    const paymentId = paymentEntity?.id || null;
    const subscriptionId = subscriptionEntity?.id || paymentEntity?.subscription_id || facility.razorpaySubscriptionId || null;
    const exists = paymentId
        ? await FacilityAutoPayEvent.findOne({ where: { razorpayPaymentId: paymentId, eventType } })
        : null;

    if (exists) return;

    await FacilityAutoPayEvent.create({
        facilityId: facility.id,
        eventType,
        razorpaySubscriptionId: subscriptionId,
        razorpayPaymentId: paymentId,
        amount: paymentEntity?.amount ? Number(paymentEntity.amount) / 100 : null,
        currency: paymentEntity?.currency || 'INR',
        status: paymentEntity?.status || subscriptionEntity?.status || null,
        method: paymentEntity?.method || null,
        failureReason: paymentEntity?.error_description || paymentEntity?.description || null,
        paidAt: parseRazorpayUnixTimestamp(paymentEntity?.created_at),
        payload: rawPayload
    });
};

const syncClientPlanStatuses = async (facilityId = null) => {
    const backfillWhere = { planId: { [Op.ne]: null } };

    if (facilityId) {
        backfillWhere.facilityId = facilityId;
    } else {
        backfillWhere.facilityId = { [Op.ne]: null };
    }

    const clientsMissingExpiry = await Client.findAll({
        where: backfillWhere,
        include: [Plan]
    });

    for (const client of clientsMissingExpiry) {
        if (!client.Plan) continue;

        if (!client.billingRenewalDate) {
            client.billingRenewalDate = toDateOnlyString(client.joiningDate || client.createdAt || new Date());
        }

        const expiryDate = calculateClientPlanExpiry(client.billingRenewalDate, client.Plan.duration);
        if (!expiryDate) continue;
        client.planExpiresAt = expiryDate;
        client.status = expiryDate < new Date() ? 'payment_due' : 'active';
        await client.save();
    }

    const now = new Date();
    const where = {
        planId: { [Op.ne]: null },
        planExpiresAt: { [Op.ne]: null, [Op.lt]: now }
    };

    if (facilityId) {
        where.facilityId = facilityId;
    } else {
        where.facilityId = { [Op.ne]: null };
    }

    await Client.update(
        { status: 'payment_due' },
        { where }
    );
};

// Middleware to check Facility Subscription Status
const checkSubscriptionStatus = async (req, res, next) => {
    // Superadmin bypasses subscription checks
    if (req.user.role === 'superadmin') return next();

    if (!req.user.facilityId) {
        return res.status(400).json({ message: 'User not associated with a facility' });
    }

    try {
        const facility = await Facility.findByPk(req.user.facilityId);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });
        await syncFacilitySubscriptionFromRazorpay(facility);

        if (facility.subscriptionStatus !== 'active') {
            return res.status(403).json({
                message: 'Facility subscription is ' + facility.subscriptionStatus + '. AutoPay activation is required.',
                code: 'SUBSCRIPTION_' + facility.subscriptionStatus.toUpperCase()
            });
        }
        next();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// --- AUTH ROUTES ---

app.post('/api/auth/register', async (req, res) => {
    // Only for initial setup or specific use case. 
    // In a real app, only Superadmin creates Admins, and Admins create Staff.
    try {
        const { name, email, password, role, facilityId } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword, role, facilityId });
        res.json({ message: 'User registered successfully', user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role, facilityId: user.facilityId }, SECRET_KEY, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, facilityId: user.facilityId } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- FACILITY ROUTES (Superadmin) ---

// --- SUBSCRIPTION PLAN ROUTES (Superadmin) ---

app.post('/api/subscription-plans', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, price, duration, maxMembers, maxStaff, description } = req.body;
        const plan = await SubscriptionPlan.create({ name, price, duration, maxMembers, maxStaff, description });

        // Add Notification for Super Admin
        await Notification.create({
            message: `New SaaS Plan "${name}" has been created.`,
            type: 'info',
            role: 'superadmin',
            path: '/subscription-plans'
        });

        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/subscription-plans', authenticate, async (req, res) => {
    try {
        const plans = await SubscriptionPlan.findAll();
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/subscription-plans/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, price, duration, maxMembers, maxStaff, description } = req.body;
        const plan = await SubscriptionPlan.findByPk(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        plan.name = name;
        plan.price = price;
        plan.duration = duration;
        plan.maxMembers = maxMembers;
        plan.maxStaff = maxStaff;
        plan.description = description;

        await plan.save();
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/subscription-plans/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByPk(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        await plan.destroy();
        res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- FACILITY TYPE ROUTES (Superadmin) ---

app.post('/api/facility-types', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, icon, memberFormConfig } = req.body;
        const type = await FacilityType.create({ name, icon, memberFormConfig });
        res.json(type);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/facility-types', authenticate, async (req, res) => {
    try {
        const types = await FacilityType.findAll();
        res.json(types);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/facility-types/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, icon, memberFormConfig } = req.body;
        const type = await FacilityType.findByPk(req.params.id);
        if (!type) return res.status(404).json({ message: 'Facility type not found' });

        type.name = name;
        type.icon = icon;
        type.memberFormConfig = memberFormConfig;

        await type.save();
        res.json(type);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/facility-types/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const type = await FacilityType.findByPk(req.params.id, {
            include: [{ model: Facility, limit: 1 }]
        });
        if (!type) return res.status(404).json({ message: 'Facility type not found' });

        if (type.Facilities && type.Facilities.length > 0) {
            return res.status(400).json({ message: 'Cannot delete this facility type because it is being used by one or more facilities.' });
        }

        await type.destroy();
        res.json({ message: 'Facility type deleted successfully' });
    } catch (error) {
        console.error('Facility Type Delete Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- FACILITY MANAGEMENT ROUTES (Superadmin) ---

app.post('/api/facilities', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, type, address, adminEmail, adminPassword, adminName, planId, facilityTypeId } = req.body;

        if (!planId) {
            return res.status(400).json({ message: 'Subscription plan is required while creating facility.' });
        }

        const plan = await SubscriptionPlan.findByPk(planId);
        if (!plan) return res.status(404).json({ message: 'Subscription plan not found' });

        const facility = await Facility.create({
            name,
            type: type || 'gym',
            address,
            subscriptionPlanId: planId,
            subscriptionExpiresAt: null,
            subscriptionStatus: 'pending',
            facilityTypeId: facilityTypeId || null
        });

        // Add Notification for Super Admin
        await Notification.create({
            message: `New Facility "${name}" has been registered.`,
            type: 'success',
            role: 'superadmin',
            path: '/facilities'
        });

        // Create initial admin for the facility
        if (adminEmail && adminPassword) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await User.create({
                name: adminName || 'Admin',
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
                facilityId: facility.id
            });
        }

        res.json(facility);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/facilities', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const facilities = await Facility.findAll({
            include: [
                { model: User },
                { model: SubscriptionPlan },
                { model: FacilityType }
            ]
        });

        // Auto-update expiry status on list view
        const now = new Date();
        for (const facility of facilities) {
            if (facility.subscriptionStatus === 'active' && facility.subscriptionExpiresAt && new Date(facility.subscriptionExpiresAt) < now) {
                facility.subscriptionStatus = 'expired';
                await facility.save();
            }
        }

        const facilitiesWithUserDetails = await Promise.all(
            facilities.map(async (facility) => {
                const [adminCount, staffCount, memberCount] = await Promise.all([
                    User.count({ where: { facilityId: facility.id, role: 'admin' } }),
                    User.count({ where: { facilityId: facility.id, role: 'staff' } }),
                    Client.count({ where: { facilityId: facility.id } })
                ]);

                return {
                    ...facility.toJSON(),
                    userDetails: {
                        totalUsers: adminCount + staffCount,
                        adminCount,
                        staffCount,
                        memberCount
                    }
                };
            })
        );

        res.json(facilitiesWithUserDetails);
    } catch (error) {
        console.error('Error fetching facilities:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/facilities/:id/assign-plan', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { planId } = req.body;
        const facility = await Facility.findByPk(req.params.id);
        const plan = await SubscriptionPlan.findByPk(planId);

        if (!facility || !plan) return res.status(404).json({ message: 'Facility or Plan not found' });

        await revokeFacilityAutoPay(facility, 'Subscription plan updated by super admin');
        facility.subscriptionPlanId = plan.id;
        facility.subscriptionStatus = 'pending';
        facility.subscriptionExpiresAt = null;
        facility.razorpayPlanId = null;
        facility.razorpaySubscriptionId = null;
        facility.razorpaySubscriptionStatus = 'pending_activation';
        facility.autopayAuthorizedAt = null;
        await facility.save();

        await Notification.create({
            message: `Facility "${facility.name}" plan changed to "${plan.name}". Re-subscription required.`,
            type: 'warning',
            facilityId: facility.id,
            path: '/'
        });

        res.json(facility);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/facilities/:id/status', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { status } = req.body; // active, pending, blocked
        const facility = await Facility.findByPk(req.params.id);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });

        const allowed = ['active', 'pending', 'blocked', 'suspended', 'expired'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: 'Invalid subscription status' });
        }

        // If super admin moves facility away from active, revoke current AutoPay
        // so status doesn't auto-sync back to active from an existing Razorpay subscription.
        if (status !== 'active' && facility.razorpaySubscriptionId) {
            await revokeFacilityAutoPay(facility, `Subscription manually set to ${status} by super admin`);
        }

        facility.subscriptionStatus = status;
        if (status !== 'active') {
            facility.subscriptionExpiresAt = null;
        }
        await facility.save();
        res.json(facility);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/facilities/:id/reset-password', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const admin = await User.findOne({ where: { facilityId: req.params.id, role: 'admin' } });
        if (!admin) return res.status(404).json({ message: 'Admin user not found for this facility' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        admin.password = hashedPassword;
        await admin.save();

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/facilities/:id/subscription-update', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { status, expiresAt } = req.body;
        const facility = await Facility.findByPk(req.params.id);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });

        if (status) {
            const allowed = ['active', 'pending', 'blocked', 'suspended', 'expired'];
            if (!allowed.includes(status)) {
                return res.status(400).json({ message: 'Invalid subscription status' });
            }

            if (status !== 'active' && facility.razorpaySubscriptionId) {
                await revokeFacilityAutoPay(facility, `Subscription manually set to ${status} by super admin`);
            }
            facility.subscriptionStatus = status;
            if (status !== 'active') {
                facility.subscriptionExpiresAt = null;
            }
        }
        if (expiresAt) facility.subscriptionExpiresAt = new Date(expiresAt);

        await facility.save();
        res.json(facility);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SUPER ADMIN DASHBOARD ---
app.get('/api/superadmin/dashboard', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const totalFacilities = await Facility.count();
        const activeFacilities = await Facility.count({ where: { subscriptionStatus: 'active' } });
        const suspendedFacilities = await Facility.count({ where: { subscriptionStatus: { [Op.in]: ['suspended', 'blocked', 'pending'] } } });
        const expiredFacilities = await Facility.count({ where: { subscriptionStatus: 'expired' } });

        // Calculate Total Revenue (Platform)
        const facilitiesWithPlans = await Facility.findAll({
            where: { subscriptionStatus: 'active' },
            include: [{ model: SubscriptionPlan }]
        });

        const mrr = facilitiesWithPlans.reduce((sum, facility) => sum + (facility.SubscriptionPlan ? (facility.SubscriptionPlan.price / facility.SubscriptionPlan.duration) : 0), 0);

        // Expiring soon (next 7 days)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const now = new Date();

        const expiringFacilities = await Facility.findAll({
            where: {
                subscriptionStatus: 'active',
                subscriptionExpiresAt: {
                    [Op.between]: [now, nextWeek]
                }
            },
            include: [{ model: SubscriptionPlan }]
        });

        const blockedFacilities = await Facility.findAll({
            where: { subscriptionStatus: 'blocked' },
            include: [{ model: SubscriptionPlan }],
            order: [['updatedAt', 'DESC']]
        });

        const autopayPayments = FacilityAutoPayEvent
            ? await FacilityAutoPayEvent.findAll({
                include: [{ model: Facility, attributes: ['id', 'name'] }],
                order: [['createdAt', 'DESC']],
                limit: 50
            })
            : [];

        // Create notifications for expiring facilities
        const todayStart = new Date().setHours(0, 0, 0, 0);
        for (const facility of expiringFacilities) {
            const existingNote = await Notification.findOne({
                where: {
                    message: { [Op.like]: `%${facility.name}% expiring%` },
                    createdAt: { [Op.gte]: todayStart }
                }
            });

            if (!existingNote) {
                await Notification.create({
                    message: `Subscription for "${facility.name}" is expiring soon (${formatDisplayDate(facility.subscriptionExpiresAt)}).`,
                    type: 'warning',
                    role: 'superadmin',
                    path: '/facilities'
                });
            }
        }

        res.json({
            stats: {
                totalFacilities, activeFacilities, suspendedFacilities, expiredFacilities, mrr
            },
            expiringFacilities,
            blockedFacilities,
            autopayPayments
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint for Facility Admin to check their own subscription
app.get('/api/facility/subscription', authenticate, async (req, res) => {
    try {
        if (!req.user.facilityId) return res.status(400).json({ message: 'No facility associated' });
        const facility = await Facility.findByPk(req.user.facilityId, { include: [SubscriptionPlan, FacilityType] });
        if (facility) {
            await syncFacilitySubscriptionFromRazorpay(facility);
            await facility.reload({ include: [SubscriptionPlan, FacilityType] });
        }
        res.json(facility);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/facility/subscription/create-autopay', authenticate, authorize(['admin']), async (req, res) => {
    try {
        if (!isRazorpayConfigured()) {
            return res.status(500).json({ message: 'Razorpay sandbox credentials are missing on server.' });
        }

        const facility = await Facility.findByPk(req.user.facilityId, { include: [SubscriptionPlan] });
        if (!facility) return res.status(404).json({ message: 'Facility not found' });
        if (!facility.subscriptionPlanId || !facility.SubscriptionPlan) {
            return res.status(400).json({ message: 'No subscription plan assigned to this facility.' });
        }

        if (facility.subscriptionStatus === 'active') {
            return res.status(400).json({ message: 'AutoPay already active for this facility.' });
        }

        if (facility.razorpaySubscriptionId) {
            await revokeFacilityAutoPay(facility, 'Reinitializing AutoPay setup');
            await facility.save();
        }

        const planDef = facility.SubscriptionPlan;
        const { period, interval, label } = mapDurationToRazorpayPeriod(planDef.duration);
        const amountInPaise = Math.round(Number(planDef.price || 0) * 100);
        if (amountInPaise <= 0) {
            return res.status(400).json({ message: 'Plan price should be greater than zero for AutoPay.' });
        }

        const razorpayPlan = await callRazorpayApi('/plans', 'POST', {
            period,
            interval,
            item: {
                name: `${planDef.name} (${label})`,
                amount: amountInPaise,
                currency: 'INR',
                description: `Facility SaaS subscription for ${facility.name}`
            },
            notes: {
                facilityId: String(facility.id),
                subscriptionPlanId: String(planDef.id)
            }
        });

        const razorpaySubscription = await callRazorpayApi('/subscriptions', 'POST', {
            plan_id: razorpayPlan.id,
            customer_notify: 1,
            quantity: 1,
            total_count: 100,
            notes: {
                facilityId: String(facility.id),
                subscriptionPlanId: String(planDef.id)
            }
        });

        facility.razorpayPlanId = razorpayPlan.id;
        facility.razorpaySubscriptionId = razorpaySubscription.id;
        facility.razorpaySubscriptionStatus = razorpaySubscription.status || 'created';
        facility.subscriptionStatus = 'pending';
        facility.subscriptionExpiresAt = null;
        facility.autopayAuthorizedAt = null;
        facility.autopayCancelledAt = null;
        facility.lastAutopayFailureAt = null;
        facility.lastAutopayFailureReason = null;
        await facility.save();

        const adminUser = await User.findByPk(req.user.id);

        res.json({
            keyId: RAZORPAY_KEY_ID,
            subscriptionId: razorpaySubscription.id,
            amount: amountInPaise,
            currency: 'INR',
            shortUrl: razorpaySubscription.short_url || null,
            facilityName: facility.name,
            planName: planDef.name,
            billingLabel: label,
            prefill: {
                name: adminUser?.name || '',
                email: adminUser?.email || ''
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/facility/subscription/verify-autopay', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body || {};
        if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing Razorpay subscription authorization fields.' });
        }

        const facility = await Facility.findByPk(req.user.facilityId, { include: [SubscriptionPlan] });
        if (!facility) return res.status(404).json({ message: 'Facility not found' });
        if (facility.razorpaySubscriptionId !== razorpay_subscription_id) {
            // Recovery path: if DB has stale subscription ID, verify Razorpay notes and self-heal.
            let incomingSubscription;
            try {
                incomingSubscription = await callRazorpayApi(`/subscriptions/${razorpay_subscription_id}`);
            } catch (e) {
                return res.status(400).json({
                    message: 'Subscription mismatch for this facility.',
                    details: 'Unable to verify incoming subscription with Razorpay.'
                });
            }

            const incomingFacilityId = String(incomingSubscription?.notes?.facilityId || '');
            if (incomingFacilityId && incomingFacilityId === String(facility.id)) {
                facility.razorpaySubscriptionId = razorpay_subscription_id;
                facility.razorpayPlanId = incomingSubscription.plan_id || facility.razorpayPlanId;
                await facility.save();
            } else {
                return res.status(400).json({
                    message: 'Subscription mismatch for this facility.',
                    expectedSubscriptionId: facility.razorpaySubscriptionId || null,
                    receivedSubscriptionId: razorpay_subscription_id
                });
            }
        }

        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: 'Invalid Razorpay signature.' });
        }

        let remoteSubscription = await callRazorpayApi(`/subscriptions/${razorpay_subscription_id}`);
        const successStatuses = ['active', 'authenticated'];

        // Razorpay sandbox can lag and briefly keep status as "created"
        // right after successful checkout callback/signature.
        if (!successStatuses.includes(remoteSubscription.status)) {
            for (let attempt = 0; attempt < 3; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, 1200));
                remoteSubscription = await callRazorpayApi(`/subscriptions/${razorpay_subscription_id}`);
                if (successStatuses.includes(remoteSubscription.status)) {
                    break;
                }
            }
        }

        const acceptedStatuses = new Set(['active', 'authenticated', 'created']);
        if (!acceptedStatuses.has(remoteSubscription.status)) {
            return res.status(400).json({
                message: `AutoPay authorization incomplete. Current Razorpay status: ${remoteSubscription.status}`
            });
        }

        facility.subscriptionStatus = 'active';
        facility.subscriptionExpiresAt = null;
        facility.razorpaySubscriptionStatus = remoteSubscription.status;
        facility.autopayAuthorizedAt = new Date();
        facility.autopayCancelledAt = null;
        facility.lastAutopayFailureAt = null;
        facility.lastAutopayFailureReason = null;
        await facility.save();

        await Notification.create({
            message: `AutoPay activated successfully for "${facility.name}".`,
            type: 'success',
            role: 'superadmin',
            path: '/facilities'
        });

        res.json(facility);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/razorpay/webhook', async (req, res) => {
    try {
        if (!RAZORPAY_WEBHOOK_SECRET) {
            return res.status(500).json({ message: 'Webhook secret not configured' });
        }

        const receivedSignature = req.headers['x-razorpay-signature'] || '';
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
            .update(req.rawBody || '')
            .digest('hex');

        if (receivedSignature !== expectedSignature) {
            return res.status(400).json({ message: 'Invalid webhook signature' });
        }

        const event = req.body?.event;
        const payload = req.body?.payload || {};
        const subscriptionEntity = payload?.subscription?.entity || null;
        const paymentEntity = payload?.payment?.entity || null;
        const razorpaySubscriptionId = subscriptionEntity?.id || paymentEntity?.subscription_id || null;
        if (!razorpaySubscriptionId) return res.json({ ok: true });

        const facility = await Facility.findOne({ where: { razorpaySubscriptionId } });
        if (!facility) return res.json({ ok: true });

        const blockingEvents = new Set(['subscription.cancelled', 'subscription.halted', 'subscription.paused', 'payment.failed']);
        const successEvents = new Set(['subscription.activated', 'subscription.authenticated', 'subscription.charged', 'subscription.resumed']);

        await logAutoPayEvent(facility, event, subscriptionEntity, paymentEntity, req.body);

        if (blockingEvents.has(event)) {
            const reason = paymentEntity?.error_description || subscriptionEntity?.status || event;
            await setFacilityBlocked(facility, reason, subscriptionEntity?.status || 'cancelled');

            await Notification.create({
                message: `AutoPay issue for "${facility.name}": ${reason}. Facility is now blocked.`,
                type: 'error',
                role: 'superadmin',
                path: '/facilities'
            });

            await Notification.create({
                message: `AutoPay failed/stopped (${reason}). Access is blocked until subscription is reactivated.`,
                type: 'error',
                facilityId: facility.id,
                path: '/'
            });
        } else if (successEvents.has(event) && facility.subscriptionStatus !== 'active') {
            facility.subscriptionStatus = 'active';
            facility.razorpaySubscriptionStatus = subscriptionEntity?.status || 'active';
            facility.autopayAuthorizedAt = new Date();
            facility.autopayCancelledAt = null;
            await facility.save();

            await Notification.create({
                message: `AutoPay charge/activation successful for "${facility.name}".`,
                type: 'success',
                role: 'superadmin',
                path: '/facilities'
            });
        }

        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CLIENT ROUTES (Admin, Staff) ---

app.post('/api/clients', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const { name, email, phone, height, weight, joiningDate, billingRenewalDate, gender, aadhaar_number, address, customFields } = req.body;
        // Ensure the staff/admin belongs to a facility
        if (!req.user.facilityId) return res.status(400).json({ message: 'User not associated with a facility' });

        const facility = await getFacilityPlanContext(req.user.facilityId);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });

        const maxMembers = facility.SubscriptionPlan?.maxMembers;
        if (maxMembers != null) {
            const currentMembers = await Client.count({ where: { facilityId: req.user.facilityId } });
            if (currentMembers >= maxMembers) {
                await createLimitExceededNotification(facility, 'member', maxMembers, currentMembers + 1);
                return res.status(403).json({
                    message: `Member limit reached for your plan (${maxMembers}). Upgrade your plan to add more members.`,
                    code: 'PLAN_MEMBER_LIMIT_EXCEEDED'
                });
            }
        }

        const normalizedJoiningDate = toDateOnlyString(joiningDate || new Date());
        const normalizedBillingDate = toDateOnlyString(billingRenewalDate || normalizedJoiningDate || new Date());

        const clientData = {
            name,
            email: email || null,
            phone,
            height: height || null,
            weight: weight || null,
            joiningDate: normalizedJoiningDate,
            billingRenewalDate: normalizedBillingDate,
            gender,
            aadhaar_number: aadhaar_number || null,
            address: address || null,
            planId: req.body.planId || null,
            facilityId: req.user.facilityId,
            addedBy: req.user.id,
            customFields: customFields || {}
        };

        if (clientData.planId) {
            const plan = await Plan.findByPk(clientData.planId);
            if (plan) {
                const expiryDate = calculateClientPlanExpiry(clientData.billingRenewalDate, plan.duration);
                if (expiryDate) {
                    clientData.planExpiresAt = expiryDate;
                    clientData.status = expiryDate < new Date() ? 'payment_due' : 'active';
                }
            }
        }

        const client = await Client.create(clientData);

        // Add Notification for Facility Admin
        await Notification.create({
            message: `New member "${name}" has been registered.`,
            type: 'success',
            facilityId: req.user.facilityId,
            path: '/clients'
        });

        res.json(client);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- STAFF ROUTES (Admin) ---

app.post('/api/staff', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (role !== 'staff') return res.status(400).json({ message: 'Admins create staff only' });

        const facility = await getFacilityPlanContext(req.user.facilityId);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });

        const maxStaff = facility.SubscriptionPlan?.maxStaff;
        if (maxStaff != null) {
            const currentStaff = await User.count({ where: { facilityId: req.user.facilityId, role: 'staff' } });
            if (currentStaff >= maxStaff) {
                await createLimitExceededNotification(facility, 'staff', maxStaff, currentStaff + 1);
                return res.status(403).json({
                    message: `Staff limit reached for your plan (${maxStaff}). Upgrade your plan to add more staff.`,
                    code: 'PLAN_STAFF_LIMIT_EXCEEDED'
                });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const staff = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'staff',
            facilityId: req.user.facilityId
        });

        // Add Notification for Facility Admin
        await Notification.create({
            message: `New staff member "${name}" has been added.`,
            type: 'success',
            facilityId: req.user.facilityId,
            path: '/staff'
        });

        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/staff', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const staff = await User.findAll({ where: { facilityId: req.user.facilityId, role: 'staff' } });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- PLAN ROUTES (Admin) ---

app.post('/api/plans', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const { name, price, duration, description, features } = req.body;
        const plan = await Plan.create({
            name, price, duration, description, features,
            facilityId: req.user.facilityId
        });
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/plans/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const { name, price, duration, description, features } = req.body;
        const plan = await Plan.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });

        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        plan.name = name;
        plan.price = price;
        plan.duration = duration;
        plan.description = description;
        plan.features = features;

        await plan.save();
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/plans', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff', 'superadmin']), async (req, res) => {
    try {
        const plans = await Plan.findAll({ where: { facilityId: req.user.facilityId } });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DASHBOARD ROUTE ---
app.get('/api/dashboard', authenticate, authorize(['admin', 'staff', 'superadmin']), async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const now = new Date();

        // 0. Auto-update statuses for expired plans
        await syncClientPlanStatuses(facilityId);

        // 1. Total Active Clients
        const totalClients = await Client.count({ where: { facilityId } });

        // 2. Revenue (Total, Monthly)
        const totalRevenue = await Payment.sum('amount', { where: { facilityId } }) || 0;

        // 3. Active Staff
        const activeStaff = await User.count({ where: { facilityId, role: 'staff' } });

        // 3b. Due Clients
        const dueClients = await Client.count({ where: { facilityId, status: 'payment_due' } });
        const expiredClients = await Client.count({
            where: {
                facilityId,
                planExpiresAt: { [Op.lt]: now }
            }
        });

        // 4. Recent Clients (Last 5)
        const recentClients = await Client.findAll({
            where: { facilityId },
            limit: 5,
            order: [['createdAt', 'DESC']],
            include: [{ model: Plan, attributes: ['name'] }]
        });

        // 5. Revenue by Month (Last 6 months) for Chart
        const payments = await Payment.findAll({
            where: { facilityId },
            attributes: ['amount', 'date', 'method']
        });

        const revenueByMonth = {}; // 'YYYY-MM': total
        const revenueByMethod = { cash: 0, upi: 0 };

        payments.forEach(p => {
            const month = p.date.substring(0, 7); // 'YYYY-MM'
            revenueByMonth[month] = (revenueByMonth[month] || 0) + p.amount;
            if (revenueByMethod[p.method] !== undefined) revenueByMethod[p.method] += p.amount;
        });

        const revenueChartData = Object.entries(revenueByMonth)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-6); // Last 6 months

        // 6. Clients by Plan
        const clientsByPlan = await Client.findAll({
            where: { facilityId },
            include: [{ model: Plan, attributes: ['name'] }],
            attributes: ['planId']
        });

        const planDistribution = {};
        clientsByPlan.forEach(c => {
            const planName = c.Plan ? c.Plan.name : 'No Plan';
            planDistribution[planName] = (planDistribution[planName] || 0) + 1;
        });

        const planChartData = Object.entries(planDistribution).map(([name, value]) => ({ name, value }));

        res.json({
            stats: {
                totalClients,
                totalRevenue,
                activeStaff,
                dueClients,
                expiredClients
            },
            recentClients,
            revenueChartData,
            revenueByMethod,
            planChartData
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/payments', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const { clientId, amount, method, date, transactionId } = req.body;
        const payment = await Payment.create({
            clientId,
            amount,
            method,
            date,
            transactionId,
            processedBy: req.user.id,
            facilityId: req.user.facilityId
        });

        // Activate client and set expiry
        const client = await Client.findByPk(clientId, { include: [Plan] });
        if (client) {
            const normalizedBillingDate = toDateOnlyString(date || new Date());
            if (normalizedBillingDate) {
                client.billingRenewalDate = normalizedBillingDate;
            }
            client.status = 'active';

            // Calculate expiry based on plan duration
            if (client.Plan) {
                const durationMonths = client.Plan.duration;
                const expiryDate = calculateClientPlanExpiry(client.billingRenewalDate, durationMonths);
                if (expiryDate) {
                    client.planExpiresAt = expiryDate;
                }
            }
            await client.save();
        }

        // Fetch the created payment with associations
        const fullPayment = await Payment.findByPk(payment.id, {
            include: [
                { model: Client, attributes: ['name'] },
                { model: User, as: 'processor', attributes: ['name'] }
            ]
        });

        res.json(fullPayment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update GET /api/clients to check expiry
app.get('/api/clients', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff', 'superadmin']), async (req, res) => {
    try {
        let where = {};
        if (req.user.role !== 'superadmin') {
            where.facilityId = req.user.facilityId;
        }

        await syncClientPlanStatuses(req.user.role === 'superadmin' ? null : req.user.facilityId);

        const clients = await Client.findAll({ where, include: [Plan] });
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/payments', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const payments = await Payment.findAll({
            where: { facilityId: req.user.facilityId },
            include: [
                { model: Client, attributes: ['name'] },
                { model: User, as: 'processor', attributes: ['name'] }
            ],
            order: [['date', 'DESC']]
        });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/reports', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff', 'superadmin']), async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const clientWhere = facilityId ? { facilityId } : {};

        // Plan Distribution
        const plans = await Plan.findAll({ where: clientWhere });
        const planStats = await Promise.all(plans.map(async (plan) => {
            const count = await Client.count({ where: { ...clientWhere, planId: plan.id } });
            return { name: plan.name, count };
        }));

        // Payment Stats
        const updatedWhere = facilityId ? { facilityId } : {};
        const payments = await Payment.findAll({
            where: updatedWhere,
            order: [['date', 'DESC']],
            limit: 10,
            include: [{ model: Client, attributes: ['name'] }]
        });

        const allPayments = await Payment.findAll({ where: updatedWhere });
        const revenue = { total: 0, cash: 0, upi: 0 };
        allPayments.forEach(p => {
            revenue.total += p.amount;
            if (p.method === 'cash') revenue.cash += p.amount;
            if (p.method === 'upi') revenue.upi += p.amount;
        });

        let genderStats = null;
        if (req.user.role !== 'superadmin') {
            const clients = await Client.findAll({ where: clientWhere, attributes: ['gender'] });
            genderStats = { male: 0, female: 0, other: 0 };
            clients.forEach(c => {
                if (genderStats[c.gender] !== undefined) {
                    genderStats[c.gender] += 1;
                }
            });
        }

        const blockedWhere = req.user.role === 'superadmin'
            ? { subscriptionStatus: 'blocked' }
            : { id: facilityId, subscriptionStatus: 'blocked' };

        const blockedFacilities = await Facility.findAll({
            where: blockedWhere,
            include: [{ model: SubscriptionPlan }]
        });

        const autopayEventWhere = req.user.role === 'superadmin'
            ? {}
            : { facilityId };

        const autopayPayments = FacilityAutoPayEvent
            ? await FacilityAutoPayEvent.findAll({
                where: autopayEventWhere,
                include: [{ model: Facility, attributes: ['id', 'name'] }],
                order: [['createdAt', 'DESC']],
                limit: 50
            })
            : [];

        const autopayStats = {
            totalEvents: autopayPayments.length,
            failedEvents: autopayPayments.filter((e) => e.eventType === 'payment.failed').length,
            chargedEvents: autopayPayments.filter((e) => e.eventType === 'subscription.charged').length
        };

        res.json({
            revenue,
            planStats,
            recentPayments: payments,
            genderStats,
            blockedFacilities,
            autopayPayments,
            autopayStats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- UPDATE & DELETE ROUTES ---

app.put('/api/facilities/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, address } = req.body;
        const facility = await Facility.findByPk(req.params.id);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });

        facility.name = name;
        facility.address = address;
        await facility.save();
        res.json(facility);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/attendance/today', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff', 'superadmin']), async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const where = { date: today };
        if (req.user.facilityId) where.facilityId = req.user.facilityId;

        const attendance = await Attendance.findAll({
            where,
            include: [{ model: Client, attributes: ['id', 'name'] }]
        });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/attendance/client/:clientId', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff', 'superadmin']), async (req, res) => {
    try {
        const { clientId } = req.params;
        const where = { clientId };
        if (req.user.facilityId) where.facilityId = req.user.facilityId;

        const attendance = await Attendance.findAll({
            where,
            order: [['date', 'DESC']],
            include: [{ model: Client, attributes: ['id', 'name'] }]
        });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/attendance', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const { clientId, status } = req.body;
        const today = new Date().toISOString().split('T')[0];

        // Check if already checked in today
        const existing = await Attendance.findOne({
            where: { clientId, date: today, facilityId: req.user.facilityId }
        });

        if (existing) {
            return res.status(400).json({ message: 'Member already checked in for today' });
        }

        const attendance = await Attendance.create({
            clientId,
            facilityId: req.user.facilityId,
            date: today,
            status: status || 'present',
            checkInTime: new Date().toLocaleTimeString('en-US', { hour12: false })
        });

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/facilities/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const facility = await Facility.findByPk(req.params.id);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });
        await facility.destroy();
        res.json({ message: 'Facility deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/clients/:id', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const { name, email, phone, height, weight, joiningDate, billingRenewalDate, gender, aadhaar_number, address, customFields } = req.body;
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });

        if (!client) return res.status(404).json({ message: 'Client not found' });

        client.name = name;
        client.email = email;
        client.phone = phone;
        client.height = height;
        client.weight = weight;
        const previousBillingRenewalDate = client.billingRenewalDate || null;
        if (joiningDate) {
            client.joiningDate = toDateOnlyString(joiningDate);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'billingRenewalDate')) {
            client.billingRenewalDate = toDateOnlyString(billingRenewalDate) || null;
        }
        client.gender = gender;
        client.aadhaar_number = aadhaar_number;
        client.address = address;
        client.customFields = customFields || client.customFields;
        const oldPlanId = client.planId;
        if (Object.prototype.hasOwnProperty.call(req.body, 'planId')) {
            client.planId = req.body.planId || null;
        }

        if (!client.billingRenewalDate) {
            client.billingRenewalDate = toDateOnlyString(client.joiningDate || new Date());
        }

        const billingDateChanged = previousBillingRenewalDate !== client.billingRenewalDate;
        const planChanged = oldPlanId !== client.planId;

        if (client.planId && (planChanged || billingDateChanged)) {
            const plan = await Plan.findByPk(client.planId);
            if (plan) {
                const expiryDate = calculateClientPlanExpiry(client.billingRenewalDate, plan.duration);
                if (expiryDate) {
                    client.planExpiresAt = expiryDate;
                    client.status = expiryDate < new Date() ? 'payment_due' : 'active';
                }
            }
        } else if (!client.planId && planChanged) {
            client.planExpiresAt = null;
            client.status = 'inactive';
        }
        await client.save();
        res.json(client);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/clients/:id', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        await client.destroy();
        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/staff/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const { name, email } = req.body;
        const staff = await User.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId, role: 'staff' } });

        if (!staff) return res.status(404).json({ message: 'Staff member not found' });

        staff.name = name;
        staff.email = email;
        await staff.save();
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/staff/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const staff = await User.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId, role: 'staff' } });
        if (!staff) return res.status(404).json({ message: 'Staff member not found' });
        await staff.destroy();
        res.json({ message: 'Staff deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/plans/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const plan = await Plan.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        await plan.destroy();
        res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/notifications', authenticate, async (req, res) => {
    try {
        const { role, facilityId } = req.user;
        const where = {};
        if (role === 'superadmin') {
            where.role = 'superadmin';
        } else {
            where.facilityId = facilityId;
        }

        const notifications = await Notification.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: 20
        });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/notifications/mark-read/:id', authenticate, async (req, res) => {
    try {
        const notification = await Notification.findByPk(req.params.id);
        if (notification) {
            notification.isRead = true;
            await notification.save();
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/notifications/mark-all-read', authenticate, async (req, res) => {
    try {
        const { role, facilityId } = req.user;
        const where = {};
        if (role === 'superadmin') {
            where.role = 'superadmin';
        } else {
            where.facilityId = facilityId;
        }

        await Notification.update({ isRead: true }, { where });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize DB and Start Server
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

sequelize.sync({ alter: true }).then(async () => {
    // Create default superadmin if not exists
    const superadmin = await User.findOne({ where: { role: 'superadmin' } });
    if (!superadmin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
            name: 'Super Admin',
            email: 'super@admin.com',
            password: hashedPassword,
            role: 'superadmin'
        });
        console.log('Superadmin created: super@admin.com / admin123');
    }

    // Seed some notifications for demo if none exist
    const noteCount = await Notification.count();
    if (noteCount === 0) {
        await Notification.bulkCreate([
            { message: 'New facility "Power House" has registered on the platform.', type: 'success', role: 'superadmin', path: '/facilities' },
            { message: 'Facility "Elite Fitness" subscription is expiring within 7 days.', type: 'warning', role: 'superadmin', path: '/facilities' },
            { message: 'Your monthly revenue report for February is now available.', type: 'info', role: 'superadmin', path: '/reports' }
        ]);
        console.log('Initial notifications seeded.');
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
