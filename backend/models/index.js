const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config(); // Load .env file

let sequelize;

if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    });
} else {
    // Default to local PostgreSQL if no URL provided
    sequelize = new Sequelize(
        process.env.DB_NAME || 'gym_db',
        process.env.DB_USER || 'postgres',
        process.env.DB_PASSWORD || 'postgres',
        {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            dialect: 'postgres',
            logging: false
        }
    );
}

// Log connection status
sequelize.authenticate()
    .then(() => console.log('Database connected...'))
    .catch(err => console.log('Error: ' + err));

const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: {
        type: DataTypes.ENUM('superadmin', 'admin', 'trainer'),
        defaultValue: 'trainer'
    },
    phone: { type: DataTypes.STRING, allowNull: true },
});

// SaaS Subscription Plan (For Gyms)
const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true }, // Basic, Pro, Enterprise
    price: { type: DataTypes.FLOAT, allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: false }, // in months
    maxMembers: { type: DataTypes.INTEGER, allowNull: true }, // Optional limit
    maxTrainers: { type: DataTypes.INTEGER, allowNull: true }, // Optional limit
    description: { type: DataTypes.TEXT, allowNull: true }
});

const Gym = sequelize.define('Gym', {
    name: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING, allowNull: true },
    subscriptionStatus: {
        type: DataTypes.ENUM('active', 'expired', 'suspended'),
        defaultValue: 'active'
    },
    subscriptionExpiresAt: { type: DataTypes.DATE, allowNull: true }
});

const Client = sequelize.define('Client', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true }, // Clients might not have email login
    phone: { type: DataTypes.STRING, allowNull: false },
    height: { type: DataTypes.FLOAT, allowNull: true }, // in cm
    weight: { type: DataTypes.FLOAT, allowNull: true }, // in kg
    joiningDate: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    gender: { type: DataTypes.ENUM('male', 'female', 'other'), allowNull: false, defaultValue: 'male' },
    aadhaar_number: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'payment_due'),
        defaultValue: 'inactive'
    },
    planExpiresAt: { type: DataTypes.DATE, allowNull: true }
});

const Attendance = sequelize.define('Attendance', {
    date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.ENUM('present', 'absent', 'excused'), defaultValue: 'present' },
    checkInTime: { type: DataTypes.TIME, defaultValue: DataTypes.NOW }
});

const Payment = sequelize.define('Payment', {
    amount: { type: DataTypes.FLOAT, allowNull: false },
    method: { type: DataTypes.ENUM('cash', 'upi'), allowNull: false },
    date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW }
});

const Plan = sequelize.define('Plan', {
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: false }, // in months
    description: { type: DataTypes.STRING, allowNull: true }
});

// Relationships
Gym.belongsTo(SubscriptionPlan, { foreignKey: 'subscriptionPlanId' });
SubscriptionPlan.hasMany(Gym, { foreignKey: 'subscriptionPlanId' });

Gym.hasMany(User, { foreignKey: 'gymId' });
User.belongsTo(Gym, { foreignKey: 'gymId' });

Gym.hasMany(Client, { foreignKey: 'gymId' });
Client.belongsTo(Gym, { foreignKey: 'gymId' });

User.hasMany(Client, { as: 'addedClients', foreignKey: 'addedBy' });
Client.belongsTo(User, { as: 'addedByStaff', foreignKey: 'addedBy' });

Client.hasMany(Payment, { foreignKey: 'clientId' });
Payment.belongsTo(Client, { foreignKey: 'clientId' });

Gym.hasMany(Payment, { foreignKey: 'gymId' });
Payment.belongsTo(Gym, { foreignKey: 'gymId' });

Gym.hasMany(Plan, { foreignKey: 'gymId' });
Plan.belongsTo(Gym, { foreignKey: 'gymId' });

Plan.hasMany(Client, { foreignKey: 'planId' });
Client.belongsTo(Plan, { foreignKey: 'planId' });

Client.hasMany(Attendance, { foreignKey: 'clientId' });
Attendance.belongsTo(Client, { foreignKey: 'clientId' });

Gym.hasMany(Attendance, { foreignKey: 'gymId' });
Attendance.belongsTo(Gym, { foreignKey: 'gymId' });

module.exports = { sequelize, User, Gym, Client, Payment, Plan, SubscriptionPlan, Attendance };
