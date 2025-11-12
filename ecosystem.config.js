module.exports = {
  apps: [
    {
      name: 'informejo',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      merge_logs: true,
      // Restart delay
      restart_delay: 4000,
      // Listen timeout
      listen_timeout: 10000,
      // Kill timeout
      kill_timeout: 5000,
      // Wait ready before considering the app as online
      wait_ready: true,
      // Max restarts in 1 minute before considering the app as errored
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
}

