// =============================================================================
// Production migration for the Gamification module.
//
// Uses the app's own Sequelize connection (../models), so it runs against the
// same database the server uses — no separate sequelize-cli production config
// needed. Fully idempotent: safe to run multiple times.
//
// Run on the server (with the production .env present):
//     node scripts/migrate-gamification.js
//
// What it does:
//   1. Creates any missing gamification tables (CREATE TABLE IF NOT EXISTS via
//      sync — never drops or alters existing tables).
//   2. Adds the new nullable `clientId` column to the existing Notifications
//      table (sync alone won't add a column to an existing table).
//   3. Seeds the global default XP rules / leagues / achievements (idempotent).
// =============================================================================

require('dotenv').config();
const models = require('../models');
const { sequelize } = models;
const { seedGamificationDefaults } = require('../gamification/seed');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('[migrate-gamification] Connected to database.');

        // 1. Create missing tables (dependency-ordered, non-destructive).
        //    alter is intentionally NOT used — existing tables are untouched.
        await sequelize.sync();
        console.log('[migrate-gamification] Ensured gamification tables exist.');

        // 2. Add Notifications.clientId (safe additive, nullable, idempotent).
        await sequelize.query(
            'ALTER TABLE "Notifications" ADD COLUMN IF NOT EXISTS "clientId" INTEGER;'
        );
        console.log('[migrate-gamification] Ensured Notifications.clientId column.');

        // 3. Seed global defaults (findOrCreate — idempotent).
        await seedGamificationDefaults();

        console.log('[migrate-gamification] ✅ Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('[migrate-gamification] ❌ Migration failed:', err?.message || err);
        process.exit(1);
    }
})();
