# FLOW.md — Luồng Hoạt Động Tổng Thể

Tài liệu này mô tả **hệ thống shopify-autotest hoạt động như thế nào** — từ cấu hình ban đầu đến khi chạy test và đọc kết quả. Dùng để hiểu tổng thể và kiểm chứng từng phần.

---

## Bức tranh toàn cảnh

```
┌──────────────────────────────────────────────────────────────────┐
│                        SHOPIFY AUTOTEST                          │
│                                                                  │
│   .env (store + app handles)                                     │
│   .auth/session.json (session đã login)                          │
│            │                                                     │
│            ▼                                                     │
│   ┌─────────────────┐     ┌──────────────────────────────────┐  │
│   │  Test thủ công  │     │       AI Test Generator          │  │
│   │                 │     │                                  │  │
│   │  tests/*.spec   │     │  snapshot (DOM thật)             │  │
│   │  helpers/pages/ │     │  + source context                │  │
│   │  fixtures/      │     │  → Claude Code sinh spec + POM   │  │
│   └────────┬────────┘     └──────────────┬───────────────────┘  │
│            │                             │                       │
│            └──────────────┬──────────────┘                       │
│                           ▼                                      │
│                    Playwright chạy test                          │
│                    trên Shopify Admin (iframe)                   │
│                           │                                      │
│                           ▼                                      │
│                    HTML Report (pass/fail + screenshot)          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Cấu hình & Xác thực

### 1.1 File cấu hình `.env`

Mọi thứ bắt đầu từ file `.env` — chứa thông tin store và app handles:

```env
STORE_HANDLE=dophuc-store
AVADA_PLAZA_HANDLE=avada-image-optimizer
SEO_HANDLE=seo-pizza-app-phucdm
BLOGS_HANDLE=
```

`playwright.config.ts` đọc file này trước khi chạy bất kỳ test nào.
Multi-environment: `ENV=staging` → load `.env.staging`; `ENV=prod` → load `.env.prod`.

### 1.2 Session đăng nhập

Shopify yêu cầu đăng nhập để vào Admin. Thay vì đăng nhập lại mỗi lần chạy test:

```
npm run auth
    └→ Playwright mở browser → User đăng nhập Shopify
           └→ Session lưu vào .auth/session.json
                  └→ Mọi test đọc session này → chạy ở trạng thái đã login
```

Session thường dùng được nhiều tuần. Hết hạn → `npm run auth:reset && npm run auth`.

**Kiểm chứng:**
```bash
cat .auth/session.json | grep "shopify" | head -3
# ✅ Có cookies của Shopify → session hợp lệ
# ❌ File rỗng hoặc không có → cần auth lại
```

---

## 2. Cấu trúc Test

### 2.1 Page Object Model (POM)

Shopify apps chạy trong **iframe** — đây là điểm quan trọng nhất. Mọi selector phải dùng `frame.*` thay vì `page.*`.

```
Test spec (tests/avada-plaza/compress.spec.ts)
    └→ Gọi ImageManagerPage (helpers/pages/ImageManagerPage.ts)
           └→ Extends BasePage (helpers/pages/BasePage.ts)
                  └→ Dùng frame.locator() — không phải page.locator()
```

**Lý do dùng POM:** Khi Shopify thay đổi UI → chỉ sửa 1 file Page Object, không cần đụng vào test spec.

**`BasePage.ts`** — các action phổ biến dùng cho mọi page:
- `waitForVisible(locator, ms)` — chờ element xuất hiện
- `waitForHidden(locator, ms)` — chờ element biến mất
- `clickButton(locator)` — click và chờ
- Throw lỗi mô tả rõ: `[ImageManagerPage] waitForVisible timed out after 5000ms`

**`ImageManagerPage.ts`** — Page Object của Image Manager app:
- Locators: `toast`, `progress`, `skeleton`, `compressButton`, `optimizeAllButton`
- Actions: `goTo()`, `waitForLoad()`, `clickOptimizeNow()`, `switchToManualMode()`, `selectFirstImage()`, `clickCompressImage()`

### 2.2 Fixtures

Fixtures tự động khởi tạo Page Object và inject vào test — không cần boilerplate:

```typescript
// Không dùng fixture:
const frame = await goToApp(page, APPS.avadaPlaza.handle);
const imageManager = new ImageManagerPage(page, frame);
await imageManager.goTo();

