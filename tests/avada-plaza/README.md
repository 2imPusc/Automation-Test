# Avada Plaza Tests

Test suite cho app **Avada Plaza** (image optimizer).

## Test files

| File | Mô tả |
|------|-------|
| `basic.spec.ts` | Smoke tests: app load, không crash |
| `compress.spec.ts` | Image Manager: auto optimize + manual compress |

## Chạy tests

```bash
npm run test:avada-plaza
```

## Page Object

Dùng `ImageManagerPage` từ `helpers/pages/ImageManagerPage.ts`.
Khi UI app thay đổi → chỉ cần sửa selectors trong file đó, không cần đụng spec files.
