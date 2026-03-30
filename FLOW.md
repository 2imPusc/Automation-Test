# FLOW.md — Luồng Hoạt Động Tổng Thể

---

## 1. Tổng quan luồng xử lý

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SHOPIFY AUTOTEST PIPELINE                          │
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐                  │
│  │  Notion Task │     │  GitLab MR  │     │  Manual Input │  ◄── ĐẦU VÀO   │
│  └──────┬──────┘     └──────┬──────┘     └──────┬───────┘                  │
│         └──────────────┬────┘───────────────────┘                           │
│                        ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Web UI (localhost:3100/smart-run)            ◄── ĐIỀU PHỐI          │   │
│  │  Next.js orchestrator — gọi API routes, stream SSE events           │   │
│  └──────────────────────────┬───────────────────────────────────────────┘   │
│                             │                                               │
│         ┌─────────────────┬─┴────────────────┬───────────────┐             │
│         ▼                 ▼                  ▼               ▼              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐       │
│  │ Layer 1     │  │ Layer 2      │  │ Layer 3      │  │ Layer 4   │       │
│  │ Context     │  │ Flow Planner │  │ Code Writer  │  │ Error     │       │
│  │ Collector   │  │              │  │              │  │ Analyzer  │       │
│  │             │  │ (OpenClaw    │  │ (Claude Code │  │ (OpenClaw │       │
│  │ (Scripts)   │  │  Gateway)    │  │  CLI)        │  │  Gateway) │       │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘       │
│         └──────────┬─────┘───────────┬─────┘                │              │
│                    ▼                 ▼                       │              │
│           ┌────────────────┐  ┌────────────────┐            │              │
│           │ Staging Verify │  │ Playwright     │────────────┘              │
│           │ (GitLab API)   │  │ Test Runner    │                           │
│           └────────┬───────┘  └───────┬────────┘                           │
│                    │                  │                                     │
│                    ▼                  ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  KẾT QUẢ ĐẦU RA                                                     │   │
│  │  ├─ Test spec files (.spec.ts) + Page Object files                   │   │
│  │  ├─ HTML Report (pass/fail + screenshot + video + trace)             │   │
│  │  └─ Notion task update (ghi kết quả test lên Notion)                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Các role tham gia

| Role | Công nghệ | Vai trò |
|------|-----------|---------|
| **Web UI** | Next.js 14 (localhost:3100) | Điều phối toàn bộ pipeline, giao diện cho tester |
| **OpenClaw Gateway** | Local proxy (localhost:18789) | AI inference — dùng Claude Max subscription, cung cấp API tương thích OpenAI |
| **Claude Code CLI** | CLI tool (~/.local/bin/claude) | Viết test code — đọc codebase, tạo file .spec.ts + Page Object |
| **Playwright** | Test framework | Chạy test trên Shopify Admin (iframe), sinh report |
| **Scripts** | Node.js scripts (scripts/) | Thu thập context (Notion, GitLab, source code, snapshot) |

---

## 2. Chi tiết từng phần

### 2.1 Đầu vào dữ liệu

Hệ thống nhận dữ liệu từ 3 nguồn chính:

#### Nguồn 1: Notion Task (chính)

```
Tester paste Notion task URL vào Web UI
    │
    ├─ API: POST /api/smart/parse-notion
    │       └→ scripts/notion-context.js đọc Notion API
    │
    └─ Trả về:
        ├─ pageId, title, description
        ├─ app (tên app: "App plaza Image optimizer", "Avada SEO suite"...)
        ├─ status, assignees
        └─ mr (GitLab MR URL — nếu có)
```

**Thông tin lấy được:** Tên task, mô tả chi tiết, app nào cần test, link MR.

#### Nguồn 2: GitLab MR (tự động từ Notion)

