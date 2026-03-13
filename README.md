# Shopify Automation Tests

Dự án automation testing cho các ứng dụng Shopify sử dụng Playwright.

## Mục đích

- Tự động hóa việc test các tính năng của ứng dụng Shopify
- Kiểm tra UI/UX và chức năng trong Shopify Admin
- Phát hiện lỗi sớm trong quá trình phát triển

## Cài đặt

1. **Clone repository:**
   ```bash
   git clone https://github.com/2imPusc/Automation-Test.git
   cd shopify-autotest
   ```

2. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

3. **Cấu hình môi trường:**
   - Copy file `.env.example` thành `.env`:
     ```bash
     cp .env.example .env
     ```
   - Chỉnh sửa `.env` với thông tin của bạn:
     ```env
     STORE_HANDLE=your-shopify-store-handle
     APP_HANDLE=your-app-handle-in-shopify
     ```

## Cấu hình chi tiết

### Tìm STORE_HANDLE
- Vào Shopify Admin: `https://admin.shopify.com/store/YOUR_STORE`
- `YOUR_STORE` chính là STORE_HANDLE

### Tìm APP_HANDLE
1. Vào Apps list: `https://admin.shopify.com/store/YOUR_STORE/apps`
2. Click vào app cần test
3. Nhìn URL: `.../apps/YOUR_APP_HANDLE/embed/...`
4. `YOUR_APP_HANDLE` chính là APP_HANDLE

## Chạy Tests

### Setup Authentication (chạy 1 lần đầu)
```bash
npm run auth
```
Lệnh này sẽ mở browser để bạn login vào Shopify và lưu session.

### Reset Authentication
```bash
npm run auth:reset
```

### Chạy tất cả tests
```bash
npm run test
```

### Chạy tests cho Avada Plaza
```bash
npm run test:avada-plaza
```

### Chạy tests với UI mode (debug)
```bash
npm run test:ui
```

### Chạy tests với headed browser (thấy browser)
```bash
npm run test:headed
```

### Xem báo cáo
```bash
npm run report
```

## Cấu trúc dự án

```
shopify-autotest/
├── .env                    # Cấu hình môi trường (không commit)
├── .env.example           # Template cấu hình
├── helpers/
│   └── shopify.ts         # Utility functions cho Shopify
├── tests/
│   ├── auth.setup.ts      # Setup authentication
│   ├── example.spec.ts    # Ví dụ test
│   └── avada-plaza/       # Tests cho Avada Plaza app
│       ├── basic.spec.ts  # Tests cơ bản
│       └── compress.spec.ts # Tests nén ảnh
├── playwright.config.ts   # Cấu hình Playwright
└── package.json
```

## Lưu ý quan trọng

- **Authentication:** Phải chạy `npm run auth` trước khi chạy tests
- **Environment:** Đừng commit file `.env` (đã được ignore)
- **Selectors:** Có thể cần cập nhật selectors nếu UI app thay đổi
- **Timeouts:** Tests có timeout 60s, có thể điều chỉnh trong `playwright.config.ts`

## Troubleshooting

### Tests fail do authentication
```bash
npm run auth:reset
npm run auth
```

### Tests fail do selectors cũ
- Chạy `npm run test:headed` để debug
- Cập nhật selectors trong file test

### Không tìm thấy app
- Kiểm tra lại APP_HANDLE trong `.env`
- Đảm bảo app đã được install trong store

## Contributing

1. Fork repository
2. Tạo branch mới: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add some feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Tạo Pull Request

## License

ISC