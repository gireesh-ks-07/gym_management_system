const { Op } = require('sequelize');
const { Membership, Client, Plan, Payment } = require('../models');

// ============================================================================
// Memberships — couple & group plans
//
// A membership holds a plan on behalf of one or more members. For an individual
// plan (memberCapacity 1) that is a membership of one, so there is a single code
// path rather than "grouped" and "legacy".
//
// This module is the ONLY writer of the plan/billing columns on Client. Those
// columns are a projection of the owning membership — around ninety backend read
// sites and both Flutter apps read them off the member payload, so they stay,
// but nothing else may set them or the two will drift.
// ============================================================================

// Add months without rolling over a short month: 31 Jan + 1 month is 28/29 Feb,
// not 2/3 March. Mirrors addMonthsClamped in server.js, which is not exported.
const addMonthsClamped = (baseDateValue, monthsToAdd) => {
    if (!baseDateValue) return null;
    const base = new Date(baseDateValue);
    if (Number.isNaN(base.getTime())) return null;
    const months = Number(monthsToAdd);
    if (!Number.isFinite(months)) return null;

    const day = base.getDate();
    const target = new Date(base.getTime());
    target.setDate(1);
    target.setMonth(target.getMonth() + months);
    const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, daysInTargetMonth));
    return target;
};

// The plan runs to the day before the same date next term.
const calculateExpiry = (baseDateValue, monthsToAdd) => {
    const expiry = addMonthsClamped(baseDateValue, monthsToAdd);
    if (!expiry) return null;
    expiry.setDate(expiry.getDate() - 1);
    return expiry;
};

const toDateOnly = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * How many members a plan covers. Anything unparseable, or a PT plan, is one.
 * PT is delivered one-to-one, so a PT plan is never a group plan.
 */
