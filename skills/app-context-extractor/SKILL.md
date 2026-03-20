---
name: app-context-extractor
description: Extract structured app context from a Shopify app's source code to produce an input file for shopify-test-gen. Use when a developer wants to register a new app for test generation, or update an existing app's context after UI/feature changes. Reads source files (JSX/TSX/JS/TS) and locale JSON to extract routes, button labels, toast messages, test-ids, nav links, and loading states. Outputs a curated markdown context file at skills/shopify-test-gen/references/app-context/[appKey].md. Triggers on phrases like "đăng ký app mới để test", "cập nhật context cho app", "extract context", "add app to test gen", "register app for testing".
---

# App Context Extractor

Read a Shopify app's source code and produce a structured context file that `shopify-test-gen` uses to write accurate selectors.

## Workflow

### 1. Gather inputs

Ask the developer for (or read from args):
- **`appKey`** — camelCase key for the app (e.g. `avadaPlaza`, `seo`, `blogs`)
- **`appName`** — human readable (e.g. `Avada Plaza`)
- **`srcDir`** — absolute path to app source root (e.g. `/Users/avada/avada-image-optimizer/packages/assets/src`)
- **`localeFile`** — path to `origin.json` locale file (auto-detected if not given: `{srcDir}/locale/translations/origin.json`)

### 2. Run the extraction script

```bash
python3 skills/app-context-extractor/scripts/extract.py \
  --app-key avadaPlaza \
  --app-name "Avada Plaza" \
  --src /path/to/src \
  --locale /path/to/origin.json \
  --out skills/shopify-test-gen/references/app-context/avadaPlaza.md
```

The script produces a structured `.md` file. Review and verify the output.

### 3. Review & supplement manually

After the script runs, open the output file and:
- Verify nav link labels are exact (match Shopify Admin sidebar text)
- Add any missing pages/sections not in the source scan
- Add selector notes specific to this app (e.g. special iframe nesting)
- Remove false-positives (labels from internal/dev-only components)

### 4. Register app in helpers/apps.ts

If this is a new app, add it to the registry:

```typescript
// helpers/apps.ts
export const APPS = {
  avadaPlaza: { handle: process.env.AVADA_PLAZA_HANDLE ?? '', name: 'Avada Plaza', testDir: 'tests/avada-plaza' },
  newApp: { handle: process.env.NEW_APP_HANDLE ?? '', name: 'New App', testDir: 'tests/new-app' },
};
```

Also create `tests/new-app/.gitkeep` and add `NEW_APP_HANDLE` to `.env.example`.

### 5. Confirm to developer

```
✅ Context file created: skills/shopify-test-gen/references/app-context/avadaPlaza.md
   - X routes found
   - X toast messages extracted
   - X button labels extracted
   - X test-ids found

👉 Next: npm run test:generate
   AI will now use this context for accurate selectors.
```

## Output file format

The generated file follows this structure (see `references/output-format.md` for full spec):

```markdown
# [AppName] — App Context
## Pages & Nav Links
## Key UI Text
## Toast Messages
## Error Messages
## Loading States
## Selector Notes
```

## Reference

- Output format spec: `references/output-format.md`
- Example output: `references/example-output.md`
