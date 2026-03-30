---
app: seo
page: seo-checklist
url: /seoChecklist
source: pages/Analysis/
product_spec: avada-seo-suite/features/Feature specification document/SEO checklist/shop-seo-checklist.md
---

# SEO Checklist

## Navigation

Nav link text: `"SEO Checklist"` or `"SEO checklist"`
URL: `/seoChecklist` or `/analysis/seoChecklist`

## Page Structure

| Section | Description |
|---|---|
| Overall Score card (left) | Gauge chart 0–100 + Re-scan button + issue count |
| Category tabs (right) | Content / Accessibility / Performance tabs with donut charts |
| Issue list | Grouped by severity: Issue (red) / Good result (green) / Cannot detected (gray) |

## Buttons (exact labels — from product spec)

| Button | Context | Action |
|---|---|---|
| `"Re-scan"` | Overall Score card | Trigger new scan (has cooldown) |
| `"Enable"` | Issue CTA — generic enable | Enable app feature |
| `"Enable meta rule"` | Meta title/description issues | Enable meta automation |
| `"View"` | Broken links, JS errors, large videos | Navigate to detail list |
| `"Optimize"` | Image issues | Navigate to image optimization |
| `"Optimize URL"` | URL optimization | Navigate to URL settings |
| `"Create blog"` | Blog integration issue | Navigate to blog creation |
| `"Update"` | Favicon issue | Navigate to favicon settings |
| `"Contact us"` | H1 tag, LCP, canonical | Open support chat |

## Severity Groups

```
Issue (red, expand by default)        — needs fixing
Good result (green, collapsed)        — already passing
Cannot detected (gray, collapsed)     — can't check (store password, etc.)
```

## Key UI Elements & Selectors

```typescript
// Overall Score card
frame.locator('[class*="overall" i], [class*="score-card" i]').first()

// Score number (0-100)
frame.locator('[class*="gauge" i] [class*="score" i]').first()

// Re-scan button
frame.getByRole('button', { name: /re-scan|rescan/i })

// Category tabs
frame.getByRole('tab', { name: 'Content' })
frame.getByRole('tab', { name: 'Accessibility' })
frame.getByRole('tab', { name: 'Performance' })

// Issue severity groups (accordion)
frame.getByText('Issue').first()           // red group header
frame.getByText('Good result').first()     // green group header
frame.getByText('Cannot detected').first() // gray group header

// Individual CTA buttons
frame.getByRole('button', { name: 'Enable meta rule' })
frame.getByRole('button', { name: /view/i }).first()
frame.getByRole('link',   { name: /enable/i }).first()

// Task count
frame.getByText(/Task to solve/i)
frame.getByText(/critical issue/i)
```

## i18n Keys

| Key | Value |
|---|---|
| `Home.checklist.rescan2` | `"Rescan"` |
| `Home.checklist.rescan` | `"Re-scan"` |
| `Issue.checklist.metaTitle.success` | `"Meta title is set up for all pages."` |
| `Issue.checklist.metaTitle.error` | `"Meta title is missing."` |
| `Issue.checklist.metaTitleLength.success` | `"All the meta title have a good length."` |
| `Issue.checklist.metaDescription.success` | `"Meta description is set up for all pages."` |
| `Issue.checklist.duplicateTitle.success` | `"All pages have only one title tag"` |

## Common Test Flows

### Smoke: Checklist page loads
1. Navigate to app → `/seoChecklist`
2. Wait for iframe load
3. Assert: Overall Score card visible (gauge)
4. Assert: 3 category tabs visible (Content, Accessibility, Performance)
5. Assert: Issue list visible with at least one group

### Flow: Navigate between categories
1. Load checklist page
2. Click tab `"Content"` → assert donut chart visible
3. Click tab `"Accessibility"` → assert donut chart visible
4. Click tab `"Performance"` → assert donut chart visible

### Flow: Expand issue group
1. Load checklist page
2. Locate "Issue" group (red, expanded by default)
3. Assert: at least one issue item visible
4. Assert: CTA button visible on first item

### Flow: Re-scan
1. Load checklist page
2. Click `"Re-scan"` button
3. Assert: scanning state visible (toast or progress indicator)
4. (Note: cooldown may prevent immediate rescan — handle gracefully)

## Edge Cases

- Scan in progress: `"SEO Scan is in progress, the checklist will be updated when ready"`
- Store has password: many items show "Cannot detected" — gray group populated
- Re-scan cooldown: button may be disabled briefly after recent scan
- First scan: page may show loading state
