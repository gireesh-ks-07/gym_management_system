/**
 * The single place that answers "who may do what".
 *
 * Before this existed, role lists were written out by hand at every call site —
 * `['admin', 'staff']` appeared in more than thirty places across server.js,
 * four route registrars and five React files. Adding the `dietician` role meant
 * updating all of them, and it was only updated in some: that drift is what
 * produced the dietician-shows-as-trainer bug and the missing dietician read
 * access to health profiles.
 *
 * Rules:
 *   - Route gates take a capability from here, never a literal array.
 *   - Name capabilities after the action, not the role, so the question a
 *     reader asks ("may a dietician do X?") is answered in one place.
 *   - Keep frontend/src/config/roles.js in step with this file.
 */

const ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    STAFF: 'staff',
    DIETICIAN: 'dietician',
    CLIENT: 'client'
};

const { SUPERADMIN, ADMIN, STAFF, DIETICIAN, CLIENT } = ROLES;

// Every role that belongs to a facility's staff (i.e. logs into the admin web
// app rather than the member app).
const FACILITY_STAFF = [ADMIN, STAFF, DIETICIAN];

const PERMISSIONS = {
    // --- Platform (super admin) ---
    PLATFORM_MANAGE: [SUPERADMIN],

    // --- Facility ---
    // Reading subscription state gates the "facility suspended" screen, so
    // every staff role needs it — including dieticians.
    FACILITY_SUBSCRIPTION_READ: [SUPERADMIN, ADMIN, STAFF, DIETICIAN],
    FACILITY_BILLING_MANAGE: [ADMIN],

    // --- Members ---
    MEMBERS_READ: [SUPERADMIN, ADMIN, STAFF],
    MEMBERS_WRITE: [ADMIN, STAFF],

    // --- Health profile & workout schedules ---
    // NOTE: HEALTH_READ is widened to include DIETICIAN in the next commit
    // (read-only access to the training week, so diet plans can be built around
    // it). Held at the current value here so this refactor is provably a
    // no-op.
    HEALTH_READ: [ADMIN, STAFF],
    HEALTH_WRITE: [ADMIN, STAFF],
    WORKOUTS_WRITE: [ADMIN, STAFF],

    // --- Staff & membership plans ---
    STAFF_MANAGE: [ADMIN],
    PLANS_WRITE: [ADMIN],
    PLANS_READ: [SUPERADMIN, ADMIN, STAFF],

    // --- Payments & attendance ---
    PAYMENTS_READ: [ADMIN, STAFF],
    PAYMENTS_WRITE: [ADMIN, STAFF],
    ATTENDANCE_READ: [SUPERADMIN, ADMIN, STAFF],
    ATTENDANCE_WRITE: [ADMIN, STAFF],

    // --- Reporting & gamification ---
    DASHBOARD_READ: [SUPERADMIN, ADMIN, STAFF],
    REPORTS_READ: [SUPERADMIN, ADMIN, STAFF],
    GAMIFICATION_MANAGE: [ADMIN, SUPERADMIN],

    // --- Personal training ---
    PT_MANAGE: [SUPERADMIN, ADMIN, STAFF],
    // Who may be *assigned* as a trainer on a session. Deliberately excludes
    // dieticians: they are staff, but they do not deliver training.
    PT_TRAINER: [ADMIN, STAFF],

    // --- Nutrition ---
    NUTRITION_MANAGE: [SUPERADMIN, ADMIN, STAFF],
    FOOD_DB: [SUPERADMIN, ADMIN, STAFF, DIETICIAN],

    // --- Dieticians & diet charts ---
    DIETICIAN_MANAGE: [SUPERADMIN, ADMIN],
    CHART_READ: [SUPERADMIN, ADMIN, STAFF, DIETICIAN],
    // Only a dietician authors a plan.
    CHART_AUTHOR: [DIETICIAN],
    CHART_EDIT: [SUPERADMIN, ADMIN, STAFF, DIETICIAN],
    // NOTE: STAFF is removed from CHART_DELETE in the next commit — deleting a
    // member's nutrition plan is not a front-desk action. Held at the current
    // value here so this refactor is provably a no-op.
    CHART_DELETE: [SUPERADMIN, ADMIN, STAFF, DIETICIAN],

    // --- Member (client app) ---
    CLIENT_APP: [CLIENT]
};

/**
 * May this role see every record in its facility, rather than only the subset
 * assigned to it?
 *
 * Kept separate from "is an admin". Conflating the two is what let a plain
 * staff member delete any diet chart: the dietician controller asked
 * `isAdminRole()` both for scoping (where staff legitimately belong) and for
 * destructive authority (where they do not).
 */
const isUnscoped = (role) => role === SUPERADMIN || role === ADMIN || role === STAFF;

/** Roles that log into the admin web app rather than the member app. */
const isFacilityStaff = (role) => FACILITY_STAFF.includes(role);

/** May this user be assigned as the trainer on a PT session? */
const isTrainerRole = (role) => PERMISSIONS.PT_TRAINER.includes(role);

const can = (capability, role) => (PERMISSIONS[capability] || []).includes(role);

module.exports = {
    ROLES,
    FACILITY_STAFF,
    PERMISSIONS,
    P: PERMISSIONS,
    isUnscoped,
    isFacilityStaff,
    isTrainerRole,
    can
};
