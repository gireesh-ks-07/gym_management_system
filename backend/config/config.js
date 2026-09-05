/**
 * Database configuration for sequelize-cli (migrations).
 *
 * Mirrors the connection logic in models/index.js so the CLI and the running
 * app always talk to the same database. Credentials come from the environment —
 * this file replaces a config.json that carried the production password in
 * plain text and was committed to the repository.
 */
require('dotenv').config();

const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

// A single DATABASE_URL wins when present (managed Postgres providers hand you
// one); otherwise fall back to discrete variables for local development.
const fromUrl = () => ({
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: { require: true, rejectUnauthorized }
    }
});

const fromParts = () => ({
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'facility_db',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
});

const config = () => (process.env.DATABASE_URL ? fromUrl() : fromParts());

module.exports = {
    development: config(),
    test: config(),
    production: config()
};
