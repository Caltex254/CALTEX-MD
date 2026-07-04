// =============================================================================
// CALTEX MD - PM2 Ecosystem Configuration
// =============================================================================

module.exports = {
  apps: [
    // ---------------------------------------------------------------------------
    // Next.js Dashboard Application
    // ---------------------------------------------------------------------------
    {
      name: "caltex-app",
      script: "node",
      args: "server.js",
      cwd: "/app",
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
        DATABASE_URL: "file:./data/caltex.db",
        BOT_API_URL: "http://localhost:3031",
        WS_URL: "http://localhost:3003",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/app-error.log",
      out_file: "./logs/app-out.log",
      merge_logs: true,
      log_type: "json",

      // Auto restart
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000,
      watch: false,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,

      // Health monitoring
      min_uptime: "10s",
      max_restarts: 15,
    },

    // ---------------------------------------------------------------------------
    // WhatsApp Bot Service
    // ---------------------------------------------------------------------------
    {
      name: "caltex-bot",
      script: "bun",
      args: "run mini-services/caltex-bot/index.ts",
      cwd: "/app",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        BOT_PORT: 3031,
        DASHBOARD_API_URL: "http://localhost:3000",
        WS_URL: "http://localhost:3003",
      },
      env_production: {
        NODE_ENV: "production",
        BOT_PORT: 3031,
      },
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/bot-error.log",
      out_file: "./logs/bot-out.log",
      merge_logs: true,
      log_type: "json",

      // Auto restart
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,

      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 30000,
      shutdown_with_message: true,

      // Health monitoring
      min_uptime: "30s",
      max_restarts: 10,
    },

    // ---------------------------------------------------------------------------
    // WebSocket Service
    // ---------------------------------------------------------------------------
    {
      name: "caltex-ws",
      script: "bun",
      args: "run mini-services/websocket-service/index.ts",
      cwd: "/app",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        WS_PORT: 3003,
        BOT_API_URL: "http://localhost:3031",
      },
      env_production: {
        NODE_ENV: "production",
        WS_PORT: 3003,
      },
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/ws-error.log",
      out_file: "./logs/ws-out.log",
      merge_logs: true,
      log_type: "json",

      // Auto restart
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,

      // Health monitoring
      min_uptime: "10s",
      max_restarts: 15,
    },
  ],

  // ---------------------------------------------------------------------------
  // Deployment Configuration
  // ---------------------------------------------------------------------------
  deploy: {
    production: {
      user: "deploy",
      host: "localhost",
      ref: "origin/main",
      repo: "git@github.com:caltex-md/caltex-md.git",
      path: "/var/www/caltex-md",
      "pre-deploy-local": "",
      "post-deploy":
        "npm install && npx prisma generate && npm run build && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
    },
  },
};
