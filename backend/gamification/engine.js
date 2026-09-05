// =============================================================================
// Gamification Engine
// -----------------------------------------------------------------------------
// The single source of truth for XP, levels, streaks, achievements, challenges,
// leaderboards and league promotions. Everything routes through here so award
// logic lives in one place and duplicate awards are impossible (unique dedupeKey
// on XpTransaction).
//
// Design rule: engine calls invoked from inside a live HTTP request are
// fire-and-forget — awardActivity() never throws; a gamification failure must
// never break attendance, payments, or workout logging.
// =============================================================================

const { Op } = require('sequelize');
const models = require('../models');
const {
    STREAK_QUALIFYING_RULES,
    DAILY_CHALLENGE_TEMPLATES,
    WEEKLY_CHALLENGE_TEMPLATES
} = require('./config');

const {
    sequelize,
    Client,
    Attendance,
    Notification,
    GamificationProfile,
    XpRule,
    XpTransaction,
    Achievement,
    MemberAchievement,
    Challenge,
    ChallengeProgress,
    League,
    LeagueMembership,
    Reward,
    RewardRedemption,
    GamificationEvent
} = models;

const MAX_LEVEL = 100;

// ---------------------------------------------------------------------------
// Level maths — matches the spec (L1=0, L2=300, L3=700; delta grows +100/level)
//   xpForLevel(n) = 200*(n-1) + 50*(n-1)*n
// ---------------------------------------------------------------------------
function xpForLevel(n) {
    if (n <= 1) return 0;
    const capped = Math.min(n, MAX_LEVEL);
    return 200 * (capped - 1) + 50 * (capped - 1) * capped;
}

function levelForXp(xp) {
    const value = Math.max(0, Number(xp) || 0);
    let level = 1;
    while (level < MAX_LEVEL && xpForLevel(level + 1) <= value) level += 1;
    return level;
}

// Progress within the current level -> useful for animated progress bars.
function levelProgress(lifetimeXp) {
    const level = levelForXp(lifetimeXp);
    const currentFloor = xpForLevel(level);
    const nextCeil = level >= MAX_LEVEL ? currentFloor : xpForLevel(level + 1);
    const span = Math.max(1, nextCeil - currentFloor);
    const into = Math.max(0, lifetimeXp - currentFloor);
    return {
        level,
        currentFloor,
        nextLevelXp: nextCeil,
        xpIntoLevel: into,
        xpForNextLevel: Math.max(0, nextCeil - lifetimeXp),
        percent: level >= MAX_LEVEL ? 100 : Math.min(100, Math.round((into / span) * 100))
    };
}

// ---------------------------------------------------------------------------
// Date helpers — UTC-based, matching the rest of the app (Attendance keys its
// day off new Date().toISOString().split('T')[0]). Keeping the engine on the
// same UTC "day" boundary is what makes dedupe keys and daily filters line up.
// DATEONLY strings are YYYY-MM-DD.
// ---------------------------------------------------------------------------
function toDateStr(value) {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
}

// Monday-based week start (UTC) for the given date.
function weekStartStr(value) {
    const d = value ? new Date(value) : new Date();
    const dayOfWeek = (d.getUTCDay() + 6) % 7; // 0 = Monday
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek));
    return monday.toISOString().slice(0, 10);
}

// Start of the current day/week/month as a UTC-midnight Date, for range filters.
function periodRange(period) {
    const now = new Date();
    const end = now;
    let start;
    if (period === 'daily') {
        start = new Date(toDateStr(now)); // UTC midnight today
    } else if (period === 'monthly') {
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    } else {
        // weekly (default)
        start = new Date(weekStartStr(now));
    }
    return { start, end };
}

// ---------------------------------------------------------------------------
// Rules & profile
// ---------------------------------------------------------------------------
async function resolveRule(facilityId, code) {
    // Facility-specific override wins over the global default.
    const facilityRule = facilityId
        ? await XpRule.findOne({ where: { facilityId, code } })
        : null;
    if (facilityRule) return facilityRule;
    return XpRule.findOne({ where: { facilityId: null, code } });
}