```
Nếu Notion task có link MR:
    │
    ├─ API: POST /api/smart/parse-gitlab
    │       └→ scripts/gitlab-context.js đọc GitLab API
    │
    └─ Trả về:
        ├─ branch (tên branch)
        ├─ title, description (MR title/desc)
        └─ diff (thay đổi code)
                │
                └→ scripts/diff-summary.js phân tích:
                    ├─ summary (tóm tắt thay đổi)
                    ├─ filesChanged (danh sách file thay đổi)
                    └─ keyChanges (thay đổi quan trọng)
```

**Thông tin lấy được:** Branch nào thay đổi, file nào bị sửa, nội dung thay đổi.

#### Nguồn 3: Manual Input (khi không có Notion)

```
Tester nhập trực tiếp trên Web UI:
    ├─ App: chọn từ dropdown (avadaPlaza / seo / blogs)
    ├─ Branch: tên branch cần test
    ├─ Title: tiêu đề task
    ├─ Description: mô tả chi tiết cần test gì
    └─ Bugs (tùy chọn): danh sách bug cần guard
```

#### Nguồn bổ sung: Source Code Context

```
scripts/context-sync.js
    │
    ├─ Đọc source code app từ repo local (~/avada-image-optimizer, ~/seo, ~/blogs)
    ├─ Checkout branch đúng (từ GitLab MR)
    ├─ Extract context → skills/shopify-test-gen/references/app-context/
    │       ├─ _overview.md (tổng quan app)
    │       ├─ image-manager.md (curated context cho từng feature)
    │       └─ image-manager.scanned.md (auto-scanned DOM info)
    │
    └─ scripts/source-loader.js load source files liên quan (max 10 files, 200 lines/file)
```

---

### 2.2 Xử lý — Các role tham gia

Pipeline xử lý gồm **3 Layer chính** + Error Analyzer + Staging Verify + Test Runner:

#### Layer 1: Context Collector (Scripts)

```
POST /api/smart/pipeline  (hoặc /api/smart/plan)
    │
    ├─ collectContext(input, stream)
    │
    ├─ 1. Parse Notion task (hoặc dùng manual input)
    ├─ 2. Parse GitLab MR → branch, diff summary
    ├─ 3. Context sync:
    │       ├─ Git fetch + checkout branch trên repo local
    │       └─ Extract/update context files
    ├─ 4. Load feature context:
    │       ├─ Tìm feature file phù hợp nhất (match theo diff hoặc title)
    │       ├─ Load curated + scanned supplement
    │       └─ Load source files liên quan
    └─ 5. Load snapshots (nếu có)
```

**Vai trò:** Thu thập tất cả dữ liệu cần thiết để AI hiểu feature cần test.

**Output:** `PipelineContext` object chứa notion info, gitlab info, feature context, source files, snapshots, metadata.

#### Layer 2: Flow Planner (OpenClaw Gateway)

```
planFlow(ctx, stream)
    │
    ├─ Đọc prompt template: skills/shopify-test-gen/prompts/flow-planner.md
    │
    ├─ Gọi OpenClaw Gateway:
    │       POST http://127.0.0.1:18789/v1/chat/completions
    │       Model: "openclaw:test-gen"
    │       Auth: Bearer OPENCLAW_GATEWAY_TOKEN
    │
    ├─ Input cho AI:
    │       ├─ Prompt template (rules phân tích flow)
    │       ├─ Task description + bugs
    │       ├─ Diff summary
    │       ├─ App overview
    │       ├─ Feature context
    │       └─ Source file names
    │
    └─ Output (JSON):
        FlowPlan {
            targetPage: "image-manager"
            featureFile: "image-manager.md"
            pomAction: "create" | "extend" | "reuse"
            existingPom: "ImageManagerPage.ts" | null
            scenarios: [
                {
                    name: "Kiểm tra auto optimize hoạt động"
                    type: "regression" | "smoke" | "guard" | "edge-case"
                    priority: "high" | "medium" | "low"
                    steps: ["Mở Image Manager", "Click Optimize Now", ...]
                    assertions: ["Toast 'Optimizing...' xuất hiện", ...]
                    needsSourceFiles: ["ImageManager.tsx", ...]
                    tags: ["@smoke"]
                }
            ]
        }
```

