'use strict';

/**
 * Letterhead fields for the diet-chart PDF export.
 *
 * The exported chart is a clinical document that carries a practitioner's
 * credentials in its header and the facility's contact block in its footer.
 * Neither had anywhere to live: Facility held only name + address, and User
 * held no professional credentials at all.
 *
 *  - Facilities.tagline / email / phone / logoUrl  -> PDF footer block.
 *  - Users.qualification / registrationNumber      -> PDF header + signature.
 *
 * All nullable and additive: a facility that never fills these in still gets a
 * valid PDF, just with the corresponding lines omitted.
 *
 * Idempotent — safe against dev databases already built by sequelize.sync.
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

    const ensureColumn = async (table, column, definition) => {
      if (!tableExists(table)) return;
      const def = await qi.describeTable(table);
      if (!def[column]) await qi.addColumn(table, column, definition);
    };

    await ensureColumn('Facilities', 'tagline', { type: Sequelize.STRING, allowNull: true });
    await ensureColumn('Facilities', 'email', { type: Sequelize.STRING, allowNull: true });
    await ensureColumn('Facilities', 'phone', { type: Sequelize.STRING, allowNull: true });
    await ensureColumn('Facilities', 'logoUrl', { type: Sequelize.TEXT, allowNull: true });

    await ensureColumn('Users', 'qualification', { type: Sequelize.STRING, allowNull: true });
    await ensureColumn('Users', 'registrationNumber', { type: Sequelize.STRING, allowNull: true });
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const tableNames = new Set(
      tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name))
    );

    const dropColumn = async (table, column) => {
      if (!tableNames.has(table)) return;
      const def = await qi.describeTable(table);
      if (def[column]) await qi.removeColumn(table, column);
    };

    for (const c of ['tagline', 'email', 'phone', 'logoUrl']) await dropColumn('Facilities', c);
    for (const c of ['qualification', 'registrationNumber']) await dropColumn('Users', c);
  }
};
