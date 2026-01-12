module.exports = {
  apps: [
    {
      name: 'teamly-api',
      script: './dist/backend/server.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Performance & Restart
      max_memory_restart: '500M', // Restart if memory exceeds 500MB
      min_uptime: '10s', // Minimum uptime before considered ready
      max_restarts: 10, // Max restart attempts
      autorestart: true,
      
      // Graceful shutdown
      kill_timeout: 30000, // 30 seconds to gracefully shutdown
      wait_ready: true, // Wait for process to be ready
      listen_timeout: 10000, // 10 seconds to listen
      
      // Health monitoring
      watch: false, // Disable file watching in production
      ignore_watch: ['node_modules', 'logs', 'uploads', '.git'],
      
      // Environment-specific settings
      node_args: '--max-old-space-size=512', // Limit Node.js memory
    },
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: 'production.server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/teamly.git',
      path: '/var/www/teamly',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
    staging: {
      user: 'deploy',
      host: 'staging.server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/teamly.git',
      path: '/var/www/teamly-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
    },
  },
};
