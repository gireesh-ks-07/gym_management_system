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
        process.env.DB_NAME || 'facility_db',
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
        type: DataTypes.ENUM('superadmin', 'admin', 'staff'),
        defaultValue: 'staff'
    },
    phone: { type: DataTypes.STRING, allowNull: true },
});

// SaaS Subscription Plan (For Facilities)
const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true }, // Basic, Pro, Enterprise
    price: { type: DataTypes.FLOAT, allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: false }, // in months
    maxMembers: { type: DataTypes.INTEGER, allowNull: true }, // Optional limit
    maxStaff: { type: DataTypes.INTEGER, allowNull: true }, // Optional limit
    description: { type: DataTypes.TEXT, allowNull: true }
});

const FacilityType = sequelize.define('FacilityType', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    icon: { type: DataTypes.STRING, defaultValue: 'Activity' },
    memberFormConfig: {
        type: DataTypes.JSON,
        defaultValue: [] // Array of { label, name, type, required, options? }
    }
});

const Facility = sequelize.define('Facility', {
    name: { type: DataTypes.STRING, allowNull: false },
    type: { // Keep for backward compatibility or simple labelling
        type: DataTypes.ENUM('gym', 'dance_school', 'boxing_school', 'yoga_studio', 'other'),
        defaultValue: 'gym',
        allowNull: false
    },
    address: { type: DataTypes.STRING, allowNull: true },
    subscriptionStatus: {
        type: DataTypes.ENUM('active', 'expired', 'suspended'),
        defaultValue: 'active'
    },
    subscriptionExpiresAt: { type: DataTypes.DATE, allowNull: true },
    healthProfileEnabled: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const Client = sequelize.define('Client', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: false },
    height: { type: DataTypes.FLOAT, allowNull: true },
    weight: { type: DataTypes.FLOAT, allowNull: true },
    joiningDate: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    gender: { type: DataTypes.ENUM('male', 'female', 'other'), allowNull: false, defaultValue: 'male' },
    aadhaar_number: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'payment_due'),
        defaultValue: 'inactive'
    },
    billingRenewalDate: { type: DataTypes.DATEONLY, allowNull: true },
    planExpiresAt: { type: DataTypes.DATE, allowNull: true },
    customFields: { type: DataTypes.JSON, defaultValue: {} } // Store custom field values
    ,
    healthProfile: { type: DataTypes.JSON, defaultValue: {} },
    workoutPlans: { type: DataTypes.JSON, defaultValue: [] }
});

const Attendance = sequelize.define('Attendance', {
    date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.ENUM('present', 'absent', 'excused'), defaultValue: 'present' },
    checkInTime: { type: DataTypes.TIME, defaultValue: DataTypes.NOW }
});

const Payment = sequelize.define('Payment', {
    amount: { type: DataTypes.FLOAT, allowNull: false },
    method: { type: DataTypes.ENUM('cash', 'upi'), allowNull: false },
    date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    transactionId: { type: DataTypes.STRING, allowNull: true } // Captured for UPI
});

const Plan = sequelize.define('Plan', {
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: false }, // in months
    description: { type: DataTypes.STRING, allowNull: true },
    features: { type: DataTypes.JSON, defaultValue: [] }
});

const Notification = sequelize.define('Notification', {
    message: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, defaultValue: 'info' }, // info, warning, success, error
    role: { type: DataTypes.STRING, allowNull: true }, // Targeted role (e.g., superadmin)
    facilityId: { type: DataTypes.INTEGER, allowNull: true }, // Targeted facility
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    path: { type: DataTypes.STRING, allowNull: true } // Redirection path
});

// Relationships
Facility.belongsTo(SubscriptionPlan, { foreignKey: 'subscriptionPlanId' });
SubscriptionPlan.hasMany(Facility, { foreignKey: 'subscriptionPlanId' });

Facility.belongsTo(FacilityType, { foreignKey: 'facilityTypeId' });
FacilityType.hasMany(Facility, { foreignKey: 'facilityTypeId' });

Facility.hasMany(User, { foreignKey: 'facilityId' });
User.belongsTo(Facility, { foreignKey: 'facilityId' });

Facility.hasMany(Client, { foreignKey: 'facilityId' });
Client.belongsTo(Facility, { foreignKey: 'facilityId' });

User.hasMany(Client, { as: 'addedClients', foreignKey: 'addedBy' });
Client.belongsTo(User, { as: 'addedByStaff', foreignKey: 'addedBy' });

Client.hasMany(Payment, { foreignKey: 'clientId' });
Payment.belongsTo(Client, { foreignKey: 'clientId' });

Facility.hasMany(Payment, { foreignKey: 'facilityId' });
Payment.belongsTo(Facility, { foreignKey: 'facilityId' });

User.hasMany(Payment, { as: 'processedPayments', foreignKey: 'processedBy' });
Payment.belongsTo(User, { as: 'processor', foreignKey: 'processedBy' });

Facility.hasMany(Plan, { foreignKey: 'facilityId' });
Plan.belongsTo(Facility, { foreignKey: 'facilityId' });

Plan.hasMany(Client, { foreignKey: 'planId' });
Client.belongsTo(Plan, { foreignKey: 'planId' });

Client.hasMany(Attendance, { foreignKey: 'clientId' });
Attendance.belongsTo(Client, { foreignKey: 'clientId' });

Facility.hasMany(Attendance, { foreignKey: 'facilityId' });
Attendance.belongsTo(Facility, { foreignKey: 'facilityId' });

module.exports = { sequelize, User, Facility, Client, Payment, Plan, SubscriptionPlan, Attendance, Notification, FacilityType };
