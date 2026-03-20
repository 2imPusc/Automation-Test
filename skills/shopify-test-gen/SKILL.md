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

**Step 1c — UI snapshots (if provided in prompt):**
- Use button/input/link names from DOM info — extracted from real app
- Read the screenshot file to visually understand the UI layout

**Selector priority (highest → lowest):**
1. `getByTestId('...')` — if data-testid in App Context
2. `getByRole('button/link/...', { name: '...' })` — exact label from App Context
3. `getByText('...')` — exact text from App Context
4. `getByLabel('...')` — for form inputs
5. CSS selector — last resort only

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

### 5. Validate

```bash
npx playwright test --list
```

Fix any TypeScript/syntax errors before reporting.

### 6. Report summary

```
✅ Created:
  - helpers/pages/ImageManagerPage.ts  (updated POM)
  - tests/avada-plaza/compress.spec.ts  (3 test cases)

📋 Test cases:
  1. Image Manager loads correctly @smoke
  2. Optimize all → toast "Optimization started" appears
  3. Select image → Compress → toast "Image optimized successfully"

▶ Run:
  npx playwright test tests/avada-plaza/compress.spec.ts --headed
```

## Reference

- Templates (POM + spec): `references/templates.md`
- Example input/output: `references/examples.md`
