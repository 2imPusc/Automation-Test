#!/usr/bin/env node
/**
 * Staging Deploy Verifier
 *
 * Kiểm tra xem staging environment đã deploy đúng branch chưa,
 * bằng cách query GitLab Deployments API.
 *
 * Export:
 *   verifyStagingDeploy(projectPath, stageNum, expectedBranch)
 *     → { match, deployedBranch, expectedBranch, found }
 *
 * Usage (standalone):
 *   node scripts/staging-verify.js --mr <MR_URL> --stage <N> --branch <branch>
 */

const { execSync } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_URL   = process.env.GITLAB_URL || 'https://gitlab.com';

// ── Parse MR URL → projectPath ─────────────────────────────────────────────

/**
 * Parse project path từ GitLab MR URL.
 * Input:  https://gitlab.com/avada/avada-image-optimizer/-/merge_requests/102
 * Output: 'avada/avada-image-optimizer'
 */
function parseProjectPath(mrUrl) {
  const match = mrUrl.match(/gitlab[^/]*\/(.+?)\/-\/merge_requests\/(\d+)/);
  if (!match) throw new Error(`Không parse được project path từ URL: ${mrUrl}`);
  return match[1];
}

// ── GitLab API ─────────────────────────────────────────────────────────────────

function gitlabGet(apiPath) {
  if (!GITLAB_TOKEN) throw new Error('GITLAB_TOKEN chưa set trong .env');
  const url = `${GITLAB_URL}/api/v4${apiPath}`;
  const res = execSync(
    `curl -s "${url}" -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}"`,
    { stdio: 'pipe', maxBuffer: 5 * 1024 * 1024 }
  ).toString();
  return JSON.parse(res);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Verify xem staging đang deploy đúng branch không.
 *
 * @param {string} projectPath    - GitLab project path (e.g. 'avada/avada-image-optimizer')
 * @param {number|string} stageNum - Staging number (e.g. 2)
 * @param {string} expectedBranch  - Branch cần được deploy (e.g. 'improve/opt-image-v2')
 * @returns {{ match: boolean, deployedBranch: string|null, expectedBranch: string, found: boolean }}
 */
async function verifyStagingDeploy(projectPath, stageNum, expectedBranch) {
  const encoded = encodeURIComponent(projectPath);

  // Thử lấy environment name từ .env trước, fallback về staging-N
  const envNameKey = `STAGING_${stageNum}_ENV_NAME`;
  const envName = process.env[envNameKey] || `staging-${stageNum}`;

  console.log(`  🔍 Kiểm tra deployment: ${projectPath} / ${envName}`);

  try {
    const deployments = gitlabGet(
      `/projects/${encoded}/deployments?environment=${encodeURIComponent(envName)}&order_by=created_at&sort=desc&per_page=1`
    );

    if (!Array.isArray(deployments) || deployments.length === 0) {
      console.warn(`  ⚠️  Không tìm thấy deployment nào cho environment "${envName}"`);
      return { match: false, deployedBranch: null, expectedBranch, found: false };
    }

    const latest = deployments[0];
    const deployedBranch = latest.ref || null;
    const match = deployedBranch === expectedBranch;

    console.log(`  📦 Latest deployment: ref="${deployedBranch}", status="${latest.status}"`);

    return { match, deployedBranch, expectedBranch, found: true };

  } catch (err) {
    console.warn(`  ⚠️  Lỗi khi query deployments: ${err.message}`);
    return { match: false, deployedBranch: null, expectedBranch, found: false };
  }
}

module.exports = { verifyStagingDeploy, parseProjectPath };

// ── CLI mode ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);

  const mrUrl = args.find((_, i) => args[i - 1] === '--mr') || args[0];
  const stageNum = parseInt(args.find((_, i) => args[i - 1] === '--stage') || args[1] || '1');
  const branch = args.find((_, i) => args[i - 1] === '--branch') || args[2] || 'master';

  if (!mrUrl || !mrUrl.includes('gitlab')) {
    console.error('Usage: node scripts/staging-verify.js --mr <MR_URL> --stage <N> --branch <branch>');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/staging-verify.js \\');
    console.error('    --mr https://gitlab.com/avada/avada-image-optimizer/-/merge_requests/102 \\');
    console.error('    --stage 2 \\');
    console.error('    --branch improve/opt-image-v2');
    process.exit(1);
  }

  const projectPath = parseProjectPath(mrUrl);
  console.log(`\n🔍 Staging Verify`);
  console.log(`─────────────────────────────────────`);
  console.log(`  Project:  ${projectPath}`);
  console.log(`  Stage:    ${stageNum}`);
  console.log(`  Expected: ${branch}`);

  verifyStagingDeploy(projectPath, stageNum, branch).then(result => {
    console.log('');
    if (!result.found) {
      console.log('❓ Không tìm thấy deployment. Không thể xác nhận trạng thái staging.');
    } else if (result.match) {
      console.log(`✅ Staging ${stageNum} đang deploy đúng branch: "${result.deployedBranch}"`);
    } else {
      console.log(`❌ Staging ${stageNum} đang deploy "${result.deployedBranch}"`);
      console.log(`   Cần deploy "${result.expectedBranch}" lên staging ${stageNum} trước.`);
    }
  }).catch(err => {
    console.error('❌', err.message);
    process.exit(1);
  });
}
