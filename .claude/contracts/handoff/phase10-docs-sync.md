# Handoff — phase10-docs-sync (docs only, 0 subagents)
Branch `docs/phase10-roadmap-sync`, base main = 5b755d1. Phase 10 vẫn "gần đóng", KHÔNG đóng.
- F1: guest review limit 3/h → 10/h (khớp `WRITE_LIMITS.guestReview`) ở `docs/features/README*.md`, `docs/usage*.md`; thêm `docs/architecture*.md` (grep thấy cùng lỗi); ADR 0014 giữ nguyên (lịch sử).
- `CURRENT.md`: đưa Phase 10 gần đóng lên đầu + điều kiện đóng; giữ nguyên lịch sử Phase 05.
- `PHASES.md` mục Phase 10 và `backlog.md`: ghi sec/qc 2026-11-17 PASS_WITH_WARNINGS, #137–#139, W1–W7, F2–F4, 2 câu hỏi #139, smoke NOT RUN, việc owner. Không tạo ID mới.
- Sửa dòng P10-11 (xóa review khách đã ở #139) và P10-13 (3/giờ → 10/giờ). `specs-community-roadmap*` và `project-context.md` không đổi (không sai).
- Checks: xem báo cáo cuối (typecheck/lint/test).
- Không merge. Quyết định W1/W2 thuộc chủ dự án.
