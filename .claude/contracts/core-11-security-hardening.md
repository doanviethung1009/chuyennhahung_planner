# Task Contract: CORE-11 Củng cố bảo mật còn lại của CORE-8 (S-3, S-4, S-6, P-3)
- Class: **L** (đổi hành vi ranh giới tin cậy: S-3, S-6). Branch đề xuất: `fix/core-security-followups` cắt từ `origin/main` @ `d154d96`. Một contract = một session = một nhánh = một PR, single agent. `/sec-check` khuyến nghị, chỉ chạy khi chủ dự án gọi.
- Nguồn: `.claude/reports/core-8-smoke-2026-11-19.md` mục 7 (S-3, S-4, S-6, P-3). **State: DONE (merged PR #189, 2026-11-19; If-Match now required for token callers too (428), same-origin check on reports, safer error log; sec-check NOT RUN)

## Bằng chứng đã xác minh trên `main` @ `d154d96`
- **S-3** `src/app/api/community/reports/route.ts:24-33`: chỉ nhận diện thành viên khi `Sec-Fetch-Site` vắng hoặc `same-origin`; khi vắng (client cũ/không phải trình duyệt) **không kiểm tra `Origin`**, trong khi Planner (`src/server/planner/http.ts` `requireSameOrigin`, ~116-146) có kiểm tra `Origin` qua `ownOrigins`. Tác động: một trang khác (trình duyệt không gửi Sec-Fetch-Site) có thể nộp báo cáo mang danh thành viên; chặn bởi 10 báo cáo/ngày.
- **S-4** `src/server/rate-limit.ts:144-150`: `clientKey` lấy phần tử đầu `x-forwarded-for`; limiter đăng nhập là bộ nhớ trong từng tiến trình (limiter ghi review/report đã chia sẻ qua PostgreSQL ở `planner/instance.ts`). An toàn khi nginx ghi đè `X-Forwarded-For` (đã có trong tài liệu).
- **S-6** `src/server/admin/content-route.ts:40-54` `ifMatchStamp` trả `undefined` khi thiếu `If-Match` → repository Content ghi đè (last write wins). 7 route dùng nó (stories, stories/places, places, reviews, collections, templates, reorder, move-activity). Planner bắt buộc `If-Match` (428). UI admin luôn gửi `If-Match` (`use-record.ts`).
- **P-3** `src/server/content/http.ts:69` `console.error('[travel-content] unhandled error', error)` log nguyên đối tượng lỗi (lỗi driver pg có thể mang tham số/câu lệnh).

## Thiết kế đề xuất (cần duyệt)
1. **S-3:** dùng chung bước kiểm tra nguồn với Planner (tách/hoặc gọi lại `requireSameOrigin`): có `Sec-Fetch-Site` ≠ `same-origin` hoặc `Origin` không thuộc `ownOrigins` → **vẫn nhận báo cáo nhưng như khách** (không gán userId), giữ hành vi hiện tại cho trường hợp đã có; thêm nhánh `Origin`. Không đổi mã lỗi, không chặn khách.
2. **S-4:** **không đổi mã.** Ghi rõ trong `docs/runbook.md` (+vi) giới hạn "theo tiến trình, một instance" và yêu cầu nginx ghi đè `X-Forwarded-For`; chuyển limiter đăng nhập sang PostgreSQL chỉ khi chủ dự án muốn (ngoài phạm vi).
3. **S-6 (đổi hành vi, cần quyết):** `If-Match` **bắt buộc** cho PATCH admin Content → thiếu header trả `428 precondition_required` (mã đã có cho Planner? kiểm tra `errors.ts`, nếu chưa thì thêm). Token API (`ADMIN_API_TOKEN`, script/cURL) cũng bị ảnh hưởng — xem câu hỏi 1.
4. **P-3:** log chỉ `error.name` + `error.message` đã cắt độ dài (không `stack`/tham số), cùng quy ước với CORE-9.
5. Test: S-3 (Origin lạ/đúng/vắng, có/không Sec-Fetch-Site), S-6 (thiếu → 428, đúng → 200, sai → 412, token-only vẫn theo quyết định), P-3 (không log đối tượng gốc). Tài liệu `docs/travel-content-api.md`, `docs/runbook.md`, `docs/architecture.*` (+ `.vi.md`) sửa cùng PR.

## Scope OUT
Đổi mô hình auth, hosted IdP, limiter dùng PostgreSQL, MFA, migration SQL, UI.

## Câu hỏi mở cho chủ dự án
1. **S-6:** bắt buộc `If-Match` cho **mọi** người gọi (kể cả token/cURL), hay chỉ cho phiên trình duyệt và giữ token được ghi đè? Khuyến nghị: bắt buộc cho tất cả, cập nhật tài liệu/ví dụ cURL. Đây là thay đổi phá vỡ cho script dùng token.
2. **S-3:** đồng ý "hạ xuống khách" thay vì từ chối 403?
3. **S-4:** đồng ý chỉ ghi tài liệu?

## Kiểm tra / Done
typecheck, lint, test PASS kèm output; suite PostgreSQL (PG14 `/opt/homebrew/opt/postgresql@14`, `-k ''`, TCP 127.0.0.1, `TEST_DATABASE_URL`, dừng sau khi chạy) nếu chạm persistence — dự kiến không chạm. Handoff ≤25 dòng trong `.claude/contracts/handoff/core-11-security-hardening.md`. Rollback: revert PR.
