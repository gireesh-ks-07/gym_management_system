const { sequelize } = require('./models');

async function checkColumns() {
    try {
        const [results] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'Facilities'");
        console.log('Columns in Facilities table:');
        results.forEach(r => console.log('- ' + r.column_name));

        const [types] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'FacilityTypes'");
        console.log('\nColumns in FacilityTypes table:');
        types.forEach(r => console.log('- ' + r.column_name));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkColumns();