// Dùng fixture — gọn hơn, tự setup:
import { test } from '../../fixtures';
test('...', async ({ imageManager }) => {
  // imageManager đã sẵn sàng
});
```

### 2.3 App Registry

`helpers/apps.ts` chứa thông tin tất cả apps — đọc handle từ `.env`:

```typescript
APPS.avadaPlaza  →  handle: process.env.AVADA_PLAZA_HANDLE
APPS.seo         →  handle: process.env.SEO_HANDLE
APPS.blogs       →  handle: process.env.BLOGS_HANDLE
```

---

## 3. Chạy Tests

### 3.1 Cách chạy

**Menu tương tác** (khuyên dùng — không cần nhớ lệnh):
```bash
npm run test:pick
```
```
1. All tests
2. Avada Plaza only
3. SEO only
4. Blogs only
5. Smoke tests only (fast ⚡)
6. Open UI mode (debug 🔍)
7. 🤖 Generate new test with AI
8. 📸 Capture app snapshots
```

**Lệnh trực tiếp:**

| Lệnh | Khi nào dùng |
|------|-------------|
| `npm run test:smoke` | Trước deploy — chạy nhanh < 60s |
| `npm run test` | Kiểm tra toàn bộ |
| `npm run test:avada-plaza` | Chỉ test Avada Plaza |
| `npm run test:headed` | Muốn thấy browser chạy thực tế |
| `npm run test:ui` | Debug chi tiết từng test |
| `npm run report` | Xem báo cáo HTML sau khi chạy |

### 3.2 Luồng chạy một test

```
npm run test:smoke
    │
    ├─ playwright.config.ts load .env + .auth/session.json
    │
    ├─ auth.setup.ts verify session còn hợp lệ
    │
    └─ Với mỗi test @smoke:
            ├─ Playwright mở Chromium (headless)
            ├─ Load session → vào Shopify Admin đã login
            ├─ Điều hướng đến app URL
            ├─ Chờ iframe app load xong
            ├─ Thực hiện actions (click, type, wait...)
            └─ Assert kết quả → pass ✓ / fail ✗
```

### 3.3 Đọc kết quả terminal

```
✓ Avada Plaza › app load đúng @smoke (3.2s)
✓ Avada Plaza › Image Manager hiển thị @smoke (5.1s)
✗ Avada Plaza › Auto Optimize › click Optimize all (12.4s)
  → TimeoutError: Waiting for selector '.toast-success'
```

- `✓` = pass
- `✗` = fail — xem message lỗi → chạy `npm run report` để xem screenshot

---

## 4. AI Test Generator

Khi cần test tính năng mới mà chưa có test file — thay vì tự viết code, mô tả bằng tiếng Việt và để AI sinh ra.

### 4.1 Snapshot — "chụp" UI thật

Trước khi sinh test, cần cho AI biết UI trông như thế nào:

```
npm run snapshot
    │
    ├─ Playwright mở browser (headed), load session đã auth
    ├─ Điều hướng đến app
    └─ Với mỗi trang:
            ├─ Chụp screenshot → snapshots/[app]/[page].png
            └─ Extract DOM: buttons, inputs, links, headings
                    └→ Lưu → snapshots/[app]/[page].json
```

**File `snapshots/avadaPlaza/home.json` trông như thế này:**
```json
{
  "buttons": ["Optimize Now", "Optimize All", "View Details"],
  "inputs": [{"placeholder": "Search images...", "name": "search"}],
  "headings": ["Image Manager", "Total images: 1,234"]
}
```

**Kiểm chứng:**
```bash
ls snapshots/avadaPlaza/
# home.png  home.json  settings.json ...

