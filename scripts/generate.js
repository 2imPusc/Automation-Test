#!/usr/bin/env node
/**
 * AI Test Generator — sinh Playwright test từ mô tả tự nhiên.
 *
 * Dùng Claude Code để đọc codebase và tạo spec file + Page Object tự động.
 *
 * Usage:
 *   npm run test:generate
 *   npm run test:generate -- --run   (tạo xong chạy luôn)
 */

const readline = require('readline');
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const SKILL_FILE = path.join(ROOT, 'skills/shopify-test-gen/SKILL.md');

// ── Check claude CLI ────────────────────────────────────────────────────────
function checkClaude() {
  try {
    execSync('which claude', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ── Đọc mô tả từ tester ────────────────────────────────────────────────────
function askDescription() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('');
    console.log('🤖 AI Test Generator');
    console.log('─────────────────────────────────────────────────');
    console.log('Mô tả feature/flow cần test (tiếng Việt hoặc English).');
    console.log('Gợi ý format:');
    console.log('  App: [tên app]');
    console.log('  Trang: [tên trang/section]');
    console.log('  Flow: [mô tả các bước và điều cần kiểm tra]');
    console.log('');
    console.log('Nhấn Enter 2 lần khi xong.');
    console.log('─────────────────────────────────────────────────');

    let lines = [];
    let emptyCount = 0;

    rl.on('line', (line) => {
      if (line === '') {
        emptyCount++;
        if (emptyCount >= 2) {
          rl.close();
          resolve(lines.join('\n').trim());
        }
      } else {
        emptyCount = 0;
        lines.push(line);
      }
    });

    rl.on('close', () => {
      resolve(lines.join('\n').trim());
    });
  });
}

// ── Hỏi có muốn chạy luôn không ───────────────────────────────────────────
function askRunNow() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\n▶ Chạy test ngay? (y/n): ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ── Build prompt cho Claude Code ───────────────────────────────────────────
function buildPrompt(description) {
  const skill = fs.readFileSync(SKILL_FILE, 'utf-8');

  return `${skill}

---

## Yêu cầu từ tester

${description}

---

## Hướng dẫn thực hiện

1. Đọc các file context bắt buộc trong SKILL.md
2. Phân tích mô tả trên
3. Tạo file cần thiết (Page Object + spec file)
4. Chạy \`npx playwright test --list\` để validate
5. In ra summary theo format trong SKILL.md

Working directory: ${ROOT}
`;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const autoRun = args.includes('--run');

  // Check prerequisite
  if (!checkClaude()) {
    console.error('');
    console.error('❌ Không tìm thấy Claude Code CLI.');
    console.error('   Cài đặt tại: https://claude.ai/code');
    process.exit(1);
  }

  // Nhận mô tả từ tester
  const description = await askDescription();

  if (!description) {
    console.error('\n❌ Mô tả trống. Thoát.');
    process.exit(1);
  }

  // Build prompt
  const prompt = buildPrompt(description);

  // Ghi prompt ra temp file để tránh shell escaping issues
  const tmpFile = path.join(os.tmpdir(), `shopify-test-gen-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf-8');

  console.log('\n⏳ Claude Code đang phân tích và tạo test...\n');
  console.log('─────────────────────────────────────────────────');

  // Chạy Claude Code
  const result = spawnSync(
    'claude',
    ['--permission-mode', 'bypassPermissions', '--print', `$(cat ${tmpFile})`],
    {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    }
  );

  // Cleanup temp file
  try { fs.unlinkSync(tmpFile); } catch {}

  if (result.status !== 0) {
    console.error('\n❌ Claude Code gặp lỗi (exit code:', result.status, ')');
    process.exit(result.status ?? 1);
  }

  console.log('\n─────────────────────────────────────────────────');

  // Hỏi chạy test ngay không (nếu chưa có --run flag)
  if (!autoRun) {
    const runNow = await askRunNow();
    if (runNow) {
      console.log('\n▶ Chạy tất cả tests...\n');
      spawnSync('npx', ['playwright', 'test', '--project=chromium'], {
        cwd: ROOT,
        stdio: 'inherit',
        shell: true,
      });
    } else {
      console.log('\n💡 Chạy sau bằng: npm run test');
      console.log('   Hoặc xem test mới: npm run test:pick\n');
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Lỗi:', err.message);
  process.exit(1);
});
