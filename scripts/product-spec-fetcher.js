#!/usr/bin/env node
/**
 * Product Spec Fetcher
 *
 * Fetch feature specification docs từ GitLab product repo.
 * Map: appKey + featureName → spec file path → extract buttons, toasts, flows.
 *
 * Usage:
 *   const { fetchProductSpec } = require('./product-spec-fetcher');
 *   const spec = await fetchProductSpec('seo', 'seo-checklist');
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'skills/shopify-test-gen/references/product-spec-cache');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// GitLab project config
const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab.com';
const GITLAB_TOKEN = process.env.GITLAB_TOKEN || '';
const PRODUCT_DOCS_PROJECT = 'avada%2Ffalcon%2Fproduct%2Fproduct';
const PRODUCT_DOCS_REF = 'main';

// Map: appKey → base path trong product repo
const APP_SPEC_PATHS = {
  avadaPlaza: 'ap-speed-optimizer/features/Feature specification document',
  seo:        'avada-seo-suite/features/Feature specification document',
  blogs:      'seo-on-blog/features/Feature specification document',
};

// Map: feature name keywords → file name trong product repo (avadaPlaza app)
// Lưu ý: ap-speed-optimizer dùng file trực tiếp, không có subfolder
const AVADA_PLAZA_FEATURE_MAP = {
  'image-manager':      'image-optimizer.md',
  'image-optimizer':    'image-optimizer.md',
  'image-seo':          'image-optimizer.md',
  'compress':           'image-optimizer.md',
  'manual-compress':    'image-optimizer.md',
  'speed-up':           'site-speed-up.md',
  'site-speed':         'site-speed-up.md',
  'speed-score':        'speed-score.md',
  'script-manager':     'script-manager.md',
  'scripts':            'script-manager.md',
};

// Map: feature name keywords → folder name trong product repo (seo app)
const SEO_FEATURE_MAP = {
  'dashboard':          'Dashboard',
  'home':               'Dashboard',
  'seo-checklist':      'SEO checklist',
  'checklist':          'SEO checklist',
  'broken-link':        'Broken link manager',
  'broken-links':       'Broken link manager',
  'google-structured':  'Google structured data',
  'structured-data':    'Google structured data',
  'image-optimization': 'Image optimization',
  'image-seo':          'Image optimization',
  'seo-ai':             'SEO AI agent',
  'seo-audit':          'SEO Audit agent',
  'seo-tools':          'SEO tools',
  'search-appearance':  'Search appearance',
  'settings':           'Settings',
  'speed-up':           'Speed up',
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'PRIVATE-TOKEN': GITLAB_TOKEN,
        'User-Agent': 'shopify-autotest/1.0',
      },
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        } else {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function gitlabListTree(projectPath, ref) {
  const url = `${GITLAB_URL}/api/v4/projects/${PRODUCT_DOCS_PROJECT}/repository/tree?path=${encodeURIComponent(projectPath)}&ref=${ref}&per_page=50`;
  const raw = await httpsGet(url);
  return JSON.parse(raw);
}

async function gitlabGetFile(filePath, ref) {
  const url = `${GITLAB_URL}/api/v4/projects/${PRODUCT_DOCS_PROJECT}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${ref}`;
  return httpsGet(url);
}

// ── Cache ─────────────────────────────────────────────────────────────────────

function getCacheKey(appKey, featureName) {
  return `${appKey}-${featureName.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`;
}

function readCache(cacheKey) {
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
  if (!fs.existsSync(cacheFile)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    if (Date.now() - data.cachedAt < CACHE_TTL_MS) return data.spec;
    return null; // stale
  } catch {
    return null;
  }
}

function writeCache(cacheKey, spec) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
  fs.writeFileSync(cacheFile, JSON.stringify({ cachedAt: Date.now(), spec }, null, 2));
}

// ── Feature name matching ─────────────────────────────────────────────────────

/**
 * Match feature name → spec file path.
 * - avadaPlaza: files nằm trực tiếp trong base folder (không có subfolder)
 * - seo: mỗi feature là 1 subfolder chứa 1 file .md
 * Returns: full file path hoặc null
 */
