#!/usr/bin/env node
/**
 * 完整诊断：测试前端保存 -> 后端接收 -> 数据库存储 -> 查询验证
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 配置
const DB_PATH = path.join(__dirname, 'prisma', 'dev.db');
const PORT = 3002;

async function checkDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) reject(err);
    });

    db.get(
      "SELECT openrouterApiKey, openrouterModel, enableAiDetection FROM SiteConfig WHERE id = 'singleton'",
      (err, row) => {
        db.close();
        if (err) reject(err);
        resolve(row || {});
      }
    );
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  🔍 AI 配置诊断工具');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('📊 当前数据库状态：\n');
  
  try {
    const dbState = await checkDatabase();
    console.log('  openrouterApiKey:', dbState.openrouterApiKey ? `✓ (前 20 字: ${String(dbState.openrouterApiKey).substring(0, 20)})` : '✗ 空或无');
    console.log('  openrouterModel:', dbState.openrouterModel || '✗ 无');
    console.log('  enableAiDetection:', dbState.enableAiDetection ? '✓ 已启用' : '✗ 未启用');

    console.log('\n\n📝 接下来请在浏览器做以下操作：\n');
    console.log('  1️⃣  打开浏览器：http://localhost:' + PORT + '/admin/settings');
    console.log('  2️⃣  登录管理员账户');
    console.log('  3️⃣  滚动到 "🤖 启用 AI 垃圾评论检测" 区域');
    console.log('  4️⃣  在 "OpenRouter API 密钥" 输入框中粘贴你的实际 API Key');
    console.log('  5️⃣  确认 AI 模型选择正确（例如：claude-3.5-sonnet）');
    console.log('  6️⃣  点击页面底部的 "💾 保存设置" 按钮');
    console.log('  7️⃣  返回这个终端，重新运行本脚本检查数据库\n');

    console.log('  💡 操作时查看浏览器 F12 开发者工具 -> 网络选项卡：');
    console.log('     应该看到一个 PUT /api/admin/config 请求');
    console.log('     在下方的后端终端日志中会看到：');
    console.log('     [config PUT] 收到数据: { openrouterApiKey: "sk-or...", ... }\n');

    console.log('═══════════════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('❌ 数据库读取失败:', err.message);
    console.log('   检查 prisma/dev.db 是否存在');
  }

  process.exit(0);
}

main();
