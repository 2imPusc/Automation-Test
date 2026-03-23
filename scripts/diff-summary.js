#!/usr/bin/env node
/**
 * Diff Summary Utility
 *
 * Tóm tắt GitLab MR diff thành format compact cho Layer 2 (Flow Planner).
 * Giảm từ ~3000 token full diff → ~500 token summary.
 *
 * Export: summarizeDiff(diffContent) → { summary, filesChanged, keyChanges }
 * CLI:    node diff-summary.js < diff.txt
 */

/**
 * Parse raw diff text hoặc GitLab API diff array
 *
 * @param {string|object[]} input - raw diff text hoặc array of { old_path, new_path, diff, new_file, deleted_file }
 * @returns {{ summary: string, filesChanged: string[], keyChanges: string[] }}
 */
function summarizeDiff(input) {
  let files;

  if (Array.isArray(input)) {
    // GitLab API format
    files = input.map(f => parseDiffEntry(f));
  } else if (typeof input === 'string') {
    // Raw unified diff
    files = parseUnifiedDiff(input);
  } else {
    return { summary: 'No diff data', filesChanged: [], keyChanges: [] };
  }

  const filesChanged = files.map(f => f.path);
  const keyChanges = extractKeyChanges(files);

  // Build compact summary (~500 token target)
  const lines = [];
  lines.push(`## Changed Files (${files.length})`);
  lines.push('');

  for (const f of files) {
    const status = f.deleted ? 'D' : f.newFile ? 'A' : 'M';
    lines.push(`${status} ${f.path} (+${f.additions}/-${f.deletions})`);
  }

  if (keyChanges.length) {
    lines.push('');
    lines.push('## Key Changes');
    for (const change of keyChanges) {
      lines.push(`- ${change}`);
    }
  }

  return {
    summary: lines.join('\n'),
    filesChanged,
    keyChanges,
  };
}

/**
 * Parse GitLab API diff entry
 */
function parseDiffEntry(entry) {
  const diff = entry.diff || '';
  const additions = (diff.match(/^\+[^+]/gm) || []).length;
  const deletions = (diff.match(/^-[^-]/gm) || []).length;

  return {
    path: entry.new_path || entry.old_path,
    oldPath: entry.old_path,
    newFile: entry.new_file || false,
    deleted: entry.deleted_file || false,
    renamed: entry.renamed_file || false,
    additions,
    deletions,
    diff,
  };
}

/**
 * Parse raw unified diff text
 */
function parseUnifiedDiff(text) {
  const files = [];
  const chunks = text.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    const pathMatch = chunk.match(/^a\/(.+?) b\/(.+)/);
    if (!pathMatch) continue;

    const path = pathMatch[2];
    const newFile = chunk.includes('new file mode');
    const deleted = chunk.includes('deleted file mode');
    const additions = (chunk.match(/^\+[^+]/gm) || []).length;
    const deletions = (chunk.match(/^-[^-]/gm) || []).length;

    files.push({ path, oldPath: pathMatch[1], newFile, deleted, renamed: false, additions, deletions, diff: chunk });
  }

  return files;
}

/**
 * Extract key changes: props added/removed, functions changed, imports changed
 */
function extractKeyChanges(files) {
  const changes = [];

  for (const f of files) {
    if (!f.diff) continue;

    // Removed props/params
    const removedProps = f.diff.match(/^-\s+\b(should\w+|open\w+|close\w+|on\w+|is\w+|has\w+)\b/gm);
    if (removedProps?.length) {
      const props = removedProps.map(p => p.replace(/^-\s+/, '').trim());
      changes.push(`${shortPath(f.path)}: removed props [${props.join(', ')}]`);
    }

    // Added props/params
    const addedProps = f.diff.match(/^\+\s+\b(should\w+|open\w+|close\w+|on\w+|is\w+|has\w+)\b/gm);
    if (addedProps?.length) {
      const props = addedProps.map(p => p.replace(/^\+\s+/, '').trim());
      changes.push(`${shortPath(f.path)}: added props [${props.join(', ')}]`);
    }

    // New exports/components
    const newExports = f.diff.match(/^\+\s*export\s+(default\s+)?(function|class|const)\s+(\w+)/gm);
    if (newExports?.length) {
      const names = newExports.map(e => e.match(/(\w+)\s*$/)?.[1]).filter(Boolean);
      changes.push(`${shortPath(f.path)}: new exports [${names.join(', ')}]`);
    }

    // Removed exports
    const removedExports = f.diff.match(/^-\s*export\s+(default\s+)?(function|class|const)\s+(\w+)/gm);
    if (removedExports?.length) {
      const names = removedExports.map(e => e.match(/(\w+)\s*$/)?.[1]).filter(Boolean);
      changes.push(`${shortPath(f.path)}: removed exports [${names.join(', ')}]`);
    }

    // Modal/dialog changes
    if (f.diff.match(/[+-]\s*(modal|dialog|confirm|Modal|Dialog)/i)) {
      changes.push(`${shortPath(f.path)}: modal/dialog changes`);
    }

    // Toast/notification changes
    if (f.diff.match(/[+-]\s*(toast|notification|alert|Toast|Notification)/i)) {
      changes.push(`${shortPath(f.path)}: toast/notification changes`);
    }

    // Route changes
    if (f.diff.match(/[+-]\s*(path:\s*['"]|Route|route|navigate)/)) {
      changes.push(`${shortPath(f.path)}: route/navigation changes`);
    }
  }

  // Deduplicate
  return [...new Set(changes)].slice(0, 15);
}

function shortPath(p) {
  // Keep last 2 segments: "pages/ImageManager/ImageManager.js"
  const parts = p.split('/');
  return parts.length > 2 ? parts.slice(-2).join('/') : p;
}

module.exports = { summarizeDiff };

// ── CLI mode ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    const result = summarizeDiff(input);
    console.log(result.summary);
    console.log(`\n---\nFiles: ${result.filesChanged.length} | Key changes: ${result.keyChanges.length}`);
  });
}
