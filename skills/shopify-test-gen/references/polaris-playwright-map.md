# Polaris ↔ Playwright Selector Map

> **Mục đích:** Reference tra cứu — khi gặp Polaris/Avada component trong UI, dùng selector nào trong Playwright.
> **Nguyên tắc:** Ưu tiên stable selector (role, aria, custom class) hơn CSS fragile (nth, nested path).
> **Cập nhật:** Mỗi khi phát hiện selector mới từ Playwright Codegen/recorded tests, thêm vào đây.
> **Validation:** Chạy `npm run probe -- --query "element text"` để verify selector trên DOM thật.

## 0. Quick Decision Table

Dùng bảng này khi cần chọn selector strategy nhanh cho một component:

| Component | ❌ ĐỪNG dùng | ✅ NÊN dùng | Lý do |
|---|---|---|---|
| **Polaris Button** | `getByText('Label')` | `getByRole('button', { name: tRegex('key') })` | Text match hidden elements |
| **Polaris Tab** | `getByText('Tab Name')` | `getByRole('tab', { name: tRegex('key') })` | Hidden spans in tab labels |
| **Polaris Toast** | `.Polaris-Frame-ToastManager` | `.Polaris-Frame-ToastManager [role="alert"]` | Wrapper always in DOM |
| **Polaris Modal** | `[role="dialog"]` | `[role="dialog"]:not(#sidekick)` | Exclude Shopify Sidekick |
| **IndexTable checkbox** | `.click()` | `.click({ force: true })` | Hidden until hover |
| **Avada component** | `tLoc('key')` without `.first()` | `.Avada-ClassName` class | More stable than text match; tLoc OK as fallback with `.first()` |
| **ActionList item** | `getByText('Option')` | `getByRole('button', { name: /Option/i })` | Items render as buttons |
| **Form input** | `getByText('Label')` | `getByLabel('Label')` | Proper form association |
| **Split button dropdown** | Click main button | Click `.Avada-Optimize-Button-suffix-wrapper` | Arrow is separate element |

---

---

## 1. Avada Custom Components

### OptimizeButton (Split Button với dropdown)

**Source:** `pages/ImageManager/Optimizer/OptimizeButton/index.js`

**DOM structure:**
```
div.Avada-Optimize-Button                  ← click để toggle Popover
  ├── [text: "Optimize now"]               ← i18n: ButtonOptimize.labelOtm
  └── div.Avada-Optimize-Button-suffix-wrapper   ← dropdown arrow wrapper
        └── [Polaris Icon / svg]           ← click này để MỞ dropdown
```

**Playwright selectors:**
```ts
// Toàn bộ button (click → toggle popover)
frame.locator('.Avada-Optimize-Button').first()

// Chỉ arrow để MỞ dropdown (CONFIRMED từ Codegen)
frame.locator('.Avada-Optimize-Button-suffix-wrapper').first()
// hoặc SVG bên trong:
frame.locator('.Avada-Optimize-Button-suffix-wrapper > .Polaris-Icon > .Polaris-Icon__Svg')

// Options bên trong Polaris Popover (xuất hiện SAU KHI click arrow)
frame.getByRole('button', { name: 'Optimize all' })
frame.getByRole('button', { name: 'Optimize unoptimized' })
// hoặc dùng i18n:
frame.locator(tLoc('ButtonOptimize.optionAll'))
frame.locator(tLoc('ButtonOptimize.optionUnoptimized'))
```

**Trạng thái:**
```ts
// Đang loading (tắt click)
frame.locator('.Avada-Optimize-Button.loading')
// Bị disabled
frame.locator('.Avada-Optimize-Button.disabled')
// Bình thường
frame.locator('.Avada-Optimize-Button:not(.disabled):not(.loading)')
```

**⚠️ Lưu ý:**
- `ActionList` items hiển thị text `'Optimize all'` và `'Optimize unoptimized'` hardcode (không qua i18n key) trong source — dùng `getByRole('button', { name: /Optimize all/i })` an toàn hơn tLoc
- Popover mở chậm ~300-500ms sau click → cần `waitFor visible` trước khi click option

---

### ButtonOptimize (Old single button — trang Home)

**Source:** `components/ButtonOptimize/ButtonOptimize.js`

**DOM structure:**
```
div.Avada-BtnOTM                      ← click để optimize
  ├── div.Avada-BtnOTM--Title         ← text label (i18n)
  └── svg.Avada-BtnOTM--IconOTM       ← decorative icon (không click)
```

**Playwright selectors:**
```ts
frame.locator('.Avada-BtnOTM').first()
// hoặc i18n:
frame.locator(tLoc('ButtonOptimize.labelOtm')).first()
```

---

## 2. Polaris Components (Standard)

### Button

```ts
// Primary / default
frame.getByRole('button', { name: /label/i })

// Disabled state
frame.getByRole('button', { name: /label/i, disabled: true })

// Trong Polaris ButtonGroup
frame.locator('.Polaris-ButtonGroup').getByRole('button', { name: /label/i })
```

### TextField / Input

```ts
// By label text
frame.getByLabel('Field label')
// By placeholder
frame.getByPlaceholder('placeholder text')
// Polaris wrapper (khi không có label rõ)
frame.locator('.Polaris-TextField').getByRole('textbox')
// Select/combobox bên trong TextField
frame.locator('.Polaris-TextField').locator('select, [role="combobox"]')
```

### Select (Polaris custom)

```ts
// Native select bên trong wrapper
frame.locator('.Polaris-Select select')
// hoặc
frame.locator('select').filter({ has: frame.locator('option') })

// Custom Popover-based select (như quality dropdown):
// 1. Click wrapper để mở
frame.locator('[aria-haspopup="listbox"], [role="combobox"]').first().click()
// 2. Click option
frame.locator('[role="option"]').filter({ hasText: /option text/i }).click()
```