cat snapshots/avadaPlaza/home.json
# ✅ Có buttons[], inputs[] với tên thật từ app
# ❌ Rỗng {} → app chưa load kịp khi chụp
```

### 4.2 Generate test

```
npm run test:generate
    │
    ├─ Hỏi: app nào? branch nào? mô tả feature?
    │
    ├─ context-sync:
    │       └→ git pull lấy code mới nhất
    │       └→ scan source code → .context/[app].md (cache)
    │
    ├─ Inject vào prompt Claude Code:
    │       ├─ SKILL.md (rules: dùng iframe, không hardcode, tag @smoke)
    │       ├─ .context/[app].md (toàn bộ source code app)
    │       └─ snapshots/[app]/*.json (DOM thật — nếu có)
    │
    ├─ Claude Code phân tích → sinh:
    │       ├─ helpers/pages/[Feature]Page.ts (Page Object mới)
    │       └─ tests/[app]/[feature].spec.ts (test spec)
    │
    └─ Retry loop (tối đa 3 lần):
            └→ Chạy test → nếu fail → Claude Code xem lỗi → sửa → chạy lại
```

**Mô tả tốt để AI sinh đúng:**
```
App: Avada Plaza
Trang: Settings
Flow:
- Mở trang Settings
- Kiểm tra slider Compression Quality hiển thị
- Thay đổi giá trị slider
- Click Save
- Kiểm tra toast "Settings saved" xuất hiện
```

**Kiểm chứng sau generate:**
```bash
# File đã được tạo?
ls helpers/pages/           # có [Feature]Page.ts mới
ls tests/avada-plaza/       # có [feature].spec.ts mới

# Nội dung đúng pattern?
grep "frame\." tests/avada-plaza/[feature].spec.ts   # phải dùng frame, không phải page
grep "@smoke" tests/avada-plaza/[feature].spec.ts    # phải có smoke tag
grep "AVADA_PLAZA_HANDLE\|APPS\." tests/avada-plaza/[feature].spec.ts  # không hardcode handle

# Test chạy được?
npm run test -- --grep "[tên feature]"
```

---

## 5. Multi-Environment

```
┌────────────────────────────────────────────────────┐
│  local   → .env           + .auth/session.json     │
│  staging → .env.staging   + .auth/session.staging  │
│  prod    → .env.prod      + .auth/session.prod     │
└────────────────────────────────────────────────────┘
```

Setup staging/prod:
```bash
cp .env.example .env.staging   # điền thông tin staging store
npm run auth:staging            # đăng nhập staging
npm run test:staging            # chạy test trên staging
```

---

## 6. Báo cáo kết quả

```bash
npm run report
```

Browser mở HTML report, hiển thị:
- **Danh sách tests** — pass ✓ / fail ✗ / skip
- **Timeline** — từng bước trong test mất bao lâu
- **Screenshot tự động** — chụp ngay lúc test fail
- **Video replay** — xem lại toàn bộ test fail
- **Trace viewer** — replay từng action (click, type, navigate...)

---

## 7. Sơ đồ thư mục

```
shopify-autotest/
│
├── .env                        ← Store + app handles (không commit)
├── .auth/session.json          ← Session Shopify đã login (không commit)
│
├── .context/[app].md           ← Source code cache cho AI generator
├── snapshots/                  ← DOM + screenshot thật (không commit)
│   ├── index.json
│   └── avadaPlaza/home.png + home.json
│
├── helpers/
│   ├── apps.ts                 ← Registry apps (đọc từ .env)
│   ├── shopify.ts              ← goToApp(), getAppFrame(), waitForAppLoad()
│   └── pages/
│       ├── BasePage.ts         ← Base class: waitForVisible, clickButton...
│       └── ImageManagerPage.ts ← Page Object của Image Manager
│
├── fixtures/index.ts           ← Custom fixtures (auto-inject Page Objects)
│
├── tests/
│   ├── auth.setup.ts           ← Verify/setup session trước khi test
│   └── avada-plaza/
│       ├── basic.spec.ts       ← Smoke: app load, không crash
│       └── compress.spec.ts    ← Feature: auto optimize, manual compress
│
├── scripts/
│   ├── generate.js             ← AI generator orchestrator
│   ├── snapshot.js             ← Chụp UI + extract DOM
│   ├── context-sync.js         ← Git sync + quản lý context cache
│   ├── scan-source.js          ← Đọc source code → .context/[app].md
│   ├── setup.js                ← Setup wizard (tạo .env)
│   └── pick.js                 ← Menu tương tác
│
├── skills/shopify-test-gen/
│   └── SKILL.md                ← Rules Claude Code sinh test đúng pattern
│
└── playwright.config.ts        ← Config: env, auth, retry, screenshot on fail
```

---

## 8. Checklist kiểm chứng nhanh

| # | Kiểm tra | Lệnh | Kết quả mong đợi |
|---|----------|------|-----------------|
| 1 | Session hợp lệ | `cat .auth/session.json \| grep shopify` | Có cookies Shopify |
| 2 | Smoke tests pass | `npm run test:smoke` | `2+ passed` trong < 60s |
| 3 | Menu CLI hoạt động | `npm run test:pick` | Hiện menu 1-8 |
| 4 | Snapshot tạo được | `npm run snapshot` → `ls snapshots/avadaPlaza/` | Có `.png` + `.json` |
| 5 | DOM info hợp lệ | `cat snapshots/avadaPlaza/home.json` | Có `buttons[]`, `inputs[]` |
| 6 | AI generator chạy | `npm run test:generate` | Tạo file `.spec.ts` mới |
| 7 | Test mới đúng pattern | `grep "frame\." tests/...spec.ts` | Dùng `frame.*` không phải `page.*` |
| 8 | Test mới pass | `npm run test -- --grep "tên test"` | `1 passed` |
| 9 | Multi-env | `npm run test:staging` | URL dùng staging store |
| 10 | Report hiện | `npm run report` | Browser mở HTML report |

---

*Phiên bản: v1.4.0 — Cập nhật khi có thay đổi lớn về kiến trúc.*
