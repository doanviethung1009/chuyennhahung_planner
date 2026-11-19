# Handoff CORE-11 — củng cố bảo mật (S-3, S-4, S-6, P-3)
- Nhánh hiện tại `claude/stoic-cray-c659d3` (từ origin/main d154d96). **Chưa commit/push/PR.** Contract: `.claude/contracts/core-11-security-hardening.md` (APPROVED 2026-11-19, theo khuyến nghị). CORE-12, CORE-13 mới là contract APPROVED, chưa làm.
## Đã làm
- S-6: `ifMatchStamp` (`src/server/admin/content-route.ts`) bắt buộc `If-Match`; thiếu → 428 `precondition_required` (cả token). 8 route PATCH/POST (place, story, story-places, review, collection, template, reorder, move) bị ảnh hưởng; UI admin đã luôn gửi `If-Match` (story-places PATCH không có UI gọi).
- S-3: `/api/community/reports` — `Sec-Fetch-Site` ≠ same-origin, hoặc (khi thiếu) `Origin` lạ/sai định dạng → coi là khách (vẫn 201). Không có cả hai → như cũ.
- P-3: `toErrorResponse` log chỉ `name` + `message` cắt 200 ký tự.
- S-4: chỉ tài liệu (`docs/runbook.md` + `.vi.md`, mục Conventions).
- Docs VI+EN: runbook, travel-content-api (cả ví dụ cURL), architecture.
- Test: cập nhật `admin-content-session` (helper `reqM` tự gửi If-Match; ca 428 cho token/PATCH/reorder/move/collection), `travel-content-api` (helper `stampOf`), thêm ca S-3 vào `community-reports-routes`.
## Kiểm tra (đã chạy)
- typecheck PASS (không lỗi); lint PASS (không lỗi); `npm run test` PASS: 110 file pass, 4 skipped; 1366 pass, 95 skipped (suite PG skip vì thiếu TEST_DATABASE_URL — không chạm persistence).
- `/qc-check`, `/sec-check`: NOT RUN — khuyến nghị `/sec-check` (đổi hành vi ranh giới tin cậy).
## Lưu ý
- Thay đổi phá vỡ: script cURL dùng token PATCH không có `If-Match` giờ nhận 428.
- Worktree cần `npm ci` (đã chạy). Hai file contract CORE-11/12/13 chưa tracked.