### Tabs

```ts
// Click tab by name
frame.getByRole('tab', { name: /Tab Name/i }).click()
// Check tab selected
frame.getByRole('tab', { name: /Tab Name/i, selected: true })
// Dùng i18n:
frame.getByRole('tab', { name: tRegex('ImageManager.tabs.compression') }).click()
```

### Modal / Dialog

```ts
// Polaris Modal
frame.locator('[role="dialog"]')
// Không nhầm với Shopify Sidekick
page.locator('[role="dialog"]:not(#sidekick)')
// Title
frame.locator('[role="dialog"]').getByRole('heading')
// Close button
frame.locator('[role="dialog"]').getByRole('button', { name: /close/i })
```

### Toast / Banner

```ts
// Polaris Toast (bên trong ToastManager)
frame.locator('.Polaris-Frame-ToastManager [role="alert"]')
// KHÔNG dùng wrapper: .Polaris-Frame-ToastManager (luôn có trong DOM, hidden khi rỗng)

// Polaris Banner
frame.locator('[role="status"]')
frame.locator('.Polaris-Banner')
// Loại banner theo tone:
frame.locator('.Polaris-Banner--toneSuccess')
frame.locator('.Polaris-Banner--toneCritical')
```

### IndexTable (Image list)

```ts
// Header row
frame.locator('[role="rowgroup"]').first().locator('[role="row"]')
// Data rows
frame.locator('[role="rowgroup"]').last().locator('[role="row"]')
// Checkbox trong row (Polaris ẩn, cần force)
frame.locator('input[type="checkbox"]').nth(1).click({ force: true })
// nth(0) = select-all header, nth(1+) = data rows
```

### Popover / ActionList

```ts
// Trigger Popover
frame.locator('[aria-controls][aria-expanded]').click()
// Items trong ActionList
frame.locator('[role="listbox"] [role="option"]')
frame.getByRole('button', { name: /action name/i })  // ActionList items render as buttons
```

### ProgressBar

```ts
frame.locator('[role="progressbar"]')
// Polaris ProgressBar class:
frame.locator('.Polaris-ProgressBar')
// Value
frame.locator('[role="progressbar"]').getAttribute('aria-valuenow')
```

### Skeleton / Loading

```ts
// Polaris Skeleton
frame.locator('.Polaris-SkeletonBodyText, .Polaris-SkeletonDisplayText, .Polaris-SkeletonThumbnail')
// Aria busy
frame.locator('[aria-busy="true"]')
// Wait for gone:
await expect(frame.locator('.Polaris-SkeletonBodyText').first()).not.toBeVisible({ timeout: 30000 })
```

---

## 3. Shopify Admin (ngoài iframe)

### Dev Console overlay

```ts
// Đóng Dev Console (xuất hiện sau mỗi page load)
const devConsoleClose = page.getByRole('button', { name: 'Close Dev Console' })
if (await devConsoleClose.isVisible({ timeout: 1500 }).catch(() => false)) {
  await devConsoleClose.click()
}
// Ẩn nhanh bằng DOM removal (reliable hơn)
await page.evaluate(() => document.querySelectorAll('dialog').forEach(d => d.remove()))
```

### Sidekick

```ts
// Close button
page.getByRole('button', { name: 'Close Sidekick' })
// hoặc remove qua DOM (Sidekick không có close button chuẩn)
await page.evaluate(() => document.querySelectorAll('dialog').forEach(d => d.remove()))
```

### Contextual Save Bar (Unsaved changes)

```ts
// Bar xuất hiện trên page (ngoài iframe) khi app có dirty state
page.locator('text=/Unsaved changes/i')
// hoặc i18n key:
page.getByText(t('AvadaContextualSaveBar.unsavedTitle'))
// Discard button
page.getByRole('button', { name: /discard/i })
// Save button
page.getByRole('button', { name: /save/i })
```

### App iframe

```ts
// Standard selector — không đổi
page.frameLocator('iframe[name="app-iframe"]')
// Tất cả interaction với app đều phải qua frame:
const frame = page.frameLocator('iframe[name="app-iframe"]')
await frame.locator('...').click()
```

---

## 4. Patterns thường gặp & Pitfalls

### ❌ Selector fragile → ✅ Stable

```ts
// ❌ CSS path quá sâu — vỡ khi Polaris update
'.Polaris-Icon > .Polaris-Icon__Svg'
// ✅ Custom class của app — stable hơn
'.Avada-Optimize-Button-suffix-wrapper'

// ❌ nth() mà không có context
page.locator('button').nth(3)
// ✅ Role + name
page.getByRole('button', { name: 'Save' })

// ❌ getByText cho Polaris Tab (render hidden spans)
frame.getByText('Compression')  // match cả hidden tab label
// ✅ Dùng role
frame.getByRole('tab', { name: /Compression/i })
frame.getByRole('heading', { name: /Compression/i })
```

### Iframe timing

```ts
// ❌ Sai — page chưa load iframe
await page.goto(url)
await frame.locator('button').click()  // có thể fail

// ✅ Đúng — chờ iframe có src
await page.waitForSelector('iframe[name="app-iframe"]', { timeout: 30000 })
await page.waitForFunction(
  sel => { const f = document.querySelector(sel); return f && f.src && f.src !== 'about:blank' },
  'iframe[name="app-iframe"]', { timeout: 30000 }
)
```

### Polaris Modal vs Shopify dialog

```ts
// Shopify Sidekick render như dialog[id="sidekick"]
// Polaris Modal render như [role="dialog"] không có id
// Luôn exclude Sidekick khi assert không có modal:
await expect(page.locator('[role="dialog"]:not(#sidekick)')).toHaveCount(0)
```
