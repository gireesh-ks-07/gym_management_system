'use strict';

/**
 * Dietician role & per-client Diet Chart:
 *  - Adds 'dietician' to the User role enum (additive; existing roles unaffected).
 *  - Adds Clients.dieticianId (nullable FK -> Users) so admins can assign a
 *    client to a dietician; scopes what each dietician can see.
 *  - New DietCharts table holding per-client nutrition assessment + individualized
 *    diet plan (rich JSON `data` blob + queryable columns).
 *
 * Idempotent — safe to run against a DB where sequelize.sync already created some
 * of these objects in non-production environments.
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

    // --- 'dietician' role ---
    await ensureEnumValues('enum_Users_role', ['dietician']);

    // --- Clients.dieticianId ---
    await ensureColumn('Clients', 'dieticianId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // --- DietCharts table ---
    if (!tableExists('DietCharts')) {
      await qi.createTable('DietCharts', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        facilityId: { type: Sequelize.INTEGER, allowNull: false },
        clientId: { type: Sequelize.INTEGER, allowNull: false },
        dieticianId: { type: Sequelize.INTEGER, allowNull: true },
        title: { type: Sequelize.STRING, allowNull: true },
        assessmentDate: { type: Sequelize.DATEONLY, allowNull: true },
        primaryGoal: { type: Sequelize.STRING, allowNull: true },
        status: {
          type: Sequelize.ENUM('draft', 'active', 'archived'),
          allowNull: false,
          defaultValue: 'draft'
        },
        data: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      });

      for (const field of ['facilityId', 'clientId', 'dieticianId', 'status']) {
        await qi.addIndex('DietCharts', [field]);
      }
    }
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const tableNames = new Set(
      tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name))
    );

    if (tableNames.has('DietCharts')) {
      await qi.dropTable('DietCharts');
    }
    // Note: Postgres cannot easily drop a single enum value, so 'dietician' is
    // intentionally left in enum_Users_role. Clients.dieticianId is removed.
    if (tableNames.has('Clients')) {
      const def = await qi.describeTable('Clients');
      if (def.dieticianId) await qi.removeColumn('Clients', 'dieticianId');
    }
  }
};
