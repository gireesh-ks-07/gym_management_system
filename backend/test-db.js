const { sequelize, SubscriptionPlan, FacilityType, Facility } = require('./models');

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        const plans = await SubscriptionPlan.findAll();
        console.log('Plans:', plans.length);
        const types = await FacilityType.findAll();
        console.log('Types:', types.length);
        const facilities = await Facility.findAll();
        console.log('Facilities:', facilities.length);
        process.exit(0);
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1);
    }
}

test();
