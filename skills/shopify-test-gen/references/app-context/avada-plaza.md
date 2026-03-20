# Avada Plaza — App Context

> Auto-generated + manually curated from source code.
> Update this file when new pages/features are added.

## Pages & Nav Links

| Nav label (exact) | Page | Notes |
|---|---|---|
| Image manager | Image Manager / Manual Compression | Main page |
| Compression History | Optimize History | |
| Script manager | Script Manager | |
| Subscription | Subscription | |
| Settings | Settings | |

## Key UI Text (exact strings for getByText / getByRole)

### Image Manager / Optimizer
```
"Optimize now"           ← main CTA button
"Optimize all"           ← dropdown option
"Optimize unoptimized"   ← dropdown option
"Optimize manually"      ← switch to manual mode
"Optimizing images"      ← loading state text
"Optimize in progress"   ← progress state
"Reverting image is running in the background..."
"Revert all images"      ← revert button
```

### Manual Compression
```
"Compress image"         ← action button (single image)
"Optimize all (alt + compress)"  ← bulk action
"Compression management" ← page heading
"Select all"             ← select all checkbox label
"Items per page"         ← pagination
"Optimization started"   ← toast after start compress
"Image optimized successfully"  ← toast after single compress done
```

### Toast Messages (exact text)
```
"Settings updated successfully"   ← after save settings
"Revert finished"                 ← after revert done
"Optimization started"            ← after click optimize
"Image optimized successfully"    ← single image compress done
"Optimize successfully"           ← bulk optimize done banner title
"Revert successfully"             ← bulk revert done banner title
"Migrate successfully"            ← script manager migrate
"Check scripts successfully"      ← script manager check
```

### Error / Warning Messages
```
"Something went wrong"            ← generic error banner title
"A technical error occurred. Please try again or contact support for assistance."
"Please wait {time} before the next compression"  ← cooldown message
"Please wait 30 minutes until the next optimization"
"Please wait for 30 minutes before starting optimize process again"
"No images to optimize"           ← empty state title
"No image in your store"          ← empty state ManualCompression
```

### Loading / Progress States
```
"Optimizing images"       ← optimizer loading label
"Optimizing..."
"Preparing..."
"Calculating time remain..."
"Estimating finish date ..."
"{time} remaining"
```

### Polaris / Shopify UI patterns
```
[role="progressbar"]              ← progress bar
[role="alert"]                    ← toast notification
[class*="Polaris-Toast"]         ← Polaris toast
[class*="Polaris-Banner"]        ← Polaris banner
[class*="Polaris-Skeleton"]      ← loading skeleton
[aria-busy="true"]                ← loading state
```

## Image Manager — Statistics Labels
```
"Total images"
"Original size"
"Optimized size"
"Size saved"
"Images optimized"
```

## Compression Level Options
```
"Automatic - 92%"
"High - 80%"
"Medium - 70%"
"Low - 50%"
```

## Image Type Checkboxes (Settings)
```
"Product images"
"Collection images"
"Blog images"
"Only published product images"
"All product images"
```

## Table Column Headers (Manual Compression)
```
"Image"
"Title"
"Type"
"Size before"
"Size after"
"Size saved"
"Date added"
"Status"
```

## Status Badges
```
"Optimized"
"Reverted"
"Unoptimized"
"Skipped"
"Not scanned"
"No image"
```

## Save Bar (Shopify Contextual Save Bar)
```
"Save"      ← save button
"Discard"   ← discard button
"Unsaved changes"  ← title when there are unsaved changes
```

## Selector Notes

- App runs in Shopify iframe: always use `frame.locator()` not `page.locator()`
- Nav links are **outside** iframe (Shopify Admin sidebar): use `page.getByRole('link', { name: '...' })`
- Sidekick close button (outside iframe): `page.getByRole('button', { name: 'Close Sidekick' })`
- Most buttons inside app: `frame.getByRole('button', { name: '...' })`
- Toast: `frame.locator('[role="alert"]').first()` or `frame.locator('[class*="Toast" i]').first()`
