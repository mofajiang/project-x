/**
 * 测试配置保存功能
 */
const fetch = require('node-fetch');

async function testConfigSave() {
  const testApiKey = 'sk-or-test-key-12345'; // 测试密钥
  const payload = {
    siteName: 'Test Blog',
    openrouterApiKey: testApiKey,
    openrouterModel: 'claude-3.5-sonnet',
    enableAiDetection: true,
    aiReviewStrength: 'balanced',
    aiAutoApprove: true,
  };

  console.log('[TEST] 发送 PUT 请求到 /api/admin/config');
  console.log('[TEST] 负载:', { openrouterApiKey: testApiKey, openrouterModel: payload.openrouterModel });

  try {
    const response = await fetch('http://localhost:3002/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('[TEST] 响应状态:', response.status);
    console.log('[TEST] 返回结果 (openrouter 部分):', {
      openrouterApiKey: result.openrouterApiKey?.substring(0, 20) || '(empty)',
      openrouterModel: result.openrouterModel,
      enableAiDetection: result.enableAiDetection,
    });

    if (result.openrouterApiKey) {
      console.log('✓ API Key 已成功保存到数据库！');
    } else {
      console.log('✗ API Key 未保存（为空）— 这是问题所在');
    }
  } catch (err) {
    console.error('[TEST] 请求失败:', err.message);
    console.log('\n💡 如果看到 401 Unauthorized，说明需要先创建 cookie/auth token。');
    console.log('   请先在浏览器登录管理员，然后重新运行本测试。');
  }
}

testConfigSave();
