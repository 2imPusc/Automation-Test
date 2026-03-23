# FLOW.md — Luồng Hoạt Động Hệ Thống

Tài liệu này mô tả **toàn bộ luồng hoạt động** của dự án `shopify-autotest`, từ kiến trúc tổng thể đến từng thành phần, kèm cách kiểm chứng kết quả ở mỗi bước.

---

## Tổng quan kiến trúc

```
Tester (mô tả) → AI Generator → Playwright Test → Báo cáo kết quả
                      ↑
              Snapshot (DOM thật) + App Context (source code)
```

Dự án có 3 tầng chính:

| Tầng | Vai trò | Thành phần |
|------|---------|------------|
| **Infrastructure** | Auth, config, helper | `.env`, `.auth/`, `helpers/`, `fixtures/` |
| **AI Generator** | Sinh test tự động | `scripts/generate.js`, `scripts/snapshot.js`, `skills/` |
| **Test Runner** | Chạy test, báo cáo | `tests/`, `playwright.config.ts`, HTML report |

---

## Phase 1 — Page Object Model (POM)

### Mục đích
Tách selector (UI locator) ra khỏi logic test → khi UI thay đổi, chỉ sửa 1 file POM thay vì sửa tất cả tests.

### Luồng

```
Test file (spec.ts)
    └→ Page Object (helpers/pages/XxxPage.ts)
           └→ BasePage.ts (waitForVisible, clickButton, ...)
                  └→ Playwright (browser automation)
```

### Thành phần

- **`helpers/pages/BasePage.ts`** — base class, chứa các action phổ biến:
  - `waitForVisible(locator, ms)` — chờ element hiện ra
  - `waitForHidden(locator, ms)` — chờ element ẩn đi
  - `clickButton(locator)` — click + chờ response
  - Throw lỗi rõ ràng kèm tên class khi timeout

- **`helpers/pages/ImageManagerPage.ts`** — Page Object của Image Manager:
  - Chứa toàn bộ locators: `toast`, `progress`, `skeleton`, `compressButton`...
  - Chứa actions: `goTo()`, `waitForLoad()`, `clickOptimizeNow()`, `switchToManualMode()`...

- **`helpers/apps.ts`** — registry các app:
  - Đọc handles từ env (`AVADA_PLAZA_HANDLE`, `SEO_HANDLE`, `BLOGS_HANDLE`)
  - Backward compat: `APP_HANDLE` vẫn là fallback

### Kiểm chứng Phase 1

```bash
npm run test:avada-plaza
```

✅ **Pass:** Terminal hiển thị `✓` cho `basic.spec.ts` và `compress.spec.ts`
❌ **Fail:** Chạy `npm run test:headed` → xem browser để biết UI thay đổi gì

---

## Phase 2 — Fixtures & Smoke Tests

### Mục đích
- **Fixtures:** tự động setup/teardown Page Objects, viết test gọn hơn
- **Smoke tests:** bộ test nhanh (< 60 giây) để verify hệ thống trước deploy

### Luồng

```
test('...', async ({ imageManager }) => { ... })
         ↑
fixtures/index.ts (tự khởi tạo ImageManagerPage, inject vào test)
```

### Thành phần

- **`fixtures/index.ts`** — re-export `test` từ Playwright, thêm fixture:
  - `imageManager`: khởi tạo `ImageManagerPage`, gọi `goTo()`, inject vào test
  - Test dùng `import { test } from '../../fixtures'` thay vì `@playwright/test`

- **Smoke tags:** thêm `@smoke` vào tên test → được pick bởi `grep: '@smoke'` trong config

### Kiểm chứng Phase 2

```bash
npm run test:smoke
```

✅ **Pass:** Chạy xong trong < 60 giây, toàn bộ `@smoke` test pass
```
✓ app load được @smoke (3.2s)
✓ Image Manager hiển thị đúng @smoke (5.1s)
2 passed (8.3s)
```

---

## Phase 3 — Authentication & Session

### Mục đích
Lưu session Shopify đã đăng nhập để các test không cần login lại mỗi lần.

### Luồng

```
npm run auth
    └→ Playwright mở browser → User đăng nhập Shopify thủ công
           └→ Session lưu vào .auth/session.json
                  └→ playwright.config.ts đọc session trước khi chạy test
                         └→ Tests chạy trong trạng thái đã đăng nhập
```

### Thành phần

- **`tests/auth.setup.ts`** — setup project "chromium setup":
  - Mở browser (headed) để user đăng nhập
  - Lưu storage state vào `.auth/session.json` (hoặc `.auth/session.staging.json`)
  
- **`playwright.config.ts`** — đọc `ENV` variable:
  - `ENV=staging` → load `.env.staging` và dùng `session.staging.json`
  - Mặc định → load `.env` và dùng `session.json`

### Kiểm chứng Phase 3

```bash
cat .auth/session.json | head -5
```

