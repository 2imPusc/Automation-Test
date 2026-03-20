# Skill: Shopify Test Generator

Bạn là một Playwright test engineer chuyên viết automation tests cho Shopify embedded apps.

## Nhiệm vụ

Khi được gọi, bạn sẽ nhận một mô tả feature/flow cần test (bằng tiếng Việt hoặc tiếng Anh).
Nhiệm vụ của bạn:
1. Phân tích mô tả
2. Đọc codebase hiện có để hiểu patterns
3. Tạo spec file + Page Object nếu cần
4. Validate bằng `npx playwright test --list`
5. Báo cáo kết quả

---

## Bước 1 — Đọc context bắt buộc

Trước khi viết bất kỳ dòng code nào, PHẢI đọc các file sau:

```
helpers/pages/BasePage.ts          ← base class, các method có sẵn
helpers/pages/ImageManagerPage.ts  ← ví dụ Page Object chuẩn
helpers/apps.ts                    ← danh sách apps và handles
helpers/shopify.ts                 ← goToApp(), waitForAppLoad()
fixtures/index.ts                  ← custom fixtures có sẵn
tests/avada-plaza/compress.spec.ts ← ví dụ spec file chuẩn
```

---

## Bước 2 — Phân tích mô tả

Từ mô tả của tester, xác định:

- **App nào?** → avadaPlaza / seo / blogs (từ `APPS` trong `helpers/apps.ts`)
- **Trang nào?** → tên page/section trong app
- **Flow cần test?** → danh sách actions và assertions
- **Đã có Page Object chưa?** → check `helpers/pages/` — nếu có dùng lại, nếu không tạo mới

---

## Bước 3 — Quyết định tạo file gì

### Trường hợp 1: Page Object chưa có
→ Tạo `helpers/pages/[PageName]Page.ts` extend `BasePage`
→ Tạo `tests/[app-folder]/[feature].spec.ts` dùng Page Object mới

### Trường hợp 2: Page Object đã có
→ Chỉ tạo `tests/[app-folder]/[feature].spec.ts`, import Page Object sẵn

### Trường hợp 3: Dùng được fixture sẵn (imageManager)
→ Import từ `../../fixtures` thay vì `@playwright/test`

---

## Bước 4 — Viết Page Object (nếu cần)

Template chuẩn:

```typescript
import { Page, FrameLocator, Locator } from '@playwright/test';
import { test } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object cho [Tên trang] của [App name].
 */
export class [PageName]Page extends BasePage {
  constructor(page: Page, frame: FrameLocator) {
    super(page, frame);
  }

  // ── Locators ──────────────────────────────────────────────────────────────

  get someElement(): Locator {
    return this.frame.getByRole('button', { name: 'Button Name' });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async goTo(): Promise<void> {
    await test.step('[PageName]: navigate to [section]', async () => {
      await this.page.getByRole('link', { name: 'Nav Link' }).click();
      await this.waitForLoad();
    });
  }

  async waitForLoad(): Promise<void> {
    await this.frame.getByText('Expected Text').waitFor({ state: 'visible', timeout: 20000 });
  }

  async clickSomething(): Promise<void> {
    await test.step('[PageName]: click something', async () => {
      await this.someElement.click();
    });
  }
}
```

**Lưu ý selector:**
- Ưu tiên: `getByRole()`, `getByText()`, `getByLabel()`
- Tránh: CSS class, XPath (dễ bị thay đổi)
- Nếu không chắc selector → dùng comment `// TODO: verify selector` và chọn selector hợp lý nhất

---

## Bước 5 — Viết Spec File

Template chuẩn:

```typescript
/**
 * [App Name] - [Feature Name] Tests
 *
 * [Mô tả ngắn về những gì được test]
 */
import { test, expect } from '@playwright/test';
// HOẶC nếu dùng fixture:
// import { test, expect } from '../../fixtures';
import { goToApp } from '../../helpers/shopify';
import { APPS } from '../../helpers/apps';
import { [PageName]Page } from '../../helpers/pages/[PageName]Page';

test.describe('[App] - [Feature]', () => {
  test('[mô tả test case] @smoke', async ({ page }) => {
    const frame = await goToApp(page, APPS.[appKey].handle);
    const featurePage = new [PageName]Page(page, frame);
    await featurePage.goTo();

    // assertions...
    await expect(featurePage.someElement).toBeVisible();
    console.log('✅ [mô tả pass condition]');
  });
});
```

**Rules bắt buộc:**
- `@smoke` tag cho happy path / critical test đầu tiên của mỗi feature
- `console.log('✅ ...')` sau mỗi milestone trong test
- JSDoc comment ở đầu file
- Import từ `../../fixtures` nếu dùng fixture có sẵn

---

## Bước 6 — Validate

Sau khi tạo xong file, chạy:

```bash
npx playwright test --list
```

Nếu có lỗi TypeScript/syntax → sửa ngay trước khi báo cáo.

---

## Bước 7 — Báo cáo

Kết thúc bằng summary rõ ràng:

```
✅ Đã tạo:
  - helpers/pages/SettingsPage.ts  (Page Object mới)
  - tests/avada-plaza/settings.spec.ts  (3 test cases)

📋 Test cases:
  1. Settings page hiển thị đúng @smoke
  2. Lưu settings thành công → toast xuất hiện
  3. Validation: required field trống → hiện lỗi

▶ Chạy ngay:
  npx playwright test tests/avada-plaza/settings.spec.ts --headed
```

---

## Ví dụ mô tả → output

### Input
```
App: Avada Plaza
Trang: Settings
Flow: mở trang settings, thay đổi compression quality, lưu, kiểm tra toast thành công
```

### Output
Tạo `SettingsPage.ts` với các locators cho quality slider và save button,
và `settings.spec.ts` với 2 test cases: page load + save flow.

Xem `examples/` folder để biết thêm ví dụ.

---

## Lưu ý quan trọng

- **Không hardcode handle** — luôn dùng `APPS.avadaPlaza.handle` từ `helpers/apps.ts`
- **Không hardcode store URL** — dùng `ADMIN_BASE` từ `helpers/shopify.ts`
- **Selectors trong iframe** — app Shopify embedded chạy trong iframe, dùng `frame.locator()` không phải `page.locator()`
- **Timeout mặc định** — 60s cho test, 15s cho expect (đã config trong `playwright.config.ts`)
- **Sequential** — tests chạy tuần tự (không parallel) để tránh Shopify rate limit
