#!/usr/bin/env node
/**
 * Lấy OpenClaw Gateway token từ ~/.openclaw/openclaw.json
 * Dùng để điền vào web/.env.local
 *
 * Usage: node scripts/get-gateway-token.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');

if (!fs.existsSync(configPath)) {
  console.error('❌ Không tìm thấy ~/.openclaw/openclaw.json');
  console.error('   Hãy cài và chạy OpenClaw trước: openclaw start');
  process.exit(1);
}

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const token = config?.gateway?.auth?.token;
  const port = config?.gateway?.port || 18789;

  if (!token) {
    console.error('❌ Không tìm thấy gateway token trong config');
    console.error('   Kiểm tra gateway.auth.token trong ~/.openclaw/openclaw.json');
    process.exit(1);
  }

  console.log('\n✅ OpenClaw Gateway info:\n');
  console.log(`OPENCLAW_GATEWAY_URL=http://127.0.0.1:${port}`);
  console.log(`OPENCLAW_GATEWAY_TOKEN=${token}`);
  console.log('\n📋 Copy 2 dòng trên vào web/.env.local\n');

} catch (err) {
  console.error('❌ Lỗi đọc config:', err.message);
  process.exit(1);
}
