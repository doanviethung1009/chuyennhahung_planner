# Task Contract: CORE-9 `place_in_use` — chặn xóa place còn được tham chiếu (sửa D-1) + hai lỗi tài liệu S-1, S-2
- Class: **L** (đụng ranh giới tin cậy: một route admin phải đọc hai store; thông tin trả về không được lộ dữ liệu người dùng). `/sec-check` được khuyến nghị, chỉ chạy khi chủ dự án gọi.
- Branch: `fix/place-in-use` (cắt từ `origin/main` @ `77578df`, sau PR #174). One contract = one session = one branch = one PR, single agent.
- Nguồn: báo cáo CORE-8 mục 7 (D-1, S-1, S-2) và **quyết định 11** + mục "Amendment to CORE-4 — place_in_use" trong [core-completion-index.md](core-completion-index.md) (chủ dự án duyệt thiết kế 2026-11-18).
- Amendment cũ cần nêu rõ: contract CORE-4 ([admin-ws-p07-15-collections-integrity.md](admin-ws-p07-15-collections-integrity.md), dòng ~29) ghi `place_in_use` là **OUT of scope**; amendment trong index cho phép làm nhưng PR #168 (CORE-4) **không làm**. Contract này là nơi thực hiện amendment đó. Contract CORE-4 đã DONE nên **không sửa**; contract này thay thế dòng OUT đó.
- Desired outcome: `DELETE /api/admin/travel/places/[slug]` trả `409 place_in_use` (kèm số đếm) khi bất kỳ thứ gì còn trỏ vào place, kể cả dữ liệu Planner; không còn slug treo sau khi xóa.

## Bằng chứng (đọc từ `origin/main` @ `77578df`)
- `src/server/content/repository.ts:222-245` — `deletePlace` trong `transaction` đã chặn khi story / collection / template / editorial review (`data.reviews`, subject place) còn tham chiếu, nhưng ném `invalidState(<chuỗi tự do>)` → 409 `invalid_state` (`errors.ts:35`). Không thấy dữ liệu Planner.
- `src/app/api/admin/travel/places/[slug]/route.ts:27-34` — `DELETE` dùng `adminRoute` (chỉ `ADMIN_API_TOKEN`), gọi thẳng `repository.deletePlace`. Không có kiểm tra Planner.
- `PlannerData` (`src/server/planner/store.ts:32-56`) có `tripActivities[].placeSlug` và `communityReviews[].placeSlug`; cả backend JSON và PostgreSQL đều là `DocumentStore` đọc bằng `snapshot()` (`repository.ts:352`), nên một phương thức đọc chạy được trên cả hai.
- `getPlannerRepository()` (`src/server/planner/instance.ts`) đã được route admin dùng (vd. `stories/[slug]/status/route.ts`) → admin được phép phụ thuộc cả hai.
- `grep place_in_use src` = 0. UI admin **không có nút xóa place** (DELETE là token-only, chỉ gọi qua API); `adminContent.errors` hiện chưa có mã này.

## Scope IN
1. `src/server/content/errors.ts`: thêm `place_in_use` vào `ContentErrorCode`, `STATUS_BY_CODE` = 409; helper `placeInUse(counts)` mang `details`/`counts` trong body.
2. `src/server/content/repository.ts` (chỉ `deletePlace`): thay `invalidState` bằng `placeInUse` với số đếm `stories`, `collections`, `templates`, `contentReviews`; vẫn trong transaction hiện có. (Phần này có thể trả counts cho Planner = 0 ở chỗ này; ghép tổng ở handler.)
3. `src/server/planner/repository.ts`: **một** phương thức đọc-only mới, `countPlaceReferences(slug): Promise<{ tripActivities: number; communityReviews: number }>`: đếm **mọi** `communityReviews.status` (pending/removed/... vẫn nêu tên place) và mọi chuyến kể cả archived. Trả số đếm thuần, không id người dùng/chuyến/nội dung.
4. `src/app/api/admin/travel/places/[slug]/route.ts` `DELETE`: gọi `countPlaceReferences` **trước** `deletePlace`; nếu >0 → 409 `place_in_use` với số đếm hợp nhất (sáu khóa, khóa Planner lấy từ phương thức mới; khóa content lấy từ lỗi của `deletePlace` — xem Interface). Lỗi store Planner → **fail closed**: không xóa, trả 503 `service_unavailable` (đã có trong `errors.ts`). Vẫn `adminRoute` (chỉ token), không đổi quyền.
5. Tài liệu: bảng lỗi `docs/runbook.md` + `.vi.md` (thêm `place_in_use`; **S-1**: dòng DELETE places sửa từ "Admin token or staff session" thành token-only, khớp `docs/travel-content-api.md:47`); `docs/travel-content-api.md` (+ `.vi.md`) nêu mã mới và giới hạn không-atomic; `docs/features/follow-hung-footsteps.md:123-124` + `.vi.md` (**S-2**: editor trình duyệt đã có tại `src/components/planner/trip-editor`; đọc `docs/features/` về trip editor để nêu đúng phạm vi, không phóng đại).
6. `messages/vi.json` + `en.json`: thêm `adminContent.errors.place_in_use` và đưa `place_in_use` vào `KNOWN_ERRORS` (`src/components/admin/content/use-record.ts`) **để các màn hình dùng `useErrorNotice` hiển thị đúng nếu sau này có nút xóa**. Xem câu hỏi mở 1.

## Scope OUT
- Cascade, ghi lại hay dọn dữ liệu người dùng; nút xóa place trong UI admin; đổi `DELETE` sang session; transaction xuyên hai store; mọi lỗi khác của báo cáo (S-3…S-6, P-1…P-6) — liệt kê là follow-up; đổi route `/tour*`; migration SQL (không đổi schema).

## Interface contract
- `409` body (cùng khung lỗi hiện có của `toErrorResponse`): `{ error: { code: "place_in_use", message, details: { counts: { stories, collections, templates, contentReviews, tripActivities, communityReviews } } } }`. Mọi khóa luôn có mặt (số nguyên ≥ 0), tổng > 0. **Không** có slug của referrer, id người dùng, id chuyến, id review; message là chuỗi cố định, không nối dữ liệu. (Hôm nay message `invalid_state` liệt kê `story:<slug>`, `review:<id>`; thay bằng số đếm là chủ đích: id review là id định danh nội bộ.)
- Cách ghép số đếm: `deletePlace` ném `place_in_use` với bốn khóa content (Planner = 0); handler gọi Planner trước, nếu Planner > 0 thì **vẫn** hỏi content để trả đủ sáu số? → **Thiết kế chọn**: thêm `TravelContentRepository.countPlaceReferences(slug)` (đọc-only, cùng logic đếm với `deletePlace`, dùng chung hàm nội bộ) để handler lấy đủ hai nửa, trả 409 một lần với sáu số đúng, rồi mới gọi `deletePlace` (vẫn kiểm tra lại trong transaction, đề phòng race). Thêm một phương thức content đọc-only là mở rộng nhỏ so với amendment; xin duyệt (câu hỏi mở 2).
- Thứ tự handler: tồn tại place (404 nếu không) → đếm Planner (lỗi → 503, không xóa) → đếm content → nếu tổng > 0: 409 → `deletePlace` → 204.
- `place_in_use` thay `invalid_state` cho trường hợp này. Client nào đang phụ thuộc `invalid_state` của DELETE place: `grep` cho thấy chỉ test (`tests/travel-content-api.test.ts`, `tests/content-postgres.integration.test.ts`) — cập nhật cùng PR.

## File ownership
`src/server/content/errors.ts`, `src/server/content/repository.ts` (delete + một phương thức đếm), `src/server/planner/repository.ts` (một phương thức đọc), `src/app/api/admin/travel/places/[slug]/route.ts`, `src/components/admin/content/use-record.ts`, `messages/*.json`, `tests/**` liên quan, `docs/runbook*`, `docs/travel-content-api*`, `docs/features/follow-hung-footsteps*`, `docs/features/README*` nếu cần, handoff. Không động file khác; kiểm `gh pr list --state open` trước khi bắt đầu viết mã.

## Acceptance criteria / tests
- Mỗi loại tham chiếu chặn riêng với **đúng số đếm**: story, collection, template, content review, trip activity (cả chuyến archived), community review (mọi status).
- Nhiều tham chiếu cùng lúc → sáu số đúng, một lần 409.
- Place không tham chiếu → vẫn 204 và biến mất.
- Planner store ném lỗi → 503, place **còn nguyên**.
- Body 409 không chứa id người dùng, id chuyến, id review (test so khớp chuỗi trên JSON thô).
- Chạy trên backend JSON (`tests/travel-content-api.test.ts` + test mới) **và** PostgreSQL (`*postgres*.integration.test.ts` với `TEST_DATABASE_URL`; PostgreSQL 14 tại `/opt/homebrew/opt/postgresql@14`, dùng DB thử rồi dừng).
- `tests/docs.test.ts` PASS (hai bản, cùng khung tiêu đề). VI/EN `messages` cùng khóa.
- Definition of done: `npm run typecheck`, `lint`, `test` (và suite PostgreSQL) PASS, nêu output; check chưa chạy ghi NOT RUN.

## Security and migration risks
- Không migration, không đổi schema. Quyền không đổi (token-only).
- Lộ thông tin: body chỉ có số đếm tổng theo loại; token admin vốn không đọc được chuyến (ADR 0002 §3) — số đếm không cho biết ai/chuyến nào. Số đếm community review theo mọi status tiết lộ có review đã gỡ tồn tại: chấp nhận, đây là thông tin tổng hợp cho operator.
- **Giới hạn đã biết (chấp nhận, nêu trong tài liệu):** hai kiểm tra không atomic khi hai store tách rời; một chuyến có thể thêm place giữa lúc kiểm và lúc xóa. Backstop: `/api/admin/planner/integrity` ("unknown place").
- Fail closed khi Planner lỗi.

## Rollback approach
Revert PR; không có dữ liệu bị đổi (đọc-only + từ chối). Hành vi cũ quay lại (xóa được dù Planner còn tham chiếu).

## Budget
Sub-agents: 0 (single agent). Dừng nếu: cần đổi schema/migration, cần session admin cho DELETE, hoặc phát hiện thêm bảng khác tham chiếu `place_slug`.

## Tasks by owner
Architect (contract này, đã xong) → Backend (1–4) → Frontend (6, nhỏ) → docs (5). QC / Security: **NOT RUN**, chạy khi chủ dự án gọi; khuyến nghị `/sec-check` (chỉ lộ thông tin, fail-closed) và `/qc-check`.

## Câu hỏi mở cho chủ dự án (cần trả lời cùng lúc duyệt contract)
1. UI admin **không có nút xóa place**, nên chuỗi `adminContent.errors.place_in_use` chưa có nơi hiển thị. Thêm vào catalogue VI/EN + `KNOWN_ERRORS` (khuyến nghị, rẻ, sẵn sàng khi có nút), hay bỏ phần 6?
2. Thêm phương thức đọc-only `countPlaceReferences` ở content repository (khuyến nghị — để một lần 409 có đủ sáu số đúng) hay chỉ giữ amendment nguyên văn (content ném `place_in_use` với 4 số, Planner kiểm tra trước, và khi Planner > 0 thì trả số content = 0/không đầy đủ)?
3. Lỗi store Planner: 503 `service_unavailable` (đề xuất) — đồng ý?

## Quyết định của chủ dự án (2026-11-19)
Duyệt theo khuyến nghị: câu 1 thêm chuỗi UI + `KNOWN_ERRORS`; câu 2 thêm `countPlaceReferences` ở content; câu 3 lỗi Planner → 503.

## State: REVIEW — mã xong, chưa commit; qc/sec NOT RUN
- Feature document owner: none (sửa lỗi; không tính là tính năng mới). Cập nhật `docs/travel-content-api.*`, `docs/runbook.*`, `docs/features/follow-hung-footsteps.*`.
- Architecture/usage doc updates needed: `docs/architecture.*` nếu có đoạn mô tả DELETE places/`invalid_state` cho place (kiểm bằng grep khi sửa); `docs/usage.*` không đổi.
