# Task Contract: CORE-10 — Nút "Xóa" place trong UI admin (chỉ admin / super admin)
- ID: **CORE-10** (nối tiếp [CORE-9](core-9-place-in-use.md), phần "nút xóa place trong UI admin" mà CORE-9 để OUT of scope).
- Class: **L** (đổi quyền + route + UI + tài liệu) · Branch: `feat/admin-place-delete` · One contract = one session = one branch = one PR, single agent (sub-agents 0).
- State: **ĐÃ DUYỆT 2026-11-19 → ĐÃ CODE, chờ chủ dự án cho phép commit/push/PR** (nhánh `feat/admin-place-delete` cắt từ `fix/place-in-use`; chưa commit). Không thêm dòng vào `core-completion-index.md` (chưa có hàng CORE-9 ở nhánh này).
- Desired outcome: admin và super admin xóa được một place từ `/admin/content/places/[slug]` bằng trình duyệt (có hộp xác nhận, thấy số đếm khi 409 `place_in_use`); editor/member không thấy nút và server trả 403 nếu gọi thẳng.

## Base branch (nêu rõ)
PR #179 (`fix/place-in-use`) **chưa merge** (kiểm 2026-11-19: OPEN). CORE-10 phụ thuộc code của nó (`place_in_use`, `ContentError.details`, `countPlaceReferences`, chuỗi `adminContent.errors.place_in_use`). Cắt nhánh `feat/admin-place-delete` từ `fix/place-in-use` (448e831/59e664b). Khi #179 merge: `git rebase --onto origin/main fix/place-in-use` rồi PR vào `main`. Nếu #179 bị squash/đổi, rebase lại theo `main`. Không mở PR của CORE-10 trước khi #179 merge (hoặc ghi rõ "stacked on #179" trong PR).

## Evidence (đã đọc)
- `src/server/identity/permissions.ts`: vai trò `member | editor | admin | super_admin`; `can(principal, action)`; `isAdminRole`. Editor có `content:write`, `story:publish`, `template:write`, `community:moderate`; admin/super_admin thêm `user:*`, `community:restrict/erase`, `audit:read`. **Chưa có action nào cho "xóa cứng content".**
- `src/server/planner/http.ts` `resolveAdminPrincipal(request, { action, session })`: token (header `Authorization`) → `service`; session cookie → bắt buộc same-origin, rate-limit 30/phút/user, `password_change_required` chặn; kiểm `can()` cho mọi principal.
- `src/app/api/admin/travel/places/[slug]/route.ts` (trên `fix/place-in-use`): `DELETE` dùng `adminRoute` (token-only) → trình duyệt không gọi được. GET/PATCH dùng `adminContentRoute(..., { action: 'content:write', session: true })`.
- Tiền lệ: `community:erase` (admin trở lên; ADR 0024 §8) + trang `admin/community/page.tsx` truyền `canErase={can(access.principal, 'community:erase')}` xuống client island → nút chỉ hiện khi được phép. `requireStaff(..., 'content')` lấy `access.principal`.
- UI: `place-editor.tsx` → `record-shell.tsx` (thanh lưu, `LiveNotice`); `content-list.tsx` (danh sách). `useErrorNotice` + `KNOWN_ERRORS` trong `use-record.ts` đã có `place_in_use`; chuỗi VI/EN `adminContent.errors.place_in_use` (messages dòng ~759). `ContentError.details` mang số đếm (stories, collections, templates, contentReviews, tripActivities, communityReviews).
- Docs hiện sai/chưa khớp: `docs/runbook.md` dòng 127 ghi `DELETE places` = "Admin token or staff session" (thực tế token-only); `docs/travel-content-api.md` dòng 47 ("`DELETE` of stories/places/reviews stays token-only") và dòng 98.

## Quyết định thiết kế cần duyệt (đổi quyền — XL-ish nên xin duyệt trước)
1. **Action mới `content:delete`** (không dùng lại `community:erase`/`user:provision` vì sai nghĩa). `ROLE_ACTIONS`: `admin`, `super_admin`, `service` có; `editor`, `member` **không**. Lý do: xóa vĩnh viễn không phải việc của editor (cùng tinh thần quyết định 2026-11-19 cho collections/templates). Đây là chỗ duy nhất mở rộng quyền; test ghim ma trận.
   - Phương án thay thế (không khuyến nghị): cho cả editor → trái quyết định "xóa vĩnh viễn không phải việc editor".
