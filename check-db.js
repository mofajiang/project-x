
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./prisma/dev.db', (err) => {
  if (err) {
    console.error('DB 连接失败:', err);
    process.exit(1);
  }
});

db.get("SELECT openrouterApiKey, openrouterModel, enableAiDetection, aiAutoApprove FROM SiteConfig WHERE id = 'singleton'", (err, row) => {
  if (err) console.error(err);
  else {
    console.log('当前 DB 状态:');
    console.log(JSON.stringify(row, null, 2));
  }
  db.close();
  process.exit(0);
});

