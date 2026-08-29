'use strict';

/**
 * Personal Training (PT) support:
 *  - Plans gain planType / ptSessionsCount / ptSessionPeriod (additive; existing
 *    plans default to 'normal' and are unaffected).
 *  - New PTSessions table for per-member session tracking.
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
    const tableExists = (name) => tableNames.has(name);

    const columnExists = async (table, column) => {
      if (!tableExists(table)) return false;
      const def = await qi.describeTable(table);
      return Boolean(def[column]);
    };

    const ensureColumn = async (table, column, definition) => {
      if (!tableExists(table)) return;
      if (!(await columnExists(table, column))) {
        await qi.addColumn(table, column, definition);
      }
    };

    // --- Plan PT columns ---
    await ensureColumn('Plans', 'planType', {
      type: Sequelize.ENUM('normal', 'pt'),
      allowNull: false,
      defaultValue: 'normal'
    });
    await ensureColumn('Plans', 'ptSessionsCount', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await ensureColumn('Plans', 'ptSessionPeriod', {
      type: Sequelize.ENUM('weekly', 'monthly'),
      allowNull: true
    });

    // --- PTSessions table ---
    if (!tableExists('PTSessions')) {
      await qi.createTable('PTSessions', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        facilityId: { type: Sequelize.INTEGER, allowNull: false },
        clientId: { type: Sequelize.INTEGER, allowNull: false },
        planId: { type: Sequelize.INTEGER, allowNull: true },
        trainerId: { type: Sequelize.INTEGER, allowNull: true },
        sessionDate: { type: Sequelize.DATE, allowNull: false },
        durationMinutes: { type: Sequelize.INTEGER, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        status: {
          type: Sequelize.ENUM('scheduled', 'completed', 'cancelled', 'no_show'),
          allowNull: false,
          defaultValue: 'scheduled'
        },
        completedAt: { type: Sequelize.DATE, allowNull: true },
        overrideUsed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        createdBy: { type: Sequelize.INTEGER, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      });

      for (const field of ['facilityId', 'clientId', 'trainerId', 'status', 'sessionDate']) {
        await qi.addIndex('PTSessions', [field]);
      }
    }
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const tableNames = new Set(
      tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name))
    );
    if (tableNames.has('PTSessions')) {
      await qi.dropTable('PTSessions');
    }
    for (const column of ['ptSessionPeriod', 'ptSessionsCount', 'planType']) {
      if (tableNames.has('Plans')) {
        const def = await qi.describeTable('Plans');
        if (def[column]) await qi.removeColumn('Plans', column);
      }
    }
  }
};
