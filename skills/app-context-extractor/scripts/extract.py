#!/usr/bin/env python3
"""
App Context Extractor — sinh context file cho shopify-test-gen.

Usage:
  python3 extract.py --app-key avadaPlaza --app-name "Avada Plaza" \
    --src /path/to/src --out /path/to/output.md

  python3 extract.py --app-key avadaPlaza --app-name "Avada Plaza" \
    --src /path/to/src \
    --locale /path/to/origin.json \
    --out skills/shopify-test-gen/references/app-context/avadaPlaza.md
"""

import argparse
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

# ── Helpers ──────────────────────────────────────────────────────────────────

SKIP_DIRS = {'node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'coverage'}
SRC_EXTS = {'.js', '.jsx', '.ts', '.tsx'}


def walk_src(src_dir: Path):
    """Yield all source files, skipping irrelevant dirs."""
    for root, dirs, files in os.walk(src_dir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if Path(f).suffix in SRC_EXTS:
                yield Path(root) / f


def flatten_json(obj, prefix=''):
    """Flatten nested JSON into (dotted.key, value) pairs."""
    items = []
    for k, v in obj.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, str):
            items.append((full_key, v))
        elif isinstance(v, dict):
            items.extend(flatten_json(v, full_key))
    return items


# ── Scanners ─────────────────────────────────────────────────────────────────

def scan_test_ids(src_dir: Path) -> list[str]:
    pattern = re.compile(r'data-testid=["\'\`]([^"\'\`]+)["\'\`]')
    ids = set()
    for f in walk_src(src_dir):
        content = f.read_text(encoding='utf-8', errors='ignore')
        ids.update(pattern.findall(content))
    return sorted(ids)


def scan_routes(src_dir: Path) -> list[str]:
    patterns = [
        re.compile(r'path=["\'\`](\/[^"\'\`\s{$][^"\'\`]*)["\'\`]'),
        re.compile(r'to=["\'\`](\/[^"\'\`\s{$][^"\'\`]*)["\'\`]'),
        re.compile(r'navigate\(["\'\`](\/[^"\'\`\s{$][^"\'\`]*)["\'\`]'),
    ]
    routes = set()
    for f in walk_src(src_dir):
        content = f.read_text(encoding='utf-8', errors='ignore')
        for pat in patterns:
            for match in pat.findall(content):
                if len(match) > 1 and '{' not in match and '$' not in match:
                    routes.add(match)
    return sorted(routes)


def scan_nav_links(src_dir: Path) -> list[str]:
    """Extract text from nav/sidebar link components."""
    patterns = [
        re.compile(r'url:\s*["\'\`][^"\'\`]*["\'\`].*?label:\s*["\'\`]([^"\'\`]+)["\'\`]', re.DOTALL),
        re.compile(r'label:\s*["\'\`]([^"\'\`]+)["\'\`].*?url:\s*["\'\`][^"\'\`]*["\'\`]', re.DOTALL),
    ]
    links = set()
    for f in walk_src(src_dir):
        if any(x in f.name.lower() for x in ['nav', 'menu', 'sidebar', 'link']):
            content = f.read_text(encoding='utf-8', errors='ignore')
            for pat in patterns:
                links.update(pat.findall(content))
    return sorted(links)


def scan_locale(locale_file: Path) -> dict:
    """Extract categorised strings from locale JSON, including i18n key mappings."""
    if not locale_file.exists():
        return {'toasts': [], 'errors': [], 'buttons': [], 'headings': [], 'locale_keys': []}

    data = json.loads(locale_file.read_text(encoding='utf-8'))
    flat = flatten_json(data)

    toast_keys = re.compile(r'toast|success|done|finish|complet|saved|updated|revert', re.I)
    error_keys = re.compile(r'error|fail|invalid|wrong|warning|cooldown|wait', re.I)
    button_keys = re.compile(r'button|btn|action|label|cta|title|Button', re.I)
    heading_keys = re.compile(r'title|heading|header|Title', re.I)
    # Keys useful for test selectors (short UI strings)
    selector_keys = re.compile(r'button|btn|label|cta|tab|title|heading|header|badge|status|placeholder', re.I)

    toasts, errors, buttons, headings = set(), set(), set(), set()
    locale_key_pairs = []  # (key, value) for selector reference

    for key, val in flat:
        if not val or len(val) > 120:
            continue
        val_clean = val.strip()
        if toast_keys.search(key):
            toasts.add(val_clean)
        if error_keys.search(key):
            errors.add(val_clean)
        if button_keys.search(key) and len(val_clean) < 50:
            buttons.add(val_clean)
        if heading_keys.search(key) and len(val_clean) < 60:
            headings.add(val_clean)
        # Collect short, UI-visible strings with their keys for locale mapping table
        if selector_keys.search(key) and len(val_clean) < 60 and len(val_clean) > 1:
            locale_key_pairs.append((key, val_clean))

    # Deduplicate locale_key_pairs by key, sort by key
    seen_keys = set()
    deduped_locale = []
    for k, v in sorted(locale_key_pairs, key=lambda x: x[0]):
        if k not in seen_keys:
            seen_keys.add(k)
            deduped_locale.append((k, v))

    return {
        'toasts': sorted(toasts),
        'errors': sorted(errors)[:30],
        'buttons': sorted(buttons)[:40],
        'headings': sorted(headings)[:20],
        'locale_keys': deduped_locale[:60],  # top 60 most useful key→value pairs
    }


def scan_page_routes(src_dir: Path) -> list[tuple[str, str]]:
    """Extract route paths with their source file paths for navigation context."""
    patterns = [
        re.compile(r'path=["\'\`](\/[^"\'\`\s{$][^"\'\`]*)["\'\`]'),
        re.compile(r'to=["\'\`](\/[^"\'\`\s{$][^"\'\`]*)["\'\`]'),
        re.compile(r'navigate\(["\'\`](\/[^"\'\`\s{$][^"\'\`]*)["\'\`]'),
    ]
    route_files: dict[str, str] = {}  # route → first source file found
    for f in walk_src(src_dir):
        content = f.read_text(encoding='utf-8', errors='ignore')
        for pat in patterns:
            for match in pat.findall(content):
                if len(match) > 1 and '{' not in match and '$' not in match:
                    if match not in route_files:
                        route_files[match] = str(f)
    return sorted(route_files.items())


# ── Generator ────────────────────────────────────────────────────────────────

def generate_md(app_key: str, app_name: str, data: dict) -> str:
    routes = data.get('routes', [])
    route_files = data.get('route_files', [])  # list of (route, filepath)
    test_ids = data.get('test_ids', [])
    nav_links = data.get('nav_links', [])
    toasts = data.get('toasts', [])
    errors = data.get('errors', [])
    buttons = data.get('buttons', [])
    headings = data.get('headings', [])
    locale_keys = data.get('locale_keys', [])
    source_files = data.get('source_files', [])  # list of full file paths for this page
    page_name = data.get('page_name', '')  # e.g. "ImageManager"

    lines = [
        f'# {app_name} — App Context',
        f'',
        f'> Auto-extracted by `app-context-extractor` on {date.today().isoformat()}.',
        f'> Re-generated automatically on every context-sync. Do NOT edit manually.',
        f'',
    ]

    # ── Source Files (with full paths) ────────────────────────────────────────
    if source_files:
        lines += ['## Source Files (full paths)', '']
        lines += ['These files contain the page logic. Pass to AI when deep source analysis needed.', '```']
        for sf in source_files:
            lines.append(sf)
        lines += ['```', '']

    # ── Navigation ────────────────────────────────────────────────────────────
    lines += ['## Navigation', '']
    if route_files:
        lines += ['**Routes found (route → source file):**', '']
        lines += ['| Route | Source file |', '|---|---|']
        for route, fpath in route_files[:20]:
            # Show relative path from src root if possible
            lines.append(f'| `{route}` | `{fpath}` |')
        lines.append('')
    elif routes:
        lines += ['**Routes found:**']
        for r in routes[:20]:
            lines.append(f'- `{r}`')
        lines.append('')

    lines += [
        '**Navigation patterns:**',
        '```typescript',
        '// Navigate via URL (most reliable — avoids disabled nav links)',
        '// Pattern: https://admin.shopify.com/store/{handle}/apps/{appHandle}/embed/{route}',
        '',
        '// Switch tabs — use getByRole("tab") NOT getByText (avoids hidden Polaris span matches)',
        'await frame.getByRole("tab", { name: /Tab Label/i }).click();',
        '',
        '// Wait for page heading after navigation',
        'await frame.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 20000 });',
        '```',
        '',
    ]

    # ── Pages & Nav Links ─────────────────────────────────────────────────────
    lines += ['## Pages & Nav Links (Shopify Admin sidebar)', '']
    lines += ['| Nav label (verify exact text) | Notes |', '|---|---|']
    if nav_links:
        for link in nav_links:
            lines.append(f'| `"{link}"` | Outside iframe — use `page.getByRole("link")` |')
    else:
        lines.append('| _(auto-extract failed — check sidebar manually)_ | |')
    lines.append('')

    # ── Locale Key Mappings ───────────────────────────────────────────────────
    if locale_keys:
        lines += [
            '## Locale Key Mappings (use tRegex/tLoc — never hardcode text!)',
            '',
            '> The store may render in any language (DE, FR, VI...). Always use locale helpers:',
            '> - `tLoc("key")` → Playwright `text=/locale|english/i` locator string',
            '> - `tRegex("key")` → RegExp matching all locales',
            '> - `t("key")` → current locale string',
            '',
            '| i18n key | English value |',
            '|---|---|',
        ]
        for key, val in locale_keys:
            # Escape pipes in values
            val_escaped = val.replace('|', '\\|')
            lines.append(f'| `{key}` | {val_escaped} |')
        lines.append('')

    # ── Toast messages ────────────────────────────────────────────────────────
    if toasts:
        lines += ['## Toast / Success Messages (exact text)', '```']
        for t in toasts:
            lines.append(f'"{t}"')
        lines += ['```', '']

    # ── Error messages ────────────────────────────────────────────────────────
    if errors:
        lines += ['## Error / Warning Messages', '```']
        for e in errors:
            lines.append(f'"{e}"')
        lines += ['```', '']

    # ── Button labels ─────────────────────────────────────────────────────────
    if buttons:
        lines += ['## Button / Action Labels', '```']
        for b in buttons:
            lines.append(f'"{b}"')
        lines += ['```', '']

    # ── Headings ──────────────────────────────────────────────────────────────
    if headings:
        lines += ['## Page Headings', '```']
        for h in headings:
            lines.append(f'"{h}"')
        lines += ['```', '']

    # ── Test IDs ──────────────────────────────────────────────────────────────
    if test_ids:
        lines += ['## data-testid (use getByTestId)', '```']
        for tid in test_ids:
            lines.append(tid)
        lines += ['```', '']

    # ── Polaris / Shopify UI Patterns ─────────────────────────────────────────
    lines += [
        '## Polaris UI Patterns & Selector Notes',
        '',
        '### Iframe boundary',
        '- App content is inside `iframe[name="app-iframe"]` — **always** use `frame.locator()` for app UI',
        '- Shopify Admin shell (nav, Sidekick, save bar) — use `page.locator()`',
        '',
        '### Known always-present overlays (exclude from dialog assertions)',
        '- **Sidekick**: `[role="dialog"][id="sidekick"]` — always in DOM, NOT a confirmation modal',
        '  → Filter with: `page.locator(\'[role="dialog"]:not(#sidekick)\')`',
        '- **Dev Console**: button `"Close Dev Console"` — close if needed: `page.getByRole("button", { name: "Close Dev Console" })`',
        '',
        '### Polaris IndexTable (image/product lists)',
        '- Rows: `frame.locator(\'[role="rowgroup"]\').last().locator(\'[role="row"]\')`',
        '- Checkboxes are **visually hidden** until hover — use `{ force: true }` to click:',
        '  ```typescript',
        '  await frame.locator(\'input[type="checkbox"]\').nth(1).click({ force: true }); // nth(0) = select-all',
        '  ```',
        '- Sort button opens a **popover** with radio options — click sort button then select radio:',
        '  ```typescript',
        '  await frame.getByRole("button", { name: /sort/i }).click();',
        '  await frame.getByRole("radio", { name: /Date|Datum/i }).click();',
        '  ```',
        '',
        '### Polaris Tabs',
        '- **Always use `getByRole("tab")`** — `getByText()` or `text=/regex/` will match hidden tab spans',
        '  and cause strict mode violations (multiple matches):',
        '  ```typescript',
        '  // ❌ WRONG — matches tab span + heading + status text',
        '  frame.locator("text=/Compression/i").click()',
        '  // ✅ CORRECT',
        '  frame.getByRole("tab", { name: /Compression|Kompression/i }).click()',
        '  ```',
        '',
        '### Common selectors',
        '```typescript',
        'frame.locator(\'[role="alert"]\').first()          // Toast',
        'frame.locator(\'[role="progressbar"]\')            // Progress bar',
        'frame.locator(\'[class*="Skeleton" i]\').first()   // Loading skeleton',
        'frame.getByRole("heading", { level: 1 })          // Page title (waitForLoad)',
        'page.locator(\'[role="dialog"]:not(#sidekick)\')   // Real dialogs only',
        '```',
        '',
    ]

    return '\n'.join(lines)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Extract app context for shopify-test-gen')
    parser.add_argument('--app-key', required=True, help='camelCase key, e.g. avadaPlaza')
    parser.add_argument('--app-name', required=True, help='Human readable name, e.g. "Avada Plaza"')
    parser.add_argument('--src', required=True, help='Path to app source root')
    parser.add_argument('--locale', help='Path to origin.json locale file (auto-detected if omitted)')
    parser.add_argument('--out', help='Output .md path (default: stdout)')
    parser.add_argument('--split-by-page', action='store_true',
                        help='Split output into one file per pages/ subfolder instead of single file')
    args = parser.parse_args()

    src_dir = Path(args.src)
    if not src_dir.exists():
        print(f'❌ Source dir not found: {src_dir}', file=sys.stderr)
        sys.exit(1)

    locale_path = Path(args.locale) if args.locale else src_dir / 'locale/translations/origin.json'

    print(f'🔍 Scanning {src_dir}...', file=sys.stderr)

    test_ids = scan_test_ids(src_dir)
    routes = scan_routes(src_dir)
    nav_links = scan_nav_links(src_dir)
    locale_data = scan_locale(locale_path)

    print(f'  test-ids : {len(test_ids)}', file=sys.stderr)
    print(f'  routes   : {len(routes)}', file=sys.stderr)
    print(f'  nav links: {len(nav_links)}', file=sys.stderr)
    print(f'  toasts   : {len(locale_data["toasts"])}', file=sys.stderr)
    print(f'  errors   : {len(locale_data["errors"])}', file=sys.stderr)
    print(f'  buttons  : {len(locale_data["buttons"])}', file=sys.stderr)

    route_files = scan_page_routes(src_dir)

    md = generate_md(args.app_key, args.app_name, {
        'routes': routes,
        'route_files': route_files,
        'test_ids': test_ids,
        'nav_links': nav_links,
        **locale_data,
    })

    if args.split_by_page:
        # Split mode: one .scanned.md per pages/ subfolder
        pages_dir = src_dir / 'pages'
        if not pages_dir.exists():
            print(f'❌ pages/ dir not found at {pages_dir}', file=sys.stderr)
            sys.exit(1)

        out_dir = Path(args.out) if args.out else Path(f'skills/shopify-test-gen/references/app-context/{args.app_key}')
        out_dir.mkdir(parents=True, exist_ok=True)

        page_folders = sorted([d for d in pages_dir.iterdir() if d.is_dir()])
        print(f'  Splitting into {len(page_folders)} page files...', file=sys.stderr)

        for page_folder in page_folders:
            page_locale = scan_locale(locale_path)
            page_test_ids = scan_test_ids(page_folder)
            page_route_files = scan_page_routes(page_folder)
            page_routes = [r for r, _ in page_route_files]

            # Collect all source file paths for this page folder
            page_source_files = sorted([str(f) for f in walk_src(page_folder)])

            page_md = generate_md(args.app_key, f'{args.app_name} / {page_folder.name}', {
                'routes': page_routes,
                'route_files': page_route_files,
                'test_ids': page_test_ids,
                'nav_links': [],
                'source_files': page_source_files,
                'page_name': page_folder.name,
                **page_locale,
            })

            slug = re.sub(r'(?<=[a-z])(?=[A-Z])', '-', page_folder.name).lower()
            page_file = out_dir / f'{slug}.scanned.md'
            page_file.write_text(page_md, encoding='utf-8')
            print(f'  ✅ {page_file.name} ({len(page_test_ids)} test-ids, {len(page_routes)} routes, {len(page_source_files)} files)', file=sys.stderr)

        print(f'\n✅ Split into {len(page_folders)} files in {out_dir}', file=sys.stderr)
        print(f'✅ .scanned.md files are auto-generated — used directly by pipeline', file=sys.stderr)

    elif args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(md, encoding='utf-8')
        print(f'\n✅ Saved: {out_path}', file=sys.stderr)
        print(f'\n💡 Review file và chạy: npm run test:generate', file=sys.stderr)
    else:
        print(md)


if __name__ == '__main__':
    main()
