/**
 * Frontend mirror of backend/config/permissions.js.
 *
 * The router, sidebar and navbar used to each keep their own hand-written role
 * lists, which is how a dietician ended up with a "Quick Add → Add Member"
 * button that bounces straight back to /nutrition, and why the suspended-
 * facility screen never appeared for them.
 *
 * This file is the only place the admin web app decides what a role may see.
 * It is a *usability* boundary, not a security one — the backend is the
 * authority. Keep the two in step.
 */

export const ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    STAFF: 'staff',
    DIETICIAN: 'dietician'
};

const { SUPERADMIN, ADMIN, STAFF, DIETICIAN } = ROLES;

/** Roles that belong to a facility (as opposed to the platform superadmin). */
export const FACILITY_STAFF = [ADMIN, STAFF, DIETICIAN];

/**
 * Who may open each route. Mirrors the backend capability of the same name.
 */
export const ROUTE_ROLES = {
    dashboard:        [ADMIN, STAFF, SUPERADMIN],
    members:          [ADMIN, STAFF, SUPERADMIN],
    healthProfile:    [ADMIN, STAFF, DIETICIAN], // dietician read-only
    facilities:       [SUPERADMIN],
    subscriptionPlans:[SUPERADMIN],
    facilityTypes:    [SUPERADMIN],
    plans:            [ADMIN],
    staff:            [ADMIN],
    payments:         [ADMIN, STAFF],
    reports:          [ADMIN, SUPERADMIN],
    gamification:     [ADMIN, SUPERADMIN],
    nutrition:        [ADMIN, STAFF, DIETICIAN],
    personalTraining: [ADMIN, STAFF]
};

/**
 * Which feature module each route belongs to, mirroring backend/config/modules.js.
 *
 * This is a SaaS: a nav item needs both a role that may open it AND a facility
 * whose plan includes it. Routes absent from this map are core product and are
 * always available.
 */
export const MODULE_ROUTES = {
    nutrition: 'nutrition',
    personalTraining: 'pt',
    gamification: 'gamification'
};

export const can = (routeKey, role) => (ROUTE_ROLES[routeKey] || []).includes(role);

/**
 * Is the module behind this route included in the facility's plan?
 *
 * `enabledModules` comes resolved from GET /api/facility/subscription. When it
 * is absent — superadmin, or the request hasn't landed yet — nothing is hidden;
 * the backend is the authority and will answer 402 if it really isn't included.
 */
export const moduleAvailable = (routeKey, enabledModules) => {
    const moduleKey = MODULE_ROUTES[routeKey];
    if (!moduleKey) return true;
    if (!enabledModules) return true;
    return enabledModules[moduleKey] !== false;
};

/** Does this role belong to a facility, and therefore have a subscription? */
export const isFacilityStaff = (role) => FACILITY_STAFF.includes(role);

/**
 * Where a role lands after login, and where it is sent if it hits a route it
 * may not open. Dieticians have a restricted workspace centred on diet charts.
 */
export const homePathForRole = (role) => (role === DIETICIAN ? '/nutrition' : '/');

/**
 * Deleting a member's diet chart is not a front-desk action — mirrors the
 * backend CHART_DELETE capability. Staff keep read and health-section edit
 * access, so the list stays fully usable for them.
 */
export const canDeleteDietChart = (role) =>
    [SUPERADMIN, ADMIN, DIETICIAN].includes(role);

/**
 * May this role write the diet-plan sections (goals, meal plan, specifications,
 * guidelines) rather than only the health-assessment ones? Mirrors the backend
 * CHART_AUTHOR capability — admins are included because a facility may not
 * employ a dietician at all.
 */
export const canAuthorDietPlan = (role) =>
    [SUPERADMIN, ADMIN, DIETICIAN].includes(role);

/**
 * A facility whose subscription has lapsed locks its staff out of everything
 * except their landing page. Applies to every facility role — a dietician of a
 * suspended gym must see the same block screen as its admin, rather than a
 * working UI that returns 403 on the first click.
 */
export const isFacilityBlocked = (role, subscription) =>
    isFacilityStaff(role) && !!subscription && subscription.subscriptionStatus !== 'active';