async function matchSpecPath(featureName, appKey) {
  const basePath = APP_SPEC_PATHS[appKey];
  const lower = featureName.toLowerCase().replace(/\.md$/, '').replace(/_/g, '-');

  if (appKey === 'avadaPlaza') {
    // Map trực tiếp → tên file
    for (const [keyword, fileName] of Object.entries(AVADA_PLAZA_FEATURE_MAP)) {
      if (lower.includes(keyword)) return `${basePath}/${fileName}`;
    }
    // Fallback: fuzzy match từ danh sách file thật trên GitLab
    try {
      const entries = await gitlabListTree(basePath, PRODUCT_DOCS_REF);
      const mdFiles = entries.filter(e => e.type === 'blob' && e.name.endsWith('.md'));
      const keywords = lower.split('-').filter(w => w.length > 2);
      let best = null, bestScore = 0;
      for (const f of mdFiles) {
        const score = keywords.filter(k => f.name.includes(k)).length;
        if (score > bestScore) { bestScore = score; best = f.name; }
      }
      if (best) return `${basePath}/${best}`;
    } catch { /* ignore */ }
    return null;
  }

  if (appKey === 'seo') {
    // Map feature → subfolder, rồi tìm file trong subfolder
    for (const [keyword, folder] of Object.entries(SEO_FEATURE_MAP)) {
      if (lower.includes(keyword)) {
        return findSpecFileInFolder(`${basePath}/${folder}`);
      }
    }
  }

  if (appKey === 'blogs') {
    // blogs chưa có map riêng — fuzzy match từ danh sách file
    try {
      const entries = await gitlabListTree(basePath, PRODUCT_DOCS_REF);
      const mdFiles = entries.filter(e => e.type === 'blob' && e.name.endsWith('.md'));
      const keywords = lower.split('-').filter(w => w.length > 2);
      let best = null, bestScore = 0;
      for (const f of mdFiles) {
        const score = keywords.filter(k => f.name.toLowerCase().includes(k)).length;
        if (score > bestScore) { bestScore = score; best = f.name; }
      }
      if (best) return `${basePath}/${best}`;
    } catch { /* ignore */ }
  }

  return null;
}

// Legacy helper dùng bởi seo flow
async function findSpecFileInFolder(folderPath) {
  try {
    const entries = await gitlabListTree(folderPath, PRODUCT_DOCS_REF);
    const mdFiles = entries.filter(e => e.type === 'blob' && e.name.endsWith('.md'));
    if (!mdFiles.length) return null;
    const best = mdFiles.find(f => !f.name.includes('template') && !f.name.includes('draft'))
      || mdFiles[0];
    return `${folderPath}/${best.name}`;
  } catch {
    return null;
  }
}

// ── Extract structured data từ spec markdown ──────────────────────────────────

function extractSpecData(markdown) {
  const buttons = [];
  const toasts = [];
  const flows = [];
  const edgeCases = [];

  const lines = markdown.split('\n');
  let currentSection = '';
  let inCtaTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Track current section
    if (line.startsWith('## ') || line.startsWith('# ')) {
      currentSection = lower;
      inCtaTable = false;
    }
    if (line.startsWith('### ')) {
      inCtaTable = false;
    }

    // Detect CTA column table: header row chứa "CTA" hoặc "Nút"
    if (line.includes('|') && (lower.includes('| cta') || lower.includes('cta |') || lower.includes('| nút') || lower.includes('nút |'))) {
      inCtaTable = true;
      continue; // skip header row
    }
    // Skip separator row
    if (inCtaTable && line.match(/^\s*\|[\s\-|]+\|\s*$/)) continue;

    // Extract CTA from table: last non-empty column in CTA table
    if (inCtaTable && line.includes('|')) {
      const cells = line.split('|').map(c => c.replace(/\*\*/g, '').trim()).filter(Boolean);
      // CTA thường ở cột cuối
      const lastCell = cells[cells.length - 1];
      if (lastCell && lastCell.length > 1 && lastCell.length < 50
          && !lastCell.startsWith('-') && !lastCell.match(/^[\s—–-]+$/)) {
        buttons.push(lastCell);
      }
      continue;
    }

    // Extract buttons từ inline text patterns
    // Pattern: nút "Text", button "Text", **"Text"**, "Activate Turbo", CTA: "Text"
    const inlinePatterns = [
      /nút\s+"([^"]{2,50})"/gi,
      /button\s+"([^"]{2,50})"/gi,
      /\*\*"([^"]{2,50})"\*\*/g,
      /CTA[:\s]+"([^"]{2,50})"/gi,
      /"([A-Z][a-zA-Z\s]{2,40})"/g,   // Capitalized quoted strings (likely button labels)
    ];

    for (const pattern of inlinePatterns) {
      const matches = [...line.matchAll(pattern)];
      for (const match of matches) {
        const text = match[1].trim();
        // Filter out: pure numbers, table headers, long sentences
        if (text && text.length >= 2 && text.length <= 50
            && !text.match(/^\d+$/)
            && !text.match(/^[\s—–]+$/)) {
          buttons.push(text);
        }
      }
    }

    // Extract toasts — tìm quoted strings trong dòng có từ toast/thông báo/hiện
    if (lower.includes('toast') || lower.includes('thông báo xuất hiện') || lower.includes('hiển thị thông báo')) {
      const toastMatches = [...line.matchAll(/"([^"]{5,100})"/g)];
      for (const match of toastMatches) {
        const text = match[1].trim();
        if (text.length > 4 && text.length < 100) toasts.push(text);
      }
    }

    // Extract flows từ numbered steps
    if (line.match(/^###?\s*(Bước|Step)\s+\d+/i)) {
      const flowTitle = line.replace(/^#{1,3}\s*/, '').trim();
      const steps = [];
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        if (lines[j].startsWith('#')) break;
        const step = lines[j].replace(/^[-*\d.]+\s*/, '').trim();
        if (step) steps.push(step);
      }
      if (flowTitle) flows.push({ title: flowTitle, steps });
    }

    // Extract edge cases
    if (lower.includes('edge case') || lower.includes('trường hợp đặc biệt') || lower.includes('lưu ý quan trọng')) {
      const bullets = [];
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        if (lines[j].startsWith('#')) break;
        const item = lines[j].replace(/^[-*]\s*/, '').trim();
        if (item) bullets.push(item);
      }
      edgeCases.push(...bullets);
    }
  }

  // Deduplicate + filter noise
  const unique = arr => [...new Set(arr.filter(x =>
    x && x.length >= 2 && !x.match(/^[\d\s—–\-|]+$/)
  ))];

  return {
    buttons: unique(buttons),
    toasts:  unique(toasts),
    flows,
    edgeCases: unique(edgeCases),
  };
}

