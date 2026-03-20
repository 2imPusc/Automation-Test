---
name: shopify-test-gen
description: Generate Playwright automation tests for Shopify embedded apps from a natural language description (Vietnamese or English). Use when a tester describes a feature or user flow and wants test files created automatically. Produces Page Object files (helpers/pages/) and spec files (tests/) following the project's existing patterns. Triggers on phrases like "tạo test cho", "generate test", "viết test kiểm tra", "sinh test".
---

# Shopify Test Generator

Generate Playwright tests from a natural language description of a feature or flow.

## Workflow

### 1. Read context files (required before writing any code)

```
helpers/pages/BasePage.ts
helpers/pages/ImageManagerPage.ts   ← canonical POM example
helpers/apps.ts                     ← APPS registry + handles
helpers/shopify.ts                  ← goToApp(), ADMIN_BASE
fixtures/index.ts                   ← available fixtures
tests/avada-plaza/compress.spec.ts  ← canonical spec example
```

**If App Context is provided in the prompt:**
- This contains exact UI strings extracted from real source code — use them directly
- Toast assertions: use exact text from "Toast Messages" section (e.g. `"Settings updated successfully"`)
- Button selectors: use exact labels from "Button / Action Labels" section
- `data-testid`: use `getByTestId()` when available — most stable selector

**If UI Snapshots are provided in the prompt:**
- Prioritise button/input/link names from the DOM info — extracted from the real app
- Read the screenshot file to visually understand the UI layout
- Use exact text matches: `getByRole('button', { name: 'Optimize now' })` beats guessing
- Only fall back to CSS/attribute selectors if role+name is not unique

**Selector priority (highest → lowest):**
1. `getByTestId('...')` — if data-testid exists in App Context
2. `getByRole('button/link/...', { name: '...' })` — with exact label from App Context
3. `getByText('...')` — with exact text from App Context
4. `getByLabel('...')` — for form inputs
5. CSS selector — last resort only

### 2. Analyse the description

Identify: **which app** (avadaPlaza / seo / blogs), **which page/section**, **actions + assertions needed**, and **whether a Page Object already exists** in `helpers/pages/`.

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
- **Iframe selectors** — always use `frame.locator()`, never `page.locator()` for app content
- **Selector priority** — `getByRole()` > `getByText()` > `getByLabel()` > CSS (last resort)
- **Unsure about selector?** — add `// TODO: verify selector` comment and use best guess
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
  - helpers/pages/SettingsPage.ts  (new POM)
  - tests/avada-plaza/settings.spec.ts  (3 test cases)

📋 Test cases:
  1. Settings page loads correctly @smoke
  2. Save settings → success toast appears
  3. Required field empty → validation error shown

▶ Run:
  npx playwright test tests/avada-plaza/settings.spec.ts --headed
```

## Reference

- Templates (POM + spec): `references/templates.md`
- Example input/output: `references/examples.md`
