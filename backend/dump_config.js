const { FacilityType } = require('./models');

async function dumpFacilityTypes() {
    try {
        const types = await FacilityType.findAll();
        console.log(JSON.stringify(types, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

dumpFacilityTypes();
