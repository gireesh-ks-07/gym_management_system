// =============================================================================
// Gamification HTTP routes (client app + admin portal).
// Registered from server.js via registerGamificationRoutes(app, deps) so the
// existing authenticate / authorize / checkSubscriptionStatus / sendServerError
// middleware is reused rather than duplicated.
// =============================================================================

const { Op } = require('sequelize');
const models = require('../models');
const engine = require('./engine');

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

function registerGamificationRoutes(app, deps) {
    const { authenticate, authorize, checkSubscriptionStatus, sendServerError } = deps;

    // Resolve the facility a request operates on. Admin/staff are locked to their
    // own facility; superadmin may target one via query/body.
    const resolveFacilityId = (req) => {
        if (req.user.role === 'superadmin') {
            const q = req.query.facilityId || req.body?.facilityId;
            return q ? Number(q) : null;
        }
        return req.user.facilityId;
    };

    // =====================================================================
    // CLIENT APP ROUTES  (role: client)
    // =====================================================================
    const clientOnly = [authenticate, authorize(P.CLIENT_APP)];
    const cBase = '/api/client/gamification';

    // --- Hero card summary ---
    app.get(`${cBase}/summary`, clientOnly, async (req, res) => {
        try {
            const clientId = req.user.id;
            const facilityId = req.user.facilityId;
            const profile = await engine.getOrCreateProfile(clientId, facilityId);
            const progress = engine.levelProgress(profile.lifetimeXp);

            const league = profile.currentLeagueId ? await League.findByPk(profile.currentLeagueId) : null;
            const board = await engine.getLeaderboard({ facilityId, period: 'weekly', clientId });
            const me = board.find((r) => r.clientId === clientId);

            const nextReward = await Reward.findOne({
                where: {
                    status: 'active',
                    facilityId: { [Op.or]: [facilityId, null] },
                    xpCost: { [Op.gt]: profile.totalXp }
                },
                order: [['xpCost', 'ASC']]
            });

            res.json({
                level: profile.level,
                title: profile.title,
                totalXp: profile.totalXp,
                lifetimeXp: profile.lifetimeXp,
                weeklyXp: profile.weeklyXp,
                weeklyRank: me ? me.rank : null,
                league: league ? { name: league.name, tier: league.tier, color: league.color, icon: league.icon } : null,
                currentStreak: profile.currentStreak,
                longestStreak: profile.longestStreak,
                progress,
                nextReward: nextReward ? { id: nextReward.id, name: nextReward.name, xpCost: nextReward.xpCost, image: nextReward.image } : null
            });
        } catch (err) { sendServerError(res, err, 'gamification summary'); }
    });

    // --- Today's daily goals ---
    app.get(`${cBase}/daily-goals`, clientOnly, async (req, res) => {
        try {
            const clientId = req.user.id;
            const today = engine.toDateStr(new Date());
            const txns = await XpTransaction.findAll({
                where: { clientId, createdAt: { [Op.gte]: new Date(today) }, xp: { [Op.gt]: 0 } },
                attributes: ['ruleCode'], raw: true
            });
            const done = new Set(txns.map((t) => t.ruleCode));
            const goals = [
                { key: 'daily_checkin', label: 'Daily Check-in', icon: 'CalendarCheck', xp: 20 },
                { key: 'gym_attendance', label: 'Attendance', icon: 'MapPin', xp: 25 },
                { key: 'workout_completed', label: 'Workout Completed', icon: 'Dumbbell', xp: 100 },
                { key: 'cardio_completed', label: 'Cardio / Stretching', icon: 'HeartPulse', xp: 20 },
                { key: 'nutrition_logged', label: 'Nutrition Logged', icon: 'Apple', xp: 20 },
                { key: 'weight_updated', label: 'Water / Weight Log', icon: 'Droplet', xp: 10 }
            ].map((g) => ({ ...g, completed: done.has(g.key) }));
            res.json(goals);
        } catch (err) { sendServerError(res, err, 'daily goals'); }
    });

    // --- Today's XP breakdown ---
    app.get(`${cBase}/xp/today`, clientOnly, async (req, res) => {
        try {
            const clientId = req.user.id;
            const today = engine.toDateStr(new Date());
            const rows = await XpTransaction.findAll({
                attributes: ['ruleCode', [sequelize.fn('SUM', sequelize.col('xp')), 'xpSum']],
                where: { clientId, createdAt: { [Op.gte]: new Date(today) }, xp: { [Op.gt]: 0 } },
                group: ['ruleCode'], raw: true
            });
            const rules = await XpRule.findAll({ where: { facilityId: null }, attributes: ['code', 'label'], raw: true });
            const labelMap = new Map(rules.map((r) => [r.code, r.label]));
            const breakdown = rows.map((r) => ({
                code: r.ruleCode,
                label: labelMap.get(r.ruleCode) || r.ruleCode,
                xp: Number(r.xpSum) || 0
            }));
            const total = breakdown.reduce((s, b) => s + b.xp, 0);
            res.json({ total, breakdown });
        } catch (err) { sendServerError(res, err, 'today xp'); }
    });

    // --- Leaderboard ---
    app.get(`${cBase}/leaderboard`, clientOnly, async (req, res) => {
        try {
            const period = ['daily', 'weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'weekly';
            const board = await engine.getLeaderboard({
                facilityId: req.user.facilityId, period, clientId: req.user.id, limit: 100
            });
            res.json(board);
        } catch (err) { sendServerError(res, err, 'client leaderboard'); }
    });

    // --- League standing (this week's bucket) ---
    app.get(`${cBase}/league`, clientOnly, async (req, res) => {
        try {
            const clientId = req.user.id;
            const facilityId = req.user.facilityId;
            const profile = await engine.getOrCreateProfile(clientId, facilityId);
            const league = profile.currentLeagueId ? await League.findByPk(profile.currentLeagueId) : await engine.resolveLowestLeague(facilityId);
            const weekStart = engine.weekStartStr(new Date());

            const bucket = await LeagueMembership.findAll({
                where: { facilityId, weekStart, leagueId: league ? league.id : null },
                order: [['weeklyXp', 'DESC']]
            });
            const ids = bucket.map((b) => b.clientId);
            const clients = ids.length ? await Client.findAll({ where: { id: ids }, attributes: ['id', 'name'] }) : [];
            const nameMap = new Map(clients.map((c) => [c.id, c.name]));

            const standings = bucket.map((b, i) => ({
                rank: i + 1, clientId: b.clientId, name: nameMap.get(b.clientId) || 'Member',
                weeklyXp: b.weeklyXp, isCurrentUser: b.clientId === clientId
            }));
            const myRank = standings.find((s) => s.isCurrentUser)?.rank || null;

            res.json({
                league: league ? { name: league.name, tier: league.tier, color: league.color, icon: league.icon,
                    promotionCount: league.promotionCount, relegationCount: league.relegationCount } : null,
                weekStart,
                myRank,
                promotionZone: league ? league.promotionCount : 0,
                relegationZone: league ? league.relegationCount : 0,
                standings
            });
        } catch (err) { sendServerError(res, err, 'client league'); }
    });

    // --- Challenges (with per-member progress) ---
    app.get(`${cBase}/challenges`, clientOnly, async (req, res) => {
        try {
            const clientId = req.user.id;
            const facilityId = req.user.facilityId;
            const now = new Date();
            const challenges = await Challenge.findAll({
                where: {
                    status: 'active',
                    visibility: 'visible',
                    facilityId: { [Op.or]: [facilityId, null] },
                    [Op.and]: [
                        { [Op.or]: [{ startDate: null }, { startDate: { [Op.lte]: now } }] },
                        { [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: now } }] }
                    ]
                },
                order: [['type', 'ASC'], ['createdAt', 'DESC']]
            });
            const progressRows = await ChallengeProgress.findAll({ where: { clientId } });
            const progMap = new Map(progressRows.map((p) => [p.challengeId, p]));

            res.json(challenges.map((c) => {
                const p = progMap.get(c.id);
                const target = Number(c.criteria?.target) || 1;
                const progress = p ? p.progress : 0;
                return {
                    id: c.id, title: c.title, description: c.description, type: c.type,
                    xpReward: c.xpReward, difficulty: c.difficulty, target,
                    progress, percent: Math.min(100, Math.round((progress / target) * 100)),
                    completed: p ? p.completed : false, claimed: p ? p.claimed : false,
                    endDate: c.endDate
                };
            }));
        } catch (err) { sendServerError(res, err, 'client challenges'); }
    });

    app.post(`${cBase}/challenges/:id/claim`, clientOnly, async (req, res) => {
        try {
            const result = await engine.claimChallenge(req.user.id, req.user.facilityId, Number(req.params.id));
            res.json({ message: 'Reward claimed', ...result });
        } catch (err) {
            return res.status(400).json({ message: err.message || 'Unable to claim' });
        }
    });

    // --- Achievement gallery ---
    app.get(`${cBase}/achievements`, clientOnly, async (req, res) => {
        try {
            const clientId = req.user.id;
            const facilityId = req.user.facilityId;
            const achievements = await Achievement.findAll({
                where: { status: 'active', facilityId: { [Op.or]: [facilityId, null] } },
                order: [['category', 'ASC'], ['rewardXp', 'ASC']]
            });
            const unlocked = await MemberAchievement.findAll({ where: { clientId } });
            const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));
            res.json(achievements.map((a) => ({
                id: a.id, code: a.code, name: a.name, icon: a.icon, category: a.category,
                rewardXp: a.rewardXp, badge: a.badge,
                unlocked: unlockedMap.has(a.id),
                unlockedAt: unlockedMap.get(a.id) || null,
                condition: a.visibility === 'hidden' && !unlockedMap.has(a.id) ? null : a.unlockCondition
            })));
        } catch (err) { sendServerError(res, err, 'client achievements'); }
    });

    // --- Streak screen (heatmap) ---
    app.get(`${cBase}/streak`, clientOnly, async (req, res) => {
        try {
            const clientId = req.user.id;
            const profile = await engine.getOrCreateProfile(clientId, req.user.facilityId);
            const since = new Date(Date.now() - 120 * 86400000);
            const rows = await XpTransaction.findAll({
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('createdAt')), 'day'],
                    [sequelize.fn('SUM', sequelize.col('xp')), 'xpSum']
                ],
                where: { clientId, createdAt: { [Op.gte]: since }, xp: { [Op.gt]: 0 } },
                group: [sequelize.fn('DATE', sequelize.col('createdAt'))], raw: true
            });
            const heatmap = rows.map((r) => ({ date: engine.toDateStr(r.day), xp: Number(r.xpSum) || 0 }));
            const milestones = [7, 14, 30, 60, 100];
            const nextMilestone = milestones.find((m) => m > profile.currentStreak) || null;
            res.json({
                currentStreak: profile.currentStreak,
                longestStreak: profile.longestStreak,
                nextMilestone,
                daysToMilestone: nextMilestone ? nextMilestone - profile.currentStreak : null,
                heatmap
            });
        } catch (err) { sendServerError(res, err, 'client streak'); }
    });

    // --- Rewards store ---
    app.get(`${cBase}/rewards`, clientOnly, async (req, res) => {
        try {
            const facilityId = req.user.facilityId;
            const profile = await engine.getOrCreateProfile(req.user.id, facilityId);
            const rewards = await Reward.findAll({
                where: { status: 'active', facilityId: { [Op.or]: [facilityId, null] } },
                order: [['xpCost', 'ASC']]
            });
            res.json({
                balance: profile.totalXp,
                rewards: rewards.map((r) => ({
                    id: r.id, name: r.name, description: r.description, image: r.image,
                    xpCost: r.xpCost,
                    available: (r.inventory == null || r.inventory > 0) && (!r.expiry || new Date(r.expiry) > new Date()),
                    affordable: profile.totalXp >= r.xpCost,
                    inventory: r.inventory
                }))
            });
        } catch (err) { sendServerError(res, err, 'client rewards'); }
    });

    app.post(`${cBase}/rewards/:id/redeem`, clientOnly, async (req, res) => {
        try {
            const redemption = await engine.redeemReward(req.user.id, req.user.facilityId, Number(req.params.id));
            res.json({ message: 'Reward redeemed — pending fulfillment', redemptionId: redemption.id });
        } catch (err) {
            return res.status(400).json({ message: err.message || 'Unable to redeem' });
        }
    });

    // --- Activity timeline ---
    app.get(`${cBase}/timeline`, clientOnly, async (req, res) => {
        try {
            const events = await GamificationEvent.findAll({
                where: { clientId: req.user.id },
                order: [['createdAt', 'DESC']],
                limit: Math.min(100, Number(req.query.limit) || 50)
            });
            res.json(events);
        } catch (err) { sendServerError(res, err, 'client timeline'); }
    });

    // --- Manual daily check-in action ---
    app.post(`${cBase}/checkin`, clientOnly, async (req, res) => {
        try {
            const clientId = req.user.id;
            const facilityId = req.user.facilityId;
            const today = engine.toDateStr(new Date());
            const result = await engine.awardXp({
                clientId, facilityId, ruleCode: 'daily_checkin',
                dedupeKey: `daily_checkin:${clientId}:${today}`
            });
            if (result.duplicate) return res.status(200).json({ message: 'Already checked in today', alreadyDone: true });
            await engine.updateStreak(clientId, facilityId, today);
            await engine.progressChallenges(clientId, facilityId, 'daily_checkin', 1);
            await engine.evaluateAchievements(clientId, facilityId);
            res.json({ message: 'Checked in', xp: result.xp });
        } catch (err) { sendServerError(res, err, 'client checkin'); }
    });

    // --- Client notifications ---
    app.get('/api/client/notifications', clientOnly, async (req, res) => {
        try {
            const notes = await Notification.findAll({
                where: { audience: 'client', clientId: req.user.id },
                order: [['createdAt', 'DESC']], limit: 50
            });
            res.json(notes);
        } catch (err) { sendServerError(res, err, 'client notifications'); }
    });

    app.post('/api/client/notifications/:id/read', clientOnly, async (req, res) => {
        try {
            await Notification.update({ isRead: true }, { where: { id: req.params.id, audience: 'client', clientId: req.user.id } });
            res.json({ message: 'ok' });
        } catch (err) { sendServerError(res, err, 'mark notification read'); }
    });

    // =====================================================================
    // ADMIN PORTAL ROUTES  (role: admin / superadmin)
    // =====================================================================
    const adminOnly = [authenticate, authorize(P.GAMIFICATION_MANAGE)];
    const aBase = '/api/gamification';

    // --- Dashboard KPIs + chart data ---
    app.get(`${aBase}/dashboard`, adminOnly, async (req, res) => {
        try {
            const facilityId = resolveFacilityId(req);
            const facilityFilter = facilityId ? { facilityId } : {};
            const today = engine.toDateStr(new Date());
            const weekStart = engine.weekStartStr(new Date());

            const [totalMembers, xpAgg, activeStreaks, challengesCompleted, xpTodayAgg, dauRows] = await Promise.all([
                GamificationProfile.count({ where: facilityFilter }),
                GamificationProfile.findOne({
                    where: facilityFilter,
                    attributes: [[sequelize.fn('SUM', sequelize.col('lifetimeXp')), 'sum']], raw: true
                }),
                GamificationProfile.count({ where: { ...facilityFilter, currentStreak: { [Op.gt]: 0 } } }),
                ChallengeProgress.count({ where: { ...(facilityId ? { facilityId } : {}), completed: true } }),
                XpTransaction.findOne({
                    where: { ...facilityFilter, createdAt: { [Op.gte]: new Date(today) }, xp: { [Op.gt]: 0 } },
                    attributes: [[sequelize.fn('SUM', sequelize.col('xp')), 'sum']], raw: true
                }),
                XpTransaction.findAll({
                    where: { ...facilityFilter, createdAt: { [Op.gte]: new Date(today) } },
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('clientId')), 'clientId']], raw: true
                })
            ]);

            // League distribution
            const leagues = await engine.leaguesFor(facilityId);
            const leagueMap = new Map(leagues.map((l) => [l.id, l]));
            const distRows = await GamificationProfile.findAll({
                where: facilityFilter,
                attributes: ['currentLeagueId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['currentLeagueId'], raw: true
            });
            const leagueDistribution = leagues.map((l) => ({
                name: l.name, tier: l.tier, color: l.color,
                count: Number(distRows.find((d) => d.currentLeagueId === l.id)?.count || 0)
            }));

            // XP earned per day (last 14 days) for the engagement chart
            const since = new Date(Date.now() - 13 * 86400000);
            const trendRows = await XpTransaction.findAll({
                where: { ...facilityFilter, createdAt: { [Op.gte]: since }, xp: { [Op.gt]: 0 } },
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('createdAt')), 'day'],
                    [sequelize.fn('SUM', sequelize.col('xp')), 'xp']
                ],
                group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
                order: [[sequelize.literal('day'), 'ASC']], raw: true
            });
            const xpTrend = trendRows.map((r) => ({ date: engine.toDateStr(r.day), xp: Number(r.xp) || 0 }));

            const topPerformers = await engine.getLeaderboard({ facilityId, period: 'weekly', limit: 5 });

            res.json({
                totalMembers,
                totalXp: Number(xpAgg?.sum || 0),
                activeStreaks,
                challengesCompleted,
                xpToday: Number(xpTodayAgg?.sum || 0),
                dailyActiveUsers: dauRows.length,
                weekStart,
                leagueDistribution,
                xpTrend,
                topPerformers
            });
        } catch (err) { sendServerError(res, err, 'admin dashboard'); }
    });

    // --- Leaderboard management (+ CSV export) ---
    app.get(`${aBase}/leaderboard`, adminOnly, async (req, res) => {
        try {
            const facilityId = resolveFacilityId(req);
            const period = ['daily', 'weekly', 'monthly', 'all'].includes(req.query.period) ? req.query.period : 'weekly';
            let board;
            if (period === 'all') {
                const profiles = await GamificationProfile.findAll({
                    where: facilityId ? { facilityId } : {},
                    order: [['lifetimeXp', 'DESC']], limit: 500
                });
                const ids = profiles.map((p) => p.clientId);
                const clients = ids.length ? await Client.findAll({ where: { id: ids }, attributes: ['id', 'name', 'gender'] }) : [];
                const nameMap = new Map(clients.map((c) => [c.id, c]));
                board = profiles.map((p, i) => ({
                    rank: i + 1, clientId: p.clientId, name: nameMap.get(p.clientId)?.name || 'Member',
                    gender: nameMap.get(p.clientId)?.gender || null, xp: p.lifetimeXp, level: p.level,
                    currentStreak: p.currentStreak
                }));
            } else {
                board = await engine.getLeaderboard({ facilityId, period, limit: 500 });
            }

            if (req.query.export === 'csv') {
                const header = 'Rank,Member,Level,XP,Streak\n';
                const body = board.map((r) => `${r.rank},"${(r.name || '').replace(/"/g, '""')}",${r.level},${r.xp},${r.currentStreak || 0}`).join('\n');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="leaderboard.csv"');
                return res.send(header + body);
            }
            res.json(board);
        } catch (err) { sendServerError(res, err, 'admin leaderboard'); }
    });

    // --- Recalculate levels from ledger (repair tool) ---
    app.post(`${aBase}/recalculate`, adminOnly, async (req, res) => {
        try {
            const facilityId = resolveFacilityId(req);
            const profiles = await GamificationProfile.findAll({ where: facilityId ? { facilityId } : {} });
            for (const p of profiles) {
                const agg = await XpTransaction.findOne({
                    where: { clientId: p.clientId, xp: { [Op.gt]: 0 } },
                    attributes: [[sequelize.fn('SUM', sequelize.col('xp')), 'sum']], raw: true
                });
                p.lifetimeXp = Number(agg?.sum || 0);
                p.level = engine.levelForXp(p.lifetimeXp);
                await p.save();
            }
            res.json({ message: `Recalculated ${profiles.length} members` });
        } catch (err) { sendServerError(res, err, 'recalculate'); }
    });

    // --- Generic CRUD helper for config tables ---
    const crud = (base, Model, { list, scoped = true } = {}) => {
        app.get(base, adminOnly, async (req, res) => {
            try {
                const facilityId = resolveFacilityId(req);
                const where = scoped && facilityId ? { facilityId: { [Op.or]: [facilityId, null] } } : {};
                const rows = await Model.findAll({ where, order: [['id', 'ASC']] });
                res.json(rows);
            } catch (err) { sendServerError(res, err, `${base} list`); }
        });
        app.post(base, adminOnly, async (req, res) => {
            try {
                const facilityId = resolveFacilityId(req);
                const row = await Model.create({ ...req.body, facilityId: facilityId ?? req.body.facilityId ?? null });
                res.json(row);
            } catch (err) { sendServerError(res, err, `${base} create`); }
        });
        app.put(`${base}/:id`, adminOnly, async (req, res) => {
            try {
                const row = await Model.findByPk(req.params.id);
                if (!row) return res.status(404).json({ message: 'Not found' });
                await row.update(req.body);
                res.json(row);
            } catch (err) { sendServerError(res, err, `${base} update`); }
        });
        app.delete(`${base}/:id`, adminOnly, async (req, res) => {
            try {
                const row = await Model.findByPk(req.params.id);
                if (!row) return res.status(404).json({ message: 'Not found' });
                await row.destroy();
                res.json({ message: 'Deleted' });
            } catch (err) { sendServerError(res, err, `${base} delete`); }
        });
    };

    crud(`${aBase}/leagues`, League);
    crud(`${aBase}/xp-rules`, XpRule);
    crud(`${aBase}/challenges`, Challenge);
    crud(`${aBase}/achievements`, Achievement);
    crud(`${aBase}/rewards`, Reward);

    // --- Reward redemption management ---
    app.get(`${aBase}/redemptions`, adminOnly, async (req, res) => {
        try {
            const facilityId = resolveFacilityId(req);
            const where = facilityId ? { facilityId } : {};
            if (req.query.status) where.status = req.query.status;
            const rows = await RewardRedemption.findAll({
                where,
                include: [{ model: Reward, attributes: ['name', 'image'] }, { model: Client, attributes: ['name', 'phone'] }],
                order: [['createdAt', 'DESC']], limit: 200
            });
            res.json(rows);
        } catch (err) { sendServerError(res, err, 'redemptions'); }
    });

    app.post(`${aBase}/redemptions/:id/fulfill`, adminOnly, async (req, res) => {
        try {
            const row = await RewardRedemption.findByPk(req.params.id);
            if (!row) return res.status(404).json({ message: 'Not found' });
            row.status = 'fulfilled';
            row.fulfilledBy = req.user.id;
            row.fulfilledAt = new Date();
            if (req.body.note) row.note = req.body.note;
            await row.save();
            await engine.notifyClient(row.clientId, row.facilityId, '🎁 Your reward is ready to collect!', 'success');
            res.json(row);
        } catch (err) { sendServerError(res, err, 'fulfill redemption'); }
    });

    app.post(`${aBase}/redemptions/:id/cancel`, adminOnly, async (req, res) => {
        try {
            const row = await RewardRedemption.findByPk(req.params.id);
            if (!row || row.status !== 'pending') return res.status(400).json({ message: 'Cannot cancel' });
            // Refund the XP that was spent.
            await engine.awardXp({
                clientId: row.clientId, facilityId: row.facilityId, ruleCode: 'reward_refund',
                amount: row.xpSpent, dedupeKey: `reward_refund:${row.id}`
            });
            row.status = 'cancelled';
            await row.save();
            res.json(row);
        } catch (err) { sendServerError(res, err, 'cancel redemption'); }
    });

    // --- Member gamification profile (admin view) ---
    app.get(`${aBase}/members/:id`, adminOnly, async (req, res) => {
        try {
            const clientId = Number(req.params.id);
            const client = await Client.findByPk(clientId, { attributes: ['id', 'name', 'phone', 'email', 'facilityId'] });
            if (!client) return res.status(404).json({ message: 'Member not found' });
            if (req.user.role !== 'superadmin' && client.facilityId !== req.user.facilityId) {
                return res.status(403).json({ message: 'Forbidden' });
            }
            const profile = await engine.getOrCreateProfile(clientId, client.facilityId);
            const league = profile.currentLeagueId ? await League.findByPk(profile.currentLeagueId) : null;
            const [badges, redemptions, challenges, recentXp, stats] = await Promise.all([
                MemberAchievement.findAll({ where: { clientId }, include: [{ model: Achievement, attributes: ['name', 'icon', 'category'] }] }),
                RewardRedemption.findAll({ where: { clientId }, include: [{ model: Reward, attributes: ['name'] }], order: [['createdAt', 'DESC']], limit: 20 }),
                ChallengeProgress.findAll({ where: { clientId }, include: [{ model: Challenge, attributes: ['title', 'type'] }], limit: 20 }),
                XpTransaction.findAll({ where: { clientId }, order: [['createdAt', 'DESC']], limit: 30 }),
                engine.getMemberStats(clientId, profile)
            ]);
            res.json({
                client, profile,
                league: league ? { name: league.name, tier: league.tier, color: league.color } : null,
                progress: engine.levelProgress(profile.lifetimeXp),
                stats, badges, redemptions, challenges, recentXp
            });
        } catch (err) { sendServerError(res, err, 'member profile'); }
    });

    // --- Manual admin actions on a member ---
    app.post(`${aBase}/members/:id/adjust-xp`, adminOnly, async (req, res) => {
        try {
            const clientId = Number(req.params.id);
            const amount = Math.trunc(Number(req.body.amount) || 0);
            if (!amount) return res.status(400).json({ message: 'amount required' });
            const profile = await engine.getOrCreateProfile(clientId);
            await engine.awardXp({
                clientId, facilityId: profile.facilityId, ruleCode: 'manual_adjust',
                amount, dedupeKey: `manual_adjust:${clientId}:${Date.now()}`,
                meta: { adminId: req.user.id, reason: req.body.reason || null }
            });
            res.json({ message: 'XP adjusted' });
        } catch (err) { sendServerError(res, err, 'adjust xp'); }
    });

    app.post(`${aBase}/members/:id/reset-streak`, adminOnly, async (req, res) => {
        try {
            const profile = await engine.getOrCreateProfile(Number(req.params.id));
            profile.currentStreak = 0;
            await profile.save();
            res.json({ message: 'Streak reset' });
        } catch (err) { sendServerError(res, err, 'reset streak'); }
    });

    app.post(`${aBase}/members/:id/assign-badge`, adminOnly, async (req, res) => {
        try {
            const clientId = Number(req.params.id);
            const achievementId = Number(req.body.achievementId);
            const ach = await Achievement.findByPk(achievementId);
            if (!ach) return res.status(404).json({ message: 'Achievement not found' });
            const [, created] = await MemberAchievement.findOrCreate({ where: { clientId, achievementId } });
            if (created && ach.rewardXp > 0) {
                await engine.awardXp({ clientId, ruleCode: 'achievement', amount: ach.rewardXp, dedupeKey: `achievement:${clientId}:${ach.id}` });
            }
            res.json({ message: created ? 'Badge assigned' : 'Member already has this badge' });
        } catch (err) { sendServerError(res, err, 'assign badge'); }
    });

    app.post(`${aBase}/members/:id/grant-reward`, adminOnly, async (req, res) => {
        try {
            const clientId = Number(req.params.id);
            const rewardId = Number(req.body.rewardId);
            const reward = await Reward.findByPk(rewardId);
            if (!reward) return res.status(404).json({ message: 'Reward not found' });
            const profile = await engine.getOrCreateProfile(clientId);
            const redemption = await RewardRedemption.create({
                clientId, facilityId: profile.facilityId, rewardId, xpSpent: 0, status: 'fulfilled',
                fulfilledBy: req.user.id, fulfilledAt: new Date(), note: 'Granted by admin'
            });
            await engine.notifyClient(clientId, profile.facilityId, `🎁 You received: ${reward.name}`, 'success');
            res.json(redemption);
        } catch (err) { sendServerError(res, err, 'grant reward'); }
    });

    // --- XP audit log (ledger) ---
    app.get(`${aBase}/audit`, adminOnly, async (req, res) => {
        try {
            const facilityId = resolveFacilityId(req);
            const where = facilityId ? { facilityId } : {};
            if (req.query.clientId) where.clientId = Number(req.query.clientId);
            const rows = await XpTransaction.findAll({ where, order: [['createdAt', 'DESC']], limit: 200 });
            res.json(rows);
        } catch (err) { sendServerError(res, err, 'audit log'); }
    });

    console.log('Gamification routes registered.');
}

module.exports = { registerGamificationRoutes };
