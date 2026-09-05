const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/encryption');
require('dotenv').config(); // Load .env file

let sequelize;

if (process.env.DATABASE_URL) {
    // Validate the DB server certificate by default. Only disable when the
    // deployment explicitly opts out (e.g. a provider with self-signed certs)
    // via DB_SSL_REJECT_UNAUTHORIZED=false. Never silently accept any cert.
    const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized
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
        type: DataTypes.ENUM('superadmin', 'admin', 'staff', 'dietician'),
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
    description: { type: DataTypes.TEXT, allowNull: true },
    // Which feature modules this tier includes. See config/modules.js — a
    // facility's own `modules` overrides this, and the registry default applies
    // when neither says anything.
    modules: { type: DataTypes.JSON, defaultValue: {} }
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
        type: DataTypes.ENUM('active', 'pending', 'blocked', 'suspended', 'expired'),
        defaultValue: 'active'
    },
    subscriptionExpiresAt: { type: DataTypes.DATE, allowNull: true },
    healthProfileEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Add-on feature packages — controlled by super-admin per facility
    modules: {
        type: DataTypes.JSON,
        defaultValue: {
            healthPro: false,    // Body fat history, measurements, fitness tests, mobility, goal reviews, strength PRs
            paymentsPro: false   // Online payments, proper invoices
        }
    },
    // --- Razorpay AutoPay fields (added by migration 20260218113923) ---
    // These MUST be declared on the model, otherwise Sequelize neither selects
    // nor persists them — which silently breaks subscription sync and causes the
    // frontend to keep re-fetching /facility/subscription in a loop.
    razorpayPlanId: { type: DataTypes.STRING, allowNull: true },
    razorpaySubscriptionId: { type: DataTypes.STRING, allowNull: true },
    razorpaySubscriptionStatus: { type: DataTypes.STRING, allowNull: true },
    autopayAuthorizedAt: { type: DataTypes.DATE, allowNull: true },
    autopayCancelledAt: { type: DataTypes.DATE, allowNull: true },
    lastAutopayFailureAt: { type: DataTypes.DATE, allowNull: true },
    lastAutopayFailureReason: { type: DataTypes.TEXT, allowNull: true }
});

const Client = sequelize.define('Client', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: true }, // Added for client app auth
    resetPasswordToken: { type: DataTypes.STRING, allowNull: true },
    resetPasswordExpires: { type: DataTypes.DATE, allowNull: true },
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
    workoutPlans: { type: DataTypes.JSON, defaultValue: [] },
    // Dietician assigned to this member (nullable). Set by admins; scopes which
    // clients a dietician can see and create diet charts for.
    dieticianId: { type: DataTypes.INTEGER, allowNull: true }
});

const Attendance = sequelize.define('Attendance', {
    date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.ENUM('present', 'absent', 'excused'), defaultValue: 'present' },
    // TIME column: DataTypes.NOW emits a full ISO timestamp, which Postgres
    // rejects for `time` ("invalid input syntax for type time"). Every caller
    // happened to pass an explicit value, so the broken default never fired —
    // but any create that omitted it would have thrown.
    checkInTime: {
        type: DataTypes.TIME,
        defaultValue: () => new Date().toLocaleTimeString('en-US', { hour12: false })
    },
    // How this row came to exist. A row raised by completing a PT session is
    // removed again if that session is un-completed or deleted; a row someone
    // marked at the front desk never is.
    source: {
        type: DataTypes.ENUM('manual', 'pt_session'),
        allowNull: false,
        defaultValue: 'manual'
    }
});

const Payment = sequelize.define('Payment', {
    amount: { type: DataTypes.FLOAT, allowNull: false },
    method: { type: DataTypes.ENUM('cash', 'upi'), allowNull: false },
    date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    transactionId: { type: DataTypes.STRING, allowNull: true }, // Captured for UPI
    paymentId: { type: DataTypes.STRING, allowNull: true },     // Razorpay payment ID
    invoiceNumber: { type: DataTypes.STRING, allowNull: true }, // Auto-generated invoice number
    planId: { type: DataTypes.INTEGER, allowNull: true }        // Plan at time of payment
});