**Vai trò:** AI phân tích context → quyết định cần test những gì, bao nhiêu scenario, loại test nào (smoke/regression/guard/edge-case).

**Lưu ý:** Tester có thể review và chỉnh sửa plan trên Web UI trước khi sang Layer 3.

#### Layer 3: Code Writer (Claude Code CLI)

```
writeCode(ctx, plan, stream)
    │
    ├─ Đọc prompt template: skills/shopify-test-gen/prompts/code-writer.md
    │
    ├─ Chuẩn bị input:
    │       ├─ Test plan (từ Layer 2)
    │       ├─ Feature context + source files
    │       ├─ Codebase patterns:
    │       │       ├─ helpers/pages/BasePage.ts
    │       │       ├─ helpers/apps.ts
    │       │       ├─ helpers/shopify.ts
    │       │       ├─ fixtures/index.ts
    │       │       └─ Existing POM (nếu có)
    │       ├─ Metadata header (generated timestamp, task info)
    │       └─ UI snapshots (nếu có)
    │
    ├─ Spawn Claude Code CLI:
    │       claude --permission-mode bypassPermissions --print
    │       └→ stdin: prompt (full context + plan + patterns)
    │       └→ Timeout: 180s
    │
    ├─ Claude Code đọc codebase + viết files:
    │       ├─ tests/[app]/[feature]-[taskId].spec.ts (test spec)
    │       └─ helpers/pages/[Feature]Page.ts (POM mới, nếu cần)
    │
    └─ Validate:
        npx playwright test --list [files]
        └→ Kiểm tra syntax OK, test được nhận diện
```

**Vai trò:** AI viết code thực tế — tạo file test spec và Page Object, tuân thủ pattern của dự án.

**Tại sao dùng Claude Code CLI (không phải OpenClaw)?** Claude Code CLI có khả năng đọc/ghi file trực tiếp trên máy, hiểu cấu trúc codebase, và tuân thủ SKILL.md rules. OpenClaw Gateway chỉ cung cấp text completion.

#### Error Analyzer (OpenClaw Gateway)

```
POST /api/smart/analyze-errors
    │
    ├─ Khi test fail, Web UI gửi danh sách failed tests
    │
    ├─ Cho mỗi test fail (max 5):
    │       ├─ Load error context:
    │       │       ├─ test-results/[dir]/error-context.md (DOM snapshot lúc fail)
    │       │       ├─ Screenshot (.png)
    │       │       └─ Video (.webm) — nếu có
    │       ├─ Load test source code
    │       ├─ Load feature context
    │       │
    │       ├─ Gọi OpenClaw Gateway:
    │       │       Model: "openclaw:test-gen" (fallback: "openclaw:main")
    │       │       Prompt: error-analyzer.md + error details
    │       │
    │       └─ Output (JSON):
    │           AnalysisResult {
    │               diagnosis: { category, summary, details, confidence }
    │               rootCause: { isAppBug, isTestBug, isEnvIssue, explanation }
    │               suggestions: [{ action, description, code? }]
    │               evidence: [...]
    │           }
    │
    └─ Tester đọc diagnosis → quyết định fix test hay report bug cho dev
```

**Vai trò:** Khi test fail, AI phân tích nguyên nhân — lỗi app, lỗi test, hay lỗi môi trường.

#### Staging Verify (GitLab API)

