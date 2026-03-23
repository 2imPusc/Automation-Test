# Speed Up — Feature Context

Page: `/speed-up`
Source: `pages/SpeedUp/`, `pages/SiteSpeedUp/`, `pages/ScriptManager/`, `pages/SpeedScoreDetails/`

## Source Files
- packages/assets/src/pages/SpeedUp/SpeedUp.js
- packages/assets/src/pages/SpeedUp/CriticalCss/
- packages/assets/src/pages/SpeedUp/FontSwap/
- packages/assets/src/pages/SpeedUp/LazyLoad/
- packages/assets/src/pages/SpeedUp/Minify/
- packages/assets/src/pages/SpeedUp/Preload/
- packages/assets/src/pages/SpeedUp/AssetImageOptimization/
- packages/assets/src/pages/SpeedUp/Hyperspeed/

## Navigation

```typescript
await page.getByRole('link', { name: 'Speed up ⚡' }).click();
```

## Script Manager

### Buttons
```
"Check for new scripts"          ← primary action
"Migrate"                        ← migrate scripts
"Generate"                       ← generate critical CSS
"Regenerate"
"Contact us"
"Learn more"
```

### Toast
```
"Check scripts successfully"
"Migrate successfully"
"Generating in progress"
"Generation successfully"
"Error generating critical CSS"
"Logo must be a PNG, JPG, or SVG file"
"Logo must be less than 5MB"
```

### Font Optimization options
```
"Standard" | "Smart" | "Expert"
"Use fallbackfont"
"Font optimization"
```

### Critical CSS
```
"Critical CSS Generator"
"Home page" | "Collection page" | "Product page"
```

### Page Loader presets
```
"Loading circle" | "Loading logo" | "Loading process"
"Minimalist" | "Bright" | "Dark"
"Small" | "Medium" | "Large"
```

## Site Speed Up

### Key text
```
"Speed up now"                  ← primary CTA (dangerous action)
"Your website's speed is"       ← score display
"Maintain this level of performance for optimal SEO and user experience."
"Activate Turbo"
```

### Warning
```
"By selecting 'Speed up', you agree to apply changes directly to your store that may lead to unexpected impact."
"Please wait for 30 minutes before starting speed up process again"
```

## Asset Optimization

### Key text
```
"Asset optimization"
"Assets image optimized"
"Size saved"
"Last run time"
"Read the guide"
```

## Selectors

```typescript
// Script manager check
frame.getByRole('button', { name: 'Check for new scripts' })

// Toast
frame.locator('[role="alert"]').first()

// Speed score
frame.getByText('Your website\'s speed is')
```