const Plan = sequelize.define('Plan', {
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: false }, // in months
    description: { type: DataTypes.STRING, allowNull: true },
    features: { type: DataTypes.JSON, defaultValue: [] },
    // --- Personal Training (PT) support ---
    // Additive columns. Existing plans default to 'normal' and behave exactly
    // as before. PT plans additionally define a session allowance per period.
    planType: {
        type: DataTypes.ENUM('normal', 'pt'),
        allowNull: false,
        defaultValue: 'normal'
    },
    // Number of PT sessions granted per period (null for normal plans).
    ptSessionsCount: { type: DataTypes.INTEGER, allowNull: true },
    // Whether the session allowance resets weekly or monthly.
    ptSessionPeriod: {
        type: DataTypes.ENUM('weekly', 'monthly'),
        allowNull: true
    }
});

// Who a notification is addressed to is stated explicitly by `audience`, never
// inferred from which id columns happen to be set. Inferring it is what leaked
// facility notifications into members' client-app feeds: every row carries a
// facilityId, so filtering on facilityId alone matched everything.
//
//   audience            required ids            read by
//   ------------------  ---------------------   -------------------------------
//   'superadmin'        —                       superadmins only
//   'facility'          facilityId              staff of that facility
//   'user'              facilityId + userId     that one staff user
//   'client'            facilityId + clientId   that one member (client app)
const NOTIFICATION_AUDIENCES = ['superadmin', 'facility', 'user', 'client'];

const Notification = sequelize.define('Notification', {
    message: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, defaultValue: 'info' }, // info, warning, success, error
    audience: {
        type: DataTypes.ENUM(...NOTIFICATION_AUDIENCES),
        allowNull: false,
        defaultValue: 'facility'
    },
    facilityId: { type: DataTypes.INTEGER, allowNull: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },   // audience 'user'
    clientId: { type: DataTypes.INTEGER, allowNull: true }, // audience 'client'
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    path: { type: DataTypes.STRING, allowNull: true } // Redirection path
}, {
    indexes: [
        { fields: ['audience'] },
        { fields: ['facilityId'] },
        { fields: ['userId'] },
        { fields: ['clientId'] }
    ]
});

