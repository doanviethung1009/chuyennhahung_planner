# Task Contract: PLACES-UI-S3 Thêm địa điểm vào chuyến đi (Planner trên trang địa điểm)
- ID: **PLACES-UI-S3** (track Places UI, sau [S1](places-ui-s1-public-places.md) và [S2](places-ui-s2-place-reviews.md); thêm dòng vào `.claude/roadmap/backlog.md` trong PR). Không thuộc Phase 07/10/11; không mở rộng Phase 10.
- Class: **M** (một module UI/client, dùng API Planner hiện có, không API/DB mới). Branch: `feat/place-add-to-trip`. One contract = one session = one branch = one PR, single agent, 0 subagent.
- Desired outcome: ngay trên `/dia-diem/[slug]` (EN `/places/[slug]`), thành viên chọn một chuyến đang hoạt động của cùng điểm đến + một ngày rồi thêm địa điểm vào lịch trình; khách được dẫn đi đăng nhập rồi quay lại đúng trang.
- Scope IN:
  - Client component `PlaceAddToTrip` đặt trong phần đầu trang địa điểm (dưới địa chỉ, trước ảnh bìa), nút "Thêm vào chuyến đi" mở một vùng mở rộng tại chỗ (disclosure, không modal).
  - Nhận biết phiên bằng `GET /api/planner/session` (401 = khách), giống S2; trạng thái `loading` trung tính (không đoán quyền).
  - Khách: không có nút chết — render **liên kết** "Đăng nhập để thêm vào chuyến" tới `/sign-in?returnTo=<đường dẫn hiện tại>` qua `signInUrl(locale)`; sau đăng nhập quay lại trang địa điểm (cơ chế `safeReturnTo` sẵn có).
  - Thành viên: tải `GET /api/planner?destinationSlug=<điểm đến của địa điểm>` (mặc định chỉ chuyến `active`), chọn chuyến → chọn ngày (1…`durationDays`, kèm ngày lịch nếu có `startDate`) → `POST /api/planner/[id]/activities` với `{ placeSlug, dayNumber, durationMinutes: suggestedMinutes (kẹp 5–1440), estimatedCostVnd: estimatedCostVnd của địa điểm, costScope: 'group', startTime: null }` (title/category do server suy ra; thêm vào cuối ngày).
  - Khi chọn chuyến: `GET /api/planner/[id]` để (a) báo **trùng địa điểm** (đã có ở ngày N — cảnh báo không chặn, nút đổi thành "Vẫn thêm"), (b) vô hiệu hóa ngày đã đủ 40 hoạt động (`ACTIVITIES_PER_DAY_LIMIT`).
  - Trạng thái: không có chuyến phù hợp (liên kết tạo chuyến `/my-trips/new` + liên kết `/my-trips`), đang tải, thành công (thông báo `role="status"` + liên kết tới `/my-trips/[id]`), 401 giữa chừng → `goToSignIn`, 404 (chuyến đã bị xóa) → làm mới danh sách, 409 `invalid_state` (chuyến vừa bị lưu trữ hoặc ngày đầy) → thông báo rõ, 429/lỗi mạng → thông báo chung, lỗi đọc được qua `role="alert"`.
  - `PublicPlace` truyền thêm `suggestedMinutes`, `estimatedCostVnd` vào component (dữ liệu công khai sẵn có).
  - Chuỗi VI+EN trong `messages/*.json` (namespace `places`), test mới, cập nhật docs.
- Scope OUT: tạo chuyến mới ngay tại trang địa điểm (chỉ liên kết sang `/my-trips/new`); chọn giờ bắt đầu/ghi chú/đổi chi phí khi thêm (sửa trong trình soạn chuyến); chuyến đã lưu trữ (không liệt kê, không tự khôi phục); thêm vào chuyến của người khác/chia sẻ; nhớ chuyến chọn lần trước; thêm vào chuyến từ danh sách địa điểm ở trang điểm đến; bản đồ, gợi ý AI; mọi thay đổi API Planner, schema, DB, migration; đổi hành vi S1/S2 và Phase 10; Audit Log UI (S4).
- Evidence (đã đọc, 2026-11-18):
  - `POST /api/planner/[id]/activities` (`src/app/api/planner/[id]/activities/route.ts`): body theo `tripActivityCreateSchema` (`src/server/planner/schemas.ts:390`); `placeSlug` đủ, `title` tùy chọn; `If-Match` tùy chọn; trả 201 `TripView`.
  - `PlannerRepository.addActivity` (`src/server/planner/repository.ts:2584`): 404 nếu không phải chủ chuyến/ngày không có; 409 `invalid_state` nếu chuyến `archived` hoặc ngày đã đủ 40; 422 `invalid_reference` nếu địa điểm không tồn tại hoặc **thuộc điểm đến khác** với chuyến → client lọc theo `destinationSlug`. **Không có kiểm tra trùng địa điểm ở server** → cảnh báo trùng là việc của client, không đổi API.
  - `GET /api/planner` (`src/app/api/planner/route.ts`): chuyến của chính người gọi, mặc định `active`, `limit` mặc định 50 (tối đa 100); `tripListQuerySchema` nhận `destinationSlug`. `Trip` có `id`, `title`, `destinationSlug`, `startDate`, `durationDays`, `status`.
  - `GET /api/planner/session`: 401 = khách (dùng ở `PlaceReviewSection`). `src/components/planner/api.ts`: `api()`, `ApiError` (`status`, `code`), `signInUrl`, `goToSignIn`; `403 password_change_required` tự chuyển sang đổi mật khẩu.
  - `src/app/[locale]/places/[slug]/page.tsx` (`force-dynamic`), `src/components/places/place-review-section.tsx` là mẫu client.
