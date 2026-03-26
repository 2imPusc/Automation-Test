---
name: shopify-test-gen
description: Generate Playwright automation tests for Shopify embedded apps from a natural language description (Vietnamese or English). Use when a tester describes a feature or user flow and wants test files created automatically. Produces Page Object files (helpers/pages/) and spec files (tests/) following the project's existing patterns. Triggers on phrases like "tạo test cho", "generate test", "viết test kiểm tra", "sinh test".
---

# Shopify Test Generator

Generate Playwright tests from a natural language description of a feature or flow.

## Workflow

### 1. Read context files (required before writing any code)

**Step 1a — codebase patterns (always):**
```
helpers/pages/BasePage.ts
helpers/pages/ImageManagerPage.ts   ← canonical POM example
helpers/apps.ts                     ← APPS registry + handles
helpers/shopify.ts                  ← goToApp(), ADMIN_BASE
fixtures/index.ts                   ← available fixtures
tests/avada-plaza/compress.spec.ts  ← canonical spec example
```

**Step 1b — app context (progressive disclosure):**

1. Read `skills/shopify-test-gen/references/app-context/[app-folder]/_overview.md`
   → understand which pages exist, which feature file maps to the request
2. Load **only** the one matching feature file (e.g. `image-manager.md`)
   → do NOT load all feature files — other pages are irrelevant noise

App context folder per app:
- Avada Plaza → `references/app-context/avada-plaza/`
- SEO → `references/app-context/seo/` _(if exists)_
- Blogs → `references/app-context/blogs/` _(if exists)_

**Step 1c — scanned DOM context (if exists):**
Check if `[feature].scanned.md` exists in the app-context folder.
These files contain **real DOM analysis** from the running app — they are MORE RELIABLE than
source code context when they exist.

When scanned data conflicts with source code context, **TRUST scanned data**.

**Step 1d — snapshot / probe data (if provided in prompt or in `snapshots/`):**
- Read `snapshots/[app]/[page].json` — contains selector-ready DOM data:
  - `interactables[]` — all clickable elements with recommended Playwright selectors
  - `testIds[]` — all data-testid attributes
  - `roles[]` — all ARIA role elements
  - `components[]` — Avada/Polaris custom component classes
- Read `snapshots/probe-[app]-[page].json` if it exists — targeted element probe data
- Use the `selectors[]` array from snapshot data — they are **pre-ranked best → worst**
- Read the screenshot file to visually understand the UI layout

**Selector priority (highest → lowest) — MUST follow this order:**
1. `getByTestId('...')` — if data-testid found in snapshot/scanned data
2. `getByRole('button/link/...', { name: tRegex('i18n.key') })` — role + i18n name
3. `frame.locator('.Avada-ClassName')` — Avada custom component class (stable, app-specific)
4. `getByLabel('...')` — for form inputs with labels
5. `frame.locator(tLoc('i18n.key')).first()` — i18n text locator (ONLY with `.first()`)
6. CSS selector — last resort only

**⚠️ Selector anti-patterns (NEVER do these):**
- `getByText()` for Polaris Tabs — renders hidden spans → strict mode violation
- `tLoc()` without `.first()` — may match multiple elements
- `page.locator()` for anything inside the iframe — must use `frame.locator()`
- `frame.locator('.Polaris-*')` alone — fragile, changes on Polaris upgrade

### 2. Analyse the description

Identify: **which app**, **which page/feature** (use `_overview.md` to map), **actions + assertions needed**, **existing POM** in `helpers/pages/`.

### 3. Decide what to create

| Situation | Action |
|---|---|
| POM doesn't exist | Create `helpers/pages/[Name]Page.ts` + spec file |
| POM exists | Create spec file only, import existing POM |
| `imageManager` fixture covers it | Import `test` from `../../fixtures` |

### 4. Write files

Follow the templates in `references/templates.md`.

Key rules:
- **Never hardcode handles** — use `APPS.[key].handle` from `helpers/apps.ts`
- **Never hardcode store URL** — use `ADMIN_BASE` from `helpers/shopify.ts`
- **Iframe selectors** — always `frame.locator()`, never `page.locator()` for app content
- **Toast text** — use exact string from feature file's "Toast Messages" section
- **Button name** — use exact label from feature file's "Buttons" section
- **Wrap actions in `test.step()`** — improves HTML report readability
- **Tag first test `@smoke`** — included in `npm run test:smoke`
- **Add `console.log('✅ ...')`** after each milestone

### 5. Validate (syntax check)

```bash
npx playwright test --list
```

Fix any TypeScript/syntax errors before proceeding.

### 6. Selector verification (REQUIRED — run test, fix, retry)

**Do NOT report "done" until this step passes.**

```bash
npx playwright test [spec-file] --retries=0 --reporter=list 2>&1 | head -60
```

**If test passes** → proceed to step 7.

**If test fails** → diagnose and fix:
1. Read the error message — identify which selector failed
2. Check: is it a `selector` issue (element not found), `timing` issue (timeout), or `state` issue?
3. For selector failures:
   - Run `npm run probe -- --app [app] --page [page] --query "[element text]"` to get correct selector from live DOM
   - Or read `snapshots/probe-[app]-[page].json` if probe was already run
   - Replace the broken selector with the probe-recommended one
4. Re-run the test
5. Maximum 3 retry cycles. If still failing after 3 retries, report the failure with diagnosis.

### 7. Report summary

```
✅ Created:
  - helpers/pages/ImageManagerPage.ts  (updated POM)
  - tests/avada-plaza/compress.spec.ts  (3 test cases)

📋 Test cases:
  1. Image Manager loads correctly @smoke
  2. Optimize all → toast "Optimization started" appears
  3. Select image → Compress → toast "Image optimized successfully"

🧪 Verification: X/Y tests passed (ran with --retries=0)
   [If any failed: brief diagnosis + what was tried]

▶ Run:
  npx playwright test tests/avada-plaza/compress.spec.ts --headed
```

## Reference

- Templates (POM + spec): `references/templates.md`
- Example input/output: `references/examples.md`
