# Image Manager — Feature Context

Pages: `/image-manager` (Compression tab) + `/image-manager/alt-text-optimizer`
Source: `pages/ImageManager/`, `pages/ManualCompression/`

## Source Files
<!-- Layer 1 đọc nội dung → Layer 3 dùng khi cần hiểu logic -->
- packages/assets/src/pages/ImageManager/ImageManager.js
- packages/assets/src/pages/ImageManager/Optimizer/
- packages/assets/src/pages/ImageManager/ImageCompression/
- packages/assets/src/pages/ManualCompression/ManualCompression.js
- packages/assets/src/pages/ManualCompression/CompressionTable/

## Navigation

**Important:** The Shopify Admin sidebar nav link is labeled **"Image optimizer"** (not "Image manager").
The app may also have overlays (Sidekick dialog, Dev Console) that must be closed first.

```typescript
// Navigate to Image Manager (nav link text is "Image optimizer")
await page.getByRole('link', { name: /image (manager|optimizer)/i }).first().click();

// Switch tabs
await frame.getByRole('link', { name: 'Compression' }).click();
await frame.getByRole('link', { name: 'Alt text optimizer' }).click();
```

## Compression Tab — Key UI Text

### Buttons & CTAs
```
"Optimize now"                    ← main CTA, opens optimize panel
"Optimize all"                    ← dropdown: optimize all images
"Optimize unoptimized"            ← dropdown: only unoptimized
"SAVE & OPTIMIZE"                 ← when settings unsaved
"Optimize manually"               ← switch to manual mode
"Compress image"                  ← action on selected image(s)
"Optimize all (alt + compress)"   ← bulk action in manual mode
"Revert all images"               ← revert CTA
"Revert"                          ← revert selected
"Revert alt"                      ← revert alt text only
```

### Statistics Labels (assertions)
```
"Total images"
"Original size"
"Optimized size"
"Size saved"
"Images optimized"
```

### Progress & Loading States
```
"Optimizing images"               ← optimizer running label
"Optimize in progress"            ← progress state text
"Preparing..."                    ← before start
"Calculating time remain..."
"Estimating finish date ..."
"{time} remaining"                ← countdown
"Revert in progress"              ← reverting state
```

### Toast Messages
```
"Optimization started"            ← after click optimize
"Optimize successfully"           ← bulk optimize done
"Your images have been optimized successfully"
"Image optimized successfully"    ← single image done
"Revert finished"                 ← after revert
"Revert successfully"
"Your images have been reverted successfully"
```

### Success Banner
```
"Optimize successfully"           ← banner title
"Your images have been optimized successfully"  ← banner body
"Revert successfully"
"Your images have been reverted successfully"
```

### Empty States
```
"No images to optimize"           ← no images in store
"No image in your store"
```

### Error / Warning
```
"Please wait 30 minutes until the next optimization"
"Please wait 30 minutes until the next reverting"
"Please wait for 30 minutes before starting optimize process again"
"Please wait {time} before optimizing again."
"Reverting image is running in the background. Please wait until images are reverted before starting optimization process."
```

### Notify Banner
```
"Optimization in progress. Get an email when it's done?"
"Notify me"                       ← action button
"We will send you an email whenever it's done"   ← confirmed state
```

## Manual Compression — Key UI Text

### Page heading
```
"Compression management"
```

### Table headers
```
"Image" | "Title" | "Type" | "Size before" | "Size after" | "Size saved" | "Date added" | "Status"
```

### Status badges
```
"Optimized" | "Reverted" | "Unoptimized" | "Skipped" | "Not scanned" | "No image"
```

### Filters
```
"Optimization type"    ← filter dropdown
"Publish status"       ← filter dropdown
"All type"             ← default filter
"Compression"          ← type filter option
"Alt"                  ← type filter option
```

### Pagination
```
"Items per page"
"Select all"
"Total: 1 item" / "Total: {num} items"
```

### Toast
```
"Optimization started"
"Image optimized successfully"
```

## Selectors

```typescript
// Optimize button (opens panel)
frame.getByText('Optimize now')

// Optimize All dropdown option
frame.getByRole('button', { name: 'Optimize all' })

// Manual mode toggle
frame.getByText('Optimize manually')

// Select first image row
frame.getByRole('cell', { name: 'Select Item' }).first()

// Compress image button
frame.getByRole('button', { name: 'Compress image' })

// Progress bar
frame.locator('[role="progressbar"]').first()

// Toast
frame.locator('[role="alert"]').first()

// Skeleton (loading)
frame.locator('[class*="Skeleton" i]').first()

// Statistics
frame.getByText('Total images')
frame.getByText('Original size')
```
