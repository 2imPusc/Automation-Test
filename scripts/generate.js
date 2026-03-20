#!/usr/bin/env node
/**
 * AI Test Generator — sinh Playwright test từ mô tả tự nhiên.
 *
 * Nếu có snapshots (từ npm run snapshot), sẽ inject DOM info + screenshot paths
 * vào prompt để Claude Code dùng selector chính xác hơn.
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
const SNAPSHOTS_DIR = path.join(ROOT, 'snapshots');
const SNAPSHOTS_INDEX = path.join(SNAPSHOTS_DIR, 'index.json');

// ── Check claude CLI ────────────────────────────────────────────────────────
function checkClaude() {
  try {
    execSync('which claude', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ── Load snapshots context ──────────────────────────────────────────────────
function loadSnapshotsContext() {
  if (!fs.existsSync(SNAPSHOTS_INDEX)) return null;

  const index = JSON.parse(fs.readFileSync(SNAPSHOTS_INDEX, 'utf-8'));
  if (!index.snapshots?.length) return null;

  const sections = [];

  for (const snap of index.snapshots) {
    const jsonPath = path.join(ROOT, snap.json);
    if (!fs.existsSync(jsonPath)) continue;

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const dom = data.dom || {};

    const lines = [
      `### Snapshot: ${snap.app} / ${snap.page}`,
      `Screenshot: ${snap.screenshot}`,
      `URL: ${data.url || ''}`,
      `Captured: ${snap.updatedAt}`,
      '',
    ];

    if (dom.headings?.length) {
      lines.push('**Headings:**');
      dom.headings.forEach(h => lines.push(`  - ${h.tag}: "${h.text}"`));
      lines.push('');
    }

    if (dom.buttons?.length) {
      lines.push('**Buttons (use these for getByRole/getByText selectors):**');
      dom.buttons.slice(0, 20).forEach(b => {
        const label = b.ariaLabel ? ` [aria-label: "${b.ariaLabel}"]` : '';
        if (b.text) lines.push(`  - "${b.text}"${label}`);
      });
      lines.push('');
    }

    if (dom.links?.length) {
      lines.push('**Nav links:**');
      dom.links.forEach(l => lines.push(`  - "${l}"`));
      lines.push('');
    }

    if (dom.inputs?.length) {
      lines.push('**Inputs:**');
      dom.inputs.forEach(inp => {
        const label = inp.label || inp.ariaLabel || inp.placeholder || inp.name;
        lines.push(`  - type="${inp.type}" label="${label}"`);
      });
      lines.push('');
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n---\n\n');
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

    rl.on('close', () => resolve(lines.join('\n').trim()));
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

// ── Build prompt ────────────────────────────────────────────────────────────
function buildPrompt(description, snapshotsContext) {
  const skill = fs.readFileSync(SKILL_FILE, 'utf-8');

  const snapshotSection = snapshotsContext
    ? `## UI Snapshots (actual app screenshots + DOM info)

These snapshots were captured from the real app. Use the button/input/link names below
as selectors — they are extracted from the actual DOM, so prefer them over guessing.

${snapshotsContext}
---

`
    : `## UI Snapshots

No snapshots available. Use best-guess selectors and add \`// TODO: verify selector\` comments.
Tip: Run \`npm run snapshot\` first to capture real UI info for more accurate selectors.

---

`;

  return `${skill}

---

${snapshotSection}
## Yêu cầu từ tester

${description}

---

## Hướng dẫn thực hiện

1. Đọc các file context bắt buộc trong SKILL.md
2. Nếu có UI Snapshots bên trên, ưu tiên dùng tên button/input/link thật từ DOM info
   thay vì đoán — điều này giúp selectors chính xác hơn nhiều
3. Nếu snapshot có screenshot path, đọc file đó để xem UI trực quan
4. Tạo file cần thiết (Page Object + spec file)
5. Chạy \`npx playwright test --list\` để validate
6. In ra summary theo format trong SKILL.md

Working directory: ${ROOT}
`;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const autoRun = args.includes('--run');

  if (!checkClaude()) {
    console.error('');
    console.error('❌ Không tìm thấy Claude Code CLI.');
    console.error('   Cài đặt tại: https://claude.ai/code');
    process.exit(1);
  }

  // Load snapshots
  const snapshotsContext = loadSnapshotsContext();
  if (snapshotsContext) {
    console.log('');
    console.log('✅ Tìm thấy snapshots — AI sẽ dùng DOM info thật để viết selectors chính xác hơn.');
  } else {
    console.log('');
    console.log('💡 Chưa có snapshots. Chạy `npm run snapshot` trước để AI viết selector chính xác hơn.');
  }

  // Nhận mô tả
  const description = await askDescription();
  if (!description) {
    console.error('\n❌ Mô tả trống. Thoát.');
    process.exit(1);
  }

  // Build prompt
  const prompt = buildPrompt(description, snapshotsContext);

  // Ghi prompt ra temp file
  const tmpFile = path.join(os.tmpdir(), `shopify-test-gen-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf-8');

  console.log('\n⏳ Claude Code đang phân tích và tạo test...\n');
  console.log('─────────────────────────────────────────────────');

  const result = spawnSync(
    'claude',
    ['--permission-mode', 'bypassPermissions', '--print', `$(cat ${tmpFile})`],
    { cwd: ROOT, stdio: 'inherit', shell: true }
  );

  try { fs.unlinkSync(tmpFile); } catch {}

  if (result.status !== 0) {
    console.error('\n❌ Claude Code gặp lỗi (exit code:', result.status, ')');
    process.exit(result.status ?? 1);
  }

  console.log('\n─────────────────────────────────────────────────');

  if (!autoRun) {
    const runNow = await askRunNow();
    if (runNow) {
      console.log('\n▶ Chạy tất cả tests...\n');
      spawnSync('npx', ['playwright', 'test', '--project=chromium'], {
        cwd: ROOT, stdio: 'inherit', shell: true,
      });
    } else {
      console.log('\n💡 Chạy sau bằng: npm run test');
      console.log('   Hoặc chọn: npm run test:pick\n');
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Lỗi:', err.message);
  process.exit(1);
});