✅ **Pass:** File tồn tại, có chứa `cookies` của Shopify
❌ **Fail:** File không có hoặc rỗng → chạy lại `npm run auth`

---

## Phase 4 — Multi-Environment & Interactive CLI

### Mục đích
- Chạy test trên nhiều store (local dev / staging / production) mà không sửa code
- CLI wizard + menu để tester không cần nhớ commands

### Luồng: Multi-environment

```
ENV=staging npm run test
    └→ playwright.config.ts detect ENV=staging
           └→ load .env.staging (store handle, app handles)
                  └→ dùng .auth/session.staging.json
                         └→ chạy test trên staging store
```

### Luồng: Interactive CLI

```
npm run test:pick
    └→ scripts/pick.js hiện menu số
           └→ Tester chọn số (1-8)
                  └→ pick.js spawn đúng npm script tương ứng
```

### Kiểm chứng Phase 4

```bash
# Multi-env
npm run test:staging        # phải chạy test trên staging store URL

# Interactive picker
npm run test:pick           # phải hiện menu, chọn 5 → chạy smoke tests
```

---

## Phase 5A+B — AI Test Generator

### Mục đích
Tester mô tả bằng tiếng Việt → Claude Code đọc codebase → tự sinh spec file + Page Object đúng pattern.

### Luồng chi tiết

```
npm run test:generate
    │
    ├─ 1. Hỏi: app nào? branch nào? mô tả feature?
    │
    ├─ 2. context-sync (scripts/context-sync.js)
    │       └→ git pull để lấy code mới nhất
    │       └→ kiểm tra context cache còn valid không
    │       └→ nếu cần: re-extract source code → .context/[app].md
    │
    ├─ 3. Inject context vào prompt
    │       ├─ skills/shopify-test-gen/SKILL.md (rules + pattern)
    │       ├─ .context/[app].md (source code hiện tại)
    │       └─ snapshots/[app]/*.json (DOM info thật — nếu có)
    │
    ├─ 4. Claude Code đọc toàn bộ → viết:
    │       ├─ helpers/pages/[Feature]Page.ts
    │       └─ tests/[app]/[feature].spec.ts
    │
    └─ 5. Retry loop (tối đa 3 lần)
            └→ nếu test fail → Claude Code xem lỗi → sửa → chạy lại
```

### Thành phần

- **`scripts/generate.js`** — orchestrator chính
- **`scripts/context-sync.js`** — git pull + quản lý context cache
- **`scripts/scan-source.js`** — đọc source code app → xuất `.context/[app].md`
- **`skills/shopify-test-gen/SKILL.md`** — skill file dạy Claude Code:
  - 7 bước rõ ràng: đọc context → phân tích → quyết định POM → viết → validate → báo cáo
  - Rules bắt buộc: không hardcode handle, dùng `frame.*` (iframe), tag `@smoke`
- **`skills/shopify-test-gen/examples/`** — ví dụ input/output để Claude Code follow

### Kiểm chứng Phase 5A+B

```bash
npm run test:generate
```

Nhập mô tả test case đơn giản, ví dụ:
```
App: Avada Plaza
Trang: Dashboard
Flow:
- Mở trang dashboard
- Kiểm tra trang load không có lỗi
```

✅ **Pass:**
- Claude Code tạo file `helpers/pages/DashboardPage.ts` và `tests/avada-plaza/dashboard.spec.ts`
- Test file mới sử dụng `frame.*` (không phải `page.*`)
- Không có hardcode URL hay handle
- Tag `@smoke` xuất hiện trong tên test

❌ **Fail phổ biến:**
- `claude: command not found` → cài Claude Code CLI
- Test sinh ra fail ngay → xem log Claude Code → thường do selector sai → chạy `npm run snapshot` trước

---

## Phase 5C — UI Snapshot + Context Injection

### Mục đích
Playwright "nhìn" vào app thật, chụp DOM thực tế → inject vào prompt Claude Code → selector chính xác hơn.

### Luồng chi tiết

```
npm run snapshot
    │
    ├─ 1. Hỏi: chụp app nào? trang nào?
    │
    ├─ 2. Playwright mở browser (headed), load session đã auth
    │
    ├─ 3. Với mỗi trang:
    │       ├─ Chụp screenshot → snapshots/[app]/[page].png
    │       └─ Extract DOM info:
    │               ├─ Buttons: text + aria-label + selector
    │               ├─ Inputs: placeholder + name + type
    │               ├─ Links: text + href
    │               └─ Headings: text + level (h1/h2/h3)
    │       └─ Lưu → snapshots/[app]/[page].json
    │
    └─ 4. Tạo snapshots/index.json (map: app → pages có snapshot)
```

### Khi `npm run test:generate` chạy (có snapshot)

```
generate.js đọc snapshots/index.json
    └→ Tìm snapshot của app được chọn
           └→ Inject vào prompt:
                  "Trang home có các button: ['Optimize Now', 'View Details', ...]
                   Input: ['search-box (placeholder: Search images...)']"
                  └→ Claude Code dùng tên thật → ít cần sửa selector
```

