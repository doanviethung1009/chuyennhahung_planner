# Handoff — CORE-8 smoke end-to-end và review lõi (2026-11-19)
Nhánh `claude/core-8-verification-2853d3` (đích `docs/core-8-verification`), worktree, **chưa commit, chưa push, chưa PR**. 0 agent ngoài `qc` và `security`. Commit đã kiểm `24ffac5` (main đến #173); `origin/main` đã có thêm #174 — không kiểm.
- Báo cáo: `.claude/reports/core-8-smoke-2026-11-19.md`.
- Checks: typecheck PASS · lint PASS · test PASS (103 file pass/3 skip, 1299 test) · build PASS · suite PostgreSQL PASS (106 file, 1387 test, DB thử riêng).
- Smoke: A, C, D, E đạt (API + UI một phần); B đạt ở mức API (không đăng nhập member trong trình duyệt). Đo 375/768 (VI, một ít EN), 1280 vài trang. Nhiều màn admin chưa bấm ở 768/1280 — NOT RUN.
- Review: `/qc-check` **BLOCKED**; `/sec-check` PASS_WITH_WARNINGS. → "Core Product Complete" = chưa hoàn thành.
- Lỗi chặn: D-1 xóa place vẫn 204 khi chuyến đi còn tham chiếu (quyết định 11 `place_in_use` chưa có trong mã).
- Nên sửa: runbook.md:127 sai (DELETE places token-only); follow-hung-footsteps.md nói editor chưa có; mục tiêu bấm <44px ở header/footer; `/api/community/reports` thiếu kiểm tra Origin; `If-Match` tùy chọn ở Content.
- Hoàn thiện: lời chào dashboard "biên tập viên" cho super_admin; 401 console ở mọi trang công khai; log nguyên object lỗi; seed template/story lệch nguồn.
- Không được bao phủ: WEB-1 (`/places`), WEB-2 (P04-4), WEB-3 (Playwright), PR #174.
- Bảy tiêu chí "Core Product Complete" không có trong repo; báo cáo dùng bảy nhóm tạm — cần chủ dự án/session cha xác nhận.
- Dữ kiện: ứng dụng không có đăng ký mật khẩu công khai; tài khoản thử tạo bằng `admin:create` + service token cục bộ.
- Đã dừng server `next start` và PostgreSQL thử; không có server nền nào còn chạy.
- Chờ chủ dự án: có commit/PR cho báo cáo + handoff không; quyết định hạ/giữ D-1; bảy tiêu chí thật.
