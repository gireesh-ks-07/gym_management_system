'use strict';

/**
 * Member identity and invoice uniqueness.
 *
 * Clients.phone had no unique constraint of any kind, and member login looks a
 * client up by phone alone — so two members in one facility could share a
 * number and login would silently resolve to whichever row came first, locking
 * the other out of their own account. Uniqueness is per facility, not global:
 * the same person legitimately holds memberships at two different gyms.
 *
 * Payments.invoiceNumber draws 5 random digits within a month — a space of
 * 90,000, where collisions become likely in the low hundreds of invoices per
 * month. With no constraint that produced two payments quietly sharing an
 * invoice number; with one, the caller retries.
 *
 * The indexes are created CONCURRENTLY-free (small tables at this stage) and
 * IF NOT EXISTS, so this is safe against a database sync() already touched.
 *
 * If this migration fails on a duplicate, resolve the duplicate rows first —
 * the constraint is refusing to hide a real data problem.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const names = new Set(tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name)));

    if (names.has('Clients')) {
      await qi.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "clients_facility_phone"
        ON "Clients" ("facilityId", "phone");
      `);
      // Partial: email is optional, and many members share the absence of one.
      await qi.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "clients_facility_email"
        ON "Clients" ("facilityId", "email")
        WHERE "email" IS NOT NULL;
      `);
    }

    if (names.has('Payments')) {
      // Named to match what the model's `unique: true` emits, so a database
      // built from migrations and one built from sync() stay identical.
      // Postgres unique indexes already permit repeated NULLs, so unset
      // invoice numbers are unaffected.
      await qi.sequelize.query(`
        DO $$ BEGIN
          ALTER TABLE "Payments"
            ADD CONSTRAINT "Payments_invoiceNumber_key" UNIQUE ("invoiceNumber");
        EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
        END $$;
      `);
    }
  },

  async down(queryInterface) {
    const qi = queryInterface;
    for (const idx of ['clients_facility_phone', 'clients_facility_email']) {
      await qi.sequelize.query(`DROP INDEX IF EXISTS "${idx}";`);
    }
    await qi.sequelize.query('ALTER TABLE "Payments" DROP CONSTRAINT IF EXISTS "Payments_invoiceNumber_key";');
  }
};