async function getOrCreateProfile(clientId, facilityId = null) {
    let profile = await GamificationProfile.findOne({ where: { clientId } });
    if (!profile) {
        const bronze = await resolveLowestLeague(facilityId);
        profile = await GamificationProfile.create({
            clientId,
            facilityId,
            currentLeagueId: bronze ? bronze.id : null,
            weekStart: weekStartStr(new Date())
        });
    }
    return profile;
}

async function resolveLowestLeague(facilityId) {
    const facilityLeague = facilityId
        ? await League.findOne({ where: { facilityId }, order: [['tier', 'ASC']] })
        : null;
    if (facilityLeague) return facilityLeague;
    return League.findOne({ where: { facilityId: null }, order: [['tier', 'ASC']] });
}

async function leaguesFor(facilityId) {
    const facilityLeagues = facilityId
        ? await League.findAll({ where: { facilityId }, order: [['tier', 'ASC']] })
        : [];
    if (facilityLeagues.length) return facilityLeagues;
    return League.findAll({ where: { facilityId: null }, order: [['tier', 'ASC']] });
}

// ---------------------------------------------------------------------------
// Notifications & timeline
// ---------------------------------------------------------------------------
async function notifyClient(clientId, facilityId, message, type = 'success', path = '/gamification') {
    try {
        await Notification.create({ audience: 'client', clientId, facilityId, message, type, path });
    } catch (_) { /* non-critical */ }
}

async function logEvent(clientId, facilityId, { type, title, description, xp = 0, icon, meta }) {
    try {
        await GamificationEvent.create({
            clientId, facilityId, type, title,
            description: description || null,
            xp, icon: icon || null, meta: meta || {}
        });
    } catch (_) { /* non-critical */ }
}

