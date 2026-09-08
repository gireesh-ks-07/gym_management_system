'use strict';

/**
 * Link the attendance log to PT sessions.
 *
 * The two were independent ledgers with no reference between them in either
 * direction: completing a PT session left the member marked absent for that
 * day, and awarded none of the XP a door check-in awards.
 *
 *   - Attendance.source     how the row came to exist ('manual' | 'pt_session').
 *                           Rows a PT session raised are removed again if that
 *                           session is un-completed or deleted; front-desk rows
 *                           never are.
 *   - PTSessions.attendanceId  the attendance row this session raised.
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

    const ensureColumn = async (table, column, definition) => {
      if (!tableNames.has(table)) return;
      const def = await qi.describeTable(table);
      if (!def[column]) await qi.addColumn(table, column, definition);
    };

    await ensureColumn('Attendances', 'source', {
      type: Sequelize.ENUM('manual', 'pt_session'),
      allowNull: false,
      defaultValue: 'manual'
    });

    await ensureColumn('PTSessions', 'attendanceId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // The attendanceId index is declared on the PTSession model and created by
    // the baseline migration; adding it here as well would duplicate it.
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const tableNames = new Set(
      tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name))
    );

    if (tableNames.has('PTSessions')) {
      const def = await qi.describeTable('PTSessions');
      if (def.attendanceId) await qi.removeColumn('PTSessions', 'attendanceId');
    }
    if (tableNames.has('Attendances')) {
      const def = await qi.describeTable('Attendances');
      if (def.source) {
        await qi.removeColumn('Attendances', 'source');
        await qi.sequelize
          .query('DROP TYPE IF EXISTS "enum_Attendances_source";')
          .catch(() => {});
      }
    }
  }
};
