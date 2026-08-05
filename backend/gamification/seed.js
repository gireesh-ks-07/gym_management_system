// =============================================================================
// Seeds the global (facilityId = null) gamification defaults. Idempotent — safe
// to run on every boot; only inserts rows that don't already exist.
// =============================================================================

const models = require('../models');
const {
    DEFAULT_XP_RULES,
    DEFAULT_LEAGUES,
    DEFAULT_ACHIEVEMENTS
} = require('./config');

const { XpRule, League, Achievement } = models;

async function seedGamificationDefaults() {
    try {
        for (const rule of DEFAULT_XP_RULES) {
            await XpRule.findOrCreate({
                where: { facilityId: null, code: rule.code },
                defaults: { ...rule, facilityId: null }
            });
        }
        for (const league of DEFAULT_LEAGUES) {
            await League.findOrCreate({
                where: { facilityId: null, tier: league.tier },
                defaults: { ...league, facilityId: null }
            });
        }
        for (const ach of DEFAULT_ACHIEVEMENTS) {
            await Achievement.findOrCreate({
                where: { facilityId: null, code: ach.code },
                defaults: { ...ach, facilityId: null }
            });
        }
        console.log('Gamification defaults seeded (XP rules, leagues, achievements).');
    } catch (err) {
        console.error('[gamification] seed failed:', err?.message || err);
    }
}

module.exports = { seedGamificationDefaults };
