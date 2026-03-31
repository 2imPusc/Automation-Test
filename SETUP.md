# SETUP.md — Hướng dẫn cài đặt cho Tester

Tài liệu này dành cho **tester** cài đặt lần đầu trên máy cá nhân.

---

## Yêu cầu

| Công cụ | Version | Kiểm tra | Ghi chú |
|---------|---------|---------|---------|
| Node.js | ≥ 18 | `node --version` | Bắt buộc |
| Git | any | `git --version` | Bắt buộc |
| Claude Code CLI | latest | `claude --version` | Cần cho AI gen test |

---

## Bước 1 — Clone dự án

```bash
git clone https://github.com/2imPusc/Automation-Test.git shopify-autotest
cd shopify-autotest
npm install
npx playwright install chromium
```

---

## Bước 2 — Clone source code các app

Source code app cần có trên máy để AI đọc context (data-testid, routes, locale...).

```bash
# Avada Plaza (Image Optimizer)
git clone https://gitlab.com/avada/avada-image-optimizer ~/avada-image-optimizer

# SEO Suite
git clone https://gitlab.com/avada/seo ~/seo

# Blogs
git clone https://gitlab.com/avada/blogs ~/blogs
```

> **Lưu ý:** Nếu đường dẫn khác, cập nhật `repoPath` trong `skills/shopify-test-gen/references/apps-registry.json`.
> App handles cho test thì cấu hình trong `.env` (xem Bước 3).

---

## Bước 3 — Cấu hình file `.env`

Copy template và điền thông tin:

```bash
cp .env.example .env
```

Mở `.env` và điền:

```env
# ── Store (dùng chung cho mọi môi trường) ────────────
# Lấy từ URL: admin.shopify.com/store/[STORE_HANDLE]
STORE_HANDLE=ten-store-shopify-cua-ban

# ── App Handles: Local / Production ──────────────────
# Lấy từ URL: Admin → Apps → click app → /apps/[handle]
AVADA_PLAZA_HANDLE=avada-image-optimizer
SEO_HANDLE=avada-seo-suite
BLOGS_HANDLE=avada-blogs

# ── App Handles: Staging ─────────────────────────────
# Dùng prefix STAGING_ — khi chạy ENV=staging, hệ thống tự đọc key này
STAGING_AVADA_PLAZA_HANDLE=avada-image-optimizer-staging
STAGING_SEO_HANDLE=seo-staging
STAGING_BLOGS_HANDLE=blogs-staging

# ── GitLab Integration ────────────────────────────────
# Lấy từ: GitLab → Avatar → Edit profile → Access Tokens → tạo với scope read_api
GITLAB_TOKEN=glpat-...
GITLAB_URL=https://gitlab.com
```

> **Quan trọng:** Tất cả handles (local + staging) nằm trong **1 file `.env` duy nhất**.
> Khi chạy `ENV=staging`, hệ thống tự đọc key có prefix `STAGING_` thay vì key thường.

---

## Bước 3.5 — Cài OpenClaw + Claude Code và lấy Gateway Token

Web UI dùng **OpenClaw** để gọi Claude Code gen test. Cần cài cả hai và lấy token trước khi cấu hình Web UI.

