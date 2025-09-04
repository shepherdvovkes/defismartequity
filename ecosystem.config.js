module.exports = {
  apps: [{
    name: 'defimon',
    script: 'npm',
    args: 'start',
    cwd: '/Users/vovkes/defismart',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    max_restarts: 5,
    min_uptime: '10s',
    // Добавляем логирование для отладки
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
