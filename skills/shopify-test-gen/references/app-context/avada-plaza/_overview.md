# Avada Plaza — Overview

> Read this file first. Then load the specific feature file for the page being tested.

## App Entry

- **APPS key:** `avadaPlaza`
- **Handle:** `APPS.avadaPlaza.handle` (from `helpers/apps.ts`)
- **Iframe selector:** `iframe[name="app-iframe"]`
- **Nav links:** outside iframe → `page.getByRole("link", { name: "..." })`
- **App content:** inside iframe → `frame.locator(...)` / `frame.getByRole(...)`
- **Sidekick:** `page.getByRole("button", { name: "Close Sidekick" })` — close before interacting

## Pages & Feature Files

| Nav label (exact) | URL | Feature file | Source folder |
|---|---|---|---|
| `"Dashboard"` | `/` | _(no file, minor page)_ | `pages/Home` |
| `"Image manager"` | `/image-manager` | `image-manager.md` | `pages/ImageManager` + `pages/ManualCompression` |
| `"Speed up ⚡"` | `/speed-up` | `speed-up.md` | `pages/SpeedUp` + `pages/ScriptManager` |
| `"Notification"` | `/notification` | _(no file)_ | `pages/Notification` |
| Subscription | `/subscription` | `subscription.md` | `pages/Subscription` |

### Sub-pages inside Image Manager (tabs)

| Tab label | URL | Feature file |
|---|---|---|
| Compression tab | `/image-manager/compression` | `image-manager.md` |
| Alt text optimizer | `/image-manager/alt-text-optimizer` | `image-seo.md` |

### Sub-pages inside Speed Up

| Section | Feature file |
|---|---|
| Script manager | `speed-up.md` |
| Asset optimization | `speed-up.md` |
| Site speed up | `speed-up.md` |

## Common Polaris Selectors (all pages)

```typescript
// Toast notification
frame.locator('[role="alert"]').first()
frame.locator('[class*="Polaris-Toast" i]').first()

// Loading skeleton
frame.locator('[class*="Skeleton" i]').first()

// Progress bar
frame.locator('[role="progressbar"]')

// Modal/dialog
frame.locator('[role="dialog"]')

// Contextual save bar (Shopify, outside iframe)
page.getByText('Unsaved changes')
page.getByRole('button', { name: 'Save' })     // save bar save
page.getByRole('button', { name: 'Discard' })  // save bar discard
```

## Instruction for shopify-test-gen

After reading this overview:
1. Identify which page/feature the tester's description refers to
2. Load **only** the corresponding feature file
3. Do NOT load other feature files — they are unnecessary context
