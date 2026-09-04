// PM2 ecosystem — monorepo backend (always-on)
// Usage: pm2 start ecosystem.config.js && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "bullionai",
      script: "backend/src/server/bullionai-api.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 8787,
      },
      out_file: "./logs/bullionai-out.log",
      error_file: "./logs/bullionai-err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
