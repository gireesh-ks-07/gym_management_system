const { DataTypes } = require('sequelize');

// Personal Training (PT) models.
// Registered through models/index.js so the single Sequelize instance owns
// them and sequelize.sync() creates the tables — mirrors the nutrition module.
function definePTModels(sequelize, models = {}) {
    const { Client, Facility, User } = models;

    // A single logged PT session for a member. Historical records are preserved
    // even if the member later changes plans — planId is a snapshot of the PT
    // plan the session was booked under, not a live foreign-key dependency.
    const PTSession = sequelize.define('PTSession', {
        facilityId: { type: DataTypes.INTEGER, allowNull: false },
        clientId: { type: DataTypes.INTEGER, allowNull: false },
        // PT plan the session was logged against (snapshot for history/audit).
        planId: { type: DataTypes.INTEGER, allowNull: true },
        // Trainer = existing staff/admin User. Nullable so a session can be
        // scheduled before a trainer is assigned.
        trainerId: { type: DataTypes.INTEGER, allowNull: true },
        // Full date + time of the session.
        sessionDate: { type: DataTypes.DATE, allowNull: false },
        durationMinutes: { type: DataTypes.INTEGER, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        status: {
            type: DataTypes.ENUM('scheduled', 'completed', 'cancelled', 'no_show'),
            allowNull: false,
            defaultValue: 'scheduled'
        },
        completedAt: { type: DataTypes.DATE, allowNull: true },
        // True when an admin completed this session past the plan's period limit
        // via an explicit override. Kept for audit/reporting.
        overrideUsed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        // User (staff/admin) who created/logged the session.
        createdBy: { type: DataTypes.INTEGER, allowNull: true }
    }, {
        indexes: [
            { fields: ['facilityId'] },
            { fields: ['clientId'] },
            { fields: ['trainerId'] },
            { fields: ['status'] },
            { fields: ['sessionDate'] }
        ]
    });

    // Associations
    if (Client) {
        Client.hasMany(PTSession, { foreignKey: 'clientId' });
        PTSession.belongsTo(Client, { foreignKey: 'clientId' });
    }

    if (Facility) {
        Facility.hasMany(PTSession, { foreignKey: 'facilityId' });
        PTSession.belongsTo(Facility, { foreignKey: 'facilityId' });
    }

    if (User) {
        // Trainer relationship — reuses the existing staff/admin User model.
        User.hasMany(PTSession, { as: 'trainerSessions', foreignKey: 'trainerId' });
        PTSession.belongsTo(User, { as: 'trainer', foreignKey: 'trainerId' });
    }

    return { PTSession };
}

module.exports = { definePTModels };
