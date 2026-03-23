# Shopify Automation Tests

Dự án automation testing cho các Shopify app sử dụng [Playwright](https://playwright.dev), tích hợp AI để sinh test case tự động từ Notion task.

---

## Tính năng

| | Tính năng |
|---|---|
| ✅ | **Page Object Model** — selectors tập trung, dễ maintain |
| ✅ | **Multi-app** — Avada Plaza, SEO, Blogs từ cùng 1 dự án |
| ✅ | **Multi-environment** — local / staging / production |
| ✅ | **Smoke tests** — chạy nhanh < 60s trước mỗi deploy |
| ✅ | **AI Test Generator** — sinh test từ Notion task, dùng Claude Max |
| ✅ | **Staging verify** — kiểm tra branch deploy trước khi chạy test |
| ✅ | **Web UI** — giao diện tại `localhost:3100` |

---

## Kiến trúc

```
Web UI (localhost:3100)
    └→ OpenClaw Gateway (localhost:18789, dùng Claude Max)
            └→ Agent test-gen
                    ├─ Đọc SKILL.md + .context/ + snapshots/
                    └─ Sinh test files vào tests/ + helpers/pages/

Playwright runner
    └→ Shopify Admin (session đã auth)
            └→ App iframe (frame.* thay vì page.*)
```

---

## Cài đặt

### Cách nhanh — dùng OpenClaw (khuyến nghị)

```bash
# 1. Cài OpenClaw và start
npm install -g openclaw && openclaw start

# 2. Từ thư mục repo, cài skill setup
openclaw skill install docs/shopify-autotest-setup.skill
```

Nhắn agent:
> "Setup shopify-autotest cho tôi: https://github.com/2imPusc/Automation-Test"

Agent tự detect OS, clone repo, cài dependencies, cấu hình `.env`, tạo agent `test-gen`, và verify. Xem chi tiết: **[SETUP.md](SETUP.md)**

---

### Cài thủ công

#### 1. Clone & cài dependencies

```bash
git clone https://github.com/2imPusc/Automation-Test.git shopify-autotest
cd shopify-autotest
npm install
npx playwright install chromium
```

#### 2. Clone source code app (cần cho AI đọc context)

```bash
git clone https://gitlab.com/avada/avada-image-optimizer ~/avada-image-optimizer
git clone https://gitlab.com/avada/seo ~/seo
git clone https://gitlab.com/avada/blogs ~/blogs
```

#### 3. Cấu hình `.env`

```bash
cp .env.example .env
# Điền: STORE_HANDLE, app handles, staging handles, GITLAB_TOKEN, AVADA_NOTION_TOKEN
```

#### 4. Đăng nhập Shopify

```bash
npm run auth
```

#### 5. Setup Web UI

```bash
cd web && npm install
node ../scripts/get-gateway-token.js  # lấy OPENCLAW_GATEWAY_TOKEN
# Tạo web/.env.local với token vừa lấy
npm run dev  # http://localhost:3100
```

---

## Workflow hàng ngày

### Web UI (khuyến nghị cho tester)

1. Mở **http://localhost:3100/smart-run**
2. Paste Notion task link → **Parse**
3. **Generate Test Cases** (AI đọc source code + bug list)
4. Chọn Staging → **Kiểm tra** branch deploy
5. **▶ Run Tests**

### Terminal

```bash
npm run test:generate   # gen test từ Notion task
npm run test:run        # verify staging + run
npm run test:smoke      # smoke test nhanh (< 60s)
npm run test:pick       # menu chọn test suite
npm run report          # xem HTML report
```

---

## Cấu trúc dự án

```
shopify-autotest/
├── .env                    # Config local (không commit)
├── .env.example            # Template
├── fixtures/index.ts       # Custom Playwright fixtures
├── helpers/
│   ├── apps.ts             # Registry app (đọc từ .env)
│   ├── shopify.ts          # goToApp(), waitForAppLoad()
│   └── pages/
│       ├── BasePage.ts     # Base class POM
│       └── ImageManagerPage.ts
├── scripts/
│   ├── generate.js         # AI test generator (CLI)
│   ├── run.js              # Verify staging + run
│   ├── notion-context.js   # Đọc Notion task
│   ├── gitlab-context.js   # MR diff fallback
│   ├── staging-verify.js   # Kiểm tra staging deploy
│   ├── snapshot.js         # Chụp UI thật
│   ├── context-sync.js     # Sync source code context
│   └── get-gateway-token.js
├── skills/
│   └── shopify-test-gen/SKILL.md   # Rules cho AI
├── tests/
│   ├── auth.setup.ts
│   └── avada-plaza/
│       ├── basic.spec.ts   # Smoke tests
│       └── compress.spec.ts
├── web/                    # Next.js Web UI (localhost:3100)
├── docs/
│   ├── SETUP.md → xem SETUP.md
│   ├── FLOW.md → xem FLOW.md
│   └── shopify-autotest-setup.skill
└── playwright.config.ts
```

---

## Viết test mới

```typescript
// Import từ fixtures (không phải @playwright/test)
import { test, expect } from '../../fixtures';

test('tên test @smoke', async ({ imageManager }) => {
  await expect(imageManager.frame.getByText('Total images')).toBeVisible();
  await imageManager.clickOptimizeNow();
});
```

**Quy tắc bắt buộc:**
- Dùng `frame.*` không phải `page.*` — Shopify app chạy trong iframe
- Không hardcode handle — dùng `APPS.avadaPlaza.handle`
- Tag `@smoke` cho test quan trọng

---

## Troubleshooting

| Lỗi | Fix |
|-----|-----|
| Authentication failed | `npm run auth:reset && npm run auth` |
| App not found | Kiểm tra handle trong `.env` |
| Session expired | `npm run auth:reset && npm run auth` |
| Selectors cũ | `npm run test:headed` → xem browser thực tế |
| test-gen agent 404 | `openclaw gateway restart` |
| NOTION_TOKEN error | Thêm vào `web/.env.local` |

---

## Tài liệu

- **[SETUP.md](SETUP.md)** — Hướng dẫn cài đặt đầy đủ (macOS + Windows)
- **[FLOW.md](FLOW.md)** — Kiến trúc và luồng hoạt động tổng thể
- **[GUIDE.md](GUIDE.md)** — Hướng dẫn sử dụng cho tester
- **[CHANGELOG.md](CHANGELOG.md)** — Lịch sử thay đổi

---

## License

ISC
