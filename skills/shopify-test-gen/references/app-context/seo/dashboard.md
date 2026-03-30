---
app: seo
page: dashboard
url: /
source: Home/Home.js
product_spec: avada-seo-suite/features/Feature specification document/Dashboard/dashboard.md
---

# SEO Dashboard (Home)

## Navigation

Nav link text (outside iframe): `"Dashboard"` or `"Home"`
URL: `/`

## Page Structure

| Section | Description |
|---|---|
| Greeting header | "Hi [Name]!" + plan badge + AI credits + Upgrade link |
| SEO Score card (left) | Gauge chart 0–100 + "View checklist" button |
| Troubleshooting card (right) | Accordion list of issues with "Fix" buttons |
| Detailed Report | 3 metric cards: Performance, Accessibility, Content |
| Onboarding checklist | "Get started with SEO Suite Pro" — 6 task steps |
| Insights | Blog posts / tutorials |
| Support | Chat / guide links |

## Buttons (exact labels)

| Button | Location | Action |
|---|---|---|
| `"View checklist"` | SEO Score card | Navigate to /seoChecklist |
| `"Fix"` | Troubleshooting accordion items | Navigate to fix page |
| `"Upgrade"` | Greeting header / AI credits | Navigate to subscription |
| `"Activate Turbo"` | Onboarding task 1 | Enable Turbo mode |
| `"Re-scan"` | SEO Score card | Trigger new SEO scan |
| `"Chat with us"` | Support card | Open Crisp chat |
| `"Read guide"` | Support card | Open docs link |
| `"Watch now"` | Insights section | Open video link |

## Key UI Elements & Selectors

```typescript
// SEO Score gauge — look for score number
frame.locator('[class*="gauge" i]')
frame.locator('[class*="score" i]').first()

// "View checklist" button
frame.getByRole('button', { name: /view checklist/i })
// or link version:
frame.getByRole('link', { name: /view checklist/i })

// Onboarding checklist card title
frame.getByText('Get started with SEO Suite Pro')

// Progress bar in onboarding
frame.locator('[role="progressbar"]')

// Troubleshooting accordion items
frame.locator('[class*="accordion" i]').first()
frame.locator('[class*="Troubleshoot" i]')

// Metric cards (Performance, Accessibility, Content)
frame.getByText('Performance').first()
frame.getByText('Accessibility').first()
frame.getByText('Content').first()
```

## i18n Keys (locale/translations/origin.json)

| Key | Value |
|---|---|
| `Home.checklist.rescan` | `"Re-scan"` |
| `Home.checklist.viewChecklist` | `"View checklist"` |
| `AppStatus.Button.enabled` | `"Enable now"` |

## Common Test Flows

### Smoke: Dashboard loads
1. Navigate to app → `/`
2. Wait for iframe to load
3. Assert: SEO Score card visible (gauge chart)
4. Assert: "View checklist" button visible
5. Assert: Onboarding checklist card visible

### Flow: Navigate to checklist
1. Load dashboard
2. Click `"View checklist"` button
3. Assert: URL changes to `/seoChecklist`
4. Assert: SEO Checklist page renders

### Flow: Check troubleshooting section
1. Load dashboard
2. Assert: Troubleshooting card present
3. Click first accordion item
4. Assert: Detail content expands
5. Assert: "Fix" button visible

## Edge Cases

- First-time visit: scan in progress → show "SEO Scan is in progress, the checklist will be updated when ready"
- Store has password: some checks show "Cannot detected"
- Free plan: "Upgrade" CTA prominent in header
