#!/usr/bin/env node
/**
 * Source File Loader
 *
 * Đọc `## Source Files` section từ feature file → load nội dung thật từ repo.
 * Layer 1 dùng để chuẩn bị context cho Layer 3 (Code Writer).
 *
 * Export: loadSourceFiles(featureFilePath, repoPath) → { [filename]: content }
 * CLI:    node source-loader.js --feature path/to/feature.md --repo ~/avada-image-optimizer
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function expandHome(p) {
  if (p && p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/**
 * Parse `## Source Files` section từ feature markdown.
 * Mỗi dòng bắt đầu bằng `- ` là 1 path.
 *
 * @param {string} featureContent - nội dung feature file
 * @returns {string[]} - relative paths from repo root
 */
function parseSourceFiles(featureContent) {
  const match = featureContent.match(/## Source Files\n(?:<!--.*?-->\n)?([\s\S]*?)(?=\n## |\n---|\n$)/);
  if (!match) return [];

  return match[1]
    .split('\n')
    .map(line => line.replace(/^-\s+/, '').trim())
    .filter(line => line && !line.startsWith('<!--') && !line.startsWith('#'));
}

/**
 * Load source files từ repo.
 * Nếu path là directory → load tất cả .js/.jsx/.ts/.tsx trong đó (1 level).
 * Nếu path là file → load trực tiếp.
 * Giới hạn mỗi file 200 dòng để kiểm soát context size.
 *
 * @param {string} featureFilePath - path đến feature .md file
 * @param {string} repoPath - path đến repo root
 * @param {object} [opts]
 * @param {number} [opts.maxLinesPerFile=200]
 * @param {number} [opts.maxTotalFiles=10]
 * @returns {{ [filename]: string }}
 */
function loadSourceFiles(featureFilePath, repoPath, opts = {}) {
  const { maxLinesPerFile = 200, maxTotalFiles = 10 } = opts;
  const content = fs.readFileSync(featureFilePath, 'utf-8');
  const sourcePaths = parseSourceFiles(content);
  const result = {};
  let count = 0;

  for (const relPath of sourcePaths) {
    if (count >= maxTotalFiles) break;

    const absPath = path.join(expandHome(repoPath), relPath);

    if (!fs.existsSync(absPath)) continue;

    const stat = fs.statSync(absPath);

    if (stat.isDirectory()) {
      // Load .js/.jsx/.ts/.tsx files in directory (1 level)
      const entries = fs.readdirSync(absPath)
        .filter(f => /\.(jsx?|tsx?)$/.test(f))
        .sort();

      for (const entry of entries) {
        if (count >= maxTotalFiles) break;
        const filePath = path.join(absPath, entry);
        const fileContent = readFileTruncated(filePath, maxLinesPerFile);
        if (fileContent) {
          const key = path.relative(expandHome(repoPath), filePath);
          result[key] = fileContent;
          count++;
        }
      }
    } else {
      const fileContent = readFileTruncated(absPath, maxLinesPerFile);
      if (fileContent) {
        const key = path.relative(expandHome(repoPath), absPath);
        result[key] = fileContent;
        count++;
      }
    }
  }

  return result;
}

function readFileTruncated(filePath, maxLines) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    return lines.slice(0, maxLines).join('\n') + `\n// ... (truncated, ${lines.length - maxLines} more lines)`;
  } catch {
    return null;
  }
}

/**
 * Chỉ load source files mà Flow Planner yêu cầu (needsSourceFiles).
 * Dùng ở Layer 3 để giảm context chỉ còn files cần thiết.
 *
 * @param {{ [filename]: string }} allSourceFiles - từ loadSourceFiles()
 * @param {string[]} neededFiles - từ Flow Planner scenario.needsSourceFiles
 * @returns {{ [filename]: string }}
 */
function filterSourceFiles(allSourceFiles, neededFiles) {
  if (!neededFiles?.length) return {};

  const result = {};
  for (const [key, content] of Object.entries(allSourceFiles)) {
    const basename = path.basename(key);
    const dirBasename = path.basename(path.dirname(key));
    if (neededFiles.some(f => basename === f || dirBasename === f || key.includes(f))) {
      result[key] = content;
    }
  }
  return result;
}

module.exports = { loadSourceFiles, filterSourceFiles, parseSourceFiles };

// ── CLI mode ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const featurePath = args.find((_, i) => args[i - 1] === '--feature');
  const repoPath = args.find((_, i) => args[i - 1] === '--repo');

  if (!featurePath || !repoPath) {
    console.error('Usage: node source-loader.js --feature path/to/feature.md --repo ~/repo');
    process.exit(1);
  }

  const files = loadSourceFiles(featurePath, repoPath);
  console.log(`Loaded ${Object.keys(files).length} source files:\n`);
  for (const [name, content] of Object.entries(files)) {
    const lines = content.split('\n').length;
    console.log(`  📄 ${name} (${lines} lines)`);
  }
}
