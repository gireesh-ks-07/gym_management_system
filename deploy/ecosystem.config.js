// pm2 process definition for the API.
//
// The script is `npm start`, not `node server.js`, deliberately: package.json's
// prestart hook runs the migrations, so a restart can never boot a server
// against a schema older than its code.
const path = require('path');

module.exports = {
    apps: [
        {
            name: 'facility-api',
            cwd: path.resolve(__dirname, '..', 'backend'),
            script: 'npm',
            args: 'start',
            env: {
                NODE_ENV: 'production'
            },
            instances: 1,          // node-cron jobs in server.js must not run twice
            autorestart: true,
            max_memory_restart: '600M',
            // Back off instead of hammering a database that is refusing
            // connections — a tight restart loop buries the real error in logs.
            exp_backoff_restart_delay: 2000,
            time: true,
            out_file: '/var/log/facility/api.out.log',
            error_file: '/var/log/facility/api.err.log'
        }
    ]
};