function buildSpecSummary(spec) {
  const lines = [];
  if (spec.buttons.length) {
    lines.push(`## Buttons\n${spec.buttons.map(b => `- "${b}"`).join('\n')}`);
  }
  if (spec.toasts.length) {
    lines.push(`## Toast Messages\n${spec.toasts.map(t => `- "${t}"`).join('\n')}`);
  }
  if (spec.flows.length) {
    lines.push(`## User Flows\n${spec.flows.map(f => `- ${f.title}`).join('\n')}`);
  }
  return lines.join('\n\n');
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch product spec cho 1 feature.
 *
 * @param {string} appKey - "seo" | "avadaPlaza" | "blogs"
 * @param {string} featureName - tên feature file, e.g. "image-manager.md", "seo-checklist"
 * @returns {Promise<{buttons, toasts, flows, edgeCases, rawSpec, specFile, summary} | null>}
 */
async function fetchProductSpec(appKey, featureName) {
  if (!GITLAB_TOKEN) {
    console.warn('[product-spec-fetcher] GITLAB_TOKEN not set — skipping');
    return null;
  }

  const basePath = APP_SPEC_PATHS[appKey];
  if (!basePath) {
    // avadaPlaza chưa có product spec repo entry
    return null;
  }

  const cacheKey = getCacheKey(appKey, featureName);

  // 1. Check cache
  const cached = readCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // 2. Map feature name → spec file path
    const specFilePath = await matchSpecPath(featureName, appKey);
    if (!specFilePath) {
      console.warn(`[product-spec-fetcher] No spec mapping for ${appKey}/${featureName}`);
      return null;
    }

    // 4. Fetch content
    const rawContent = await gitlabGetFile(specFilePath, PRODUCT_DOCS_REF);

    // 5. Extract structured data
    const extracted = extractSpecData(rawContent);

    // 6. Build result
    const spec = {
      ...extracted,
      rawSpec:  rawContent.length > 4000
        ? rawContent.slice(0, 4000) + '\n<!-- truncated -->'
        : rawContent,
      specFile: specFilePath,
      summary:  buildSpecSummary(extracted),
      fetchedAt: new Date().toISOString(),
    };

    // 7. Cache
    writeCache(cacheKey, spec);

    return spec;

  } catch (err) {
    console.warn(`[product-spec-fetcher] Error fetching spec for ${appKey}/${featureName}: ${err.message}`);
    return null;
  }
}

/**
 * Clear cache cho 1 app hoặc toàn bộ.
 */
function clearCache(appKey) {
  if (!fs.existsSync(CACHE_DIR)) return;
  const files = fs.readdirSync(CACHE_DIR);
  const prefix = appKey ? `${appKey}-` : '';
  for (const f of files) {
    if (!appKey || f.startsWith(prefix)) {
      fs.unlinkSync(path.join(CACHE_DIR, f));
    }
  }
}

module.exports = { fetchProductSpec, clearCache };

// ── CLI test ──────────────────────────────────────────────────────────────────

if (require.main === module) {
  const appKey = process.argv[2] || 'seo';
  const feature = process.argv[3] || 'seo-checklist';

  console.log(`Fetching spec: ${appKey} / ${feature} ...`);
  fetchProductSpec(appKey, feature).then(spec => {
    if (!spec) {
      console.log('No spec found.');
      return;
    }
    console.log(`\nSpec file: ${spec.specFile}`);
    console.log(`\nButtons (${spec.buttons.length}): ${spec.buttons.join(', ')}`);
    console.log(`Toasts (${spec.toasts.length}): ${spec.toasts.join(', ')}`);
    console.log(`Flows (${spec.flows.length}): ${spec.flows.map(f => f.title).join(', ')}`);
    console.log(`\nSummary:\n${spec.summary}`);
  }).catch(console.error);
}
