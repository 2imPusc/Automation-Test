# Subscription — Feature Context

Page: `/subscription`
Source: `pages/Subscription/`

## Source Files
- packages/assets/src/pages/Subscription/Subscription.jsx
- packages/assets/src/pages/Subscription/Components/
- packages/assets/src/pages/Subscription/FreePlanCard.jsx

## Navigation

```typescript
// Usually via upgrade button or direct URL
await page.goto(`${ADMIN_BASE}/apps/${APPS.avadaPlaza.handle}/embed/subscription`);
```

## Key UI Text

### Buttons
```
"Activate"
"Activate Turbo"
"Upgrade"
"Downgrade"
"Contact us"
"Learn more"
```

### Toast / Success
```
"Plan updated successfully"
```

### Labels
```
"AI request"              ← usage counter
"Advanced settings"
```

## Selectors

```typescript
// Plan upgrade button
frame.getByRole('button', { name: 'Activate' })
frame.getByRole('button', { name: 'Upgrade' })

// Toast
frame.locator('[role="alert"]').first()
```
