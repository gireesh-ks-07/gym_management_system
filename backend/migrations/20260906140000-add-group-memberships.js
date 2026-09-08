'use strict';

/**
 * Couple & group membership plans.
 *
 * A Plan gains `memberCapacity` — how many people one membership of it covers.
 * 1 is an individual plan and is the default, so every existing plan and every
 * existing member behaves exactly as before.
 *
 * A `Memberships` row is the thing that actually holds a plan: it owns the plan
 * reference, the billing cycle and the status, and one or more Clients belong to
 * it. That is what lets two people share one renewal date and one payment, which
 * pointing two Clients at the same Plan row never could.
 *
 * `Clients.planId`, `billingRenewalDate`, `planExpiresAt` and `status` are kept
 * as a projection of the owning membership rather than being dropped: roughly
 * ninety backend read sites plus both Flutter apps (including generated
 * model code) read them off the member payload. Membership is the single writer;
 * see applyMembershipToClients in services/memberships.js.
 *
 * Every existing client that holds a plan is backfilled into a one-person
 * membership, so there is one code path rather than "grouped" and "legacy".
 *
 * Idempotent — safe against dev databases already built by sequelize.sync.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;

    const tableNames = async () => {
      const tables = await qi.showAllTables();
      return new Set(tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name)));
    };

    let names = await tableNames();
    const ensureColumn = async (table, column, definition) => {
      if (!names.has(table)) return;
      const def = await qi.describeTable(table);
      if (!def[column]) await qi.addColumn(table, column, definition);
    };

    // --- 1. Plan capacity -------------------------------------------------
    // 1 = individual. Only 'normal' plans may exceed 1: personal training is
    // delivered one-to-one, so a PT plan is always a single-member plan.
    await ensureColumn('Plans', 'memberCapacity', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    });

    // --- 2. Memberships ---------------------------------------------------
    if (!names.has('Memberships')) {
      await qi.createTable('Memberships', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        facilityId: { type: Sequelize.INTEGER, allowNull: false },
        planId: { type: Sequelize.INTEGER, allowNull: true },
        // The member who carries the billing relationship. Nullable so a
        // membership survives its primary member being removed; the service
        // promotes another member rather than orphaning the row.
        primaryClientId: { type: Sequelize.INTEGER, allowNull: true },
        billingRenewalDate: { type: Sequelize.DATEONLY, allowNull: true },
        planExpiresAt: { type: Sequelize.DATE, allowNull: true },
        status: {
          type: Sequelize.ENUM('active', 'inactive', 'payment_due'),
          allowNull: false,
          defaultValue: 'inactive'
        },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      });
      await qi.addIndex('Memberships', ['facilityId'], { name: 'memberships_facility' });
      await qi.addIndex('Memberships', ['planId'], { name: 'memberships_plan' });
      names = await tableNames();
    }

    // --- 3. Links ---------------------------------------------------------
    await ensureColumn('Clients', 'membershipId', { type: Sequelize.INTEGER, allowNull: true });
    // A payment settles a membership, not a person: one payment covers a couple.
    // Kept nullable alongside the existing clientId so historic rows stay valid.
    await ensureColumn('Payments', 'membershipId', { type: Sequelize.INTEGER, allowNull: true });

    const clientDef = await qi.describeTable('Clients');
    if (clientDef.membershipId) {
      const [idx] = await qi.sequelize.query(
        `SELECT 1 FROM pg_indexes WHERE tablename = 'Clients' AND indexname = 'clients_membership' LIMIT 1;`
      );
      if (!idx.length) {
        await qi.addIndex('Clients', ['membershipId'], { name: 'clients_membership' });
      }
    }

    // --- 4. Backfill ------------------------------------------------------
    // One membership per existing plan-holding client, carrying that client's
    // own billing dates and status so nothing changes for them.
    await qi.sequelize.query(`
      INSERT INTO "Memberships"
        ("facilityId", "planId", "primaryClientId", "billingRenewalDate", "planExpiresAt", "status", "createdAt", "updatedAt")
      SELECT c."facilityId", c."planId", c."id", c."billingRenewalDate", c."planExpiresAt",
             c."status"::text::"enum_Memberships_status", NOW(), NOW()
        FROM "Clients" c
       WHERE c."planId" IS NOT NULL
         AND c."membershipId" IS NULL
         AND c."facilityId" IS NOT NULL;
    `);

    await qi.sequelize.query(`
      UPDATE "Clients" c
         SET "membershipId" = m."id"
        FROM "Memberships" m
       WHERE m."primaryClientId" = c."id"
         AND c."membershipId" IS NULL;
    `);

    // Attribute existing payments to the payer's membership.
    await qi.sequelize.query(`
      UPDATE "Payments" p
         SET "membershipId" = c."membershipId"
        FROM "Clients" c
       WHERE p."clientId" = c."id"
         AND p."membershipId" IS NULL
         AND c."membershipId" IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const names = new Set(tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name)));

    const dropColumn = async (table, column) => {
      if (!names.has(table)) return;
      const def = await qi.describeTable(table);
      if (def[column]) await qi.removeColumn(table, column);
    };

    await dropColumn('Payments', 'membershipId');
    await dropColumn('Clients', 'membershipId');
    await dropColumn('Plans', 'memberCapacity');

    if (names.has('Memberships')) {
      await qi.dropTable('Memberships');
      await qi.sequelize.query('DROP TYPE IF EXISTS "enum_Memberships_status";');
    }
  }
};
