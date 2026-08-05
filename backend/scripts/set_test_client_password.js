const { Client } = require('../models');

async function setTestClientPassword() {
  try {
    const client = await Client.findOne();
    if (!client) {
      console.log('No clients found in the database. Please create a client first.');
      process.exit(0);
    }
    
    // Set a known password
    client.password = 'password123';
    // Let the Sequelize hook handle bcrypt hashing
    await client.save();
    
    console.log('Test Client Login details:');
    console.log('Email: ' + (client.email || 'Not set'));
    console.log('Phone: ' + (client.phone || 'Not set'));
    console.log('Password: password123');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

setTestClientPassword();