const capacityOf = (plan) => {
    if (!plan) return 1;
    if (plan.planType === 'pt') return 1;
    const n = parseInt(plan.memberCapacity, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
};

/**
 * Status for a membership from its payment history and expiry, matching the
 * per-client rule that preceded it.
 *
 * The payment count is over the whole membership, not one member. Counting per
 * client would mark the non-paying half of a couple `payment_due` forever —
 * their partner made the single payment that covers them both.
 */
const resolveStatus = ({ hasPayment, expiryDate }) => {
    if (!expiryDate) return 'inactive';
    const expired = new Date(expiryDate).getTime() < Date.now();
    if (expired) return 'inactive';
    return hasPayment ? 'active' : 'payment_due';
};

/**
 * Recompute a membership's expiry and status, then project plan, billing dates
 * and status onto every member of it.
 *
 * This is the single point where those Client columns are written. Call it after
 * anything that changes a membership: joining, leaving, a plan change, a payment.
 *
 * @param {Membership|number} membershipOrId
 * @returns {Promise<Membership|null>}
 */
const applyMembershipToClients = async (membershipOrId) => {
    const membership = typeof membershipOrId === 'object' && membershipOrId !== null
        ? membershipOrId
        : await Membership.findByPk(membershipOrId);
    if (!membership) return null;

    const plan = membership.planId ? await Plan.findByPk(membership.planId) : null;

    if (!membership.billingRenewalDate && plan) {
        const members = await Client.findAll({
            where: { membershipId: membership.id },
            order: [['joiningDate', 'ASC']]
        });
        const seed = members[0]?.joiningDate || members[0]?.createdAt || new Date();
        membership.billingRenewalDate = toDateOnly(seed);
    }

    const expiry = plan ? calculateExpiry(membership.billingRenewalDate, plan.duration) : null;
    const paymentCount = await Payment.count({ where: { membershipId: membership.id } });

    membership.planExpiresAt = expiry;
    membership.status = plan
        ? resolveStatus({ hasPayment: paymentCount > 0, expiryDate: expiry })
        : 'inactive';
    await membership.save();

    // Project onto the members. Written here and nowhere else.
    await Client.update(
        {
            planId: membership.planId,
            billingRenewalDate: membership.billingRenewalDate,
            planExpiresAt: membership.planExpiresAt,
            status: membership.status
        },
        { where: { membershipId: membership.id } }
    );

    return membership;
};

/**
 * The membership a client belongs to, creating a membership of one if they have
 * none. Every client that holds a plan ends up with a membership, so callers do
 * not have to branch on whether grouping is in play.
 */
const ensureMembershipForClient = async (client, { planId } = {}) => {
    if (client.membershipId) {
        const existing = await Membership.findByPk(client.membershipId);
        if (existing) return existing;
    }

    const membership = await Membership.create({
        facilityId: client.facilityId,
        planId: planId !== undefined ? planId : client.planId || null,
        primaryClientId: client.id,
        billingRenewalDate: client.billingRenewalDate || toDateOnly(client.joiningDate || new Date()),
        status: 'inactive'
    });

    client.membershipId = membership.id;
    await client.save();
    return membership;
};

/**
 * Current and maximum occupancy of a membership.
 */
const occupancy = async (membership) => {
    const plan = membership.planId ? await Plan.findByPk(membership.planId) : null;
    const used = await Client.count({ where: { membershipId: membership.id } });
    return { used, capacity: capacityOf(plan), plan };
};

/**
 * Add a member to an existing membership.
 *
 * Refuses when the membership is full or across facilities.
 *
 * A member who already holds their own membership is a normal case — pairing two
 * existing members means one of them gives up the plan they held alone. That is
 * a real change to what someone is paying for, so it only happens when the
 * caller passes `transfer`, and never as a side effect. Moving the last member
 * out of a membership leaves it empty, and it is removed.
 */
const addMemberToMembership = async (membership, client, { transfer = false } = {}) => {
    if (client.facilityId !== membership.facilityId) {
        return { ok: false, code: 403, message: 'Member belongs to a different facility' };
    }
    if (client.membershipId === membership.id) {
        return { ok: true, membership };
    }
    if (client.membershipId) {
        if (!transfer) {
            return {
                ok: false,
                code: 409,
                message: 'Member already belongs to another membership. Remove them from it first.'
            };
        }
        const previous = await Membership.findByPk(client.membershipId);
        await removeMemberFromMembership(client);
        if (previous) {
            const left = await Client.count({ where: { membershipId: previous.id } });
            if (left === 0) await previous.destroy();
        }
        await client.reload();
    }

    const { used, capacity, plan } = await occupancy(membership);
    if (used >= capacity) {
        return {
            ok: false,
            code: 409,
            message: capacity === 1
                ? `"${plan?.name || 'This plan'}" is an individual plan and cannot be shared.`
                : `This membership is full (${used}/${capacity} members).`
        };
    }

    client.membershipId = membership.id;
    await client.save();
    if (!membership.primaryClientId) {
        membership.primaryClientId = client.id;
        await membership.save();
    }
    await applyMembershipToClients(membership);
    return { ok: true, membership };
};

/**
 * Remove a member from their membership.
 *
 * Their plan and billing columns are cleared — they are no longer covered by
 * anything. Removing the primary member promotes the next remaining one rather
 * than orphaning the billing relationship; removing the last member leaves an
 * empty membership, which the caller may delete.
 */
const removeMemberFromMembership = async (client) => {
    const membership = client.membershipId ? await Membership.findByPk(client.membershipId) : null;
    if (!membership) return { ok: true, membership: null };

    client.membershipId = null;
    client.planId = null;
    client.planExpiresAt = null;
    client.status = 'inactive';
    await client.save();

    if (membership.primaryClientId === client.id) {
        const next = await Client.findOne({
            where: { membershipId: membership.id },
            order: [['joiningDate', 'ASC']]
        });
        membership.primaryClientId = next ? next.id : null;
        await membership.save();
    }

    await applyMembershipToClients(membership);
    return { ok: true, membership };
};

/**
 * Move a membership onto a different plan.
 *
 * Refuses when the new plan cannot seat everyone already on it — silently
 * dropping the second half of a couple because the admin picked an individual
 * plan is not an acceptable outcome.
 */
const changeMembershipPlan = async (membership, plan) => {
    const used = await Client.count({ where: { membershipId: membership.id } });
    const capacity = capacityOf(plan);
    if (used > capacity) {
        return {
            ok: false,
            code: 409,
            message: `"${plan.name}" covers ${capacity} member${capacity === 1 ? '' : 's'}, but this membership has ${used}. Remove members first.`
        };
    }
    membership.planId = plan.id;
    await membership.save();
    await applyMembershipToClients(membership);
    return { ok: true, membership };
};

/**
 * Memberships of a facility with their members and plan, newest first.
 * `groupsOnly` restricts to memberships whose plan seats more than one.
 */
const listMemberships = async (facilityId, { groupsOnly = false } = {}) => {
    const memberships = await Membership.findAll({
        where: { facilityId },
        include: [
            { model: Plan, attributes: ['id', 'name', 'price', 'duration', 'planType', 'memberCapacity'] },
            { model: Client, as: 'members', attributes: ['id', 'name', 'phone', 'status'] }
        ],
        order: [['createdAt', 'DESC']]
    });
    if (!groupsOnly) return memberships;
    return memberships.filter((m) => capacityOf(m.Plan) > 1);
};

module.exports = {
    capacityOf,
    resolveStatus,
    calculateExpiry,
    applyMembershipToClients,
    ensureMembershipForClient,
    addMemberToMembership,
    removeMemberFromMembership,
    changeMembershipPlan,
    listMemberships,
    occupancy
};
