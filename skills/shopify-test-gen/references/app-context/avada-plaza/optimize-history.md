# Optimize History — Feature Context

Page: `/optimize-history` (via Compression History in nav or link from Image Manager)
Source: `pages/OptimizeHistory/`

## Source Files
- packages/assets/src/pages/OptimizeHistory/OptimizeHistory.js

## Navigation

```typescript
// Via nav (if visible)
await page.getByRole('link', { name: 'Compression History' }).click();
// Or via link inside Image Manager
await frame.getByRole('link', { name: 'ALT text optimization history' }).click();
```

## Key UI Text

### Page heading
```
"Compression History"
```

### Table headers
```
"Session" | "Status" | "Total images" | "Size before" | "Size after" | "Size saved" | "Finished at"
```

### Optimize type labels
```
"Optimize type"
"Automatically Optimized"
"Manually Optimized"
```

### Status badges
```
"Completed" | "Processing" | "Preparing" | "Error"
```

### Empty state
```
"No history found"
```

### Pagination
```
"Items per page"
"Total: 1 item" / "Total: {num} items"
```

## Selectors

```typescript
// Page heading
frame.getByText('Compression History')

// Status filter
frame.getByRole('combobox', { name: 'Status' })

// Empty state
frame.getByText('No history found')

// Table rows
frame.getByRole('row')
```
