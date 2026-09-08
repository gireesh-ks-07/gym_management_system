// pm2 process definition for the API.
//
// Runs `node server.js` in fork mode, not `npm start` in cluster mode. Cluster
// mode expects a Node entry point and cannot manage an npm wrapper: it swallows
// the child's stdout, so a crash leaves nothing in the logs but npm's own
// banner. Migrations still run before every boot — release.sh executes them
// explicitly, ahead of this process being (re)started.
const path = require('path');

module.exports = {
    apps: [
        {
            name: 'facility-api',
            cwd: path.resolve(__dirname, '..', 'backend'),
            script: 'server.js',
            env: {
                NODE_ENV: 'production'
            },
            exec_mode: 'fork',     // node-cron jobs in server.js must not run twice
            instances: 1,
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
