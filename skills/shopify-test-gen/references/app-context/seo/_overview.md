---
app: seo
branch: master
commit: (auto-updated by context-sync)
extracted_at: 2026-03-30
src: /Users/avada/seo/packages/assets/src
---

# Avada SEO Suite — Overview

> Read this file first. Then load the specific feature file for the page being tested.

## App Entry

- **APPS key:** `seo`
- **Handle:** `APPS.seo.handle` (from `helpers/apps.ts`)
- **Iframe selector:** `iframe[name="app-iframe"]`
- **Nav links:** outside iframe → `page.getByRole("link", { name: "..." })`
- **App content:** inside iframe → `frame.locator(...)` / `frame.getByRole(...)`
- **Sidekick:** `page.getByRole("button", { name: "Close Sidekick" })` — close before interacting

## Pages & Feature Files

| Nav label (exact) | URL path | Feature file | Product spec folder |
|---|---|---|---|
| `"Dashboard"` | `/` | `dashboard.md` | Dashboard |
| `"SEO Checklist"` | `/seoChecklist` or `/analysis/seoChecklist` | `seo-checklist.md` | SEO checklist |
| `"Image optimization"` | `/image-optimization` | `image-optimization.md` | Image optimization |
| `"Speed up"` | `/speed-up` | `speed-up.md` | Speed up |
| `"Broken links"` | `/redirect-404` | `broken-links.md` | Broken link manager |
| `"Structured data"` | `/structuredV2` | `structured-data.md` | Google structured data |
| `"Search appearance"` | `/search` | `search-appearance.md` | Search appearance |
| `"SEO tools"` | `/seo-tool` | `seo-tools.md` | SEO tools |
| `"Settings"` | `/settings` | `settings.md` | Settings |
| `"Subscription"` | `/subscription` | `subscription.md` | _(no spec)_ |

### Sub-pages

| Section | URL path | Feature file |
|---|---|---|
| Image SEO (alt text) | `/search/image-seo` | `image-optimization.md` |
| Optimize history | `/image-optimization/optimize-history` | `image-optimization.md` |
| Script manager | `/script-manager` | `speed-up.md` |
| Google Search Console | `/seo-tool/google` | `seo-tools.md` |
| Sitemap | `/seo-tool/sitemap` | `seo-tools.md` |
| Social tags | `/search/social` | `search-appearance.md` |
| Meta rules | `/search/meta-rule` | `search-appearance.md` |
| SEO Audit (On-page) | `/seoOnPage` | `seo-audit.md` |

## Common Polaris Selectors (all pages)

```typescript
// Toast notification
frame.locator('[role="alert"]').first()

// Loading skeleton
frame.locator('[class*="Skeleton" i]').first()

// Modal/dialog (exclude Sidekick)
frame.locator('[role="dialog"]:not(#sidekick)').first()
// or page-level modal:
page.locator('[role="dialog"]:not(#sidekick)').first()

// Progress bar
frame.locator('[role="progressbar"]')

// Polaris Tabs — NEVER use getByText for tabs
frame.getByRole('tab', { name: 'Tab Name' })

// Polaris ActionList item
frame.getByRole('button', { name: /action text/i })
```

## Source Structure

```
packages/assets/src/
├── pages/          ← Page components (Home, Audit, Image, SpeedUp...)
├── components/     ← Shared UI components
├── hooks/          ← Custom React hooks
├── locale/translations/origin.json  ← All i18n keys
└── routes.js       ← Route definitions
```

## Scanned Context

Auto-scanned DOM data available at: `seo.scanned.md`
Contains: 231 toast messages, 517 button labels extracted from source code.
