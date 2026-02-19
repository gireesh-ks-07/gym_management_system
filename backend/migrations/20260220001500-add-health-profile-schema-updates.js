'use strict';

/** @type {import('sequelize-cli').Migration} */
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

    const ensureEnumValues = async (enumName, values) => {
      const [enumRows] = await qi.sequelize.query(
        `SELECT 1 FROM pg_type WHERE typname = :enumName LIMIT 1;`,
        { replacements: { enumName } }
      );
      if (!enumRows.length) return;

      for (const value of values) {
        const [existingRows] = await qi.sequelize.query(
          `SELECT 1
           FROM pg_type t
           JOIN pg_enum e ON t.oid = e.enumtypid
           WHERE t.typname = :enumName
           AND e.enumlabel = :enumValue
           LIMIT 1;`,
          { replacements: { enumName, enumValue: value } }
        );
        if (existingRows.length) continue;

        const safeValue = value.replace(/'/g, "''");
        await qi.sequelize.query(
          `ALTER TYPE "${enumName}" ADD VALUE '${safeValue}';`
        );
      }
    };

    await ensureColumn('Facilities', 'healthProfileEnabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await ensureColumn('Clients', 'healthProfile', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {}
    });

    await ensureColumn('Clients', 'workoutPlans', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    });

    // Keep enum aligned with current API/business states.
    await ensureEnumValues('enum_Facilities_subscriptionStatus', [
      'active',
      'expired',
      'suspended',
      'pending',
      'blocked'
    ]);
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const tableNames = new Set(
      tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name))
    );
    const tableExists = (name) => tableNames.has(name);

    const removeColumnIfExists = async (table, column) => {
      if (!tableExists(table)) return;
      const def = await qi.describeTable(table);
      if (def[column]) {
        await qi.removeColumn(table, column);
      }
    };

    await removeColumnIfExists('Clients', 'workoutPlans');
    await removeColumnIfExists('Clients', 'healthProfile');
    await removeColumnIfExists('Facilities', 'healthProfileEnabled');
  }
};
