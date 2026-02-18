'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const tableNames = new Set(
      tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name))
    );

    const tableExists = (name) => tableNames.has(name);
    const columnExists = async (table, column) => {
      if (!tableExists(table)) return false;
      const def = await qi.describeTable(table);
      return Boolean(def[column]);
    };

    const ensureColumn = async (table, column, definition) => {
      if (!tableExists(table)) return;
      if (!(await columnExists(table, column))) {
        await qi.addColumn(table, column, definition);
      }
    };

    const ensureEnumValues = async (enumName, values) => {
      const [enumRows] = await qi.sequelize.query(
        `SELECT 1 FROM pg_type WHERE typname = :enumName LIMIT 1;`,
        { replacements: { enumName } }
      );
      if (!enumRows.length) return;

      for (const value of values) {
        const [existingRows] = await qi.sequelize.query(
          `SELECT 1
           FROM pg_type t
           JOIN pg_enum e ON t.oid = e.enumtypid
           WHERE t.typname = :enumName
           AND e.enumlabel = :enumValue
           LIMIT 1;`,
          { replacements: { enumName, enumValue: value } }
        );
        if (existingRows.length) continue;

        const safeValue = value.replace(/'/g, "''");
        await qi.sequelize.query(
          `ALTER TYPE "${enumName}" ADD VALUE '${safeValue}';`
        );
      }
    };

    if (!tableExists('FacilityTypes')) {
      await qi.createTable('FacilityTypes', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        icon: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Activity'
        },
        memberFormConfig: {
          type: Sequelize.JSON,
          allowNull: false,
          defaultValue: []
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      });
      tableNames.add('FacilityTypes');
    } else {
      await ensureColumn('FacilityTypes', 'icon', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Activity'
      });
      await ensureColumn('FacilityTypes', 'memberFormConfig', {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: []
      });
    }

    if (!tableExists('Notifications')) {
      await qi.createTable('Notifications', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        message: { type: Sequelize.STRING, allowNull: false },
        type: { type: Sequelize.STRING, allowNull: false, defaultValue: 'info' },
        role: { type: Sequelize.STRING, allowNull: true },
        facilityId: { type: Sequelize.INTEGER, allowNull: true },
        isRead: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        path: { type: Sequelize.STRING, allowNull: true },
        createdAt: { allowNull: false, type: Sequelize.DATE },
        updatedAt: { allowNull: false, type: Sequelize.DATE }
      });
      tableNames.add('Notifications');
    }

    if (!tableExists('FacilityAutoPayEvents')) {
      await qi.createTable('FacilityAutoPayEvents', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        eventType: { type: Sequelize.STRING, allowNull: false },
        razorpaySubscriptionId: { type: Sequelize.STRING, allowNull: true },
        razorpayPaymentId: { type: Sequelize.STRING, allowNull: true },
        amount: { type: Sequelize.FLOAT, allowNull: true },
        currency: { type: Sequelize.STRING, allowNull: true },
        status: { type: Sequelize.STRING, allowNull: true },
        method: { type: Sequelize.STRING, allowNull: true },
        failureReason: { type: Sequelize.TEXT, allowNull: true },
        paidAt: { type: Sequelize.DATE, allowNull: true },
        payload: { type: Sequelize.JSONB, allowNull: true },
        facilityId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Facilities', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        },
        createdAt: { allowNull: false, type: Sequelize.DATE },
        updatedAt: { allowNull: false, type: Sequelize.DATE }
      });
      tableNames.add('FacilityAutoPayEvents');
    } else {
      await ensureColumn('FacilityAutoPayEvents', 'eventType', { type: Sequelize.STRING, allowNull: false });
      await ensureColumn('FacilityAutoPayEvents', 'razorpaySubscriptionId', { type: Sequelize.STRING, allowNull: true });
      await ensureColumn('FacilityAutoPayEvents', 'razorpayPaymentId', { type: Sequelize.STRING, allowNull: true });
      await ensureColumn('FacilityAutoPayEvents', 'amount', { type: Sequelize.FLOAT, allowNull: true });
      await ensureColumn('FacilityAutoPayEvents', 'currency', { type: Sequelize.STRING, allowNull: true });
      await ensureColumn('FacilityAutoPayEvents', 'status', { type: Sequelize.STRING, allowNull: true });
      await ensureColumn('FacilityAutoPayEvents', 'method', { type: Sequelize.STRING, allowNull: true });
      await ensureColumn('FacilityAutoPayEvents', 'failureReason', { type: Sequelize.TEXT, allowNull: true });
      await ensureColumn('FacilityAutoPayEvents', 'paidAt', { type: Sequelize.DATE, allowNull: true });
      await ensureColumn('FacilityAutoPayEvents', 'payload', { type: Sequelize.JSONB, allowNull: true });
      await ensureColumn('FacilityAutoPayEvents', 'facilityId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Facilities', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }

    await ensureColumn('Users', 'phone', { type: Sequelize.STRING, allowNull: true });

    await ensureColumn('SubscriptionPlans', 'maxMembers', { type: Sequelize.INTEGER, allowNull: true });
    await ensureColumn('SubscriptionPlans', 'maxStaff', { type: Sequelize.INTEGER, allowNull: true });
    await ensureColumn('SubscriptionPlans', 'description', { type: Sequelize.TEXT, allowNull: true });

    await ensureColumn('Plans', 'features', { type: Sequelize.JSON, allowNull: false, defaultValue: [] });
    await ensureColumn('Plans', 'description', { type: Sequelize.STRING, allowNull: true });

    await ensureColumn('Payments', 'transactionId', { type: Sequelize.STRING, allowNull: true });

    await ensureColumn('Clients', 'aadhaar_number', { type: Sequelize.STRING, allowNull: true });
    await ensureColumn('Clients', 'address', { type: Sequelize.TEXT, allowNull: true });
    await ensureColumn('Clients', 'billingRenewalDate', { type: Sequelize.DATEONLY, allowNull: true });
    await ensureColumn('Clients', 'planExpiresAt', { type: Sequelize.DATE, allowNull: true });
    await ensureColumn('Clients', 'customFields', { type: Sequelize.JSON, allowNull: false, defaultValue: {} });

    await ensureEnumValues('enum_Clients_gender', ['male', 'female', 'other']);
    await ensureEnumValues('enum_Clients_status', ['active', 'inactive', 'payment_due']);
    await ensureEnumValues('enum_Facilities_type', ['gym', 'dance_school', 'boxing_school', 'yoga_studio', 'other']);
    await ensureEnumValues('enum_Facilities_subscriptionStatus', ['active', 'expired', 'suspended', 'pending', 'blocked']);

    await ensureColumn('Facilities', 'address', { type: Sequelize.STRING, allowNull: true });
    await ensureColumn('Facilities', 'type', {
      type: Sequelize.ENUM('gym', 'dance_school', 'boxing_school', 'yoga_studio', 'other'),
      allowNull: false,
      defaultValue: 'gym'
    });
    await ensureColumn('Facilities', 'facilityTypeId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'FacilityTypes', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
    await ensureColumn('Facilities', 'subscriptionPlanId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'SubscriptionPlans', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
    await ensureColumn('Facilities', 'subscriptionStatus', {
      type: Sequelize.ENUM('active', 'expired', 'suspended', 'pending', 'blocked'),
      allowNull: false,
      defaultValue: 'pending'
    });
    await ensureColumn('Facilities', 'subscriptionExpiresAt', { type: Sequelize.DATE, allowNull: true });
    await ensureColumn('Facilities', 'razorpayPlanId', { type: Sequelize.STRING, allowNull: true });
    await ensureColumn('Facilities', 'razorpaySubscriptionId', { type: Sequelize.STRING, allowNull: true });
    await ensureColumn('Facilities', 'razorpaySubscriptionStatus', { type: Sequelize.STRING, allowNull: true });
    await ensureColumn('Facilities', 'autopayAuthorizedAt', { type: Sequelize.DATE, allowNull: true });
    await ensureColumn('Facilities', 'autopayCancelledAt', { type: Sequelize.DATE, allowNull: true });
    await ensureColumn('Facilities', 'lastAutopayFailureAt', { type: Sequelize.DATE, allowNull: true });
    await ensureColumn('Facilities', 'lastAutopayFailureReason', { type: Sequelize.TEXT, allowNull: true });
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const tables = await qi.showAllTables();
    const tableNames = new Set(
      tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name))
    );
    const tableExists = (name) => tableNames.has(name);

    const removeColumnIfExists = async (table, column) => {
      if (!tableExists(table)) return;
      const def = await qi.describeTable(table);
      if (def[column]) {
        await qi.removeColumn(table, column);
      }
    };

    await removeColumnIfExists('Facilities', 'lastAutopayFailureReason');
    await removeColumnIfExists('Facilities', 'lastAutopayFailureAt');
    await removeColumnIfExists('Facilities', 'autopayCancelledAt');
    await removeColumnIfExists('Facilities', 'autopayAuthorizedAt');
    await removeColumnIfExists('Facilities', 'razorpaySubscriptionStatus');
    await removeColumnIfExists('Facilities', 'razorpaySubscriptionId');
    await removeColumnIfExists('Facilities', 'razorpayPlanId');
    await removeColumnIfExists('Facilities', 'subscriptionExpiresAt');
    await removeColumnIfExists('Facilities', 'subscriptionStatus');
    await removeColumnIfExists('Facilities', 'subscriptionPlanId');
    await removeColumnIfExists('Facilities', 'facilityTypeId');

    await removeColumnIfExists('Clients', 'customFields');
    await removeColumnIfExists('Clients', 'planExpiresAt');
    await removeColumnIfExists('Clients', 'billingRenewalDate');
    await removeColumnIfExists('Clients', 'address');
    await removeColumnIfExists('Clients', 'aadhaar_number');

    await removeColumnIfExists('Payments', 'transactionId');
    await removeColumnIfExists('Plans', 'features');
    await removeColumnIfExists('SubscriptionPlans', 'description');
    await removeColumnIfExists('SubscriptionPlans', 'maxStaff');
    await removeColumnIfExists('SubscriptionPlans', 'maxMembers');
    await removeColumnIfExists('Users', 'phone');

    if (tableExists('FacilityAutoPayEvents')) {
      await qi.dropTable('FacilityAutoPayEvents');
    }
    if (tableExists('Notifications')) {
      await qi.dropTable('Notifications');
    }
    if (tableExists('FacilityTypes')) {
      await qi.dropTable('FacilityTypes');
    }
  }
};
