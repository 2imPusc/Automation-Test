# Image SEO / Alt Text Optimizer — Feature Context

Page: `/image-manager/alt-text-optimizer`
Source: `pages/ImageSEO/`, `pages/ImageSEOManual/`

## Source Files
- packages/assets/src/pages/ImageSEO/ImageSEO.js
- packages/assets/src/pages/ImageSEO/ImageSEOContent/
- packages/assets/src/pages/ImageSEO/ImageSEOHistory/
- packages/assets/src/pages/ImageSEO/Banner/

## Navigation

```typescript
await page.getByRole('link', { name: 'Image manager' }).click();
await frame.getByRole('link', { name: 'Alt text optimizer' }).click();
```

## Key UI Text

### Buttons & CTAs
```
"ALT text optimizer"             ← page heading
"Alt text manager"               ← section/tab label
"Optimize alt"                   ← action button
"Revert alt"                     ← revert action
"ALT text optimization history"  ← history link
"AI request"                     ← AI usage counter label
```

### Settings
```
"Image quality"
"Apply for"
"Product images"
"Collection images"
"Blog images"
"Only published product images"
"All product images"
```

### Compression Levels
```
"Automatic - 92%"
"High - 80%"
"Medium - 70%"
"Low - 50%"
```

### Toast / Success
```
"Settings updated successfully"
"Save successfully"
"Saved successfully"
```

### Error
```
"An error occurred while saving settings. Please try again."
"You have reached the limit of meta generation."
```

### Empty State
```
"No images to optimize"
```

## Selectors

```typescript
// Alt text tab
frame.getByRole('link', { name: 'Alt text optimizer' })

// Optimize alt button
frame.getByRole('button', { name: 'Optimize alt' })

// Save settings
frame.getByRole('button', { name: 'Save' })

// Toast
frame.locator('[role="alert"]').first()
```