- Constraints / dependencies: S1 (PR #152) và S2 (PR #153) đã merge vào `main` (HEAD `8e18ceb`). Quy tắc CLAUDE.md 1–12; token ở `@theme`; không `href="#"`.
- Architecture decision / ADR: không cần ADR (không đổi route, API, dữ liệu). Quyết định ghi tại đây.
- Interface contract: không API/DB mới. Props: `PlaceAddToTrip({ place: { slug, name, destinationSlug, suggestedMinutes, estimatedCostVnd } })`. Tách logic thuần (lọc chuyến, tính ngày/đầy/trùng, dựng body) vào `src/components/places/add-to-trip-logic.ts` để test không cần DOM.
- Quyết định mở — đề xuất, chủ dự án duyệt/đổi:
  1. **Cổng khách**: liên kết `signInUrl` (đề xuất) thay vì nút mở khung giải thích rồi mới dẫn đi.
  2. **Trùng địa điểm**: cảnh báo, vẫn cho thêm lần nữa (đề xuất; thăm một nơi hai lần là hợp lệ) — thay vì chặn.
  3. **Giá trị mặc định khi thêm**: thời lượng/chi phí lấy từ địa điểm, chi phí `group`, không giờ bắt đầu (đề xuất) — chỉnh sau trong trình soạn chuyến.
  4. **Chưa có chuyến cùng điểm đến**: chỉ liên kết sang `/my-trips/new` (đề xuất), không tạo chuyến inline, không tự điền điểm đến (nếu trang đó chưa hỗ trợ query).
  5. **Chỉ liệt kê tối đa 50 chuyến active** của điểm đến (mặc định API, không phân trang) — đủ cho người dùng thực tế; ghi vào docs.
  6. **Sau khi thành công**: ở lại trang, thông báo + liên kết tới chuyến (không `router.refresh()`, không điều hướng).
- Tasks by owner: Architect (contract này) → FE (component, logic, messages, test, docs) → BE: không có việc → QC/Security: NOT RUN, chỉ khi chủ dự án yêu cầu → Git: chỉ khi được phép.
- File ownership (single agent, tuần tự): `src/components/places/place-add-to-trip.tsx` (mới), `src/components/places/add-to-trip-logic.ts` (mới), `src/app/[locale]/places/[slug]/page.tsx` (gắn component, truyền prop), `src/server/content/public-places.ts` chỉ nếu cần field (hiện đã có), `messages/vi.json`, `messages/en.json`, `tests/place-add-to-trip.test.ts` (mới), `docs/features/places.md` + `.vi.md`, `docs/usage.md` + `.vi.md`, `.claude/roadmap/backlog.md`, handoff `.claude/contracts/handoff/places-ui-s3-add-to-trip.md`. `docs/architecture.*` không đổi (không API/route mới).
- Acceptance criteria / tests:
  - Khách thấy liên kết đăng nhập (đúng `returnTo`, đúng locale); không có nút chết; thành viên chưa có chuyến cùng điểm đến thấy trạng thái rỗng kèm liên kết thật.
  - Thành viên có chuyến phù hợp chọn chuyến+ngày và thêm được; hoạt động xuất hiện trong trình soạn chuyến với đúng `placeSlug`, thời lượng, chi phí; chuyến của điểm đến khác không xuất hiện.
  - Trùng địa điểm hiện cảnh báo + "Vẫn thêm"; ngày đủ 40 bị vô hiệu hóa; 401/404/409/429/mạng xử lý đúng như trên, không lộ chi tiết nội bộ.
  - Một `<h1>`, nhãn gắn đúng, `aria-expanded`/`aria-controls` cho disclosure, `role="status"`/`"alert"`, mục tiêu ≥44px, focus nhìn thấy, đủ chuỗi VI+EN (test parity), không thay đổi S1/S2.
  - Test (vitest, `tests/place-add-to-trip.test.ts`): logic thuần (lọc điểm đến, ngày đủ, trùng, body, kẹp thời lượng) + render tĩnh trạng thái loading + parity khóa message VI/EN. Kiểm thủ công 375/768/1280, cả khi đã và chưa đăng nhập (tài khoản test local `npm run admin:create`, khởi động lại `next dev` sau khi tạo).
  - `typecheck`, `lint`, `test` pass và ghi rõ output.
- Security and migration risks: không migration. Ghi dữ liệu thành viên qua endpoint có sẵn (cookie phiên HttpOnly, same-origin, lọc `ownerId` ở server); client không quyết quyền. Không log/hiển thị token. `returnTo` đi qua `safeReturnTo` ở server. **Khuyến nghị `/qc-check`; `/sec-check` ở mức thấp** (không đổi trust boundary) — cả hai NOT RUN cho đến khi chủ dự án yêu cầu.
- Rollback approach: revert PR; không đổi dữ liệu. Hoạt động đã thêm vẫn xóa được trong trình soạn chuyến.
- Budget: subagent 0; một lượt implement + tối đa 2 vòng sửa; dừng và hỏi nếu phát hiện cần đổi API/DB.
- State: IMPLEMENTED (owner đã duyệt contract và 6 đề xuất không đổi; chờ phép commit/PR; qc PASS vòng 2, sec PASS)
- Feature document owner: main session (FE) — cập nhật `docs/features/places.md` + `.vi.md` (đường thêm vào chuyến, trạng thái, hạn chế) và `docs/usage.md` + `.vi.md`.
- Architecture/usage doc updates needed: `docs/usage.*` có; `docs/architecture.*` không.