### Kiểm chứng Phase 5C

```bash
npm run snapshot
```

Chọn app, chọn trang home. Sau khi chạy xong:

```bash
ls snapshots/avadaPlaza/         # phải có home.png và home.json
cat snapshots/avadaPlaza/home.json | head -20  # phải có buttons[], inputs[]
cat snapshots/index.json         # phải list avadaPlaza với pages: ["home"]
```

✅ **Pass:** Có file `.png` (screenshot thật) và `.json` (DOM info có nội dung)
❌ **Fail:** File `.json` rỗng hoặc chỉ có `{}` → app load trong iframe, selector có thể cần điều chỉnh trong `snapshot.js`

---

## Luồng Tổng Hợp — Workflow Hàng Ngày

```
┌─────────────────────────────────────────────────────────┐
│                  MỖI NGÀY / TRƯỚC DEPLOY                │
│                                                         │
│  1. npm run test:smoke      ← verify nhanh (~60s)       │
│     ✓ pass → tiếp tục                                   │
│     ✗ fail → npm run test:headed → xem browser          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              KHI CẦN TEST FEATURE MỚI                   │
│                                                         │
│  1. npm run snapshot        ← chụp UI hiện tại          │
│  2. npm run test:generate   ← mô tả → AI sinh test      │
│  3. npm run test:headed     ← xem kết quả trực quan     │
│  4. npm run report          ← xem báo cáo chi tiết      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              KHI UI APP THAY ĐỔI                        │
│                                                         │
│  1. npm run snapshot        ← chụp lại UI mới           │
│  2. Chạy lại test generate  ← AI dùng DOM mới           │
│     HOẶC: sửa tay POM tương ứng trong helpers/pages/    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              STAGING / PRODUCTION                       │
│                                                         │
│  npm run auth:staging  → npm run test:staging           │
│  npm run auth:prod     → npm run test:prod              │
└─────────────────────────────────────────────────────────┘
```

---

## Bảng kiểm chứng nhanh (Checklist)

| Kiểm tra | Lệnh | Kết quả mong đợi |
|----------|------|-----------------|
| Auth hoạt động | `cat .auth/session.json \| head -3` | Có `cookies` của Shopify |
| Smoke tests pass | `npm run test:smoke` | `2 passed` trong < 60s |
| Menu CLI hoạt động | `npm run test:pick` | Hiện menu 1-8 |
| Snapshot tạo được | `ls snapshots/avadaPlaza/` | Có `.png` + `.json` |
| DOM info hợp lệ | `cat snapshots/avadaPlaza/home.json` | Có `buttons`, `inputs` |
| AI generator chạy | `npm run test:generate` | Tạo file `.spec.ts` mới |
| Test mới pass | `npm run test -- --grep "feature vừa tạo"` | `1 passed` |
| Multi-env | `npm run test:staging` | URL dùng staging store |
| Report hiện | `npm run report` | Browser mở HTML report |

---

## Sơ đồ thư mục liên quan

```
shopify-autotest/
├── .auth/
│   └── session.json           ← Session Shopify (Phase 3)
├── .context/
│   └── [app].md               ← Source code cache cho AI (Phase 5A)
├── snapshots/
│   ├── index.json             ← Index các snapshot có sẵn (Phase 5C)
│   └── avadaPlaza/
│       ├── home.png           ← Screenshot thật (Phase 5C)
│       └── home.json          ← DOM info thật (Phase 5C)
├── fixtures/
│   └── index.ts               ← Custom fixtures (Phase 2)
├── helpers/
│   ├── apps.ts                ← App registry (Phase 1)
│   ├── shopify.ts             ← Utility functions
│   └── pages/
│       ├── BasePage.ts        ← Base class POM (Phase 1)
│       └── [Feature]Page.ts   ← Page Objects (Phase 1 + AI-generated)
├── scripts/
│   ├── generate.js            ← AI generator orchestrator (Phase 5A)
│   ├── snapshot.js            ← UI snapshot tool (Phase 5C)
│   ├── context-sync.js        ← Git sync + context cache (Phase 5A)
│   ├── scan-source.js         ← Source extractor (Phase 5A)
│   ├── setup.js               ← Setup wizard (Phase 4)
│   └── pick.js                ← Interactive menu (Phase 4)
├── skills/
│   └── shopify-test-gen/
│       └── SKILL.md           ← Rules cho Claude Code (Phase 5B)
└── tests/
    ├── auth.setup.ts          ← Auth setup (Phase 3)
    └── avada-plaza/
        ├── basic.spec.ts      ← Smoke tests (Phase 2)
        └── compress.spec.ts   ← Feature tests (Phase 1)
```

---

*Tài liệu này mô tả trạng thái dự án tại v1.4.0. Cập nhật khi có phase mới.*
