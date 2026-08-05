// =============================================================================
// Gamification Data Models
// -----------------------------------------------------------------------------
// Defined as a factory so models/index.js owns the single Sequelize instance and
// there is no circular require. All facility-scoped tables carry `facilityId`;
// rows with facilityId = null are global defaults shared by every facility.
// =============================================================================

const { DataTypes } = require('sequelize');

function defineGamificationModels(sequelize, models = {}) {
    const { Client, Facility, User } = models;

    // ---- Per-member rollup (1:1 with Client) -------------------------------
    const GamificationProfile = sequelize.define('GamificationProfile', {
        clientId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        // Spendable balance — decreases when a member redeems a reward.
        totalXp: { type: DataTypes.INTEGER, defaultValue: 0 },
        // Ever-earned XP — only increases; drives the level so redemptions
        // can never de-level a member.
        lifetimeXp: { type: DataTypes.INTEGER, defaultValue: 0 },
        level: { type: DataTypes.INTEGER, defaultValue: 1 },
        currentLeagueId: { type: DataTypes.INTEGER, allowNull: true },
        currentStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
        longestStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
        lastActivityDate: { type: DataTypes.DATEONLY, allowNull: true },
        weeklyXp: { type: DataTypes.INTEGER, defaultValue: 0 },
        weekStart: { type: DataTypes.DATEONLY, allowNull: true },
        title: { type: DataTypes.STRING, allowNull: true },
        profileFrame: { type: DataTypes.STRING, allowNull: true }
    });

    // ---- Configurable XP rules (global defaults + facility overrides) -------
    const XpRule = sequelize.define('XpRule', {
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        code: { type: DataTypes.STRING, allowNull: false },
        label: { type: DataTypes.STRING, allowNull: false },
        xp: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        category: { type: DataTypes.STRING, defaultValue: 'general' },
        // how often the same member may earn this rule
        frequency: {
            type: DataTypes.ENUM('once', 'once_per_day', 'unlimited'),
            defaultValue: 'unlimited'
        },
        enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
        meta: { type: DataTypes.JSON, defaultValue: {} }
    }, {
        indexes: [{ unique: true, fields: ['facilityId', 'code'] }]
    });

    // ---- XP ledger — also the audit log. dedupeKey guarantees idempotency ---
    const XpTransaction = sequelize.define('XpTransaction', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        ruleCode: { type: DataTypes.STRING, allowNull: true },
        xp: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        sourceType: { type: DataTypes.STRING, allowNull: true },
        sourceId: { type: DataTypes.STRING, allowNull: true },
        // Unique across the table. Duplicate events reuse the same key and are
        // rejected by the unique index -> no double XP for the same activity.
        dedupeKey: { type: DataTypes.STRING, allowNull: false, unique: true },
        meta: { type: DataTypes.JSON, defaultValue: {} }
    }, {
        indexes: [
            { fields: ['clientId'] },
            { fields: ['facilityId'] },
            { fields: ['clientId', 'createdAt'] }
        ]
    });

    // ---- Achievements ------------------------------------------------------
    const Achievement = sequelize.define('Achievement', {
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        code: { type: DataTypes.STRING, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
        icon: { type: DataTypes.STRING, defaultValue: 'Award' },
        category: { type: DataTypes.STRING, defaultValue: 'milestones' },
        // { metric: 'attendance_count', gte: 100 }  — evaluated by the engine
        unlockCondition: { type: DataTypes.JSON, defaultValue: {} },
        rewardXp: { type: DataTypes.INTEGER, defaultValue: 0 },
        badge: { type: DataTypes.STRING, allowNull: true },
        visibility: { type: DataTypes.ENUM('visible', 'hidden'), defaultValue: 'visible' },
        status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
    }, {
        indexes: [{ unique: true, fields: ['facilityId', 'code'] }]
    });

    const MemberAchievement = sequelize.define('MemberAchievement', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        achievementId: { type: DataTypes.INTEGER, allowNull: false },
        unlockedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    }, {
        indexes: [{ unique: true, fields: ['clientId', 'achievementId'] }]
    });

    // ---- Challenges --------------------------------------------------------
    const Challenge = sequelize.define('Challenge', {
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        title: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        type: {
            type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'seasonal'),
            defaultValue: 'daily'
        },
        startDate: { type: DataTypes.DATE, allowNull: true },
        endDate: { type: DataTypes.DATE, allowNull: true },
        xpReward: { type: DataTypes.INTEGER, defaultValue: 50 },
        difficulty: { type: DataTypes.ENUM('easy', 'medium', 'hard'), defaultValue: 'easy' },
        // { metric: 'workout_completed', target: 1 }
        criteria: { type: DataTypes.JSON, defaultValue: {} },
        visibility: { type: DataTypes.ENUM('visible', 'hidden'), defaultValue: 'visible' },
        status: { type: DataTypes.ENUM('active', 'inactive', 'archived'), defaultValue: 'active' }
    });

    const ChallengeProgress = sequelize.define('ChallengeProgress', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        challengeId: { type: DataTypes.INTEGER, allowNull: false },
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        progress: { type: DataTypes.INTEGER, defaultValue: 0 },
        completed: { type: DataTypes.BOOLEAN, defaultValue: false },
        claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
        completedAt: { type: DataTypes.DATE, allowNull: true }
    }, {
        indexes: [{ unique: true, fields: ['clientId', 'challengeId'] }]
    });

    // ---- Leagues -----------------------------------------------------------
    const League = sequelize.define('League', {
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        name: { type: DataTypes.STRING, allowNull: false },
        tier: { type: DataTypes.INTEGER, allowNull: false }, // 1 = lowest (Bronze)
        icon: { type: DataTypes.STRING, defaultValue: 'Shield' },
        color: { type: DataTypes.STRING, defaultValue: '#CD7F32' },
        promotionCount: { type: DataTypes.INTEGER, defaultValue: 5 },
        relegationCount: { type: DataTypes.INTEGER, defaultValue: 5 },
        capacity: { type: DataTypes.INTEGER, defaultValue: 30 },
        rewardXp: { type: DataTypes.INTEGER, defaultValue: 0 },
        autoPromotion: { type: DataTypes.BOOLEAN, defaultValue: true }
    }, {
        indexes: [{ unique: true, fields: ['facilityId', 'tier'] }]
    });

    // ---- Weekly league bucket (drives the weekly leaderboard) --------------
    const LeagueMembership = sequelize.define('LeagueMembership', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        leagueId: { type: DataTypes.INTEGER, allowNull: true },
        weekStart: { type: DataTypes.DATEONLY, allowNull: false },
        weeklyXp: { type: DataTypes.INTEGER, defaultValue: 0 },
        rank: { type: DataTypes.INTEGER, allowNull: true }
    }, {
        indexes: [
            { unique: true, fields: ['clientId', 'weekStart'] },
            { fields: ['facilityId', 'weekStart', 'leagueId'] }
        ]
    });

    // ---- Rewards store -----------------------------------------------------
    const Reward = sequelize.define('Reward', {
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        name: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        image: { type: DataTypes.STRING, allowNull: true },
        xpCost: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        inventory: { type: DataTypes.INTEGER, allowNull: true }, // null = unlimited
        expiry: { type: DataTypes.DATE, allowNull: true },
        status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
    });

    const RewardRedemption = sequelize.define('RewardRedemption', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        rewardId: { type: DataTypes.INTEGER, allowNull: false },
        xpSpent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        status: {
            type: DataTypes.ENUM('pending', 'fulfilled', 'cancelled'),
            defaultValue: 'pending'
        },
        fulfilledBy: { type: DataTypes.INTEGER, allowNull: true },
        fulfilledAt: { type: DataTypes.DATE, allowNull: true },
        note: { type: DataTypes.STRING, allowNull: true }
    });

    // ---- Activity timeline / feed ------------------------------------------
    const GamificationEvent = sequelize.define('GamificationEvent', {
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        facilityId: { type: DataTypes.INTEGER, allowNull: true },
        type: { type: DataTypes.STRING, allowNull: false }, // xp_earned, badge_unlocked, ...
        title: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.STRING, allowNull: true },
        xp: { type: DataTypes.INTEGER, defaultValue: 0 },
        icon: { type: DataTypes.STRING, allowNull: true },
        meta: { type: DataTypes.JSON, defaultValue: {} }
    }, {
        indexes: [{ fields: ['clientId', 'createdAt'] }]
    });

    // ---- Associations ------------------------------------------------------
    if (Client) {
        Client.hasOne(GamificationProfile, { foreignKey: 'clientId', onDelete: 'CASCADE' });
        GamificationProfile.belongsTo(Client, { foreignKey: 'clientId' });

        Client.hasMany(XpTransaction, { foreignKey: 'clientId' });
        XpTransaction.belongsTo(Client, { foreignKey: 'clientId' });

        Client.hasMany(MemberAchievement, { foreignKey: 'clientId' });
        MemberAchievement.belongsTo(Client, { foreignKey: 'clientId' });

        Client.hasMany(ChallengeProgress, { foreignKey: 'clientId' });
        ChallengeProgress.belongsTo(Client, { foreignKey: 'clientId' });

        Client.hasMany(RewardRedemption, { foreignKey: 'clientId' });
        RewardRedemption.belongsTo(Client, { foreignKey: 'clientId' });

        Client.hasMany(GamificationEvent, { foreignKey: 'clientId' });
        Client.hasMany(LeagueMembership, { foreignKey: 'clientId' });
    }

    League.hasMany(GamificationProfile, { foreignKey: 'currentLeagueId' });
    GamificationProfile.belongsTo(League, { foreignKey: 'currentLeagueId' });

    Achievement.hasMany(MemberAchievement, { foreignKey: 'achievementId' });
    MemberAchievement.belongsTo(Achievement, { foreignKey: 'achievementId' });

    Challenge.hasMany(ChallengeProgress, { foreignKey: 'challengeId' });
    ChallengeProgress.belongsTo(Challenge, { foreignKey: 'challengeId' });

    Reward.hasMany(RewardRedemption, { foreignKey: 'rewardId' });
    RewardRedemption.belongsTo(Reward, { foreignKey: 'rewardId' });

    League.hasMany(LeagueMembership, { foreignKey: 'leagueId' });
    LeagueMembership.belongsTo(League, { foreignKey: 'leagueId' });

    if (User) {
        RewardRedemption.belongsTo(User, { as: 'fulfiller', foreignKey: 'fulfilledBy' });
    }

    return {
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
    };
}

module.exports = { defineGamificationModels };