### Cài Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
# Kiểm tra:
claude --version
# Ghi lại đường dẫn:
which claude   # ví dụ: /home/username/.local/bin/claude
```

> Nếu chưa có Claude subscription, cần đăng ký tại https://claude.ai

### Cài và khởi động OpenClaw

```bash
npm install -g openclaw
openclaw gateway start
# Kiểm tra:
openclaw gateway status
```

### Lấy Gateway Token

```bash
# Quay về thư mục gốc shopify-autotest
npm run gateway-token
```

Output sẽ có dạng:
```
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=84c9e2b0bb82f1bd...
```

**Lưu lại hai giá trị này** — cần dùng ở Bước 4.

---

## Bước 4 — Cài đặt Web UI

```bash
cd web
npm install
```

Tạo file `web/.env.local`:

```bash
cat > .env.local << 'EOF'
AVADA_NOTION_TOKEN=<dán token Notion vào đây>
GITLAB_TOKEN=<dán GitLab token vào đây>
GITLAB_URL=https://gitlab.com
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=<dán token từ Bước 3.5 vào đây>
CLAUDE_PATH=<kết quả của: which claude>
EOF
```

> **Cách lấy từng giá trị:**
> - `AVADA_NOTION_TOKEN` — hỏi team lead (Notion integration token, **không phải** personal token)
> - `GITLAB_TOKEN` — tạo tại GitLab → Avatar → Edit profile → Access Tokens → scope: `read_api`
> - `OPENCLAW_GATEWAY_TOKEN` — lấy từ output của `npm run gateway-token` (Bước 3.5)
> - `CLAUDE_PATH` — chạy `which claude` trong terminal, copy kết quả

Khởi động Web UI:

```bash
npm run dev
```

Web UI chạy tại: **http://localhost:3100**

> **Lưu ý:** `web/.env.local` không commit lên git. Mỗi tester tự điền token của mình.

---

## Bước 5 — Đăng nhập Shopify

```bash
# Quay về thư mục gốc
cd ..
npm run auth
```

Browser mở → đăng nhập Shopify bình thường. Session lưu tự động vào `.auth/session.json`.

---

## Bước 6 — Chạy thử

```bash
npm run test:smoke
```

✅ Pass → cài đặt hoàn tất.

---

## Workflow hàng ngày

### Cách 1 — Web UI (khuyến nghị)

1. Đảm bảo Web UI đang chạy: `cd web && npm run dev`
2. Mở **http://localhost:3100/smart-run**
3. Paste Notion task link → Parse → Gen test → Verify staging → Run

### Cách 2 — Terminal

```bash
# Verify staging + run test
npm run test:run

# Chỉ run test thủ công
npm run test:smoke
npm run test:pick     # menu tương tác 9 options
```

---

## Cách AI sinh test hoạt động

Khi dùng Web UI Smart Run hoặc Claude Code CLI để gen test:

```
Web UI (localhost:3100) / Claude Code CLI
  └→ Claude Code đọc context:
        ├─ skills/shopify-test-gen/SKILL.md (rules sinh test)
        ├─ skills/shopify-test-gen/references/app-context/ (source code đã scan)
        ├─ skills/shopify-test-gen/prompts/ (code-writer, flow-planner, error-analyzer)
        └─ Sinh test case + Page Object files vào tests/ + helpers/pages/
```

**Yêu cầu:** Máy cần cài [Claude Code CLI](https://claude.ai/code) — kiểm tra: `claude --version`

---

## Troubleshooting

### `AVADA_NOTION_TOKEN is not configured`
→ Tạo `web/.env.local` và điền token (xem Bước 5)

### `GITLAB_TOKEN not configured`
→ Tạo GitLab Personal Access Token với scope `read_api` (xem Bước 3)

### Session Shopify hết hạn
```bash
npm run auth:reset
npm run auth
```

### Không tìm thấy app handle
→ Vào Shopify Admin → Apps → click app → xem URL → copy `[handle]`

### Source code app không đồng bộ với branch cần test
```bash
cd ~/avada-image-optimizer   # hoặc ~/seo, ~/blogs
git fetch --all
git checkout ten-branch
git pull
```
Sau đó chạy lại gen test — context-sync sẽ tự re-extract.

---

## Thông tin cần hỏi team để điền .env

| Thông tin | Hỏi ai | Ghi chú |
|-----------|--------|---------|
| Staging handles (1, 2, 3...) | Dev/DevOps | Prefix `STAGING_1_`, `STAGING_2_`... |
| `AVADA_NOTION_TOKEN` | Team lead | Notion **integration** token, không phải personal token |
| GitLab URL (nếu self-hosted) | DevOps | Mặc định: `https://gitlab.com` |
| Store handle cho test | Dev | Lấy từ URL: `admin.shopify.com/store/[handle]` |

---

*Có vấn đề không có trong guide này? Ping team dev hoặc tạo issue trên GitLab.*
