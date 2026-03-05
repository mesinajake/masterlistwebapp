/**
 * PM2 Ecosystem Configuration
 * 
 * Usage:
 *   npx pm2 start ecosystem.config.js          # Start production
 *   npx pm2 start ecosystem.config.js --env dev # Start development
 *   npx pm2 restart masterlist-app              # Restart
 *   npx pm2 stop masterlist-app                 # Stop
 *   npx pm2 logs masterlist-app                 # View logs
 *   npx pm2 monit                               # Monitor dashboard
 *   npx pm2 status                              # Process status
 * 
 * Before first run:
 *   npm run build    # Build the Next.js production bundle
 */
module.exports = {
  apps: [
    {
      name: "masterlist-app",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,

      // ── Environment ─────────────────────────────────────
      // Production (default)
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        NODE_OPTIONS: "--max-old-space-size=4096",
      },
      // Development (--env dev)
      env_dev: {
        NODE_ENV: "development",
        PORT: 3000,
        NODE_OPTIONS: "--max-old-space-size=8192",
      },

      // ── Process Management ──────────────────────────────
      instances: 1,           // Single instance (in-memory state requires this)
      exec_mode: "fork",      // Fork mode (not cluster — in-memory stores)

      // ── Auto-Restart ────────────────────────────────────
      autorestart: true,      // Restart on crash
      watch: false,           // Don't watch for file changes in production
      max_restarts: 10,       // Max restarts within restart_delay window
      min_uptime: "10s",      // Min uptime to consider "started"
      restart_delay: 5000,    // 5s delay between restarts

      // ── Memory Management ──────────────────────────────
      max_memory_restart: "2G", // Restart if memory exceeds 2GB

      // ── Logging ─────────────────────────────────────────
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      log_type: "json",

      // ── Graceful Shutdown ───────────────────────────────
      kill_timeout: 10000,    // 10s grace period for cleanup
      listen_timeout: 15000,  // 15s to wait for app to listen
      shutdown_with_message: true,
    },
  ],
};
