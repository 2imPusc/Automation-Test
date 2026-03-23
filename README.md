# Shopify Automation Tests

Dự án automation testing cho các ứng dụng Shopify sử dụng [Playwright](https://playwright.dev).

## Tính năng

- ✅ **Page Object Model** — selectors tập trung, dễ maintain khi UI thay đổi
- ✅ **Multi-app support** — test nhiều app (Avada Plaza, SEO, Blogs) từ cùng 1 dự án
- ✅ **Custom Fixtures** — setup tự động, viết test gọn hơn
- ✅ **Smoke tests** — chạy nhanh < 60s trước mỗi deploy
- ✅ **Multi-environment** — local / staging / production
- ✅ **Interactive CLI** — setup wizard + test picker, không cần nhớ commands
- ✅ **AI Test Generator** — sinh Playwright test từ Notion task link (dùng Claude Max)
- ✅ **Web UI** — giao diện tại `localhost:3100` để gen test, verify staging, run test

---

## Cài đặt nhanh (dùng OpenClaw)

Nếu đã có OpenClaw, chỉ cần install skill và nhắn AI:

```bash
openclaw skill install docs/shopify-autotest-setup.skill
```

Sau đó nhắn agent:
> "Setup shopify-autotest cho tôi: https://github.com/2imPusc/Automation-Test"

Agent sẽ tự detect OS, clone repo, cài đặt dependencies, cấu hình `.env`, tạo agent `test-gen`, và verify installation.

Xem hướng dẫn đầy đủ tại: **[SETUP.md](SETUP.md)**

---

## Cài đặt lần đầu (thủ công)

### 1. Clone & cài dependencies

```bash
git clone https://github.com/2imPusc/Automation-Test.git
cd shopify-autotest
npm install
```

### 2. Setup môi trường (cách nhanh)

```bash
npm run setup
```

Wizard sẽ hỏi từng bước và tự ghi file `.env`. Không cần tự tạo thủ công.

> **Cách thủ công:** Copy `.env.example` → `.env` rồi điền thông tin vào.

### 3. Login Shopify

```bash
npm run auth
```

Browser sẽ mở để bạn đăng nhập. Session được lưu tự động vào `.auth/session.json`.

### 4. Chạy thử

```bash
npm run test:smoke
```

---

## Tìm App Handle

1. Vào Shopify Admin → Apps
2. Click vào app cần test
3. Nhìn URL: `.../apps/[APP_HANDLE]/...`
4. Copy phần `APP_HANDLE` vào `.env`

---

## Chạy Tests

### Cách dễ nhất — Test Picker

```bash
npm run test:pick
```

```
🎭 Which tests do you want to run?
────────────────────────────────────
  1. All tests
  2. Avada Plaza only
  3. SEO only
  4. Blogs only
  5. Smoke tests only (fast ⚡)
  6. Open UI mode (debug 🔍)
```

### Chạy trực tiếp

| Command | Mô tả |
|---|---|
| `npm run test` | Tất cả tests |
| `npm run test:avada-plaza` | Chỉ Avada Plaza |
| `npm run test:seo` | Chỉ SEO |
| `npm run test:blogs` | Chỉ Blogs |
| `npm run test:smoke` | Smoke tests (< 60s) |
| `npm run test:ui` | UI mode để debug |
| `npm run test:headed` | Headed browser (thấy browser chạy) |
| `npm run report` | Xem HTML report |

---

## Multi-Environment

Hỗ trợ chạy test trên nhiều store khác nhau.

### Cấu hình

Tạo file `.env.staging` và `.env.prod` (dựa theo `.env.example`):

```env
# .env.staging
STORE_HANDLE=your-staging-store
AVADA_PLAZA_HANDLE=your-avada-plaza-handle
```

### Login từng env

```bash
npm run auth:staging   # login staging
npm run auth:prod      # login production
```

### Chạy test theo env

```bash
npm run test:staging   # test trên staging store
npm run test:prod      # test trên production store
```

---

## Cấu trúc dự án

```
shopify-autotest/
├── .env                      # Cấu hình local (không commit)
├── .env.staging              # Cấu hình staging (không commit)
├── .env.prod                 # Cấu hình production (không commit)
├── .env.example              # Template cấu hình
├── .auth/
│   ├── session.json          # Session local (không commit)
│   ├── session.staging.json  # Session staging (không commit)
│   └── session.prod.json     # Session production (không commit)
├── fixtures/
│   └── index.ts              # Custom Playwright fixtures
├── helpers/
│   ├── apps.ts               # Registry các app (handles, names)
│   ├── shopify.ts            # Utility functions (goToApp, waitForAppLoad)
│   └── pages/
│       ├── BasePage.ts       # Base class cho Page Objects
│       └── ImageManagerPage.ts  # Page Object của Image Manager
├── scripts/
│   ├── setup.js              # Setup wizard (npm run setup)
│   └── pick.js               # Interactive test picker (npm run test:pick)
├── tests/
│   ├── auth.setup.ts         # Setup authentication
│   ├── example.spec.ts       # Ví dụ test
│   ├── avada-plaza/
│   │   ├── README.md
│   │   ├── basic.spec.ts     # Smoke: app load, không crash
│   │   └── compress.spec.ts  # Image Manager: auto + manual compress
│   ├── seo/                  # Tests cho SEO app (chưa có)
│   └── blogs/                # Tests cho Blogs app (chưa có)
├── playwright.config.ts      # Cấu hình Playwright
└── package.json
```

---

## Viết Test Mới

### Dùng fixture có sẵn

```typescript
// Import từ fixtures thay vì @playwright/test
import { test, expect } from '../../fixtures';

test('tên test @smoke', async ({ imageManager }) => {
  // imageManager đã được setup sẵn, dùng luôn
  await expect(imageManager.frame.getByText('Total images')).toBeVisible();
  await imageManager.clickOptimizeNow();
});
```

### Dùng Page Object trực tiếp

```typescript
import { test, expect } from '@playwright/test';
import { goToApp } from '../../helpers/shopify';
import { APPS } from '../../helpers/apps';
import { ImageManagerPage } from '../../helpers/pages/ImageManagerPage';

test('tên test', async ({ page }) => {
  const frame = await goToApp(page, APPS.avadaPlaza.handle);
  const imageManager = new ImageManagerPage(page, frame);
  await imageManager.goTo();
  // test logic...
});
```

### Tag smoke test

Thêm `@smoke` vào tên test để include vào `npm run test:smoke`:

```typescript
test('app load đúng @smoke', async ({ page }) => { ... });
```

---

## Troubleshooting

### Tests fail do authentication

```bash
npm run auth:reset
npm run auth
```

### Tests fail do selectors cũ

1. Chạy `npm run test:headed` để xem browser thực tế
2. Cập nhật selectors trong `helpers/pages/ImageManagerPage.ts` (chỉ 1 file)

### Không tìm thấy app

Kiểm tra `AVADA_PLAZA_HANDLE` (hoặc handle tương ứng) trong `.env`.

### Session hết hạn

```bash
npm run auth:reset && npm run auth
```

---

## Contributing

1. Fork repository
2. Tạo branch: `git checkout -b feature/ten-tinh-nang`
3. Commit: `git commit -m 'feat: mô tả thay đổi'`
4. Push & tạo Pull Request

## License

ISC