// ---------------------------------------------------------------------------
// Core: award XP (idempotent)
// ---------------------------------------------------------------------------
// Returns { awarded:boolean, duplicate:boolean, xp, leveledUp, level }.
async function awardXp({ clientId, facilityId = null, ruleCode, amount, sourceType, sourceId, dedupeKey, meta = {}, date }) {
    const rule = ruleCode ? await resolveRule(facilityId, ruleCode) : null;
    if (ruleCode && rule && rule.enabled === false) {
        return { awarded: false, duplicate: false, xp: 0 };
    }

    const xp = amount != null ? Math.trunc(amount) : (rule ? rule.xp : 0);
    if (!xp) return { awarded: false, duplicate: false, xp: 0 };

    // Build a stable dedupe key when the caller didn't supply one.
    let key = dedupeKey;
    if (!key) {
        const freq = rule ? rule.frequency : 'unlimited';
        if (freq === 'once') key = `${ruleCode}:${clientId}`;
        else if (freq === 'once_per_day') key = `${ruleCode}:${clientId}:${toDateStr(date)}`;
        else if (sourceType && sourceId != null) key = `${ruleCode}:${clientId}:${sourceType}:${sourceId}`;
        else key = `${ruleCode || 'xp'}:${clientId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    }

    const profile = await getOrCreateProfile(clientId, facilityId);

    // Insert the ledger row first — the unique dedupeKey enforces idempotency.
    try {
        await XpTransaction.create({
            clientId,
            facilityId: facilityId ?? profile.facilityId,
            ruleCode: ruleCode || 'custom',
            xp,
            sourceType: sourceType || null,
            sourceId: sourceId != null ? String(sourceId) : null,
            dedupeKey: key,
            meta
        });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return { awarded: false, duplicate: true, xp: 0 };
        }
        throw err;
    }

    // Roll the weekly bucket if we crossed into a new week.
    const thisWeek = weekStartStr(new Date());
    if (profile.weekStart !== thisWeek) {
        profile.weekStart = thisWeek;
        profile.weeklyXp = 0;
    }

    const prevLevel = profile.level;
    if (xp > 0) profile.lifetimeXp += xp;
    profile.totalXp = Math.max(0, profile.totalXp + xp);
    if (xp > 0) profile.weeklyXp += xp;
    profile.level = levelForXp(profile.lifetimeXp);
    await profile.save();

    // Keep the weekly league bucket in sync for leaderboards.
    if (xp > 0) await bumpWeeklyBucket(profile, xp, thisWeek);

    if (xp > 0) {
        await logEvent(clientId, profile.facilityId, {
            type: 'xp_earned',
            title: rule ? `+${xp} XP · ${rule.label}` : `+${xp} XP`,
            xp,
            icon: 'Zap',
            meta: { ruleCode }
        });
    }

    const leveledUp = profile.level > prevLevel;
    if (leveledUp) {
        await logEvent(clientId, profile.facilityId, {
            type: 'level_up',
            title: `Reached Level ${profile.level}!`,
            icon: 'TrendingUp',
            meta: { level: profile.level }
        });
        await notifyClient(clientId, profile.facilityId, `🎉 You reached Level ${profile.level}!`, 'success');
    }

    return { awarded: true, duplicate: false, xp, leveledUp, level: profile.level };
}

async function bumpWeeklyBucket(profile, xp, thisWeek) {
    const [bucket] = await LeagueMembership.findOrCreate({
        where: { clientId: profile.clientId, weekStart: thisWeek },
        defaults: {
            facilityId: profile.facilityId,
            leagueId: profile.currentLeagueId,
            weeklyXp: 0
        }
    });
    bucket.weeklyXp += xp;
    if (!bucket.leagueId && profile.currentLeagueId) bucket.leagueId = profile.currentLeagueId;
    await bucket.save();
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------
async function updateStreak(clientId, facilityId, dateStr) {
    const profile = await getOrCreateProfile(clientId, facilityId);
    const today = dateStr || toDateStr(new Date());

    if (profile.lastActivityDate === today) return profile; // already counted today

    const yesterday = toDateStr(new Date(new Date(today).getTime() - 86400000));
    if (profile.lastActivityDate === yesterday) {
        profile.currentStreak += 1;
    } else {
        profile.currentStreak = 1;
    }
    profile.lastActivityDate = today;
    if (profile.currentStreak > profile.longestStreak) {
        profile.longestStreak = profile.currentStreak;
    }
    await profile.save();

    // Milestone bonuses (idempotent per streak-length, per member).
    if (profile.currentStreak === 7) {
        await awardXp({ clientId, facilityId, ruleCode: 'streak_7', dedupeKey: `streak_7:${clientId}:${today}` });
        await notifyClient(clientId, facilityId, '🔥 7-day streak! Keep it going.', 'success');
    }
    if (profile.currentStreak === 30) {
        await awardXp({ clientId, facilityId, ruleCode: 'streak_30', dedupeKey: `streak_30:${clientId}:${today}` });
        await notifyClient(clientId, facilityId, '🔥 30-day streak! Incredible consistency.', 'success');
    }
    return profile;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------
async function getMemberStats(clientId, profile) {
    const p = profile || await getOrCreateProfile(clientId);
    const [attendanceCount, earlyCheckins, workoutsCompleted, nutritionLogs] = await Promise.all([
        Attendance.count({ where: { clientId } }),
        Attendance.count({ where: { clientId, checkInTime: { [Op.lt]: '08:00:00' } } }),
        XpTransaction.count({ where: { clientId, ruleCode: 'workout_completed' } }),
        XpTransaction.count({ where: { clientId, ruleCode: 'nutrition_logged' } })
    ]);
    return {
        attendance_count: attendanceCount,
        early_checkins: earlyCheckins,
        workouts_completed: workoutsCompleted,
        nutrition_logs: nutritionLogs,
        longest_streak: p.longestStreak,
        current_streak: p.currentStreak,
        level: p.level,
        total_xp: p.lifetimeXp
    };
}

function conditionMet(condition, stats) {
    if (!condition || !condition.metric) return false;
    const value = stats[condition.metric];
    if (value == null) return false;
    if (condition.gte != null) return value >= condition.gte;
    if (condition.gt != null) return value > condition.gt;
    if (condition.eq != null) return value === condition.eq;
    return false;
}

async function evaluateAchievements(clientId, facilityId) {
    const profile = await getOrCreateProfile(clientId, facilityId);
    const fid = facilityId ?? profile.facilityId;

    const achievements = await Achievement.findAll({
        where: { status: 'active', facilityId: { [Op.or]: [fid, null] } }
    });
    if (!achievements.length) return [];

    const already = await MemberAchievement.findAll({ where: { clientId } });
    const unlockedIds = new Set(already.map((a) => a.achievementId));
    const toCheck = achievements.filter((a) => !unlockedIds.has(a.id));
    if (!toCheck.length) return [];

    const stats = await getMemberStats(clientId, profile);
    const newlyUnlocked = [];

    for (const ach of toCheck) {
        if (!conditionMet(ach.unlockCondition, stats)) continue;
        try {
            await MemberAchievement.create({ clientId, achievementId: ach.id });
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') continue;
            throw err;
        }
        if (ach.rewardXp > 0) {
            await awardXp({
                clientId, facilityId: fid, ruleCode: 'achievement',
                amount: ach.rewardXp,
                dedupeKey: `achievement:${clientId}:${ach.id}`,
                meta: { achievementCode: ach.code }
            });
        }
        await logEvent(clientId, fid, {
            type: 'badge_unlocked',
            title: `Unlocked: ${ach.name}`,
            xp: ach.rewardXp,
            icon: ach.icon,
            meta: { achievementId: ach.id, code: ach.code }
        });
        await notifyClient(clientId, fid, `🏅 Achievement unlocked: ${ach.name}`, 'success');
        newlyUnlocked.push(ach);
    }
    return newlyUnlocked;
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------
async function progressChallenges(clientId, facilityId, metric, amount = 1) {
    const now = new Date();
    const profile = await getOrCreateProfile(clientId, facilityId);
    const fid = facilityId ?? profile.facilityId;

    const challenges = await Challenge.findAll({
        where: {
            status: 'active',
            facilityId: { [Op.or]: [fid, null] },
            [Op.and]: [
                { [Op.or]: [{ startDate: null }, { startDate: { [Op.lte]: now } }] },
                { [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: now } }] }
            ]
        }
    });
    const matching = challenges.filter((c) => c.criteria && c.criteria.metric === metric);

    for (const ch of matching) {
        const [cp] = await ChallengeProgress.findOrCreate({
            where: { clientId, challengeId: ch.id },
            defaults: { facilityId: fid, progress: 0 }
        });
        if (cp.completed) continue;
        cp.progress += amount;
        const target = Number(ch.criteria.target) || 1;
        if (cp.progress >= target) {
            cp.progress = target;
            cp.completed = true;
            cp.completedAt = now;
            await logEvent(clientId, fid, {
                type: 'challenge_completed',
                title: `Challenge complete: ${ch.title}`,
                description: 'Claim your reward!',
                icon: 'Target',
                meta: { challengeId: ch.id }
            });
            await notifyClient(clientId, fid, `✅ Challenge complete: ${ch.title}. Claim your XP!`, 'success');
        }
        await cp.save();
    }
}

// Member-initiated: claim the XP for a completed-but-unclaimed challenge.
async function claimChallenge(clientId, facilityId, challengeId) {
    const cp = await ChallengeProgress.findOne({ where: { clientId, challengeId } });
    if (!cp || !cp.completed) throw new Error('Challenge not completed');
    if (cp.claimed) throw new Error('Reward already claimed');

    const challenge = await Challenge.findByPk(challengeId);
    if (!challenge) throw new Error('Challenge not found');

    const ruleCode = challenge.type === 'weekly' ? 'weekly_challenge'
        : challenge.type === 'daily' ? 'daily_challenge' : 'daily_challenge';

    await awardXp({
        clientId, facilityId, ruleCode,
        amount: challenge.xpReward,
        dedupeKey: `challenge_claim:${clientId}:${challengeId}`,
        meta: { challengeId }
    });
    cp.claimed = true;
    await cp.save();
    return { xp: challenge.xpReward };
}

// ---------------------------------------------------------------------------
// High-level hook used from inside HTTP requests. NEVER throws.
// rules: [{ code, amount? }]. ctx: { sourceType, sourceId, date, meta,
//   streak?:bool, challenge?:bool, achievements?:bool }
// ---------------------------------------------------------------------------
async function awardActivity(clientId, facilityId, rules, ctx = {}) {
    try {
        if (!clientId) return;
        const list = Array.isArray(rules) ? rules : [rules];
        for (const r of list) {
            const rule = typeof r === 'string' ? { code: r } : r;
            await awardXp({
                clientId,
                facilityId,
                ruleCode: rule.code,
                amount: rule.amount,
                sourceType: ctx.sourceType,
                sourceId: ctx.sourceId,
                date: ctx.date,
                meta: ctx.meta || {}
            });
            if (ctx.challenge !== false) {
                await progressChallenges(clientId, facilityId, rule.code, 1);
            }
        }
        if (ctx.streak !== false && list.some((r) => STREAK_QUALIFYING_RULES.includes(typeof r === 'string' ? r : r.code))) {
            await updateStreak(clientId, facilityId, ctx.date);
        }
        if (ctx.achievements !== false) {
            await evaluateAchievements(clientId, facilityId);
        }
    } catch (err) {
        console.error('[gamification] awardActivity failed:', err?.message || err);
    }
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------
async function redeemReward(clientId, facilityId, rewardId) {
    const reward = await Reward.findByPk(rewardId);
    if (!reward || reward.status !== 'active') throw new Error('Reward unavailable');
    if (reward.facilityId && reward.facilityId !== facilityId) throw new Error('Reward unavailable');
    if (reward.expiry && new Date(reward.expiry) < new Date()) throw new Error('Reward expired');
    if (reward.inventory != null && reward.inventory <= 0) throw new Error('Reward out of stock');

    const profile = await getOrCreateProfile(clientId, facilityId);
    if (profile.totalXp < reward.xpCost) throw new Error('Not enough XP');

    return sequelize.transaction(async (t) => {
        profile.totalXp -= reward.xpCost;
        await profile.save({ transaction: t });

        await XpTransaction.create({
            clientId,
            facilityId,
            ruleCode: 'reward_redeem',
            xp: -reward.xpCost,
            sourceType: 'reward',
            sourceId: String(rewardId),
            dedupeKey: `reward_redeem:${clientId}:${rewardId}:${Date.now()}`,
            meta: { rewardName: reward.name }
        }, { transaction: t });

        if (reward.inventory != null) {
            reward.inventory -= 1;
            await reward.save({ transaction: t });
        }

        const redemption = await RewardRedemption.create({
            clientId, facilityId, rewardId,
            xpSpent: reward.xpCost,
            status: 'pending'
        }, { transaction: t });

        await GamificationEvent.create({
            clientId, facilityId,
            type: 'reward_redeemed',
            title: `Redeemed: ${reward.name}`,
            description: `-${reward.xpCost} XP`,
            xp: -reward.xpCost,
            icon: 'Gift',
            meta: { rewardId, redemptionId: redemption.id }
        }, { transaction: t });

        return redemption;
    });
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
async function getLeaderboard({ facilityId, period = 'weekly', clientId, limit = 100 } = {}) {
    const { start, end } = periodRange(period);

    // Sum positive XP in the window, grouped by member.
    const rows = await XpTransaction.findAll({
        attributes: [
            'clientId',
            [sequelize.fn('SUM', sequelize.col('xp')), 'xpSum']
        ],
        where: {
            facilityId,
            xp: { [Op.gt]: 0 },
            createdAt: { [Op.between]: [start, end] }
        },
        group: ['clientId'],
        order: [[sequelize.literal('"xpSum"'), 'DESC']],
        limit,
        raw: true
    });

    const clientIds = rows.map((r) => r.clientId);
    if (!clientIds.length) return [];

    const [clients, profiles, leagues] = await Promise.all([
        Client.findAll({ where: { id: clientIds }, attributes: ['id', 'name', 'gender'] }),
        GamificationProfile.findAll({ where: { clientId: clientIds } }),
        leaguesFor(facilityId)
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const profileMap = new Map(profiles.map((p) => [p.clientId, p]));
    const leagueMap = new Map(leagues.map((l) => [l.id, l]));

    return rows.map((r, idx) => {
        const c = clientMap.get(r.clientId);
        const p = profileMap.get(r.clientId);
        const league = p && p.currentLeagueId ? leagueMap.get(p.currentLeagueId) : null;
        return {
            rank: idx + 1,
            clientId: r.clientId,
            name: c ? c.name : 'Member',
            gender: c ? c.gender : null,
            xp: Number(r.xpSum) || 0,
            level: p ? p.level : 1,
            league: league ? { name: league.name, tier: league.tier, color: league.color, icon: league.icon } : null,
            currentStreak: p ? p.currentStreak : 0,
            isCurrentUser: clientId != null && r.clientId === clientId
        };
    });
}

// ---------------------------------------------------------------------------
// League promotions (weekly cron) — evaluate the just-finished week.
// ---------------------------------------------------------------------------
async function computeLeaguePromotions(referenceDate) {
    const ref = referenceDate ? new Date(referenceDate) : new Date();
    // The week that just ended = previous Monday bucket.
    const lastWeek = weekStartStr(new Date(ref.getTime() - 7 * 86400000));

    const facilities = await LeagueMembership.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('facilityId')), 'facilityId']],
        where: { weekStart: lastWeek },
        raw: true
    });

    let promotions = 0;
    let relegations = 0;

    for (const { facilityId } of facilities) {
        const leagues = await leaguesFor(facilityId);
        if (!leagues.length) continue;
        const byTier = new Map(leagues.map((l) => [l.tier, l]));
        const maxTier = Math.max(...leagues.map((l) => l.tier));

        for (const league of leagues) {
            const bucket = await LeagueMembership.findAll({
                where: { facilityId, weekStart: lastWeek, leagueId: league.id },
                order: [['weeklyXp', 'DESC']]
            });
            if (!bucket.length) continue;

            // Persist final ranks.
            for (let i = 0; i < bucket.length; i++) {
                bucket[i].rank = i + 1;
                await bucket[i].save();
            }

            const promoteN = league.tier < maxTier ? league.promotionCount : 0;
            const relegateN = league.tier > 1 ? league.relegationCount : 0;

            for (let i = 0; i < bucket.length; i++) {
                const member = bucket[i];
                let targetTier = league.tier;
                if (i < promoteN) targetTier = league.tier + 1;
                else if (i >= bucket.length - relegateN) targetTier = league.tier - 1;
                if (targetTier === league.tier) continue;

                const targetLeague = byTier.get(targetTier);
                if (!targetLeague) continue;

                const profile = await GamificationProfile.findOne({ where: { clientId: member.clientId } });
                if (profile) {
                    profile.currentLeagueId = targetLeague.id;
                    await profile.save();
                }
                if (targetTier > league.tier) {
                    promotions += 1;
                    if (targetLeague.rewardXp > 0) {
                        await awardXp({
                            clientId: member.clientId, facilityId,
                            ruleCode: 'league_promotion', amount: targetLeague.rewardXp,
                            dedupeKey: `promotion:${member.clientId}:${lastWeek}`
                        });
                    }
                    await logEvent(member.clientId, facilityId, {
                        type: 'league_promoted',
                        title: `Promoted to ${targetLeague.name} League!`,
                        icon: 'ChevronsUp',
                        meta: { leagueId: targetLeague.id }
                    });
                    await notifyClient(member.clientId, facilityId, `⬆️ Promoted to ${targetLeague.name} League!`, 'success');
                } else {
                    relegations += 1;
                    await logEvent(member.clientId, facilityId, {
                        type: 'league_relegated',
                        title: `Moved to ${targetLeague.name} League`,
                        icon: 'ChevronsDown',
                        meta: { leagueId: targetLeague.id }
                    });
                }
            }
        }
    }

    // Reset weekly XP counters on all profiles for the new week.
    await GamificationProfile.update(
        { weeklyXp: 0, weekStart: weekStartStr(ref) },
        { where: {} }
    );

    return { promotions, relegations, week: lastWeek };
}

// ---------------------------------------------------------------------------
// Streak decay (daily cron) — break streaks for members inactive yesterday.
// ---------------------------------------------------------------------------
async function decayStreaks(referenceDate) {
    const ref = referenceDate ? new Date(referenceDate) : new Date();
    const yesterday = toDateStr(new Date(ref.getTime() - 86400000));
    const [count] = await GamificationProfile.update(
        { currentStreak: 0 },
        {
            where: {
                currentStreak: { [Op.gt]: 0 },
                [Op.or]: [
                    { lastActivityDate: { [Op.lt]: yesterday } },
                    { lastActivityDate: null }
                ]
            }
        }
    );
    return count;
}

// ---------------------------------------------------------------------------
// Challenge generation (daily cron + startup) — instantiate template challenges
// as global (facilityId = null) rows for the current day / week. Idempotent.
// ---------------------------------------------------------------------------
async function generateScheduledChallenges(referenceDate) {
    const ref = referenceDate ? new Date(referenceDate) : new Date();
    const dayStart = new Date(toDateStr(ref));
    const dayEnd = new Date(dayStart.getTime() + 86400000 - 1000);
    const weekStart = new Date(weekStartStr(ref));
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000 - 1000);

    const ensure = async (tpl, type, startDate, endDate) => {
        const existing = await Challenge.findOne({
            where: { facilityId: null, type, title: tpl.title, startDate }
        });
        if (existing) return;
        await Challenge.create({
            facilityId: null,
            title: tpl.title,
            description: tpl.description,
            type,
            startDate,
            endDate,
            xpReward: tpl.xpReward,
            difficulty: tpl.difficulty,
            criteria: tpl.criteria,
            status: 'active'
        });
    };

    for (const tpl of DAILY_CHALLENGE_TEMPLATES) await ensure(tpl, 'daily', dayStart, dayEnd);
    for (const tpl of WEEKLY_CHALLENGE_TEMPLATES) await ensure(tpl, 'weekly', weekStart, weekEnd);

    // Archive expired active challenges so they drop off member lists.
    await Challenge.update(
        { status: 'archived' },
        { where: { status: 'active', endDate: { [Op.lt]: ref } } }
    );
}

module.exports = {
    // maths
    xpForLevel,
    levelForXp,
    levelProgress,
    MAX_LEVEL,
    // dates
    toDateStr,
    weekStartStr,
    periodRange,
    // profile
    getOrCreateProfile,
    getMemberStats,
    leaguesFor,
    resolveLowestLeague,
    // awards
    awardXp,
    awardActivity,
    updateStreak,
    evaluateAchievements,
    progressChallenges,
    claimChallenge,
    redeemReward,
    // read models
    getLeaderboard,
    // crons
    computeLeaguePromotions,
    decayStreaks,
    generateScheduledChallenges,
    // helpers exposed for routes
    logEvent,
    notifyClient
};
