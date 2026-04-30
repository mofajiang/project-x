module.exports = {
  apps: [
    {
      name: 'x-blog',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      // 日志轮转
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      retain: 7,
      // 自动重启
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // 监听文件变化自动重启（仅生产调试时打开）
      watch: false,
      ignore_watch: ['node_modules', '.next', 'prisma/data', 'logs'],
    },
  ],
}
