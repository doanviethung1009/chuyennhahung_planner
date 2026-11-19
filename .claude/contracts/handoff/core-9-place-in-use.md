# Handoff CORE-9 — place_in_use (sửa D-1, S-1, S-2)
- Nhánh `fix/place-in-use` (từ origin/main 77578df). **Chưa commit/push/PR.** Contract: `.claude/contracts/core-9-place-in-use.md` (đã được duyệt, State REVIEW).
## Đã làm
- `errors.ts`: mã `place_in_use` (409), `details` trong ContentError, `placeInUse(counts)`; `http.ts` đưa `details` vào body.
- `content/repository.ts`: `countPlaceReferences` (đọc-only) + `deletePlace` ném `place_in_use` (không còn liệt kê id referrer).
- `planner/repository.ts`: `countPlaceReferences` (mọi hoạt động kể cả chuyến archive, mọi status review).
- Route DELETE places: 404 → đếm Planner (lỗi → 503, không xóa; chỉ log tên lỗi) → đếm content → 409 sáu số → `deletePlace` → 204. Vẫn token-only.
- UI: `place_in_use` vào `KNOWN_ERRORS` + `adminContent.errors` VI/EN (UI admin chưa có nút xóa place).
- Docs: S-1 (runbook DELETE places = Admin token, cả .vi), mã mới + giới hạn không-atomic trong `travel-content-api` (+vi), S-2 `follow-hung-footsteps` (+vi) trỏ trip-editor.
- Test: `tests/place-in-use.test.ts` (11, JSON, route-level); cập nhật `travel-content-repository.test.ts`; thêm ca PG trong `content-postgres` và `planner-postgres` integration.
## Kiểm tra (đã chạy)
- typecheck PASS; lint PASS (không output lỗi).
- `npm run test` PASS: 104 file pass, 3 skipped; 1311 pass, 91 skipped (suite PG bị skip khi thiếu TEST_DATABASE_URL).
- Với PG14 thử (cổng 55433, DB `core9test`): 107/107 file, 1401 pass, 1 skipped; đã dừng PG. Ca PG thêm ở commit thứ hai (lần đầu bị sót do một lệnh bị hook chặn, qc phát hiện).
- Route-level trên PG: NOT RUN (PG chỉ test ở mức repository, cùng logic với route). `/qc-check`, `/sec-check`: NOT RUN — khuyến nghị `/sec-check`.
## Lưu ý
- Hai kiểm tra không atomic khi hai store tách rời (đã ghi docs); backstop là `/api/admin/planner/integrity`.
- Worktree cần `npm ci` (không có node_modules).
## Follow-up (không làm ở đây)
S-3, S-4, S-5, S-6, P-1…P-6 của báo cáo CORE-8; nút xóa place trong UI admin nếu muốn.
