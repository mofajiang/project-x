#!/usr/bin/env node
const { execSync } = require('child_process');

try {
  console.log('📝 执行 git add...');
  execSync('git add -A', { cwd: process.cwd(), stdio: 'inherit' });

  console.log('\n📝 执行 git commit...');
  execSync('git commit -m "fix: 改进 OpenRouter 响应日志和配置保存诊断"', { cwd: process.cwd(), stdio: 'inherit' });

  console.log('\n📝 执行 git push...');
  execSync('git push', { cwd: process.cwd(), stdio: 'inherit' });

  console.log('\n✅ 推送成功！');
} catch (err) {
  console.error('\n❌ 出错:', err.message);
  process.exit(1);
}
