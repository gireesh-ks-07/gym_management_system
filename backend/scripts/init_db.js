const { Client } = require('pg');

async function initDb() {
    const adminClient = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'postgres',
        password: 'postgres',
        port: 5432,
    });

    try {
        await adminClient.connect();
        console.log('Connected to postgres as admin.');

        // 1. Create User
        const userRes = await adminClient.query("SELECT 1 FROM pg_roles WHERE rolname='gymuser'");
        if (userRes.rowCount === 0) {
            await adminClient.query("CREATE USER gymuser WITH PASSWORD 'yourpassword' CREATEDB;");
            console.log('User "gymuser" created.');
        } else {
            console.log('User "gymuser" already exists.');
        }

        // 2. Create Database
        const dbRes = await adminClient.query("SELECT 1 FROM pg_database WHERE datname='gymdb'");
        if (dbRes.rowCount === 0) {
            await adminClient.query('CREATE DATABASE gymdb OWNER gymuser;');
            console.log('Database "gymdb" created.');
        } else {
            console.log('Database "gymdb" already exists.');
        }

        await adminClient.end();

        // 3. Grant Permissions
        // Connect to the new database 'gymdb' as admin to grant permissions
        const dbClient = new Client({
            user: 'postgres',
            host: 'localhost',
            database: 'gymdb',
            password: 'postgres',
            port: 5432,
        });

        await dbClient.connect();
        console.log('Connected to gymdb as admin.');

        await dbClient.query('GRANT ALL ON SCHEMA public TO gymuser;');
        console.log('Granted SCHEMA public permissions to gymuser.');

        await dbClient.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO gymuser;');
        await dbClient.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO gymuser;');
        console.log('Granted TABLE/SEQUENCE permissions to gymuser.');

        await dbClient.end();

    } catch (err) {
        console.error('Error initializing database:', err.message);
    }
}

initDb();
