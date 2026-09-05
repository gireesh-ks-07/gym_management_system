'use strict';

/**
 * Explicit notification targeting.
 *
 * Notifications used to state their audience implicitly, through whichever id
 * columns happened to be set. Because every facility-scoped row carries a
 * facilityId — and the client-app JWT also carries one — a read filtered on
 * facilityId alone matched the facility's internal notices for members too.
 *
 * This replaces the inferred `role` column with an explicit `audience`, adds
 * `userId` so a single staff member can be addressed, and backfills existing
 * rows using the same inference the old code relied on (correct as a one-off,
 * since it is applied to rows written under those exact rules).
 *
 * Idempotent — safe to run against a DB where sequelize.sync already created
 * some of these objects in non-production environments.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const tableNames = new Set(
      tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name))
    );
    if (!tableNames.has('Notifications')) return;

    const describe = async () => qi.describeTable('Notifications');
    let def = await describe();

    // --- audience ---
    if (!def.audience) {
      await qi.addColumn('Notifications', 'audience', {
        type: Sequelize.ENUM('superadmin', 'facility', 'user', 'client'),
        allowNull: false,
        defaultValue: 'facility'
      });
    }

    // --- userId ---
    if (!def.userId) {
      await qi.addColumn('Notifications', 'userId', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }

    def = await describe();

    // --- Backfill audience from the old implicit rules ---
    // Order matters: most specific first.
    if (def.clientId) {
      await qi.sequelize.query(
        `UPDATE "Notifications" SET "audience" = 'client' WHERE "clientId" IS NOT NULL;`
      );
    }
    if (def.role) {
      await qi.sequelize.query(
        `UPDATE "Notifications" SET "audience" = 'superadmin'
         WHERE "role" = 'superadmin' AND "clientId" IS NULL;`
      );
    }
    await qi.sequelize.query(
      `UPDATE "Notifications" SET "audience" = 'facility'
       WHERE "facilityId" IS NOT NULL AND "clientId" IS NULL
       AND "audience" <> 'superadmin';`
    );

    // --- Drop the now-redundant role column ---
    if (def.role) {
      await qi.removeColumn('Notifications', 'role');
    }

    // --- Indexes for the new read paths ---
    const existingIndexes = await qi.showIndex('Notifications').catch(() => []);
    const haveIndex = (name) => existingIndexes.some((i) => i.name === name);
    for (const field of ['audience', 'facilityId', 'userId', 'clientId']) {
      const name = `notifications_${field.toLowerCase()}`;
      if (!haveIndex(name)) {
        await qi.addIndex('Notifications', [field], { name }).catch(() => {});
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const tableNames = new Set(
      tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name))
    );
    if (!tableNames.has('Notifications')) return;

    const def = await qi.describeTable('Notifications');

    if (!def.role) {
      await qi.addColumn('Notifications', 'role', {
        type: Sequelize.STRING,
        allowNull: true
      });
      await qi.sequelize.query(
        `UPDATE "Notifications" SET "role" = 'superadmin' WHERE "audience" = 'superadmin';`
      );
    }
    if (def.audience) {
      await qi.removeColumn('Notifications', 'audience');
      await qi.sequelize
        .query(`DROP TYPE IF EXISTS "enum_Notifications_audience";`)
        .catch(() => {});
    }
    if (def.userId) {
      await qi.removeColumn('Notifications', 'userId');
    }
  }
};
