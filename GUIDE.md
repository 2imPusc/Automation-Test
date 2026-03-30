# Hướng Dẫn Sử Dụng Shopify Automation Test

Tài liệu này dành cho **tester** — không cần biết code, chỉ cần làm theo từng bước.

---

## Mục lục

1. [Cài đặt lần đầu](#1-cài-đặt-lần-đầu)
2. [Cấu hình store](#2-cấu-hình-store)
3. [Đăng nhập Shopify](#3-đăng-nhập-shopify)
4. [Chạy tests](#4-chạy-tests)
5. [Tạo test mới bằng AI](#5-tạo-test-mới-bằng-ai)
6. [Chạy trên nhiều môi trường](#6-chạy-trên-nhiều-môi-trường)
7. [Xem báo cáo kết quả](#7-xem-báo-cáo-kết-quả)
8. [Xử lý sự cố thường gặp](#8-xử-lý-sự-cố-thường-gặp)

---

## 1. Cài đặt lần đầu

> Chỉ cần làm **1 lần duy nhất**.

**Yêu cầu:** máy đã cài [Node.js](https://nodejs.org) (version 18 trở lên).

```bash
# 1. Clone dự án về máy
git clone https://github.com/2imPusc/Automation-Test.git
cd shopify-autotest

# 2. Cài dependencies
npm install

# 3. Cài Playwright browsers
npx playwright install chromium
```

---

## 2. Cấu hình store

Chạy wizard cấu hình — sẽ hỏi từng bước:

```bash
npm run setup
```

```
🎭 Shopify Autotest Setup
─────────────────────────────────────
Store handle? (vd: my-store) → dophuc-store
Avada Plaza app handle? (Enter để bỏ qua) → avada-image-optimizer
SEO app handle? (Enter để bỏ qua) →
Blogs app handle? (Enter để bỏ qua) →

✅ .env đã được lưu!
👉 Next: npm run auth
```

### Tìm app handle ở đâu?

1. Vào **Shopify Admin** → **Apps**
2. Click vào app cần test
3. Nhìn URL trên browser:
   ```
   https://admin.shopify.com/store/dophuc-store/apps/[APP_HANDLE]/...
   ```
4. Copy phần `APP_HANDLE` và điền vào wizard

---

## 3. Đăng nhập Shopify

Chạy lệnh này để lưu session đăng nhập:

```bash
npm run auth
```

Browser sẽ tự mở → bạn **đăng nhập Shopify bình thường** (kể cả Google OAuth).
Sau khi đăng nhập xong, session được lưu tự động. **Không cần làm lại** trừ khi session hết hạn.

> **Lưu ý:** Nếu sau này test báo lỗi authentication, chạy:
> ```bash
> npm run auth:reset
> npm run auth
> ```

---

## 4. Chạy tests

### Cách dễ nhất — Menu chọn

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
  7. 🤖 Generate new test with AI
```

Nhập số và nhấn Enter.

---

### Các lệnh trực tiếp

| Lệnh | Mô tả | Khi nào dùng |
|------|-------|-------------|
| `npm run test:smoke` | Chạy smoke tests (< 60 giây) | Trước khi deploy, kiểm tra nhanh |
| `npm run test` | Chạy toàn bộ tests | Kiểm tra đầy đủ |
| `npm run test:avada-plaza` | Chỉ Avada Plaza | Khi sửa app Avada Plaza |
| `npm run test:seo` | Chỉ SEO app | Khi sửa SEO app |
| `npm run test:blogs` | Chỉ Blogs app | Khi sửa Blogs app |
| `npm run test:headed` | Chạy và thấy browser | Debug, xem thực tế |
| `npm run test:ui` | Mở giao diện debug | Debug chi tiết từng test |
| `npm run report` | Xem báo cáo HTML | Xem kết quả sau khi chạy |

---

### Đọc kết quả trên terminal

```
✓ Avada Plaza - Kiểm tra cơ bản › app load được (3.2s)
✓ Avada Plaza - Image Manager › trang hiển thị đúng @smoke (5.1s)
✗ Avada Plaza - Auto Optimize › click Optimize all (12.4s)
  → Error: Timeout waiting for toast to appear
```

- `✓` = pass ✅
- `✗` = fail ❌ — xem chi tiết bên dưới hoặc chạy `npm run report`

---

## 5. Chụp snapshot app (tùy chọn nhưng nên làm)

> Giúp AI "nhìn thấy" UI thật → viết selector chính xác hơn, ít phải sửa tay.

```bash
npm run snapshot
```

Wizard sẽ hỏi trang nào cần chụp thêm. Browser sẽ mở và tự chụp từng trang.
Screenshots + DOM info được lưu vào `snapshots/` (không commit lên git).

**Nên chạy lại khi:**
- UI app thay đổi (deploy mới)
- Thêm trang/section mới vào app
- Lần đầu setup dự án

---

## 6. Tạo test mới bằng AI

> Không cần biết code. Chỉ cần **mô tả bằng tiếng Việt** những gì cần test.

### Yêu cầu thêm

Máy cần cài [Claude Code CLI](https://claude.ai/code):
```bash
# Kiểm tra đã cài chưa
claude --version
```

### Cách dùng — Web UI (khuyến nghị)

1. Mở **http://localhost:3100/smart-run**
2. Paste Notion task link → **Parse**
3. **Generate Test Cases** — AI đọc source code context + SKILL.md
4. Chọn Staging → **Kiểm tra** branch deploy
5. **Run Tests**

### Cách dùng — Terminal (legacy)

```bash
npm run test:pick    # chọn option 7: Generate new test with AI
```

### Tips viết mô tả tốt

**Format gợi ý:**
```
App: [tên app]
Trang: [tên trang/section]
Flow:
- [bước 1]
- [bước 2]
- [điều cần kiểm tra]
```

**Ví dụ mô tả tốt:**
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

**Ví dụ mô tả cũng được (đơn giản hơn):**
```
Kiểm tra trang Dashboard của Avada Plaza hiển thị đúng số liệu thống kê
và không có lỗi khi load
```

---

## 7. Chạy trên nhiều môi trường

Hữu ích khi cần test trên staging trước khi lên production.

### Cấu hình

Tất cả handles nằm trong **1 file `.env` duy nhất**. Staging dùng prefix `STAGING_`:

```env
# Local / Production
AVADA_PLAZA_HANDLE=avada-image-optimizer

# Staging — hệ thống tự đọc key này khi ENV=staging
STAGING_AVADA_PLAZA_HANDLE=avada-image-optimizer-staging
```

Không cần tạo file `.env.staging` hay `.env.prod` riêng.

### Đăng nhập staging (nếu dùng store khác)

```bash
npm run auth:staging   # đăng nhập Shopify staging store
```

Session staging lưu tại `.auth/session.staging.json`. Nếu cùng store thì dùng chung session.

### Chạy tests

```bash
npm run test:staging   # chạy test trên staging (đọc STAGING_* handles)
npm run test:prod      # chạy test trên production
```

---

## 8. Xem báo cáo kết quả

```bash
npm run report
```

Browser sẽ mở báo cáo HTML với:
- **Danh sách tests** — pass/fail/skip
- **Timeline** từng bước trong test
- **Screenshot** khi test fail (chụp tự động)
- **Video** replay khi test fail

### Đọc báo cáo

Khi một test fail, click vào test đó để xem:
- **Error message** — lỗi cụ thể là gì
- **Screenshot** — UI trông như thế nào lúc fail
- **Trace** — replay từng action (click, type, wait...)

---

## 9. Xử lý sự cố thường gặp

### Test fail do "Authentication" / "Not logged in"

```bash
npm run auth:reset
npm run auth
```

### Test fail do "Timeout" / "Element not found"

App UI có thể đã thay đổi. Chạy headed để xem thực tế:

```bash
npm run test:headed
```

Chụp màn hình và gửi cho dev để cập nhật selector.

### Không tìm thấy app ("App not installed")

Kiểm tra lại `APP_HANDLE` trong file `.env`:
- Vào Shopify Admin → Apps → click app → xem URL
- Cập nhật bằng cách chạy lại `npm run setup`

### Browser không mở được khi `npm run auth`

```bash
# Cài lại browser
npx playwright install chromium
```

### AI gen test không chạy được

Cài Claude Code CLI: https://claude.ai/code — kiểm tra: `claude --version`

### Lỗi "Cannot find module" khi chạy test

```bash
npm install
```

---

## Tóm tắt workflow hàng ngày

```
Trước khi test:
  npm run test:smoke          → kiểm tra nhanh mọi thứ OK

Khi UI app thay đổi:
  npm run snapshot            → chụp lại UI mới để AI dùng

Khi test một feature mới:
  Mở localhost:3100/smart-run → paste Notion link → Gen → Run

Khi deploy:
  npm run test:staging        → test trên staging trước
  npm run test:prod           → confirm trên production

Khi có lỗi:
  npm run test:headed         → xem browser thực tế
  npm run report              → xem chi tiết lỗi + screenshot
```

---

*Có vấn đề không có trong guide này? Liên hệ team dev.*
