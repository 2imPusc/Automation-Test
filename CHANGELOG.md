# Changelog

Tất cả thay đổi đáng chú ý của dự án được ghi lại tại đây.

Format theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [1.2.0] — 2026-03-20

### Added — Phase 4: Multi-environment & Interactive CLI

- **Multi-environment support**: chạy test trên local / staging / production
  - `ENV=staging npm run test` → load `.env.staging` tự động
  - Auth file riêng cho từng env: `session.json` / `session.staging.json` / `session.prod.json`
- **New scripts**: `test:staging`, `test:prod`, `auth:staging`, `auth:prod`
- **Setup wizard** (`npm run setup`): guided setup tạo `.env` từng bước, không cần tự edit file
- **Interactive test picker** (`npm run test:pick`): menu số chọn test suite, không cần nhớ commands
- **Template files**: `.env.staging`, `.env.prod`
- **Dependency**: `cross-env` cho Windows compatibility

### Changed

- `playwright.config.ts`: env-aware config, đọc `ENV` variable để load đúng `.env` file
- `tests/auth.setup.ts`: auth file path thay đổi theo env

---

## [1.1.0] — 2026-03-20

### Added — Phase 2: Fixtures, Smoke Tests & Better Errors

- **Custom Playwright fixture** (`fixtures/index.ts`):
  - `imageManager` fixture — setup sẵn, inject vào test, không cần boilerplate
- **Smoke test tags**: 2 critical tests được tag `@smoke`
  - `npm run test:smoke` chạy < 60 giây
- **Named test steps** via `test.step()` trong `ImageManagerPage`:
  - HTML report hiển thị từng bước rõ ràng thay vì raw locator calls
- **Descriptive error messages** trong `BasePage`:
  - Timeout throw `[ClassName] waitForVisible timed out after Xms` thay vì generic Playwright error

### Changed

- `tests/avada-plaza/compress.spec.ts`: refactor dùng `imageManager` fixture, bỏ boilerplate setup

---

## [1.0.0] — 2026-03-20

### Added — Phase 1: Page Object Model & Multi-app Support

- **Page Object Model**:
  - `helpers/pages/BasePage.ts`: base class với `waitForVisible`, `waitForHidden`, `clickButton`
  - `helpers/pages/ImageManagerPage.ts`: encapsulate toàn bộ selectors + actions của Image Manager
    - Locators: `toast`, `progress`, `skeleton`, `compressButton`, `optimizeAllButton`
    - Actions: `goTo()`, `closeShopifySidekick()`, `waitForLoad()`, `clickOptimizeNow()`, `clickOptimizeAll()`, `switchToManualMode()`, `selectFirstImage()`, `clickCompressImage()`, `waitForSkeletonGone()`
- **App registry** (`helpers/apps.ts`):
  - `APPS` object chứa config cho avadaPlaza, seo, blogs
  - Đọc handles từ env: `AVADA_PLAZA_HANDLE`, `SEO_HANDLE`, `BLOGS_HANDLE`
  - Backward compat: `APP_HANDLE` vẫn hoạt động như fallback
- **New test folders**: `tests/seo/`, `tests/blogs/` (placeholder)
- **New npm scripts**: `test:seo`, `test:blogs`, `test:smoke`
- **Docs**: `tests/avada-plaza/README.md`

### Changed

- `tests/avada-plaza/basic.spec.ts`: dùng `APPS.avadaPlaza.handle` thay vì `APP_HANDLE` trực tiếp
- `tests/avada-plaza/compress.spec.ts`: refactor dùng `ImageManagerPage` POM
- `.env.example`: thêm `AVADA_PLAZA_HANDLE`, `SEO_HANDLE`, `BLOGS_HANDLE`; deprecated `APP_HANDLE`

---

## [0.2.0] — 2026-03-20

### Added

- Comprehensive `.gitignore`
- README.md với hướng dẫn đầy đủ
- `.env` support: `STORE_HANDLE`, `APP_HANDLE` đọc từ file thay vì hardcode

### Changed

- `helpers/shopify.ts`: refactor dùng env variables

---

## [0.1.0] — 2026-03-20

### Added — Initial Release

- Playwright setup với authentication flow (lưu session Shopify)
- `helpers/shopify.ts`: `goToApp()`, `getAppFrame()`, `waitForAppLoad()`, `goToAppsList()`
- `tests/avada-plaza/basic.spec.ts`: smoke tests (app load, không crash, page title)
- `tests/avada-plaza/compress.spec.ts`: Image Manager tests (auto optimize, manual compress)
- `playwright.config.ts`: sequential run, retry on CI, screenshot/video on failure