// AutoPay event log for tracking Razorpay subscription events
const FacilityAutoPayEvent = sequelize.define('FacilityAutoPayEvent', {
    facilityId: { type: DataTypes.INTEGER, allowNull: false },
    eventType: { type: DataTypes.STRING, allowNull: false }, // e.g. subscription.charged, payment.failed
    razorpaySubscriptionId: { type: DataTypes.STRING, allowNull: true },
    razorpayPaymentId: { type: DataTypes.STRING, allowNull: true },
    amount: { type: DataTypes.FLOAT, allowNull: true },
    currency: { type: DataTypes.STRING, defaultValue: 'INR' },
    status: { type: DataTypes.STRING, allowNull: true },
    method: { type: DataTypes.STRING, allowNull: true },
    failureReason: { type: DataTypes.TEXT, allowNull: true },
    paidAt: { type: DataTypes.DATE, allowNull: true },
    payload: { type: DataTypes.JSON, allowNull: true }
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

// Dietician (User) ↔ assigned clients
User.hasMany(Client, { as: 'dieticianClients', foreignKey: 'dieticianId' });
Client.belongsTo(User, { as: 'dietician', foreignKey: 'dieticianId' });

Client.hasMany(Payment, { foreignKey: 'clientId' });
Payment.belongsTo(Client, { foreignKey: 'clientId' });

Facility.hasMany(Payment, { foreignKey: 'facilityId' });
Payment.belongsTo(Facility, { foreignKey: 'facilityId' });

User.hasMany(Payment, { as: 'processedPayments', foreignKey: 'processedBy' });
Payment.belongsTo(User, { as: 'processor', foreignKey: 'processedBy' });

Plan.hasMany(Payment, { foreignKey: 'planId' });
Payment.belongsTo(Plan, { foreignKey: 'planId' });

Facility.hasMany(Plan, { foreignKey: 'facilityId' });
Plan.belongsTo(Facility, { foreignKey: 'facilityId' });

Plan.hasMany(Client, { foreignKey: 'planId' });
Client.belongsTo(Plan, { foreignKey: 'planId' });

Client.hasMany(Attendance, { foreignKey: 'clientId' });
Attendance.belongsTo(Client, { foreignKey: 'clientId' });

Facility.hasMany(Attendance, { foreignKey: 'facilityId' });
Attendance.belongsTo(Facility, { foreignKey: 'facilityId' });

// FacilityAutoPayEvent relationships
Facility.hasMany(FacilityAutoPayEvent, { foreignKey: 'facilityId' });
FacilityAutoPayEvent.belongsTo(Facility, { foreignKey: 'facilityId' });

// =============================================================================
// MODEL HOOKS — Password Hashing & PII Encryption
// =============================================================================

// --- User: auto-hash password on create/update (bcrypt cost factor 12) ---
// This ensures no route can accidentally store a plain-text password.
const BCRYPT_ROUNDS = 12;

User.addHook('beforeCreate', async (user) => {
    if (user.password && !user.password.startsWith('$2')) {
        user.password = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
    }
});

User.addHook('beforeUpdate', async (user) => {
    // Only re-hash if the password field was explicitly changed
    if (user.changed('password') && user.password) {
        // Avoid double-hashing: if already a bcrypt hash, skip
        if (!user.password.startsWith('$2')) {
            user.password = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
        }
    }
});

// --- Client: AES-256 encrypt/decrypt aadhaar_number (sensitive government ID) ---
const ENCRYPTED_CLIENT_FIELDS = ['aadhaar_number'];

const encryptClientFields = (client) => {
    ENCRYPTED_CLIENT_FIELDS.forEach(field => {
        if (client[field]) client[field] = encrypt(client[field]);
    });
};

const decryptClientFields = (client) => {
    if (!client) return;
    ENCRYPTED_CLIENT_FIELDS.forEach(field => {
        if (client[field]) client.setDataValue(field, decrypt(client[field]));
    });
};

Client.addHook('beforeCreate', async (client) => {
    encryptClientFields(client);
    if (client.password && !client.password.startsWith('$2')) {
        client.password = await bcrypt.hash(client.password, BCRYPT_ROUNDS);
    }
});

Client.addHook('beforeUpdate', async (client) => {
    ENCRYPTED_CLIENT_FIELDS.forEach(field => {
        if (client.changed(field) && client[field]) {
            client[field] = encrypt(client[field]);
        }
    });
    
    if (client.changed('password') && client.password && !client.password.startsWith('$2')) {
        client.password = await bcrypt.hash(client.password, BCRYPT_ROUNDS);
    }
});

// Decrypt after any find operation
Client.addHook('afterFind', (result) => {
    if (!result) return;
    if (Array.isArray(result)) {
        result.forEach(decryptClientFields);
    } else {
        decryptClientFields(result);
    }
});

// =============================================================================
// GAMIFICATION MODELS
// Registered here so a single Sequelize instance owns every model and
// sequelize.sync() creates all gamification tables. Defined via a factory to
// avoid a circular require between this file and the gamification module.
// =============================================================================
const { defineGamificationModels } = require('../gamification/models');
const gamificationModels = defineGamificationModels(sequelize, { Client, Facility, User, Notification });

const { defineNutritionModels } = require('./nutrition');
const nutritionModels = defineNutritionModels(sequelize, { Client, Facility, User });

const { definePTModels } = require('./pt');
const ptModels = definePTModels(sequelize, { Client, Facility, User });

module.exports = {
    sequelize,
    User, Facility, Client, Payment, Plan, SubscriptionPlan,
    Attendance, Notification, FacilityType, FacilityAutoPayEvent,
    NOTIFICATION_AUDIENCES,
    ...gamificationModels,
    ...nutritionModels,
    ...ptModels
};
