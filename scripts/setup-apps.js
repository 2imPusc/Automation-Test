#!/usr/bin/env node
/**
 * Setup Apps Registry
 *
 * Wizard giúp tester cấu hình đường dẫn các repo app trên máy.
 * Chạy 1 lần khi setup máy mới hoặc thêm app mới.
 *
 * Usage: npm run setup-apps
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, 'skills/shopify-test-gen/references/apps-registry.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
  const apps = Object.entries(registry).filter(([k]) => k !== '_comment');

  console.log('\n🗂️  Setup Apps Registry');
  console.log('─────────────────────────────────────────');
  console.log('Nhập đường dẫn repo trên máy của bạn.');
  console.log('Enter để giữ giá trị hiện tại.\n');

  for (const [key, app] of apps) {
    console.log(`\n📦 ${app.name} (${key})`);
    const current = app.repoPath;

    const input = await ask(`  Repo path [${current}]: `);
    const repoPath = input.trim() || current;

    // Validate path exists
    if (!fs.existsSync(repoPath)) {
      console.log(`  ⚠️  Path không tồn tại: ${repoPath}`);
      console.log(`  → Giữ giá trị cũ. Sửa lại trong ${path.relative(ROOT, REGISTRY_FILE)}`);
    } else {
      registry[key].repoPath = repoPath;
      console.log(`  ✅ ${repoPath}`);
    }
  }

  rl.close();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
  console.log(`\n✅ Registry đã lưu: ${path.relative(ROOT, REGISTRY_FILE)}`);
  console.log('\n💡 Bước tiếp theo:');
  console.log('   npm run test:generate   → AI tạo test, tự check + sync context\n');
}

main().catch(err => { console.error(err); process.exit(1); });
