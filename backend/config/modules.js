/**
 * The catalogue of sellable feature modules.
 *
 * This is a SaaS: what a facility can reach depends on what its plan includes,
 * not only on the user's role. Those are two different questions and they have
 * two different files:
 *
 *     config/permissions.js  — may this ROLE do it?      (403 Forbidden)
 *     config/modules.js      — has this FACILITY bought it? (402 Payment Required)
 *
 * A route generally needs both: `authorize(P.PT_MANAGE)` and
 * `requireModule('pt')`.
 *
 * ---------------------------------------------------------------------------
 * Adding a new sellable module
 * ---------------------------------------------------------------------------
 *   1. Add an entry below. That is the only place it needs describing — the
 *      super-admin's package toggles and the plan editor both render from this
 *      registry, so neither UI needs touching.
 *   2. Put `requireModule('<key>')` in the module's route chain, after
 *      `authenticate`.
 *   3. Add the key to MODULE_ROUTES in frontend/src/config/roles.js if it owns
 *      a nav item.
 *
 * `default` decides what a facility gets when neither its plan nor its own
 * overrides say anything. Existing modules default to true so that turning this
 * system on changed nothing; a genuinely new paid add-on should default false.
 *
 * ---------------------------------------------------------------------------
 * How a module is resolved for a facility
 * ---------------------------------------------------------------------------
 *   1. facility.modules[key]              — explicit per-facility override
 *   2. facility.SubscriptionPlan.modules  — what the tier includes
 *   3. registry default
 *
 * A per-facility override always wins, so support can switch something on for
 * one customer without inventing a new plan.
 */

const MODULES = [
    {
        key: 'healthPro',
        label: 'Health Pro',
        description: 'Body-fat history, measurements, fitness tests, mobility screens, goal reviews, strength PRs.',
        default: false
    },
    {
        key: 'paymentsPro',
        label: 'Payments Pro',
        description: 'Online payments and proper GST invoices.',
        default: false
    },
    {
        key: 'pt',
        label: 'Personal Training',
        description: 'PT plans with per-period session allowances, session logging, trainer reports.',
        default: true
    },
    {
        key: 'nutrition',
        label: 'Nutrition',
        description: 'Food database, diet plans and member assignments.',
        default: true
    },
    {
        key: 'dietician',
        label: 'Dieticians & Diet Charts',
        description: 'Dietician logins and the per-member 14-section diet chart.',
        requires: ['nutrition'],
        default: true
    },
    {
        key: 'gamification',
        label: 'Gamification',
        description: 'XP, streaks, leagues, challenges, achievements and rewards.',
        default: true
    }
];

const MODULE_KEYS = MODULES.map((m) => m.key);
const byKey = new Map(MODULES.map((m) => [m.key, m]));

/** Every module's default state, as a plain object. */
const defaultModuleMap = () =>
    MODULES.reduce((acc, m) => { acc[m.key] = m.default; return acc; }, {});

/**
 * Resolve one module for a facility.
 *
 * `facility` may carry an eager-loaded SubscriptionPlan; when it doesn't, the
 * plan tier simply doesn't contribute and the registry default applies.
 */
const isModuleEnabled = (facility, key) => {
    const spec = byKey.get(key);
    if (!spec) return false;

    // A module whose prerequisite is off is off, whatever its own flag says.
    if (spec.requires && spec.requires.some((dep) => !isModuleEnabled(facility, dep))) {
        return false;
    }

    const own = facility?.modules;
    if (own && typeof own === 'object' && own[key] != null) return Boolean(own[key]);

    const plan = facility?.SubscriptionPlan?.modules;
    if (plan && typeof plan === 'object' && plan[key] != null) return Boolean(plan[key]);

    return spec.default;
};

/** The resolved on/off state of every module for a facility. */
const resolveModules = (facility) =>
    MODULE_KEYS.reduce((acc, key) => { acc[key] = isModuleEnabled(facility, key); return acc; }, {});

/** Drop unknown keys and coerce to booleans before persisting an override. */
const sanitizeModuleMap = (input) => {
    if (!input || typeof input !== 'object') return {};
    return MODULE_KEYS.reduce((acc, key) => {
        if (input[key] != null) acc[key] = Boolean(input[key]);
        return acc;
    }, {});
};

module.exports = {
    MODULES,
    MODULE_KEYS,
    defaultModuleMap,
    isModuleEnabled,
    resolveModules,
    sanitizeModuleMap
};
