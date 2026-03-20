#!/usr/bin/env node
/**
 * Interactive test picker — chọn test suite từ menu số.
 *
 * Usage: npm run test:pick
 */

const readline = require('readline');
const { spawnSync } = require('child_process');

const MENU = [
  { label: 'All tests',                        cmd: ['playwright', 'test', '--project=chromium'] },
  { label: 'Avada Plaza only',                 cmd: ['playwright', 'test', '--project=chromium', 'tests/avada-plaza/'] },
  { label: 'SEO only',                         cmd: ['playwright', 'test', '--project=chromium', 'tests/seo/'] },
  { label: 'Blogs only',                       cmd: ['playwright', 'test', '--project=chromium', 'tests/blogs/'] },
  { label: 'Smoke tests only (fast ⚡)',       cmd: ['playwright', 'test', '--project=chromium', '--grep', '@smoke'] },
  { label: 'Open UI mode (debug 🔍)',          cmd: ['playwright', 'test', '--ui'] },
  { label: '🤖 Generate new test with AI',       cmd: ['node', 'scripts/generate.js'] },
  { label: '📸 Capture app snapshots (for AI)',  cmd: ['node', 'scripts/snapshot.js'] },
  { label: '🔬 Scan source code (for AI)',        cmd: ['node', 'scripts/scan-source.js', '--help'] },
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('');
console.log('🎭 Which tests do you want to run?');
console.log('────────────────────────────────────');
MENU.forEach((item, i) => console.log(`  ${i + 1}. ${item.label}`));
console.log('');

rl.question(`Chọn số (1-${MENU.length}): `, (answer) => {
  rl.close();

  const choice = parseInt(answer.trim(), 10);
  if (isNaN(choice) || choice < 1 || choice > MENU.length) {
    console.log(`❌ Lựa chọn không hợp lệ. Chạy lại và nhập số từ 1 đến ${MENU.length}.`);
    process.exit(1);
  }

  const { cmd } = MENU[choice - 1];
  console.log(`\n▶ npx ${cmd.join(' ')}\n`);

  const result = spawnSync('npx', cmd, { stdio: 'inherit', shell: true });
  process.exit(result.status ?? 0);
});
