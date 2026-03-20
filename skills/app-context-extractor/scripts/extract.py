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
    """Extract categorised strings from locale JSON."""
    if not locale_file.exists():
        return {'toasts': [], 'errors': [], 'buttons': [], 'headings': []}

    data = json.loads(locale_file.read_text(encoding='utf-8'))
    flat = flatten_json(data)

    toast_keys = re.compile(r'toast|success|done|finish|complet|saved|updated|revert', re.I)
    error_keys = re.compile(r'error|fail|invalid|wrong|warning|cooldown|wait', re.I)
    button_keys = re.compile(r'button|btn|action|label|cta|title|Button', re.I)
    heading_keys = re.compile(r'title|heading|header|Title', re.I)

    toasts, errors, buttons, headings = set(), set(), set(), set()

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

    return {
        'toasts': sorted(toasts),
        'errors': sorted(errors)[:30],
        'buttons': sorted(buttons)[:40],
        'headings': sorted(headings)[:20],
    }


# ── Generator ────────────────────────────────────────────────────────────────

def generate_md(app_key: str, app_name: str, data: dict) -> str:
    routes = data.get('routes', [])
    test_ids = data.get('test_ids', [])
    nav_links = data.get('nav_links', [])
    toasts = data.get('toasts', [])
    errors = data.get('errors', [])
    buttons = data.get('buttons', [])
    headings = data.get('headings', [])

    lines = [
        f'# {app_name} — App Context',
        f'',
        f'> Auto-extracted by `app-context-extractor` on {date.today().isoformat()}.',
        f'> Review manually: verify nav labels, remove false-positives, add missing pages.',
        f'',
    ]

    # Pages & Nav
    lines += ['## Pages & Nav Links', '']
    lines += ['| Nav label (verify exact text) | Notes |', '|---|---|']
    if nav_links:
        for link in nav_links:
            lines.append(f'| `"{link}"` | |')
    else:
        lines.append('| _(no nav links found — add manually)_ | |')
    if routes:
        lines += ['', '**Routes found:**']
        for r in routes[:20]:
            lines.append(f'- `{r}`')
    lines.append('')

    # Toast messages
    if toasts:
        lines += ['## Toast / Success Messages (exact text)', '```']
        for t in toasts:
            lines.append(f'"{t}"')
        lines += ['```', '']

    # Error messages
    if errors:
        lines += ['## Error / Warning Messages', '```']
        for e in errors:
            lines.append(f'"{e}"')
        lines += ['```', '']

    # Button labels
    if buttons:
        lines += ['## Button / Action Labels', '```']
        for b in buttons:
            lines.append(f'"{b}"')
        lines += ['```', '']

    # Headings
    if headings:
        lines += ['## Page Headings', '```']
        for h in headings:
            lines.append(f'"{h}"')
        lines += ['```', '']

    # Test IDs
    if test_ids:
        lines += ['## data-testid (use getByTestId)', '```']
        for tid in test_ids:
            lines.append(tid)
        lines += ['```', '']

    # Selector notes
    lines += [
        '## Selector Notes',
        '',
        '- App runs inside Shopify iframe — use `frame.locator()` not `page.locator()` for app content',
        '- Nav links are **outside** iframe (Shopify Admin sidebar): `page.getByRole("link", { name: "..." })`',
        '- Toast: `frame.locator(\'[role="alert"]\').first()`',
        '- Progress bar: `frame.locator(\'[role="progressbar"]\')`',
        '- Loading skeleton: `frame.locator(\'[class*="Skeleton" i]\').first()`',
        '- Sidekick (outside iframe): `page.getByRole("button", { name: "Close Sidekick" })`',
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

    md = generate_md(args.app_key, args.app_name, {
        'routes': routes,
        'test_ids': test_ids,
        'nav_links': nav_links,
        **locale_data,
    })

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(md, encoding='utf-8')
        print(f'\n✅ Saved: {out_path}', file=sys.stderr)
        print(f'\n💡 Review file và chạy: npm run test:generate', file=sys.stderr)
    else:
        print(md)


if __name__ == '__main__':
    main()
