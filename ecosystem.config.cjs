module.exports = {
  apps: [
    {
      name: "pattern-foundry",
      cwd: "/var/www/pattern-foundry/current",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_memory_restart: "500M",
      instances: 1,
      autorestart: true,
      watch: false,
      time: true,
    },
  ],
};
