// Load environment variables FIRST — before any module that reads process.env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const Joi = require('joi');
const { sequelize, User, Facility, Client, Plan, Payment, SubscriptionPlan, Attendance, Notification, FacilityType, FacilityAutoPayEvent } = require('./models');
const { Op } = require('sequelize');

// --- Gamification module (engine, HTTP routes, seed data) ---
const gamification = require('./gamification/engine');
const { registerGamificationRoutes } = require('./gamification/routes');
const { seedGamificationDefaults } = require('./gamification/seed');
const { registerNutritionRoutes } = require('./routes/nutrition');
const { registerPTRoutes } = require('./routes/pt');
const { registerDieticianRoutes } = require('./routes/dietician');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CRITICAL: Read SECRET_KEY from environment variable ---
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
    console.error('[FATAL] SECRET_KEY is not set in environment variables. Server cannot start.');
    process.exit(1);
}

const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// --- Security Headers ---
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// --- Rate Limiter for Auth Endpoints ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // max 10 login attempts per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Please try again after 15 minutes.' }
});

// Environment-aware CORS — restrict origins in production, permit all local dev ports
const rawAllowedOrigins = (process.env.ALLOWED_ORIGIN || 'https://facilityapis.mobilemonks.in')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, mobile apps)
        if (!origin) return callback(null, true);

        // In development, permit any localhost or 127.0.0.1 origin
        if (process.env.NODE_ENV !== 'production') {
            if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
        }

        if (rawAllowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json({
    verify: (req, res, buf) => {
        req.rawBody = buf?.toString('utf8') || '';
    }
}));

// Logger for all requests (only in non-production to avoid log noise)
const LOG_REQUESTS = process.env.NODE_ENV !== 'production';
app.use((req, res, next) => {
    if (LOG_REQUESTS) {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    }
    next();
});

// Middleware for auth
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            // Return 401 so the frontend interceptor can catch it and redirect to login
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

const authorize = (roles = []) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    };
};

// Log the real error server-side, return a generic message to the client so
// internal details (stack traces, DB errors) are never leaked in responses.
const sendServerError = (res, err, context = 'request') => {
    console.error(`[ERROR] ${context}:`, err?.message || err);
    return res.status(500).json({ message: 'Internal server error' });
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
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return value.trim();
    }
    const date = parseDateValue(value);
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeGoalType = (value) => {
    if (!value) return null;
    const normalized = String(value).trim().toLowerCase();
    const allowed = ['weight_loss', 'weight_gain', 'muscle_gain', 'strength', 'sports_performance'];
    return allowed.includes(normalized) ? normalized : null;
};

const toNullableNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeFacilitySubscriptionStatus = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (['active', 'pending', 'blocked', 'suspended', 'expired'].includes(normalized)) return normalized;
    return null;
};

const sanitizeHealthProfile = (payload = {}) => {
    const source = payload || {};
    return {
        goalType: normalizeGoalType(source.goalType),
        currentWeight: toNullableNumber(source.currentWeight),
        targetWeight: toNullableNumber(source.targetWeight),
        height: toNullableNumber(source.height),
        bodyFatPercentage: toNullableNumber(source.bodyFatPercentage),
        notes: (source.notes || '').toString().trim(),
        supplementNotes: (source.supplementNotes || '').toString().trim(),
        updatedAt: new Date().toISOString()
    };
};

