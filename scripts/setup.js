#!/usr/bin/env node
/**
 * Shopify Autotest Setup Wizard
 * Hướng dẫn tester setup .env từng bước, không cần biết cấu trúc file.
 *
 * Usage: npm run setup
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log('');
  console.log('🎭 Shopify Autotest Setup');
  console.log('─────────────────────────────────────');
  console.log('Wizard này sẽ giúp bạn tạo file .env');
  console.log('');

  // Store handle (bắt buộc)
  let storeHandle = '';
  while (!storeHandle.trim()) {
    storeHandle = await ask('Store handle? (vd: my-store) → ');
    if (!storeHandle.trim()) console.log('  ⚠️  Store handle không được để trống!');
  }

  // App handles (tuỳ chọn)
  const avadaPlaza = await ask('Avada Plaza app handle? (Enter để bỏ qua) → ');
  const seo = await ask('SEO app handle? (Enter để bỏ qua) → ');
  const blogs = await ask('Blogs app handle? (Enter để bỏ qua) → ');

  rl.close();

  // Ghi .env
  const lines = [
    '# Shopify Configuration',
    `STORE_HANDLE=${storeHandle.trim()}`,
    '',
    '# App Handles',
  ];
  if (avadaPlaza.trim()) lines.push(`AVADA_PLAZA_HANDLE=${avadaPlaza.trim()}`);
  if (seo.trim()) lines.push(`SEO_HANDLE=${seo.trim()}`);
  if (blogs.trim()) lines.push(`BLOGS_HANDLE=${blogs.trim()}`);

  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n');

  console.log('');
  console.log('✅ .env đã được lưu!');
  console.log('');
  console.log('👉 Bước tiếp theo:');
  console.log('   npm run auth     → login vào Shopify (chạy 1 lần)');
  console.log('   npm run test     → chạy tất cả tests');
  console.log('   npm run test:smoke  → chạy smoke tests nhanh (< 60s)');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