```
POST /api/smart/verify-staging
    │
    ├─ Input: mrUrl, stageNum, expectedBranch
    │
    ├─ scripts/staging-verify.js
    │       └→ Gọi GitLab API kiểm tra:
    │           ├─ Branch nào đang deploy trên staging [stageNum]?
    │           ├─ Có match với expectedBranch không?
    │           └─ Deploy status (success/running/failed)?
    │
    └─ Output:
        ├─ ✅ match → sẵn sàng chạy test
        ├─ ❌ mismatch → cảnh báo, không nên chạy
        └─ ❓ not found → cảnh báo nhẹ, vẫn cho chạy
```

#### Test Runner (Playwright)

```
POST /api/run
    │
    ├─ Resolve environment handles (staging/local/prod)
    ├─ Build Playwright command:
    │       npx playwright test
    │           --project=chromium
    │           [--grep suite]
    │           [testFiles...]
    │           [--headed]
    │
    ├─ Environment variables:
    │       ├─ ENV=staging (nếu staging)
    │       ├─ STAGING_AVADA_PLAZA_HANDLE=... (nếu staging)
    │       ├─ LOCALE=en|vi
    │       └─ STORE_HANDLE=...
    │
    ├─ Playwright chạy:
    │       ├─ Load .auth/session.json → Shopify Admin đã login
    │       ├─ Mở Chromium (Chrome channel, anti-bot)
    │       ├─ Điều hướng đến app URL (iframe)
    │       ├─ Thực hiện test actions
    │       └─ Assert kết quả
    │
    └─ Output:
        ├─ RunSummary: { total, passed, failed, skipped, duration, failedTests }
        ├─ test-results/ (screenshots, videos, traces)
        └─ playwright-report/ (HTML report)
```

---

### 2.3 Kết quả đầu ra

| Output | Mô tả | Ai dùng |
|--------|--------|---------|
| **Test spec files** | `tests/[app]/[feature]-[taskId].spec.ts` — AI-generated Playwright test | Tester review, chạy lại |
| **Page Object files** | `helpers/pages/[Feature]Page.ts` — POM mới/cập nhật | Tester maintain, dùng lại |
| **HTML Report** | `playwright-report/` — pass/fail + screenshot + video + trace | Tester đọc kết quả |
| **Notion Update** | Ghi kết quả test (pass/fail/count) lên Notion task | PM, dev theo dõi |
| **Error Analysis** | AI phân tích nguyên nhân fail — app bug / test bug / env issue | Tester quyết định next step |
| **Run Logs** | SSE stream realtime trên Web UI — theo dõi tiến trình | Tester monitor |

---

## 3. Luồng xử lý chi tiết (End-to-End)

### 3.1 Smart Run — Luồng chính (Web UI)

```
TESTER                          WEB UI                        OPENCLAW / CLAUDE CODE
  │                               │                                │
  │  1. Paste Notion URL          │                                │
  │  ────────────────────────►    │                                │
  │                               │  Parse Notion task             │
  │                               │  Parse GitLab MR               │
  │                               │  Sync source context           │
  │  ◄─ Hiển thị task info ──────│                                │
  │                               │                                │
  │  2. Click "Generate Plan"     │                                │
  │  ────────────────────────►    │                                │
  │                               │  Layer 1: Collect Context      │
  │                               │  ─────────────────────────►    │
  │                               │                                │  OpenClaw: Flow Planner
  │                               │  Layer 2: Plan Flow            │  (openclaw:test-gen)
  │                               │  ─────────────────────────►    │
  │                               │  ◄── FlowPlan (scenarios) ────│
  │  ◄─ Hiển thị test plan ──────│                                │
  │                               │                                │
  │  3. Review & chỉnh sửa plan  │                                │
  │     (thêm/bớt scenarios,     │                                │
  │      sửa steps, priority)    │                                │
  │                               │                                │
  │  4. Click "Generate Code"     │                                │
  │  ────────────────────────►    │                                │
  │                               │  Layer 3: Write Code           │
  │                               │  ─────────────────────────►    │  Claude Code CLI
  │                               │                                │  (spawn process)
  │                               │                                │  Đọc codebase + viết files
  │                               │  ◄── files created ──────────│
  │  ◄─ Hiển thị created files ──│                                │
  │                               │                                │
  │  5. Chọn env + Click "Run"    │                                │
  │  ────────────────────────►    │                                │
  │                               │  Verify staging (nếu staging)  │
  │                               │  Spawn Playwright              │
  │  ◄─ Stream logs realtime ────│                                │
  │  ◄─ RunSummary (pass/fail) ──│                                │
  │                               │                                │
  │                               │  Update Notion task            │
  │                               │  (nếu có Notion URL)           │
  │                               │                                │
  │  6. Nếu có test fail:         │                                │
  │     Click "Analyze Errors"    │                                │
  │  ────────────────────────►    │                                │
  │                               │  ─────────────────────────►    │  OpenClaw: Error Analyzer
  │                               │  ◄── AnalysisResult ─────────│  (openclaw:test-gen)
  │  ◄─ Hiển thị diagnosis ──────│                                │
```