const createWorkoutEntry = ({ title, scheduledFor, notes } = {}) => ({
    id: `wp_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    title: (title || 'Workout Session').toString().trim(),
    scheduledFor: toDateOnlyString(scheduledFor || new Date()),
    notes: (notes || '').toString().trim(),
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rescheduleHistory: []
});

const getHealthState = (client) => {
    const profile = (client.healthProfile && typeof client.healthProfile === 'object')
        ? { ...client.healthProfile }
        : {};
    profile.weeklyWeights = Array.isArray(profile.weeklyWeights)
        ? [...profile.weeklyWeights]
        : [];
    profile.currentSchedule =
        profile.currentSchedule && typeof profile.currentSchedule === 'object'
            ? { ...profile.currentSchedule }
            : null;
    profile.pastSchedules = Array.isArray(profile.pastSchedules)
        ? [...profile.pastSchedules]
        : [];
    profile.workoutCalendar = Array.isArray(profile.workoutCalendar)
        ? [...profile.workoutCalendar]
        : [];
    // Phase 2 — Health Pro sub-arrays (preserved as-is)
    profile.bodyCompositionHistory = Array.isArray(profile.bodyCompositionHistory) ? [...profile.bodyCompositionHistory] : [];
    profile.measurementLogs = Array.isArray(profile.measurementLogs) ? [...profile.measurementLogs] : [];
    profile.personalRecords = Array.isArray(profile.personalRecords) ? [...profile.personalRecords] : [];
    profile.fitnessTests = Array.isArray(profile.fitnessTests) ? [...profile.fitnessTests] : [];
    profile.mobilityScreenings = Array.isArray(profile.mobilityScreenings) ? [...profile.mobilityScreenings] : [];
    profile.goalReviews = Array.isArray(profile.goalReviews) ? [...profile.goalReviews] : [];
    return profile;
};

const weekdayName = (dateLike) => {
    const date = parseDateValue(dateLike);
    if (!date) return '';
    const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return names[date.getDay()];
};

const dayDiff = (a, b) => {
    const one = parseDateValue(a);
    const two = parseDateValue(b);
    if (!one || !two) return 0;
    one.setHours(0, 0, 0, 0);
    two.setHours(0, 0, 0, 0);
    return Math.round((one.getTime() - two.getTime()) / (1000 * 60 * 60 * 24));
};

const dateRangeInclusive = (start, end) => {
    const startDate = parseDateValue(start);
    const endDate = parseDateValue(end);
    if (!startDate || !endDate) return [];
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    if (endDate < startDate) return [];

    const result = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
        result.push(toDateOnlyString(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return result;
};

const assignedWorkoutDayForDate = (schedule, dateStr) => {
    const days = Array.isArray(schedule?.days) ? schedule.days : [];
    if (days.length === 0) return null;
    const startDate = schedule.startDate || toDateOnlyString(schedule.startedAt) || toDateOnlyString(new Date());
    const diff = dayDiff(dateStr, startDate);
    if (diff < 0) return null;

    const offDays = Array.isArray(schedule.offDays)
        ? schedule.offDays.map((d) => String(d).toLowerCase())
        : ['sunday'];

    let workoutSlots = 0;
    for (const date of dateRangeInclusive(startDate, dateStr)) {
        if (offDays.includes(weekdayName(date))) continue;
        workoutSlots += 1;
    }
    if (workoutSlots <= 0) return null;

    const idx = (workoutSlots - 1) % days.length;
    return days[idx];
};

const computeHealthDashboard = (profile = {}) => {
    const weeklyWeights = Array.isArray(profile.weeklyWeights) ? [...profile.weeklyWeights] : [];
    const workoutCalendar = Array.isArray(profile.workoutCalendar) ? [...profile.workoutCalendar] : [];
    const currentSchedule = profile.currentSchedule && typeof profile.currentSchedule === 'object'
        ? { ...profile.currentSchedule }
        : null;

    const sortedWeights = weeklyWeights
        .map((x) => ({
            date: toDateOnlyString(x.date),
            weight: toNullableNumber(x.weight)
        }))
        .filter((x) => x.date && x.weight != null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const currentWeight = toNullableNumber(profile.currentWeight) ?? sortedWeights.at(-1)?.weight ?? null;
    const targetWeight = toNullableNumber(profile.targetWeight);
    const startWeight = sortedWeights[0]?.weight ?? currentWeight;
    const height = toNullableNumber(profile.height);
    const heightMeters = height ? height / 100 : null;
    const bmi = (heightMeters && currentWeight)
        ? Number((currentWeight / (heightMeters * heightMeters)).toFixed(1))
        : null;

    let progressPct = 0;
    if (targetWeight && startWeight && currentWeight) {
        if (profile.goalType === 'weight_loss') {
            progressPct = ((startWeight - currentWeight) / Math.max(startWeight - targetWeight, 1)) * 100;
        } else if (profile.goalType === 'weight_gain' || profile.goalType === 'muscle_gain') {
            progressPct = ((currentWeight - startWeight) / Math.max(targetWeight - startWeight, 1)) * 100;
        } else if (profile.goalType === 'strength' || profile.goalType === 'sports_performance') {
            // For strength/sports, progress is based on consistency of workouts
            progressPct = consistencyPct || 0;
        }
    }
    progressPct = Math.max(0, Math.min(100, Math.round(progressPct)));

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);

    const monthWeights = sortedWeights.filter((x) => new Date(x.date) >= monthStart);
    const weekWeights = sortedWeights.filter((x) => new Date(x.date) >= weekStart);
    const monthDelta = monthWeights.length >= 2 ? Number((monthWeights.at(-1).weight - monthWeights[0].weight).toFixed(1)) : 0;
    const weekDelta = weekWeights.length >= 2 ? Number((weekWeights.at(-1).weight - weekWeights[0].weight).toFixed(1)) : 0;

    const recentEvents = workoutCalendar.filter((x) => parseDateValue(x.date) >= weekStart);
    const completedWeek = recentEvents.filter((x) => x.status === 'done').length;
    const missedWeek = recentEvents.filter((x) => x.status === 'missed').length;

    let trendPct = 0;
    if (weekWeights.length >= 2) {
        const first = Math.max(weekWeights[0].weight, 1);
        trendPct = Number((((weekWeights.at(-1).weight - weekWeights[0].weight) / first) * 100).toFixed(1));
    }

    const doneSet = new Set(
        workoutCalendar
            .filter((x) => x.status === 'done')
            .map((x) => toDateOnlyString(x.date))
            .filter(Boolean)
    );
    let streakCount = 0;
    const cursor = new Date(today);
    while (doneSet.has(toDateOnlyString(cursor))) {
        streakCount += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    const doneCount = workoutCalendar.filter((x) => x.status === 'done').length;
    const missedCount = workoutCalendar.filter((x) => x.status === 'missed').length;
    const consistencyPct = doneCount + missedCount > 0
        ? Math.round((doneCount / (doneCount + missedCount)) * 100)
        : 0;

    let nextWorkoutDay = null;
    if (currentSchedule && Array.isArray(currentSchedule.days) && currentSchedule.days.length) {
        const doneEvents = workoutCalendar
            .filter((x) => x.status === 'done' && x.dayNumber)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastDoneDay = doneEvents.at(-1)?.dayNumber;
        const sortedDays = [...currentSchedule.days]
            .sort((a, b) => Number(a.dayNumber) - Number(b.dayNumber))
            .map((d) => Number(d.dayNumber));
        if (!lastDoneDay) {
            nextWorkoutDay = sortedDays[0] || null;
        } else {
            const idx = sortedDays.findIndex((x) => x === Number(lastDoneDay));
            nextWorkoutDay = idx < 0 || idx === sortedDays.length - 1
                ? (sortedDays[0] || null)
                : sortedDays[idx + 1];
        }
    }

    const completedDayNumbers = [
        ...new Set(
            workoutCalendar
                .filter((x) => x.status === 'done' && x.dayNumber != null)
                .map((x) => Number(x.dayNumber))
        )
    ];

    const currentMonthEvents = workoutCalendar.filter((x) => {
        const d = parseDateValue(x.date);
        return d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    });
    const currentMonthStats = {
        completed: currentMonthEvents.filter((x) => x.status === 'done').length,
        missed: currentMonthEvents.filter((x) => x.status === 'missed').length,
        cardio: currentMonthEvents.filter((x) => x.status === 'cardio').length,
        off: currentMonthEvents.filter((x) => x.status === 'off_day').length
    };
    currentMonthStats.consistency = currentMonthStats.completed + currentMonthStats.missed > 0
        ? Math.round((currentMonthStats.completed / (currentMonthStats.completed + currentMonthStats.missed)) * 100)
        : 0;

    let smartInsight = 'Consistency is good. Maintain progressive overload and weekly updates.';
    if (missedWeek > 2) {
        smartInsight = 'Missed sessions are high. Suggest 2-day recovery split and volume reset.';
    } else if (Math.abs(weekDelta) < 0.05) {
        if (profile.goalType === 'strength') {
            smartInsight = 'Keep pushing compound lifts. Log personal records to track strength gains.';
        } else if (profile.goalType === 'sports_performance') {
            smartInsight = 'Focus on sport-specific drills and agility work. Track fitness test benchmarks.';
        } else {
            smartInsight = 'Weight progress is stagnant. Add 15-20 mins cardio post-workout.';
        }
    } else if (profile.goalType === 'strength' && streakCount >= 3) {
        smartInsight = 'Great training streak! Ensure adequate protein and rest for strength gains.';
    } else if (profile.goalType === 'sports_performance' && consistencyPct >= 80) {
        smartInsight = 'Excellent consistency for sports training! Consider adding mobility screening check-ins.';
    }

    return {
        currentWeight,
        targetWeight,
        bmi,
        progressPct,
        monthDelta,
        weekDelta,
        completedWeek,
        missedWeek,
        trendPct,
        streakCount,
        consistencyPct,
        nextWorkoutDay,
        completedDayNumbers,
        currentMonthStats,
        smartInsight
    };
};

const getFacilityHealthFeature = async (facilityId) => {
    if (!facilityId) return false;
    const facility = await Facility.findByPk(facilityId, { attributes: ['id', 'healthProfileEnabled'] });
    return Boolean(facility?.healthProfileEnabled);
};

const resolveClientStatusFromPaymentAndExpiry = ({ hasPayment, expiryDate }) => {
    if (!hasPayment) return 'inactive';
    if (!expiryDate) return 'inactive';
    return expiryDate < new Date() ? 'payment_due' : 'active';
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

// Throttle Razorpay subscription syncs. checkSubscriptionStatus runs on ~26
// endpoints and the dashboard fans out several requests per page load, so
// without this every page view triggered a burst of identical Razorpay API
// calls (the "subscription APIs in a loop" symptom). We sync at most once per
// facility per RAZORPAY_SYNC_TTL_MS window.
const RAZORPAY_SYNC_TTL_MS = 60 * 1000;
const lastRazorpaySyncAt = new Map();

const syncFacilitySubscriptionFromRazorpay = async (facility, { force = false } = {}) => {
    if (!facility?.razorpaySubscriptionId || !isRazorpayConfigured()) return facility;

    if (!force) {
        const last = lastRazorpaySyncAt.get(facility.id);
        if (last && Date.now() - last < RAZORPAY_SYNC_TTL_MS) return facility;
    }
    lastRazorpaySyncAt.set(facility.id, Date.now());

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
        if (!client.Plan) {
            const nextStatus = 'inactive';
            const nextExpiry = null;
            if (client.status !== nextStatus || client.planExpiresAt !== nextExpiry) {
                client.planExpiresAt = nextExpiry;
                client.status = nextStatus;
                await client.save();
            }
            continue;
        }

        if (!client.billingRenewalDate) {
            client.billingRenewalDate = toDateOnlyString(client.joiningDate || client.createdAt || new Date());
        }

        const expiryDate = calculateClientPlanExpiry(client.billingRenewalDate, client.Plan.duration);
        if (!expiryDate) continue;

        const paymentCount = await Payment.count({
            where: { clientId: client.id, facilityId: client.facilityId }
        });
        const nextStatus = resolveClientStatusFromPaymentAndExpiry({
            hasPayment: paymentCount > 0,
            expiryDate
        });

        if (
            client.status !== nextStatus ||
            new Date(client.planExpiresAt || 0).getTime() !== expiryDate.getTime()
        ) {
            client.planExpiresAt = expiryDate;
            client.status = nextStatus;
            await client.save();
        }
    }
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
        return sendServerError(res, err);
    }
};

// --- AUTH ROUTES ---

// Superadmin-only. The initial superadmin is seeded automatically at startup,
// so this endpoint must never be open — an unauthenticated caller could
// otherwise create their own superadmin and take over the platform.
app.post('/api/auth/register', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, email, password, role, facilityId } = req.body;
        // Superadmin accounts can only be seeded server-side, never via the API.
        const allowedRoles = ['admin', 'staff', 'dietician'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ message: `Role must be one of: ${allowedRoles.join(', ')}` });
        }
        // No manual bcrypt.hash — User model beforeCreate hook handles hashing
        const user = await User.create({ name, email, password, role, facilityId });
        // Never return the password hash.
        res.json({
            message: 'User registered successfully',
            user: { id: user.id, name: user.name, email: user.email, role: user.role, facilityId: user.facilityId }
        });
    } catch (error) {
        console.error('[REGISTER] Failed:', error.message);
        res.status(500).json({ message: 'Failed to register user' });
    }
});

// Joi validation schemas
const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).required()
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });
        // Use one identical 401 for "no such email" and "wrong password" so an
        // attacker can't enumerate which emails have accounts.
        if (!user) return res.status(401).json({ message: 'Invalid email or password' });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ message: 'Invalid email or password' });

        const token = jwt.sign({ id: user.id, role: user.role, facilityId: user.facilityId }, SECRET_KEY, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, facilityId: user.facilityId } });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post('/api/auth/client/login', authLimiter, async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        if (!password) return res.status(400).json({ message: 'Password is required' });
        if (!email && !phone) return res.status(400).json({ message: 'Email or phone is required' });
        
        let client;
        if (email) {
            client = await Client.findOne({ where: { email } });
        } else {
            client = await Client.findOne({ where: { phone } });
        }

        if (!client || !client.password) {
            return res.status(401).json({ message: 'Invalid credentials or password not set' });
        }

        const isValid = await bcrypt.compare(password, client.password);
        if (!isValid) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: client.id, role: 'client', facilityId: client.facilityId }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, user: { id: client.id, name: client.name, email: client.email, phone: client.phone, role: 'client', facilityId: client.facilityId } });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post('/api/auth/client/set-password', async (req, res) => {
    try {
        const { phone, email, newPassword } = req.body;
        const whereClause = phone ? { phone } : { email };
        const client = await Client.findOne({ where: whereClause });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        
        client.password = newPassword;
        await client.save();
        res.json({ message: 'Password set successfully' });
    } catch (error) {
        sendServerError(res, error);
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
        sendServerError(res, error);
    }
});

app.get('/api/subscription-plans', authenticate, async (req, res) => {
    try {
        const plans = await SubscriptionPlan.findAll();
        res.json(plans);
    } catch (error) {
        sendServerError(res, error);
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
        sendServerError(res, error);
    }
});

app.delete('/api/subscription-plans/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByPk(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        await plan.destroy();
        res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
        sendServerError(res, error);
    }
});

// --- FACILITY TYPE ROUTES (Superadmin) ---

app.post('/api/facility-types', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, icon, memberFormConfig } = req.body;
        const type = await FacilityType.create({ name, icon, memberFormConfig });
        res.json(type);
    } catch (error) {
        sendServerError(res, error);
    }
});

app.get('/api/facility-types', authenticate, async (req, res) => {
    try {
        const types = await FacilityType.findAll();
        res.json(types);
    } catch (error) {
        sendServerError(res, error);
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
        sendServerError(res, error);
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
        sendServerError(res, error);
    }
});

// --- FACILITY MANAGEMENT ROUTES (Superadmin) ---

app.post('/api/facilities', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, type, address, adminEmail, adminPassword, adminName, planId, facilityTypeId, healthProfileEnabled } = req.body;

        if (!planId) {
            return res.status(400).json({ message: 'Subscription plan is required while creating facility.' });
        }

        const plan = await SubscriptionPlan.findByPk(planId);
        if (!plan) return res.status(404).json({ message: 'Subscription plan not found' });

        if (facilityTypeId) {
            const facilityType = await FacilityType.findByPk(facilityTypeId);
            if (!facilityType) {
                return res.status(404).json({ message: 'Facility type not found' });
            }
        }

        if (adminEmail) {
            const existingAdminEmail = await User.findOne({ where: { email: adminEmail } });
            if (existingAdminEmail) {
                return res.status(409).json({ message: 'Admin email already exists. Please use a different email.' });
            }
        }

        const facility = await sequelize.transaction(async (transaction) => {
            const createdFacility = await Facility.create({
                name,
                type: type || 'gym',
                address,
                subscriptionPlanId: planId,
                subscriptionExpiresAt: null,
                subscriptionStatus: 'pending',
                facilityTypeId: facilityTypeId || null,
                healthProfileEnabled: Boolean(healthProfileEnabled)
            }, { transaction });

            // Create initial admin for the facility
            if (adminEmail && adminPassword) {
                // No manual bcrypt.hash — User model beforeCreate hook handles hashing
                await User.create({
                    name: adminName || 'Admin',
                    email: adminEmail,
                    password: adminPassword,
                    role: 'admin',
                    facilityId: createdFacility.id
                }, { transaction });
            }

            return createdFacility;
        });

        // Add Notification for Super Admin
        await Notification.create({
            message: `New Facility "${name}" has been registered.`,
            type: 'success',
            role: 'superadmin',
            path: '/facilities'
        });

        res.json(facility);
    } catch (error) {
        sendServerError(res, error);
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
        const expiredIds = [];
        for (const facility of facilities) {
            if (facility.subscriptionStatus === 'active' && facility.subscriptionExpiresAt && new Date(facility.subscriptionExpiresAt) < now) {
                facility.subscriptionStatus = 'expired';
                expiredIds.push(facility.id);
            }
        }
        // Batch-update expired facilities instead of saving one by one
        if (expiredIds.length > 0) {
            await Facility.update({ subscriptionStatus: 'expired' }, { where: { id: { [Op.in]: expiredIds } } });
        }

        // --- FIX: Replace N+1 queries with 2 batch aggregation queries ---
        const facilityIds = facilities.map(f => f.id);

        const [userCounts, memberCounts] = await Promise.all([
            User.findAll({
                attributes: ['facilityId', 'role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                where: { facilityId: { [Op.in]: facilityIds }, role: { [Op.in]: ['admin', 'staff'] } },
                group: ['facilityId', 'role'],
                raw: true
            }),
            Client.findAll({
                attributes: ['facilityId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                where: { facilityId: { [Op.in]: facilityIds } },
                group: ['facilityId'],
                raw: true
            })
        ]);

        // Build lookup maps for O(1) access
        const adminCountMap = {};
        const staffCountMap = {};
        userCounts.forEach(row => {
            if (row.role === 'admin') adminCountMap[row.facilityId] = parseInt(row.count, 10);
            if (row.role === 'staff') staffCountMap[row.facilityId] = parseInt(row.count, 10);
        });
        const memberCountMap = {};
        memberCounts.forEach(row => { memberCountMap[row.facilityId] = parseInt(row.count, 10); });

        const facilitiesWithUserDetails = facilities.map(facility => {
            const adminCount = adminCountMap[facility.id] || 0;
            const staffCount = staffCountMap[facility.id] || 0;
            const memberCount = memberCountMap[facility.id] || 0;
            return {
                ...facility.toJSON(),
                userDetails: {
                    totalUsers: adminCount + staffCount,
                    adminCount,
                    staffCount,
                    memberCount
                }
            };
        });

        res.json(facilitiesWithUserDetails);
    } catch (error) {
        console.error('Error fetching facilities:', error);
        sendServerError(res, error);
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
        sendServerError(res, error);
    }
});

app.post('/api/facilities/:id/status', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { status } = req.body; // active, pending, blocked
        const facility = await Facility.findByPk(req.params.id);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });

        const normalizedStatus = normalizeFacilitySubscriptionStatus(status);
        if (!normalizedStatus) {
            return res.status(400).json({ message: 'Invalid subscription status' });
        }

        // If super admin moves facility away from active, revoke current AutoPay
        // so status doesn't auto-sync back to active from an existing Razorpay subscription.
        if (normalizedStatus !== 'active' && facility.razorpaySubscriptionId) {
            await revokeFacilityAutoPay(facility, `Subscription manually set to ${normalizedStatus} by super admin`);
        }

        facility.subscriptionStatus = normalizedStatus;
        if (normalizedStatus !== 'active') {
            facility.subscriptionExpiresAt = null;
        }
        await facility.save();
        res.json(facility);
    } catch (error) {
        sendServerError(res, error);
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

        // Assign plain text — User model beforeUpdate hook hashes it automatically
        admin.password = newPassword;
        await admin.save();

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post('/api/facilities/:id/subscription-update', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { status, expiresAt } = req.body;
        const facility = await Facility.findByPk(req.params.id);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });

        if (status) {
            const normalizedStatus = normalizeFacilitySubscriptionStatus(status);
            if (!normalizedStatus) {
                return res.status(400).json({ message: 'Invalid subscription status' });
            }

            if (normalizedStatus !== 'active' && facility.razorpaySubscriptionId) {
                await revokeFacilityAutoPay(facility, `Subscription manually set to ${normalizedStatus} by super admin`);
            }
            facility.subscriptionStatus = normalizedStatus;
            if (normalizedStatus !== 'active') {
                facility.subscriptionExpiresAt = null;
            }
        }
        if (expiresAt) facility.subscriptionExpiresAt = new Date(expiresAt);

        await facility.save();
        res.json(facility);
    } catch (error) {
        sendServerError(res, error);
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
        sendServerError(res, error);
    }
});

// Endpoint for Facility Admin to check their own subscription
app.get('/api/facility/subscription', authenticate, async (req, res) => {
    try {
        if (req.user.role === 'superadmin') {
            return res.json({
                roleScope: 'platform',
                subscriptionStatus: 'active'
            });
        }
        if (!req.user.facilityId) return res.status(400).json({ message: 'No facility associated' });
        const facility = await Facility.findByPk(req.user.facilityId, { include: [SubscriptionPlan, FacilityType] });
        if (facility) {
            await syncFacilitySubscriptionFromRazorpay(facility);
            await facility.reload({ include: [SubscriptionPlan, FacilityType] });
        }
        res.json(facility);
    } catch (error) {
        sendServerError(res, error);
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
        sendServerError(res, error);
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
        sendServerError(res, error);
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
        sendServerError(res, error);
    }
});

// --- CLIENT ROUTES (Admin, Staff) ---

app.post('/api/clients', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const { name, email, phone, height, weight, joiningDate, billingRenewalDate, gender, aadhaar_number, address, customFields, healthProfile, workoutPlans } = req.body;
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

        const healthEnabled = await getFacilityHealthFeature(req.user.facilityId);
        if (healthEnabled) {
            clientData.healthProfile = sanitizeHealthProfile(healthProfile);
            clientData.workoutPlans = Array.isArray(workoutPlans) ? workoutPlans : [];
        }

        if (clientData.planId) {
            const plan = await Plan.findByPk(clientData.planId);
            if (plan) {
                const expiryDate = calculateClientPlanExpiry(clientData.billingRenewalDate, plan.duration);
                if (expiryDate) {
                    clientData.planExpiresAt = expiryDate;
                    clientData.status = 'inactive';
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
        sendServerError(res, error);
    }
});

// --- STAFF ROUTES (Admin) ---

app.post('/api/staff', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        // Admins may create general staff or dieticians.
        const allowedStaffRoles = ['staff', 'dietician'];
        const newRole = allowedStaffRoles.includes(role) ? role : 'staff';

        const facility = await getFacilityPlanContext(req.user.facilityId);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });

        const maxStaff = facility.SubscriptionPlan?.maxStaff;
        if (maxStaff != null) {
            // Both staff and dieticians count against the plan's staff allowance.
            const currentStaff = await User.count({ where: { facilityId: req.user.facilityId, role: { [Op.in]: allowedStaffRoles } } });
            if (currentStaff >= maxStaff) {
                await createLimitExceededNotification(facility, 'staff', maxStaff, currentStaff + 1);
                return res.status(403).json({
                    message: `Staff limit reached for your plan (${maxStaff}). Upgrade your plan to add more staff.`,
                    code: 'PLAN_STAFF_LIMIT_EXCEEDED'
                });
            }
        }

        // No manual bcrypt.hash — User model beforeCreate hook handles hashing
        const staff = await User.create({
            name,
            email,
            password,
            role: newRole,
            facilityId: req.user.facilityId
        });

        // Add Notification for Facility Admin
        await Notification.create({
            message: `New ${newRole === 'dietician' ? 'dietician' : 'staff member'} "${name}" has been added.`,
            type: 'success',
            facilityId: req.user.facilityId,
            path: '/staff'
        });

        res.json(staff);
    } catch (error) {
        sendServerError(res, error);
    }
});

app.get('/api/staff', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const staff = await User.findAll({ where: { facilityId: req.user.facilityId, role: { [Op.in]: ['staff', 'dietician'] } } });
        res.json(staff);
    } catch (error) {
        sendServerError(res, error);
    }
});

// --- PLAN ROUTES (Admin) ---

// Normalize the PT-related fields from a plan payload. Returns sane values for
// both normal plans (PT fields cleared) and PT plans (validated allowance).
const normalizePlanTypeFields = (body) => {
    const planType = body.planType === 'pt' ? 'pt' : 'normal';
    if (planType !== 'pt') {
        return { planType: 'normal', ptSessionsCount: null, ptSessionPeriod: null };
    }
    const count = parseInt(body.ptSessionsCount, 10);
    const period = body.ptSessionPeriod === 'monthly' ? 'monthly' : 'weekly';
    return {
        planType: 'pt',
        ptSessionsCount: Number.isFinite(count) && count > 0 ? count : null,
        ptSessionPeriod: period
    };
};

app.post('/api/plans', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const { name, price, duration, description, features } = req.body;
        const ptFields = normalizePlanTypeFields(req.body);
        if (ptFields.planType === 'pt' && !ptFields.ptSessionsCount) {
            return res.status(400).json({ message: 'PT plans require a session count greater than 0' });
        }
        const plan = await Plan.create({
            name, price, duration, description, features,
            ...ptFields,
            facilityId: req.user.facilityId
        });
        res.json(plan);
    } catch (error) {
        sendServerError(res, error);
    }
});

app.put('/api/plans/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const { name, price, duration, description, features } = req.body;
        const plan = await Plan.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });

        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        const ptFields = normalizePlanTypeFields(req.body);
        if (ptFields.planType === 'pt' && !ptFields.ptSessionsCount) {
            return res.status(400).json({ message: 'PT plans require a session count greater than 0' });
        }

        plan.name = name;
        plan.price = price;
        plan.duration = duration;
        plan.description = description;
        plan.features = features;
        plan.planType = ptFields.planType;
        plan.ptSessionsCount = ptFields.ptSessionsCount;
        plan.ptSessionPeriod = ptFields.ptSessionPeriod;

        await plan.save();
        res.json(plan);
    } catch (error) {
        sendServerError(res, error);
    }
});

app.get('/api/plans', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff', 'superadmin']), async (req, res) => {
    try {
        const plans = await Plan.findAll({ where: { facilityId: req.user.facilityId } });
        res.json(plans);
    } catch (error) {
        sendServerError(res, error);
    }
});

// --- DASHBOARD ROUTE ---
app.get('/api/dashboard', authenticate, authorize(['admin', 'staff', 'superadmin']), async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const now = new Date();

        // 0. Auto-update statuses for expired plans - now handled by cron, skip inline sync

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

        // 7. Expiring members (within next 7 days)
        now.setHours(0, 0, 0, 0);
        const sevenDaysLater = new Date(now);
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        let expiringMembers = await Client.findAll({
            where: {
                facilityId,
                status: { [Op.in]: ['active', 'payment_due'] },
                planExpiresAt: { [Op.between]: [now, sevenDaysLater] }
            },
            include: [Plan],
            order: [['planExpiresAt', 'ASC']],
            limit: 20
        });
        expiringMembers = expiringMembers.map(c => {
            const expiry = new Date(c.planExpiresAt);
            expiry.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            return {
                id: c.id,
                name: c.name,
                phone: c.phone,
                planName: c.Plan?.name || null,
                planExpiresAt: toDateOnlyString(c.planExpiresAt),
                daysLeft: Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
            };
        });

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
            planChartData,
            expiringMembers
        });

    } catch (error) {
        sendServerError(res, error);
    }
});

app.post('/api/payments', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const { clientId, amount, method, date, transactionId } = req.body;

        // Ensure the client belongs to the caller's facility before recording
        // a payment against it (prevents cross-tenant writes / IDOR).
        const client = await Client.findOne({
            where: { id: clientId, facilityId: req.user.facilityId },
            include: [Plan]
        });
        if (!client) {
            return res.status(404).json({ message: 'Member not found' });
        }

        const today = new Date();
        const yearMonth = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
        const rand = Math.floor(Math.random() * 90000) + 10000;
        const invoiceNumber = `INV-${yearMonth}-${rand}`;

        const payment = await Payment.create({
            clientId,
            amount,
            method,
            date,
            transactionId,
            processedBy: req.user.id,
            facilityId: req.user.facilityId,
            invoiceNumber,
            planId: client.planId || null
        });

        // Activate client and set expiry
        {
            const normalizedBillingDate = toDateOnlyString(date || new Date());
            if (normalizedBillingDate) {
                client.billingRenewalDate = normalizedBillingDate;
            }
            // Calculate expiry based on plan duration
            if (client.Plan) {
                const durationMonths = client.Plan.duration;
                const expiryDate = calculateClientPlanExpiry(client.billingRenewalDate, durationMonths);
                if (expiryDate) {
                    client.planExpiresAt = expiryDate;
                    client.status = expiryDate < new Date() ? 'payment_due' : 'active';
                }
            } else {
                client.status = 'active';
            }
            await client.save();
        }

        // Gamification: award on-time payment XP (idempotent per payment).
        gamification.awardActivity(clientId, req.user.facilityId,
            [{ code: 'payment_on_time' }],
            { sourceType: 'payment', sourceId: payment.id }
        );

        // Fetch the created payment with associations
        const fullPayment = await Payment.findByPk(payment.id, {
            include: [
                { model: Client, attributes: ['name'] },
                { model: User, as: 'processor', attributes: ['name'] }
            ]
        });

        res.json(fullPayment);
    } catch (error) {
        sendServerError(res, error);
    }
});

// ============================================================================
// CLIENT APP APIs
// ============================================================================

app.get('/api/client/me', authenticate, authorize(['client']), async (req, res) => {
    try {
        const client = await Client.findByPk(req.user.id, {
            include: [
                {
                    model: Plan,
                    attributes: ['name', 'price', 'duration']
                },
                {
                    model: Facility,
                    attributes: ['name']
                }
            ],
            attributes: {
                exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires', 'aadhaar_number']
            }
        });

        if (!client) return res.status(404).json({ message: 'Client not found' });

        // Get recent attendance (last 5)
        const recentAttendance = await Attendance.findAll({
            where: { clientId: req.user.id },
            order: [['date', 'DESC']],
            limit: 5
        });

        // Get recent payments (last 5)
        const recentPayments = await Payment.findAll({
            where: { clientId: req.user.id },
            order: [['date', 'DESC']],
            limit: 5
        });

        res.json({
            client,
            recentAttendance,
            recentPayments
        });
    } catch (error) {
        sendServerError(res, error, 'GET /api/client/me');
    }
});

// --- MEMBER (client-app) SCOPED READ ENDPOINTS ---

// Full attendance history for the logged-in member + summary/streak.
app.get('/api/client/attendance', authenticate, authorize(['client']), async (req, res) => {
    try {
        const records = await Attendance.findAll({
            where: { clientId: req.user.id },
            order: [['date', 'DESC']]
        });

        const present = records.filter(r => r.status === 'present').length;
        const absent = records.filter(r => r.status === 'absent').length;
        const excused = records.filter(r => r.status === 'excused').length;

        // Current streak: consecutive most-recent 'present' days.
        let streak = 0;
        for (const r of records) {
            if (r.status === 'present') streak += 1;
            else break;
        }

        res.json({
            attendance: records,
            summary: { total: records.length, present, absent, excused, streak }
        });
    } catch (error) {
        sendServerError(res, error, 'GET /api/client/attendance');
    }
});

// Full payment history for the logged-in member + totals/outstanding flag.
app.get('/api/client/payments', authenticate, authorize(['client']), async (req, res) => {
    try {
        const client = await Client.findByPk(req.user.id, {
            include: [{ model: Plan, attributes: ['name', 'price', 'duration'] }],
            attributes: ['id', 'status', 'planExpiresAt']
        });
        if (!client) return res.status(404).json({ message: 'Client not found' });

        const payments = await Payment.findAll({
            where: { clientId: req.user.id },
            order: [['date', 'DESC']]
        });

        const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const isDue = client.status === 'payment_due';

        res.json({
            payments,
            plan: client.Plan || null,
            planExpiresAt: client.planExpiresAt,
            status: client.status,
            totalPaid,
            isDue,
            // We only know an amount is owed, not the exact figure; expose the
            // plan price as the best-effort outstanding hint when due.
            outstanding: isDue ? Number(client.Plan?.price || 0) : 0
        });
    } catch (error) {
        sendServerError(res, error, 'GET /api/client/payments');
    }
});

// GET /api/clients — syncClientPlanStatuses moved to hourly cron (see bottom of file)
app.get('/api/clients', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff', 'superadmin']), async (req, res) => {
    try {
        let where = {};
        if (req.user.role !== 'superadmin') {
            where.facilityId = req.user.facilityId;
        }
        // Pagination support (default: all, capped at 500 for safety)
        const page = parseInt(req.query.page) || null;
        const limit = Math.min(parseInt(req.query.limit) || 500, 500);
        const offset = page ? (page - 1) * limit : 0;

        const queryOptions = { where, include: [Plan], order: [['createdAt', 'DESC']], limit, offset };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const addRenewalInfo = (clients) => clients.map(c => {
            const obj = c.toJSON ? c.toJSON() : { ...c };
            if (obj.planExpiresAt) {
                const expiry = new Date(obj.planExpiresAt);
                expiry.setHours(0, 0, 0, 0);
                obj.daysUntilRenewal = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            } else {
                obj.daysUntilRenewal = null;
            }
            return obj;
        });

        if (page) {
            const { rows, count } = await Client.findAndCountAll(queryOptions);
            res.json({ data: addRenewalInfo(rows), total: count, page, pages: Math.ceil(count / limit), limit });
        } else {
            const clients = await Client.findAll(queryOptions);
            res.json(addRenewalInfo(clients));
        }
    } catch (error) {
        sendServerError(res, error);
    }
});

app.get('/api/payments', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const payments = await Payment.findAll({
            where: { facilityId: req.user.facilityId },
            include: [
                { model: Client, attributes: ['name'] },
                { model: User, as: 'processor', attributes: ['name'] },
                { model: Plan, attributes: ['name', 'price', 'duration'] }
            ],
            order: [['date', 'DESC']]
        });
        res.json(payments);
    } catch (error) {
        sendServerError(res, error);
    }
});

app.get('/api/reports', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff', 'superadmin']), async (req, res) => {
    try {
        const facilityId = req.user.facilityId;
        const clientWhere = facilityId ? { facilityId } : {};
        const updatedWhere = facilityId ? { facilityId } : {};

        // Plan Distribution — use DB-level aggregation instead of N+1 counting
        const plans = await Plan.findAll({ where: clientWhere });
        const planIds = plans.map(p => p.id);
        const clientPlanCounts = await Client.findAll({
            attributes: ['planId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            where: { ...clientWhere, planId: { [Op.in]: planIds } },
            group: ['planId'],
            raw: true
        });
        const planCountMap = {};
        clientPlanCounts.forEach(r => { planCountMap[r.planId] = parseInt(r.count, 10); });
        const planStats = plans.map(plan => ({ name: plan.name, count: planCountMap[plan.id] || 0 }));

        // Payment Stats — FIX: single query for revenue aggregation instead of fetching all rows
        const [payments, revenueAgg] = await Promise.all([
            Payment.findAll({
                where: updatedWhere,
                order: [['date', 'DESC']],
                limit: 10,
                include: [{ model: Client, attributes: ['name'] }]
            }),
            Payment.findAll({
                attributes: [
                    'method',
                    [sequelize.fn('SUM', sequelize.col('amount')), 'total']
                ],
                where: updatedWhere,
                group: ['method'],
                raw: true
            })
        ]);

        const revenue = { total: 0, cash: 0, upi: 0 };
        revenueAgg.forEach(row => {
            const amt = parseFloat(row.total) || 0;
            revenue.total += amt;
            if (row.method === 'cash') revenue.cash = amt;
            if (row.method === 'upi') revenue.upi = amt;
        });

        // Gender Stats — use DB-level aggregation
        let genderStats = null;
        if (req.user.role !== 'superadmin') {
            const genderCounts = await Client.findAll({
                attributes: ['gender', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                where: clientWhere,
                group: ['gender'],
                raw: true
            });
            genderStats = { male: 0, female: 0, other: 0 };
            genderCounts.forEach(row => {
                if (genderStats[row.gender] !== undefined) genderStats[row.gender] = parseInt(row.count, 10);
            });
        }

        const blockedWhere = req.user.role === 'superadmin'
            ? { subscriptionStatus: 'blocked' }
            : { id: facilityId, subscriptionStatus: 'blocked' };

        const blockedFacilities = await Facility.findAll({
            where: blockedWhere,
            include: [{ model: SubscriptionPlan }]
        });

        const autopayEventWhere = req.user.role === 'superadmin' ? {} : { facilityId };

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

        // Attendance Stats — total check-ins this month, top attending members
        let attendanceStats = null;
        if (req.user.role !== 'superadmin' && facilityId) {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const monthStartStr = toDateOnlyString(monthStart);

            const [monthlyCheckIns, topAttendees] = await Promise.all([
                Attendance.count({ where: { facilityId, date: { [Op.gte]: monthStartStr } } }),
                Attendance.findAll({
                    attributes: ['clientId', [sequelize.fn('COUNT', sequelize.col('Attendance.id')), 'checkIns']],
                    where: { facilityId, date: { [Op.gte]: monthStartStr } },
                    include: [{ model: Client, attributes: ['name'] }],
                    group: ['clientId', 'Client.id'],
                    order: [[sequelize.fn('COUNT', sequelize.col('Attendance.id')), 'DESC']],
                    limit: 5,
                    raw: false
                })
            ]);
            attendanceStats = {
                monthlyCheckIns,
                topAttendees: topAttendees.map(a => ({
                    name: a.Client?.name || 'Unknown',
                    checkIns: parseInt(a.dataValues.checkIns, 10) || 0
                }))
            };
        }

        // Expiring members (within next 7 days)
        let expiringMembers = [];
        if (req.user.role !== 'superadmin' && facilityId) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const sevenDaysLater = new Date(now);
            sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
            expiringMembers = await Client.findAll({
                where: {
                    facilityId,
                    status: { [Op.in]: ['active', 'payment_due'] },
                    planExpiresAt: { [Op.between]: [now, sevenDaysLater] }
                },
                include: [Plan],
                order: [['planExpiresAt', 'ASC']],
                limit: 20
            });
            expiringMembers = expiringMembers.map(c => {
                const expiry = new Date(c.planExpiresAt);
                expiry.setHours(0, 0, 0, 0);
                now.setHours(0, 0, 0, 0);
                return {
                    id: c.id,
                    name: c.name,
                    phone: c.phone,
                    planName: c.Plan?.name || null,
                    planExpiresAt: toDateOnlyString(c.planExpiresAt),
                    daysLeft: Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
                };
            });
        }

        res.json({
            revenue,
            planStats,
            recentPayments: payments,
            genderStats,
            blockedFacilities,
            autopayPayments,
            autopayStats,
            attendanceStats,
            expiringMembers
        });
    } catch (error) {
        sendServerError(res, error);
    }
});

// --- UPDATE & DELETE ROUTES ---

app.put('/api/facilities/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const { name, address, facilityTypeId, healthProfileEnabled, modules } = req.body;
        const facility = await Facility.findByPk(req.params.id);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });

        facility.name = name ?? facility.name;
        facility.address = address ?? facility.address;
        if (Object.prototype.hasOwnProperty.call(req.body, 'facilityTypeId')) {
            facility.facilityTypeId = facilityTypeId || null;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'healthProfileEnabled')) {
            facility.healthProfileEnabled = Boolean(healthProfileEnabled);
        }
        if (modules && typeof modules === 'object') {
            const current = facility.modules || {};
            facility.modules = { ...current, ...modules };
        }
        await facility.save();
        res.json(facility);
    } catch (error) {
        sendServerError(res, error);
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
        sendServerError(res, error);
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
        sendServerError(res, error);
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

        // Gamification: award attendance + daily check-in XP, update streak
        // (idempotent per day, never blocks the response).
        gamification.awardActivity(clientId, req.user.facilityId,
            [{ code: 'gym_attendance' }, { code: 'daily_checkin' }],
            { sourceType: 'attendance', sourceId: attendance.id, date: today }
        );

        res.json(attendance);
    } catch (error) {
        sendServerError(res, error);
    }
});

app.delete('/api/facilities/:id', authenticate, authorize(['superadmin']), async (req, res) => {
    try {
        const facility = await Facility.findByPk(req.params.id);
        if (!facility) return res.status(404).json({ message: 'Facility not found' });
        await facility.destroy();
        res.json({ message: 'Facility deleted successfully' });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.put('/api/clients/:id', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const { name, email, phone, height, weight, joiningDate, billingRenewalDate, gender, aadhaar_number, address, customFields, healthProfile, workoutPlans } = req.body;
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });

        if (!client) return res.status(404).json({ message: 'Client not found' });

        client.name = name;
        client.email = email;
        client.phone = phone;
        client.height = height;
        client.weight = weight;
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
        const healthEnabled = await getFacilityHealthFeature(req.user.facilityId);
        if (healthEnabled) {
            if (Object.prototype.hasOwnProperty.call(req.body, 'healthProfile')) {
                client.healthProfile = sanitizeHealthProfile(healthProfile);
            }
            if (Object.prototype.hasOwnProperty.call(req.body, 'workoutPlans')) {
                client.workoutPlans = Array.isArray(workoutPlans) ? workoutPlans : [];
            }
        }
        const oldPlanId = client.planId;
        if (Object.prototype.hasOwnProperty.call(req.body, 'planId')) {
            client.planId = req.body.planId || null;
        }

        if (!client.billingRenewalDate) {
            client.billingRenewalDate = toDateOnlyString(client.joiningDate || new Date());
        }

        const planChanged = oldPlanId !== client.planId;

        if (client.planId) {
            const plan = await Plan.findByPk(client.planId);
            if (plan) {
                const expiryDate = calculateClientPlanExpiry(client.billingRenewalDate, plan.duration);
                if (expiryDate) {
                    client.planExpiresAt = expiryDate;
                    const hasPayment = await Payment.count({
                        where: { clientId: client.id, facilityId: req.user.facilityId }
                    });
                    client.status = resolveClientStatusFromPaymentAndExpiry({
                        hasPayment: hasPayment > 0,
                        expiryDate
                    });
                }
            }
        } else if (!client.planId && planChanged) {
            client.planExpiresAt = null;
            client.status = 'inactive';
        }
        await client.save();
        res.json(client);
    } catch (error) {
        sendServerError(res, error);
    }
});

app.delete('/api/clients/:id', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        await client.destroy();
        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.get('/api/clients/:id/health-profile', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const healthEnabled = await getFacilityHealthFeature(req.user.facilityId);
        if (!healthEnabled) {
            return res.status(403).json({ message: 'Health profile is disabled for this facility.' });
        }

        const profile = getHealthState(client);
        if (profile.currentSchedule) {
            const schedule = { ...profile.currentSchedule };
            const startDate = schedule.startDate || toDateOnlyString(schedule.startedAt) || toDateOnlyString(new Date());
            const endDate = schedule.endDate || toDateOnlyString(new Date());
            const today = toDateOnlyString(new Date());
            const until = dayDiff(endDate, today) < 0 ? endDate : today;
            const offDays = Array.isArray(schedule.offDays)
                ? schedule.offDays.map((d) => String(d).toLowerCase())
                : ['sunday'];

            const existing = Array.isArray(profile.workoutCalendar)
                ? [...profile.workoutCalendar]
                : [];
            const hasEntry = (dateStr) =>
                existing.some((e) => e.scheduleId === schedule.id && e.date === dateStr);

            for (const dateStr of dateRangeInclusive(startDate, until)) {
                if (hasEntry(dateStr)) continue;
                if (offDays.includes(weekdayName(dateStr))) {
                    existing.unshift({
                        id: `wlog_auto_off_${schedule.id}_${dateStr}`,
                        date: dateStr,
                        scheduleId: schedule.id,
                        dayNumber: null,
                        status: 'off_day',
                        note: 'Default off day',
                        cardioMinutes: null,
                        createdBy: null,
                        createdAt: new Date().toISOString(),
                        autoGenerated: true
                    });
                    continue;
                }

                const assigned = assignedWorkoutDayForDate(schedule, dateStr);
                existing.unshift({
                    id: `wlog_auto_missed_${schedule.id}_${dateStr}`,
                    date: dateStr,
                    scheduleId: schedule.id,
                    dayNumber: assigned?.dayNumber ?? null,
                    status: 'missed',
                    note: 'Auto-marked missed',
                    cardioMinutes: null,
                    createdBy: null,
                    createdAt: new Date().toISOString(),
                    autoGenerated: true
                });
            }

            profile.workoutCalendar = existing
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            client.healthProfile = profile;
            await client.save();
        }
        res.json({
            clientId: client.id,
            name: client.name,
            phone: client.phone,
            healthProfile: profile,
            dashboard: computeHealthDashboard(profile),
            workoutPlans: Array.isArray(client.workoutPlans) ? client.workoutPlans : []
        });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.put('/api/clients/:id/health-profile', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const healthEnabled = await getFacilityHealthFeature(req.user.facilityId);
        if (!healthEnabled) {
            return res.status(403).json({ message: 'Health profile is disabled for this facility.' });
        }

        const incoming = sanitizeHealthProfile(req.body || {});
        const current = getHealthState(client);
        client.healthProfile = {
            ...current,
            ...incoming
        };
        await client.save();
        res.json({ healthProfile: client.healthProfile });
    } catch (error) {
        sendServerError(res, error);
    }
});

// Helper to check Health Pro module
const getFacilityHealthPro = async (facilityId) => {
    const facility = await Facility.findByPk(facilityId, { attributes: ['id', 'modules'] });
    return Boolean(facility?.modules?.healthPro);
};

// --- PHASE 2: HEALTH PRO ENDPOINTS ---

// Body Composition History — POST a new entry
app.post('/api/clients/:id/health-profile/body-composition', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const profile = getHealthState(client);
        const entry = {
            id: `bc_${Date.now()}`,
            date: toDateOnlyString(req.body.date || new Date()),
            bodyFat: toNullableNumber(req.body.bodyFat),
            weight: toNullableNumber(req.body.weight),
            notes: (req.body.notes || '').toString().trim(),
            createdAt: new Date().toISOString()
        };
        profile.bodyCompositionHistory = [entry, ...(profile.bodyCompositionHistory || [])];
        if (entry.bodyFat != null) profile.bodyFatPercentage = entry.bodyFat;
        if (entry.weight != null) {
            profile.currentWeight = entry.weight;
            profile.weeklyWeights = [{ date: entry.date, weight: entry.weight }, ...(profile.weeklyWeights || [])];
        }
        client.healthProfile = profile;
        await client.save();
        gamification.awardActivity(client.id, req.user.facilityId, [{ code: 'weight_updated' }],
            { sourceType: 'body_composition', sourceId: entry.id, date: entry.date });
        res.json({ entry, bodyCompositionHistory: profile.bodyCompositionHistory });
    } catch (error) { sendServerError(res, error); }
});

// Body Measurements Log — POST a new entry
app.post('/api/clients/:id/health-profile/measurements', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const profile = getHealthState(client);
        const entry = {
            id: `ml_${Date.now()}`,
            date: toDateOnlyString(req.body.date || new Date()),
            chest: toNullableNumber(req.body.chest),
            waist: toNullableNumber(req.body.waist),
            hips: toNullableNumber(req.body.hips),
            arms: toNullableNumber(req.body.arms),
            thighs: toNullableNumber(req.body.thighs),
            shoulders: toNullableNumber(req.body.shoulders),
            notes: (req.body.notes || '').toString().trim(),
            createdAt: new Date().toISOString()
        };
        profile.measurementLogs = [entry, ...(profile.measurementLogs || [])];
        client.healthProfile = profile;
        await client.save();
        gamification.awardActivity(client.id, req.user.facilityId, [{ code: 'measurements_updated' }],
            { sourceType: 'measurements', sourceId: entry.id, date: entry.date });
        res.json({ entry, measurementLogs: profile.measurementLogs });
    } catch (error) { sendServerError(res, error); }
});

// Personal Records (PRs) — POST a new record
app.post('/api/clients/:id/health-profile/personal-records', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const profile = getHealthState(client);
        const entry = {
            id: `pr_${Date.now()}`,
            date: toDateOnlyString(req.body.date || new Date()),
            exercise: (req.body.exercise || '').toString().trim(),
            weight: toNullableNumber(req.body.weight),
            reps: toNullableNumber(req.body.reps),
            sets: toNullableNumber(req.body.sets),
            unit: (req.body.unit || 'kg').toString().trim(),
            notes: (req.body.notes || '').toString().trim(),
            createdAt: new Date().toISOString()
        };
        if (!entry.exercise) return res.status(400).json({ message: 'Exercise name is required.' });
        profile.personalRecords = [entry, ...(profile.personalRecords || [])];
        client.healthProfile = profile;
        await client.save();
        gamification.awardActivity(client.id, req.user.facilityId, [{ code: 'personal_record' }],
            { sourceType: 'personal_record', sourceId: entry.id, date: entry.date });
        res.json({ entry, personalRecords: profile.personalRecords });
    } catch (error) { sendServerError(res, error); }
});

// Fitness Tests — POST a new test result
app.post('/api/clients/:id/health-profile/fitness-tests', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const profile = getHealthState(client);
        const allowedTypes = ['1_mile_run', 'push_ups', 'plank_hold', 'vo2_max', 'sit_ups', 'pull_ups', 'custom'];
        const entry = {
            id: `ft_${Date.now()}`,
            date: toDateOnlyString(req.body.date || new Date()),
            type: allowedTypes.includes(req.body.type) ? req.body.type : 'custom',
            label: (req.body.label || req.body.type || 'Fitness Test').toString().trim(),
            score: toNullableNumber(req.body.score),
            unit: (req.body.unit || '').toString().trim(),
            notes: (req.body.notes || '').toString().trim(),
            createdAt: new Date().toISOString()
        };
        profile.fitnessTests = [entry, ...(profile.fitnessTests || [])];
        client.healthProfile = profile;
        await client.save();
        res.json({ entry, fitnessTests: profile.fitnessTests });
    } catch (error) { sendServerError(res, error); }
});

// Mobility Screening — POST a new screening result
app.post('/api/clients/:id/health-profile/mobility-screenings', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const profile = getHealthState(client);
        const entry = {
            id: `ms_${Date.now()}`,
            date: toDateOnlyString(req.body.date || new Date()),
            overallScore: toNullableNumber(req.body.overallScore),
            areas: Array.isArray(req.body.areas) ? req.body.areas : [],
            notes: (req.body.notes || '').toString().trim(),
            createdAt: new Date().toISOString()
        };
        profile.mobilityScreenings = [entry, ...(profile.mobilityScreenings || [])];
        client.healthProfile = profile;
        await client.save();
        res.json({ entry, mobilityScreenings: profile.mobilityScreenings });
    } catch (error) { sendServerError(res, error); }
});

// Goal Reviews — POST a new review entry
app.post('/api/clients/:id/health-profile/goal-reviews', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const profile = getHealthState(client);
        const entry = {
            id: `gr_${Date.now()}`,
            date: toDateOnlyString(req.body.date || new Date()),
            reviewedBy: (req.body.reviewedBy || '').toString().trim(),
            currentGoalType: profile.goalType || null,
            progressRating: toNullableNumber(req.body.progressRating), // 1-5
            notes: (req.body.notes || '').toString().trim(),
            goalUpdated: Boolean(req.body.goalUpdated),
            newGoalType: req.body.goalUpdated ? normalizeGoalType(req.body.newGoalType) : null,
            createdAt: new Date().toISOString()
        };
        if (entry.goalUpdated && entry.newGoalType) {
            profile.goalType = entry.newGoalType;
        }
        profile.goalReviews = [entry, ...(profile.goalReviews || [])];
        client.healthProfile = profile;
        await client.save();
        res.json({ entry, goalReviews: profile.goalReviews, updatedGoalType: profile.goalType });
    } catch (error) { sendServerError(res, error); }
});

// Supplements — POST a structured supplement (type + name)
app.post('/api/clients/:id/health-profile/supplements', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const name = (req.body.name || '').toString().trim();
        if (!name) return res.status(400).json({ message: 'Supplement name is required.' });
        const profile = getHealthState(client);
        const entry = {
            id: `sup_${Date.now()}`,
            type: (req.body.type || '').toString().trim(),
            name,
            dosage: (req.body.dosage || '').toString().trim(),
            notes: (req.body.notes || '').toString().trim(),
            createdAt: new Date().toISOString()
        };
        profile.supplements = [entry, ...(profile.supplements || [])];
        client.healthProfile = profile;
        await client.save();
        res.json({ entry, supplements: profile.supplements });
    } catch (error) { sendServerError(res, error); }
});

// Supplements — DELETE a supplement by id
app.delete('/api/clients/:id/health-profile/supplements/:supplementId', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const profile = getHealthState(client);
        profile.supplements = (profile.supplements || []).filter((s) => s.id !== req.params.supplementId);
        client.healthProfile = profile;
        await client.save();
        res.json({ supplements: profile.supplements });
    } catch (error) { sendServerError(res, error); }
});

// Invoice endpoint — GET payment invoice data
app.get('/api/payments/:id/invoice', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const payment = await Payment.findOne({
            where: { id: req.params.id, facilityId: req.user.facilityId },
            include: [
                { model: Client, attributes: ['name', 'phone', 'email', 'address'] },
                { model: Plan, attributes: ['name', 'duration'] },
                { model: User, as: 'processor', attributes: ['name'] }
            ]
        });
        if (!payment) return res.status(404).json({ message: 'Payment not found' });

        const facility = await Facility.findByPk(req.user.facilityId, { attributes: ['id', 'name', 'address'] });

        res.json({
            invoiceNumber: payment.invoiceNumber || `INV-${payment.id}`,
            invoiceDate: payment.date,
            facility: { name: facility?.name, address: facility?.address },
            client: {
                name: payment.Client?.name,
                phone: payment.Client?.phone,
                email: payment.Client?.email,
                address: payment.Client?.address
            },
            payment: {
                id: payment.id,
                amount: payment.amount,
                method: payment.method,
                transactionId: payment.transactionId,
                date: payment.date,
                planName: payment.Plan?.name || null,
                planDuration: payment.Plan?.duration || null,
                processedBy: payment.processor?.name || null
            }
        });
    } catch (error) { sendServerError(res, error); }
});

app.post('/api/clients/:id/workout-plans', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const healthEnabled = await getFacilityHealthFeature(req.user.facilityId);
        if (!healthEnabled) {
            return res.status(403).json({ message: 'Health profile is disabled for this facility.' });
        }

        const { title, scheduledFor, notes } = req.body || {};
        const entry = createWorkoutEntry({ title, scheduledFor, notes });
        const current = Array.isArray(client.workoutPlans) ? [...client.workoutPlans] : [];
        current.unshift(entry);
        client.workoutPlans = current;
        await client.save();
        res.json({ workoutPlan: entry, workoutPlans: current });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.put('/api/clients/:id/workout-plans/:planId/reschedule', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const healthEnabled = await getFacilityHealthFeature(req.user.facilityId);
        if (!healthEnabled) {
            return res.status(403).json({ message: 'Health profile is disabled for this facility.' });
        }

        const { rescheduledFor, reason } = req.body || {};
        const plans = Array.isArray(client.workoutPlans) ? [...client.workoutPlans] : [];
        const index = plans.findIndex((p) => p.id === req.params.planId);
        if (index < 0) return res.status(404).json({ message: 'Workout plan not found' });

        const nextDate = toDateOnlyString(rescheduledFor);
        if (!nextDate) {
            return res.status(400).json({ message: 'Valid rescheduled date is required.' });
        }

        const current = { ...plans[index] };
        const history = Array.isArray(current.rescheduleHistory)
            ? [...current.rescheduleHistory]
            : [];
        history.unshift({
            from: current.scheduledFor || null,
            to: nextDate,
            reason: (reason || '').toString().trim(),
            by: req.user.id,
            at: new Date().toISOString()
        });

        current.scheduledFor = nextDate;
        current.status = 'rescheduled';
        current.updatedAt = new Date().toISOString();
        current.rescheduleHistory = history;
        plans[index] = current;

        client.workoutPlans = plans;
        await client.save();
        res.json({ workoutPlan: current, workoutPlans: plans });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post('/api/clients/:id/workout-plans/:planId/progress', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const healthEnabled = await getFacilityHealthFeature(req.user.facilityId);
        if (!healthEnabled) {
            return res.status(403).json({ message: 'Health profile is disabled for this facility.' });
        }

        const { status, note } = req.body || {};
        const nextStatus = ['scheduled', 'rescheduled', 'completed', 'missed'].includes(status)
            ? status
            : 'completed';

        const plans = Array.isArray(client.workoutPlans) ? [...client.workoutPlans] : [];
        const index = plans.findIndex((p) => p.id === req.params.planId);
        if (index < 0) return res.status(404).json({ message: 'Workout plan not found' });

        const current = { ...plans[index] };
        const progress = Array.isArray(current.progress) ? [...current.progress] : [];
        progress.unshift({
            status: nextStatus,
            note: (note || '').toString().trim(),
            by: req.user.id,
            at: new Date().toISOString()
        });
        current.status = nextStatus;
        current.progress = progress;
        current.updatedAt = new Date().toISOString();
        plans[index] = current;

        client.workoutPlans = plans;
        await client.save();
        res.json({ workoutPlan: current, workoutPlans: plans });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post('/api/clients/:id/workout-schedules', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const healthEnabled = await getFacilityHealthFeature(req.user.facilityId);
        if (!healthEnabled) {
            return res.status(403).json({ message: 'Health profile is disabled for this facility.' });
        }

        const { name, days, notes, offDays, startDate, endDate } = req.body || {};
        if (!name || !Array.isArray(days) || days.length === 0) {
            return res.status(400).json({ message: 'Schedule name and workout days are required.' });
        }

        const normalizedDays = days.map((d, index) => ({
            dayNumber: Number(d.dayNumber || (index + 1)),
            focus: (d.focus || `Day ${index + 1}`).toString().trim(),
            exercises: Array.isArray(d.exercises)
                ? d.exercises.map((ex) => ({
                    name: (ex.name || '').toString().trim(),
                    sets: toNullableNumber(ex.sets),
                    reps: (ex.reps || '').toString().trim(),
                    weight: toNullableNumber(ex.weight),
                    setsReps: (ex.setsReps || '').toString().trim()
                })).filter((ex) => ex.name)
                : []
        }));

        const profile = getHealthState(client);
        if (profile.currentSchedule) {
            const archived = {
                ...profile.currentSchedule,
                status: 'archived',
                endedAt: new Date().toISOString()
            };
            profile.pastSchedules.unshift(archived);
        }

        const schedule = {
            id: `ws_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
            name: name.toString().trim(),
            notes: (notes || '').toString().trim(),
            offDays: Array.isArray(offDays) && offDays.length
                ? offDays.map((d) => d.toString().toLowerCase())
                : ['sunday'],
            days: normalizedDays,
            status: 'active',
            startDate: toDateOnlyString(startDate || new Date()),
            endDate: endDate ? toDateOnlyString(endDate) : null,
            startedAt: new Date().toISOString(),
            completedDays: []
        };

        profile.currentSchedule = schedule;
        profile.updatedAt = new Date().toISOString();
        client.healthProfile = profile;
        await client.save();

        res.json({ currentSchedule: schedule, pastSchedules: profile.pastSchedules });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post('/api/clients/:id/workout-schedules/:scheduleId/day-log', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const healthEnabled = await getFacilityHealthFeature(req.user.facilityId);
        if (!healthEnabled) {
            return res.status(403).json({ message: 'Health profile is disabled for this facility.' });
        }

        const { dayNumber, status, date, note, cardioMinutes } = req.body || {};
        const allowedStatus = ['done', 'missed', 'cardio', 'off_day'];
        const logStatus = allowedStatus.includes(status) ? status : 'done';
        const logDate = toDateOnlyString(date || new Date());
        if (!logDate) {
            return res.status(400).json({ message: 'Valid date is required.' });
        }

        const profile = getHealthState(client);
        const schedule = profile.currentSchedule;
        if (!schedule || schedule.id !== req.params.scheduleId) {
            return res.status(404).json({ message: 'Active workout schedule not found.' });
        }

        const assigned = assignedWorkoutDayForDate(schedule, logDate);
        const resolvedDayNumber = Number(dayNumber || 0) > 0
            ? Number(dayNumber)
            : (assigned?.dayNumber ?? null);

        const existingEntries = profile.workoutCalendar.filter((log) => (
            log?.scheduleId === schedule.id && log?.date === logDate
        ));
        const existingEntry = existingEntries.find((e) => e.status === 'done') || existingEntries[0] || null;
        profile.workoutCalendar = profile.workoutCalendar.filter((log) => !(
            log?.scheduleId === schedule.id && log?.date === logDate
        ));

        const entry = {
            id: `wlog_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
            date: logDate,
            scheduleId: schedule.id,
            dayNumber: resolvedDayNumber,
            status: logStatus,
            note: (note || '').toString().trim(),
            cardioMinutes: toNullableNumber(cardioMinutes),
            createdBy: req.user.id,
            createdAt: existingEntry?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        profile.workoutCalendar.unshift(entry);
        const completedDays = Array.from(new Set(
            profile.workoutCalendar
                .filter((log) => log?.scheduleId === schedule.id && log?.status === 'done' && log?.dayNumber != null)
                .map((log) => Number(log.dayNumber))
                .filter((value) => Number.isFinite(value) && value > 0)
        ));
        schedule.completedDays = completedDays;
        profile.currentSchedule = { ...schedule, updatedAt: new Date().toISOString() };
        profile.updatedAt = new Date().toISOString();
        client.healthProfile = profile;
        await client.save();

        // Gamification: award workout / cardio XP for logged sessions.
        if (logStatus === 'done' || logStatus === 'cardio') {
            const rules = [];
            if (logStatus === 'done') rules.push({ code: 'workout_completed' });
            if (logStatus === 'cardio') rules.push({ code: 'cardio_completed' });
            if (Number(cardioMinutes) > 60) rules.push({ code: 'workout_long' });
            gamification.awardActivity(client.id, req.user.facilityId, rules,
                { sourceType: 'daylog', sourceId: `${schedule.id}:${logDate}`, date: logDate });
        }

        res.json({
            workoutCalendar: profile.workoutCalendar,
            currentSchedule: profile.currentSchedule,
            dashboard: computeHealthDashboard(profile)
        });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post('/api/clients/:id/weekly-weight', authenticate, checkSubscriptionStatus, authorize(['admin', 'staff']), async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        const healthEnabled = await getFacilityHealthFeature(req.user.facilityId);
        if (!healthEnabled) {
            return res.status(403).json({ message: 'Health profile is disabled for this facility.' });
        }

        const { date, weight } = req.body || {};
        const logDate = toDateOnlyString(date || new Date());
        const numericWeight = toNullableNumber(weight);
        if (!logDate || numericWeight == null) {
            return res.status(400).json({ message: 'Valid date and weight are required.' });
        }

        const profile = getHealthState(client);
        profile.weeklyWeights.unshift({
            date: logDate,
            weight: numericWeight,
            by: req.user.id,
            createdAt: new Date().toISOString()
        });
        profile.currentWeight = numericWeight;
        profile.updatedAt = new Date().toISOString();
        client.healthProfile = profile;
        await client.save();

        res.json({
            weeklyWeights: profile.weeklyWeights,
            currentWeight: profile.currentWeight,
            dashboard: computeHealthDashboard(profile)
        });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.put('/api/staff/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const { name, email } = req.body;
        const staff = await User.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId, role: { [Op.in]: ['staff', 'dietician'] } } });

        if (!staff) return res.status(404).json({ message: 'Staff member not found' });

        staff.name = name;
        staff.email = email;
        await staff.save();
        res.json(staff);
    } catch (error) {
        sendServerError(res, error);
    }
});

app.delete('/api/staff/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const staff = await User.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId, role: { [Op.in]: ['staff', 'dietician'] } } });
        if (!staff) return res.status(404).json({ message: 'Staff member not found' });
        // Detach any clients assigned to this dietician before removing them.
        if (staff.role === 'dietician') {
            await Client.update({ dieticianId: null }, { where: { dieticianId: staff.id, facilityId: req.user.facilityId } });
        }
        await staff.destroy();
        res.json({ message: 'Staff deleted successfully' });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.delete('/api/plans/:id', authenticate, checkSubscriptionStatus, authorize(['admin']), async (req, res) => {
    try {
        const plan = await Plan.findOne({ where: { id: req.params.id, facilityId: req.user.facilityId } });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        await plan.destroy();
        res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
        sendServerError(res, error);
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
        sendServerError(res, error);
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
        sendServerError(res, error);
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
        sendServerError(res, error);
    }
});

// --- GAMIFICATION ROUTES (client app + admin portal) ---
registerGamificationRoutes(app, { authenticate, authorize, checkSubscriptionStatus, sendServerError });

// --- NUTRITION ROUTES ---
registerNutritionRoutes(app, { authenticate, authorize, checkSubscriptionStatus, sendServerError });

// --- PERSONAL TRAINING ROUTES ---
registerPTRoutes(app, { authenticate, authorize, checkSubscriptionStatus, sendServerError });

// --- DIETICIAN / DIET CHART ROUTES ---
registerDieticianRoutes(app, { authenticate, authorize, checkSubscriptionStatus, sendServerError });

// Initialize DB and Start Server
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// --- SCHEDULED CRON JOBS ---
// Sync client plan statuses every hour (removes from API request path)
cron.schedule('0 * * * *', async () => {
    try {
        await syncClientPlanStatuses(null); // sync all facilities
        console.log('[CRON] Client plan statuses synced.');
    } catch (err) {
        console.error('[CRON] syncClientPlanStatuses error:', err.message);
    }
});

// Every day at midnight: check for expiring/expired facility subscriptions and notify
cron.schedule('0 0 * * *', async () => {
    try {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Mark expired facilities
        const expiredFacilities = await Facility.findAll({
            where: { subscriptionStatus: 'active', subscriptionExpiresAt: { [Op.lt]: now } }
        });
        for (const f of expiredFacilities) {
            f.subscriptionStatus = 'expired';
            await f.save();
        }

        // Notify about expiring subscriptions
        const expiringFacilities = await Facility.findAll({
            where: { subscriptionStatus: 'active', subscriptionExpiresAt: { [Op.between]: [now, in7Days] } },
            include: [{ model: SubscriptionPlan }]
        });
        for (const facility of expiringFacilities) {
            const existing = await Notification.findOne({
                where: { role: 'superadmin', message: { [Op.like]: `%${facility.name}%expiring%` }, createdAt: { [Op.gte]: new Date(now - 24 * 60 * 60 * 1000) } }
            });
            if (!existing) {
                await Notification.create({
                    message: `Facility "${facility.name}" subscription expiring on ${facility.subscriptionExpiresAt}.`,
                    type: 'warning',
                    role: 'superadmin',
                    path: '/facilities'
                });
            }
        }
        console.log(`[CRON] Facility expiry check done. ${expiredFacilities.length} expired, ${expiringFacilities.length} expiring soon.`);
    } catch (err) {
        console.error('[CRON] Facility expiry check error:', err.message);
    }
});

// --- GAMIFICATION CRON JOBS ---
// Weekly league reset + promotion/relegation (Monday 00:00).
cron.schedule('0 0 * * 1', async () => {
    try {
        const result = await gamification.computeLeaguePromotions();
        console.log(`[CRON] League reset done. Promotions: ${result.promotions}, Relegations: ${result.relegations}.`);
    } catch (err) {
        console.error('[CRON] League promotion error:', err.message);
    }
});

// Daily streak decay — break streaks for members who were inactive yesterday (00:05).
cron.schedule('5 0 * * *', async () => {
    try {
        const broken = await gamification.decayStreaks();
        console.log(`[CRON] Streak decay done. ${broken} streak(s) reset.`);
    } catch (err) {
        console.error('[CRON] Streak decay error:', err.message);
    }
});

// Daily challenge generation + expiry of stale challenges (00:01).
cron.schedule('1 0 * * *', async () => {
    try {
        await gamification.generateScheduledChallenges();
        console.log('[CRON] Scheduled challenges generated.');
    } catch (err) {
        console.error('[CRON] Challenge generation error:', err.message);
    }
});

// Run initial client sync on startup
(async () => {
    try {
        await syncClientPlanStatuses(null);
    } catch (err) {
        console.error('[STARTUP] Initial plan status sync failed:', err.message);
    }
})();

const isProduction = process.env.NODE_ENV === 'production';
// CRITICAL: Never run alter:true in production — can drop/modify columns
sequelize.sync({ alter: !isProduction }).then(async () => {
    // Create default superadmin if not exists
    const superadmin = await User.findOne({ where: { role: 'superadmin' } });
    if (!superadmin) {
        const defaultPassword = process.env.SUPERADMIN_DEFAULT_PASSWORD || 'admin123';
        if (isProduction && defaultPassword === 'admin123') {
            console.error('[FATAL] Refusing to seed superadmin with the well-known default password in production. Set SUPERADMIN_DEFAULT_PASSWORD in .env.');
            process.exit(1);
        }
        // No manual bcrypt.hash — User model beforeCreate hook handles hashing
        await User.create({
            name: 'Super Admin',
            email: process.env.SUPERADMIN_EMAIL || 'super@admin.com',
            password: defaultPassword,
            role: 'superadmin'
        });
        console.log(`Superadmin created: ${process.env.SUPERADMIN_EMAIL || 'super@admin.com'}`);
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

    // Seed global gamification defaults (XP rules, leagues, achievements)
    // and generate today's / this week's challenges.
    await seedGamificationDefaults();
    try {
        await gamification.generateScheduledChallenges();
        console.log('Scheduled challenges generated.');
    } catch (err) {
        console.error('[gamification] challenge generation failed:', err.message);
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