2. `DELETE places/[slug]` chuyển sang `adminContentRoute(request, { action: 'content:delete', session: true }, …)`: **vẫn nhận token** (service có `content:delete`), thêm session admin/super admin. Giữ nguyên toàn bộ thứ tự CORE-9 (đếm Planner fail-closed 503 → đếm content → 409 → xóa). Kiểm tra ở server; ẩn nút chỉ là tiện lợi.
3. Phạm vi **chỉ place**. `stories`, `reviews`, `collections`, `templates` DELETE giữ token-only (không đổi trong CORE-10).
4. UI: nút "Xóa địa điểm" ở `record-shell.tsx` (chỉ khi `back==='places'` và prop `canDelete`), `canDelete = can(access.principal, 'content:delete')` tính ở server page rồi truyền xuống `PlaceEditor`. Nút nằm ở vùng riêng "Vùng nguy hiểm", tách khỏi nút Lưu. Không thêm nút vào danh sách (tránh xóa nhầm; có thể mở rộng sau).
5. Hộp xác nhận: `<dialog>` modal (focus vào nút Hủy khi mở, Esc đóng, trả focus về nút Xóa; tiêu đề + tên place; nút "Xóa vĩnh viễn" + "Hủy"). Không dùng `window.confirm`.
6. Lỗi 409: hiện `place_in_use` qua `useErrorNotice` **kèm danh sách số đếm** (chuỗi mới, ví dụ "Bài viết: 2 · Bộ sưu tập: 1 …", chỉ liệt kê loại > 0). Cần `api()` lỗi giữ `details` (kiểm khi vào code; nếu `ApiError` chưa mang `details`, mở rộng tối thiểu). 403/503/401 dùng `KNOWN_ERRORS` hiện có. Xóa xong → chuyển về `/admin/content/places` kèm thông báo thành công (dùng cơ chế thông báo hiện có; nếu chưa có, hiện ở trang danh sách bằng query-less cách đơn giản — chốt khi vào code, không thêm thư viện).

## Scope IN
- `src/server/identity/permissions.ts` (+ action `content:delete`), `src/app/api/admin/travel/places/[slug]/route.ts` (DELETE), `src/app/(admin)/[locale]/admin/content/places/[slug]/page.tsx` (tính `canDelete`), `place-editor.tsx`, `record-shell.tsx`, component mới `delete-place-dialog.tsx` (cùng thư mục `admin/content`), `use-record.ts` (chỉ nếu cần mang `details`), `messages/vi.json` + `messages/en.json`.
- Test: (a) `tests/permissions.test.ts` (hoặc file ghim ma trận hiện có) — `content:delete` đúng 3 principal; (b) `tests/admin-content-session.test.ts` hoặc `tests/place-in-use.test.ts` — DELETE bằng session: admin/super_admin 204, editor 403, member 403, không cookie 401, thiếu same-origin 403, token vẫn 204, 409 có `details`, 503 fail-closed vẫn đúng; (c) `tests/dom/delete-place.test.tsx` — `canDelete=false` không render nút; `true` render, mở hộp xác nhận, Hủy không gọi API, Xác nhận gọi `DELETE` đúng URL, 409 hiện số đếm, ≥44px/`<button>` thật; (d) parity VI/EN.
- **Test PostgreSQL cho DELETE** (yêu cầu của chủ dự án): thêm vào `tests/content-postgres.integration.test.ts` và/hoặc `tests/planner-postgres.integration.test.ts` một suite gọi **route `DELETE`** (không chỉ repository) với `CONTENT_DATABASE_URL`/`PLANNER_DATABASE_URL` = `TEST_DATABASE_URL`: 409 khi còn story/collection/template/content review/trip activity/community review; 204 khi hết tham chiếu; 503 khi Planner store lỗi. Chạy: PostgreSQL 14 `/opt/homebrew/opt/postgresql@14`, DB thử riêng, `-k ''` + TCP 127.0.0.1 (socket path quá dài), dừng server khi xong.
- Docs (VI+EN cùng skeleton tiêu đề, cùng PR): ADR mới `docs/adr/0028-content-delete-action.md` + `.vi.md` (+ dòng ở `docs/adr/README.*`); `docs/travel-content-api.md` + `.vi.md` (dòng 47 và 98: DELETE places nhận session `content:delete`); `docs/runbook.md` + `.vi.md` (dòng 127: sửa đúng "Admin token or admin session (`content:delete`)"; ghi chú stories/reviews DELETE vẫn token-only — dòng hiện sai, sửa luôn cho khớp); `docs/features/core-10-admin-place-delete.md` + `.vi.md` từ `_template.md` (7 mục) và dòng ở `docs/features/README.*`; `docs/usage.*` (thao tác xóa) nếu mô tả admin; cập nhật `docs/architecture.*` chỉ nếu bảng quyền nằm ở đó (kiểm khi vào code); contract-index `core-completion-index.md` dòng CORE-10.

