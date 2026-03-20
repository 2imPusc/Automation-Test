# Example Output

Kết quả mẫu của `extract.py` cho một Shopify app điển hình.

## Command chạy

```bash
python3 skills/app-context-extractor/scripts/extract.py \
  --app-key avadaPlaza \
  --app-name "Avada Plaza" \
  --src /Users/avada/avada-image-optimizer/packages/assets/src \
  --out skills/shopify-test-gen/references/app-context/avadaPlaza.md
```

## Output mẫu

```markdown
# Avada Plaza — App Context

> Auto-extracted by app-context-extractor on 2026-03-20.
> Review manually: verify nav labels, remove false-positives, add missing pages.

## Pages & Nav Links

| Nav label (verify exact text) | Notes |
|---|---|
| `"Image manager"` | |
| `"Script manager"` | |

**Routes found:**
- `/image-manager`
- `/settings`
- `/subscription`

## Toast / Success Messages (exact text)
```
"Settings updated successfully"
"Image optimized successfully"
"Optimization started"
"Revert finished"
```

## Button / Action Labels
```
"Optimize now"
"Optimize all"
"Compress image"
"Save"
"Discard"
```

## Selector Notes

- App runs inside Shopify iframe — use `frame.locator()` not `page.locator()`
- Nav links are outside iframe: `page.getByRole("link", { name: "..." })`
- Toast: `frame.locator('[role="alert"]').first()`
```

## Sau khi generate — review checklist

- [ ] Nav labels đúng với text hiển thị thật trong Shopify Admin
- [ ] Toast messages đúng exact (không bị i18n interpolation như `{name}`)
- [ ] Xóa button labels là internal/dev-only
- [ ] Thêm tay các trang không detect được từ source
