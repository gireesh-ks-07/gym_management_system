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

export const can = (routeKey, role) => (ROUTE_ROLES[routeKey] || []).includes(role);

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
 * A facility whose subscription has lapsed locks its staff out of everything
 * except their landing page. Applies to every facility role — a dietician of a
 * suspended gym must see the same block screen as its admin, rather than a
 * working UI that returns 403 on the first click.
 */
export const isFacilityBlocked = (role, subscription) =>
    isFacilityStaff(role) && !!subscription && subscription.subscriptionStatus !== 'active';
