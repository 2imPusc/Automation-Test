# Output Format Spec

Context file phải follow format này để `shopify-test-gen` đọc đúng.

## File path

```
skills/shopify-test-gen/references/app-context/[appKey].md
```

`appKey` phải khớp với key trong `helpers/apps.ts` (camelCase: `avadaPlaza`, `seo`, `blogs`).

## Required sections

```markdown
# [AppName] — App Context

> [metadata comment]

## Pages & Nav Links
## Toast / Success Messages (exact text)
## Error / Warning Messages
## Button / Action Labels
## Selector Notes
```

## Optional sections

```markdown
## data-testid (use getByTestId)
## Page Headings
## Loading States
## Validation Rules
```

## Rules

1. **Nav labels** phải là **exact text** hiển thị trong Shopify Admin sidebar — shopify-test-gen dùng `page.getByRole('link', { name: '...' })`
2. **Toast messages** phải là **exact string** từ app — dùng cho `expect(toast).toHaveText('...')`
3. **Button labels** phải là **exact text** — dùng cho `frame.getByRole('button', { name: '...' })`
4. **Selector Notes** phải có ghi chú về iframe (`frame.` vs `page.`)
5. Không commit file nếu chứa sensitive data (store handle, API keys)