### 3.2 Terminal — Luồng thay thế

```
npm run test:pick → option 7 (Generate new test with AI)
    └→ Hỏi mô tả feature → spawn Claude Code CLI
        └→ Claude Code đọc SKILL.md + context → sinh test files

npm run test:run
    └→ Đọc last-task.json (hoặc hỏi Notion URL)
        └→ Verify staging deploy
            └→ Spawn Playwright chạy test
```

---

## 4. OpenClaw Gateway — Chi tiết tích hợp

### 4.1 OpenClaw là gì?

OpenClaw là local AI gateway proxy, cho phép các ứng dụng gọi Claude API thông qua **Claude Max subscription** (không cần API key riêng). Gateway chạy trên máy local và cung cấp endpoint tương thích OpenAI.

### 4.2 Cấu hình

```
~/.openclaw/openclaw.json
    ├─ gateway.auth.token  → OPENCLAW_GATEWAY_TOKEN
    └─ gateway.port        → mặc định 18789
```

Biến môi trường (trong `web/.env.local`):
```env
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=<token từ openclaw.json>
```

Lấy token nhanh:
```bash
node scripts/get-gateway-token.js
# Hoặc:
cat ~/.openclaw/openclaw.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['gateway']['auth']['token'])"
```

### 4.3 Cách dùng trong hệ thống

| Chức năng | Model | File sử dụng |
|-----------|-------|---------------|
| **Flow Planner** (Layer 2) | `openclaw:test-gen` | `web/src/app/api/smart/_shared/pipeline-helpers.ts` |
| **Error Analyzer** | `openclaw:test-gen` (fallback: `openclaw:main`) | `web/src/app/api/smart/analyze-errors/route.ts` |

```typescript
// Ví dụ call OpenClaw Gateway
const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${gatewayToken}`,
  },
  body: JSON.stringify({
    model: "openclaw:test-gen",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  }),
});
```

### 4.4 Health Check

Web UI tự kiểm tra OpenClaw khi load trang:

```
GET /api/smart/status
    └→ fetch(OPENCLAW_GATEWAY_URL/health, timeout 2s)
        ├─ ✅ OK → "Connected (test-gen ready)"
        └─ ❌ Fail → "Offline"
