'use strict';

/**
 * Feature modules on the SaaS tier.
 *
 * Facilities already carried a `modules` JSON override; there was nowhere to say
 * what a *plan* includes, so every sellable add-on had to be switched on
 * facility by facility. A tier now declares its own set, and the facility's map
 * stays as the per-customer override on top of it.
 *
 * Resolution order lives in config/modules.js:
 *   facility.modules → plan.modules → registry default.
 *
 * Left empty on existing plans: an empty map contributes nothing, so every
 * facility keeps resolving to the registry defaults exactly as before.
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
    if (!tableNames.has('SubscriptionPlans')) return;

    const def = await qi.describeTable('SubscriptionPlans');
    if (!def.modules) {
      await qi.addColumn('SubscriptionPlans', 'modules', {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {}
      });
    }
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const tableNames = new Set(
      tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name))
    );
    if (!tableNames.has('SubscriptionPlans')) return;

    const def = await qi.describeTable('SubscriptionPlans');
    if (def.modules) await qi.removeColumn('SubscriptionPlans', 'modules');
  }
};