## Scope OUT
Xóa story/review/collection/template từ UI; xóa hàng loạt; "khôi phục"/soft-delete place; đổi `countPlaceReferences` hay 409 (đã ở CORE-9); S-3…S-6, P-1…P-6 của CORE-8 (tách contract riêng sau, nếu chủ dự án yêu cầu); đổi route công khai; MFA/IdP; migration DB (không có).

## Acceptance criteria
- Admin/super_admin session xóa được place không còn tham chiếu (204) và được chuyển về danh sách; editor/member không thấy nút; gọi thẳng bằng session editor/member → 403; không cookie/không token → 401; mutation thiếu same-origin → 403.
- Token `ADMIN_API_TOKEN` vẫn xóa được (không hồi quy).
- 409 hiện câu `place_in_use` + số đếm đúng từng loại > 0; 503 fail-closed không xóa gì và có thông báo; không rò id người tham chiếu.
- a11y: `<button>` thật, ≥44px, focus nhìn thấy, dialog modal đúng (focus trap/Esc/trả focus), `role="alert"` cho lỗi, một `<h1>` không đổi; đủ chuỗi VI+EN; không `href="#"`.
- `typecheck`, `lint`, `test` PASS **kèm output**; suite PostgreSQL PASS kèm output (nếu không chạy được → NOT RUN, nêu lý do); `build` chạy vì đổi route (hoặc NOT RUN có lý do); kiểm thủ công 375/768/1280 trên dev server (admin tạm, kho JSON).

## Rủi ro / Security
- Mở rộng quyền (xóa vĩnh viễn cho session) → rủi ro: leo thang quyền nếu `can()` sai; giảm thiểu: ma trận được test ghim, kiểm phía server, same-origin + rate-limit sẵn có của `resolveAdminPrincipal`. **Đề xuất `/sec-check` trước merge** (NOT RUN cho tới khi chủ dự án gọi); `/qc-check` cũng chỉ khi được gọi.
- Race giữa hai kho (Planner/content không cùng transaction): giữ nguyên backstop `/api/admin/planner/integrity` như CORE-9.
- Điều kiện dừng: `resolveAdminPrincipal` không hỗ trợ được session cho DELETE như dự kiến; PG 14 không khởi động được; #179 đổi API `details` → dừng và hỏi.
- Rollback: revert PR; không migration, không đổi dữ liệu; action `content:delete` biến mất → DELETE quay về token-only.
- Phụ thuộc: #179 (xem Base branch). Conflict dự kiến: `messages/*.json`, `permissions.ts` tests.

## Câu hỏi cho chủ dự án (cần trả lời để duyệt)
1. Duyệt action mới `content:delete` cho admin + super admin (không editor)? 
2. Nút chỉ ở trang sửa place (không ở danh sách) — đồng ý?
3. Cắt nhánh từ `fix/place-in-use` (stacked) và chờ #179 merge mới mở PR — đồng ý?
- Handoff: `.claude/contracts/handoff/core-10-admin-place-delete.md` (≤25 dòng, tiếng Việt) khi xong.