```

Hiển thị trên Status Panel của Smart Run page.

### 4.5 OpenClaw vs Claude Code CLI

| | OpenClaw Gateway | Claude Code CLI |
|---|---|---|
| **Dùng cho** | Text generation (plan, analyze) | Code generation (viết file) |
| **Cách gọi** | HTTP API (`/v1/chat/completions`) | Spawn process (`claude --print`) |
| **Khả năng** | Chỉ trả text response | Đọc/ghi file, hiểu codebase |
| **Model** | `openclaw:test-gen`, `openclaw:main` | Claude (via subscription) |
| **Timeout** | Tùy request | 180s |
| **Dùng ở** | Layer 2 (plan), Error Analyzer | Layer 3 (code writer) |

---

## 5. Cấu hình & Xác thực

### 5.1 File cấu hình `.env`

Mọi thứ bắt đầu từ file `.env` — chứa thông tin store và app handles:

```env
STORE_HANDLE=dophuc-store
AVADA_PLAZA_HANDLE=avada-image-optimizer
SEO_HANDLE=seo-pizza-app-phucdm
BLOGS_HANDLE=
```

`playwright.config.ts` đọc file `.env` duy nhất trước khi chạy bất kỳ test nào.
Multi-environment: `ENV=staging` → đọc key có prefix `STAGING_*` thay vì key thường (cùng file `.env`).

### 5.2 Session đăng nhập

```
npm run auth
    └→ Playwright mở browser → User đăng nhập Shopify
           └→ Session lưu vào .auth/session.json
                  └→ Mọi test đọc session này → chạy ở trạng thái đã login
```

Session thường dùng được nhiều tuần. Hết hạn → `npm run auth:reset && npm run auth`.

### 5.3 Multi-Environment

```
┌─────────────────────────────────────────────────────────────────────┐
│  Tất cả handles nằm trong 1 file .env duy nhất                     │
│                                                                     │
│  local   → đọc AVADA_PLAZA_HANDLE         + .auth/session.json     │
│  staging → đọc STAGING_AVADA_PLAZA_HANDLE  + .auth/session.staging.json (nếu có) │
│  prod    → đọc AVADA_PLAZA_HANDLE          + .auth/session.prod.json (nếu có)    │
│                                                                     │
│  Fallback: nếu session.staging.json không tồn tại → dùng session.json chung      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Cấu trúc Test

### 6.1 Page Object Model (POM)

Shopify apps chạy trong **iframe** — mọi selector phải dùng `frame.*` thay vì `page.*`.

```
Test spec (tests/avada-plaza/compress.spec.ts)
    └→ Gọi ImageManagerPage (helpers/pages/ImageManagerPage.ts)
           └→ Extends BasePage (helpers/pages/BasePage.ts)
                  └→ Dùng frame.locator() — không phải page.locator()
```

### 6.2 Fixtures

Fixtures tự động khởi tạo Page Object và inject vào test:

```typescript
import { test } from '../../fixtures';
test('...', async ({ imageManager }) => {
  // imageManager đã sẵn sàng, không cần boilerplate
});
```

### 6.3 App Registry

`helpers/apps.ts` chứa thông tin tất cả apps — đọc handle từ `.env`:

```typescript
APPS.avadaPlaza  →  handle: process.env.AVADA_PLAZA_HANDLE
APPS.seo         →  handle: process.env.SEO_HANDLE
APPS.blogs       →  handle: process.env.BLOGS_HANDLE
```

---

## 7. Báo cáo kết quả

```bash
npm run report
```

Browser mở HTML report, hiển thị:
- **Danh sách tests** — pass / fail / skip
- **Timeline** — từng bước trong test mất bao lâu
- **Screenshot tự động** — chụp ngay lúc test fail
- **Video replay** — xem lại toàn bộ test fail
- **Trace viewer** — replay từng action (click, type, navigate...)

---

## 8. Sơ đồ thư mục

```
shopify-autotest/
│
├── .env                        ← Store + app handles (local + staging, không commit)
├── .auth/session.json          ← Session Shopify đã login (không commit)
│
├── helpers/
│   ├── apps.ts                 ← Registry apps (đọc từ .env, staging dùng prefix STAGING_*)
│   ├── shopify.ts              ← goToApp(), getAppFrame(), waitForAppLoad()
│   ├── locale.ts               ← Locale helpers
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
│       ├── compress.spec.ts    ← Feature: auto optimize, manual compress
│       ├── image-manager-*.spec.ts  ← AI-generated tests
│       └── _archive/           ← Archived test specs
│
├── recorded-features/          ← Recorded test specs từ Web UI
│
├── scripts/
│   ├── run.js                  ← Verify staging + run
│   ├── pick.js                 ← Menu tương tác (9 options)
│   ├── setup.js                ← Setup wizard (tạo .env)
│   ├── snapshot.js             ← Chụp UI + extract DOM
│   ├── probe.js                ← Probe app pages
│   ├── scan-source.js          ← Đọc source code → context
│   ├── context-sync.js         ← Git sync + quản lý context cache
│   ├── source-loader.js        ← Load source files cho AI
│   ├── notion-context.js       ← Đọc Notion task API
│   ├── gitlab-context.js       ← Đọc GitLab MR API
│   ├── staging-verify.js       ← Verify staging deploy
│   ├── diff-summary.js         ← Phân tích git diff
│   ├── get-gateway-token.js    ← Lấy OpenClaw Gateway token
│   └── generate.legacy.js      ← AI generator (legacy, deprecated)
│
├── skills/
│   ├── shopify-test-gen/
│   │   ├── SKILL.md            ← Rules Claude Code sinh test đúng pattern
│   │   ├── prompts/            ← code-writer, flow-planner, error-analyzer
│   │   └── references/         ← app-context, templates, polaris-playwright-map
│   ├── app-context-extractor/  ← Tool extract context từ source code
│   └── skill-creator/          ← Tool tạo skill mới
│
├── web/                        ← Next.js Web UI (localhost:3100)
│   ├── src/app/smart-run/      ← Smart Run page (main UI)
│   └── src/app/api/smart/      ← API routes:
│       ├── pipeline/           ←   Full pipeline (context → plan → code)
│       ├── plan/               ←   Layer 1+2 only (context → plan)
│       ├── generate/           ←   Layer 3 only (plan → code)
│       ├── parse-notion/       ←   Parse Notion task
│       ├── parse-gitlab/       ←   Parse GitLab MR
│       ├── verify-staging/     ←   Verify staging deploy
│       ├── analyze-errors/     ←   AI error analysis
│       ├── status/             ←   System health check
│       ├── env-preview/        ←   Preview env handles
│       ├── update-notion/      ←   Write results to Notion
│       └── test-catalog/       ←   List existing test files
│
└── playwright.config.ts        ← Config: env, auth, retry, screenshot on fail
```

---

## 9. Checklist kiểm chứng nhanh

| # | Kiểm tra | Lệnh | Kết quả mong đợi |
|---|----------|------|-----------------|
| 1 | Session hợp lệ | `cat .auth/session.json \| grep shopify` | Có cookies Shopify |
| 2 | Smoke tests pass | `npm run test:smoke` | `2+ passed` trong < 60s |
| 3 | OpenClaw Gateway | `curl http://127.0.0.1:18789/health` | HTTP 200 |
| 4 | Web UI chạy | Mở `http://localhost:3100` | Trang load OK |
| 5 | Status Panel | Mở `http://localhost:3100/smart-run` | All OK (auth + gateway + notion) |
| 6 | Snapshot tạo được | `npm run snapshot` | Browser mở + chụp thành công |
| 7 | Source scan | `npm run scan-source` | Context files tạo trong references/app-context/ |
| 8 | AI Plan hoạt động | Smart Run → Generate Plan | Hiện danh sách scenarios |
| 9 | AI Code Writer | Smart Run → Generate Code | Tạo file `.spec.ts` mới |
| 10 | Test mới đúng pattern | `grep "frame\." tests/...spec.ts` | Dùng `frame.*` không phải `page.*` |
| 11 | Test mới pass | Run Tests trên Web UI | `passed` trong report |
| 12 | Multi-env | `npm run test:staging` | URL dùng staging store |
| 13 | Report hiện | `npm run report` | Browser mở HTML report |

---

*Phiên bản: v1.5.0 — Cập nhật: thêm chi tiết OpenClaw Gateway integration, mô tả 3-layer pipeline, role participants.*
