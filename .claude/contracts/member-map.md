# Task Contract: MEMBER-MAP — Bản đồ riêng theo thành viên đăng nhập
- Class: **XL**, tách 2 PR. **Lát 1 = L** (bản đồ riêng tư `/my-map`, không API/schema/migration). **Lát 2 = XL** (chia sẻ qua token: cột/bảng + migration + API + route công khai; bắt buộc `/sec-check` trên mã). Các mục "không API/migration" bên dưới chỉ áp dụng cho **Lát 1**; phần Lát 2 nằm ở các mục đánh dấu **[Lát 2]**.
- Desired outcome / user impact: thành viên đã đăng nhập có một bản đồ Việt Nam của **riêng mình** — nơi mình đã đi / đã lên kế hoạch đi — tách biệt hoàn toàn với `/map` (hành trình của hai vợ chồng chủ site). Khách chưa đăng nhập không thấy dữ liệu của ai.
- Trạng thái: **ĐÃ DUYỆT (chủ) — Lát 1 đang thực thi ở session riêng; Lát 2 chưa viết mã, chờ ADR 0029.** Thứ tự ưu tiên khi các mục mâu thuẫn: khối "QUYẾT ĐỊNH ĐÃ CHỐT" ở cuối, rồi "SEC-CHECK", rồi phần còn lại; các khuyến nghị Q0–Q7 ban đầu chỉ giữ để tham khảo.

## Scope IN / OUT
IN **Lát 1**:
- Trang mới **`/my-map`** (VI `/ban-do-cua-toi`), cạnh `/my-trips`, `noindex`, đọc phiên cookie trên server (cùng cách `src/server/planner/home-page.ts`).
- Module server read-only `src/server/planner/member-map.ts`: dựng danh sách điểm của **chính** thành viên theo allow-list.
- Tái sử dụng `VietnamMap` (thu hẹp kiểu prop từ `Destination[]` xuống `Pick<Destination, 'slug'|'name'|'coords'|'visits'|'featured'|'labelSide'>[]`; đầu ra của `/map` giữ nguyên, có test).
- ADR mới, feature doc, cập nhật architecture/usage, i18n VI/EN, link trong menu tài khoản và `/my-trips`.

OUT:
- Không sửa `src/content/destinations.ts` (seed của chủ site) và không trộn dữ liệu thành viên vào `/map`.
- Không đổi `/map` theo trạng thái đăng nhập (đã chốt Q2: trang riêng).
- **[Lát 1]** Không chia sẻ công khai, không API `/api/planner/...` mới, không cột/bảng/migration (Lát 2 làm các việc này, xem mục [Lát 2] bên dưới).
- **[Lát 2] IN (PR riêng, sau Lát 1 và sau ADR 0029):** cài đặt chia sẻ theo user (cột/bảng + migration đảo ngược được), `PUT/DELETE /api/planner/map/share` (+ rotate), route công khai `/shared-map/[token]` (tên route chốt trong ADR), `deleteUser` cascade, audit, rate limit, export/import an toàn.
- Không bản đồ **tuyến đường theo từng chuyến** (pin hoạt động theo ngày, vẽ đường, trình soạn thảo chuyến) — đó vẫn là "Planner map" bị hoãn.
- Không dữ liệu giả lập của thành viên; không tile/thư viện bản đồ/API key.

## Evidence (đã đọc file thật)
- Phiên: cookie phiên theo ADR 0004; đăng nhập mật khẩu/Google theo ADR 0007; trang server đọc phiên không lộ dữ liệu cho khách: `src/server/planner/home-page.ts` (`HomeMember`, bộ lọc hình dạng token, mọi lỗi → `guest`) và `admin-page.ts`.
- Dữ liệu thành viên, lọc theo `ownerId`: `PlannerRepository.listTrips(ownerId, {status, destinationSlug, limit<=100})` (`src/server/planner/repository.ts:1147`). `Trip` (`schemas.ts` `tripSchema`) có `destinationSlug` (**tái dùng `Destination.slug`**, bất biến), `startDate/endDate`, `status` (`active|archived`), `planningStatus` (`draft|planned|completed`, hàng cũ = `draft`), `visibility`, `listing`.
- Hoạt động theo địa điểm: `activity.placeSlug` → `Place` (catalog nội dung) có `destinationSlug` và `coords`. Mỗi chuyến vốn đã một `destinationSlug`, nên **không cần** đi qua hoạt động để biết điểm đến.
- Review của thành viên: `listOwnReviews(userId)` → `OwnReview {placeSlug, visitedOn, status, ...}` (`repository.ts:1927`, `schemas.ts:1018`); `placeSlug` → `Place.destinationSlug`.
- `/my-trips` hiện là client component (`src/components/planner/my-trips.tsx`) gọi `GET /api/planner`; `/my-trips/[id]` chỉ đọc; `/shared/[token]` công khai theo token (ADR 0005).
- Bản đồ hiện tại: `src/lib/map.ts` (`project`, `pinRadius(visits)`, `labelSide`, `MAP_TARGET_PX=44`), `src/components/map/vietnam-map.tsx` (pin là `<a>` 44px, nhãn cố định chỉ khi `featured`, `variant: full|preview`), `src/app/[locale]/map/page.tsx`; `isVisited()` = `visits > 0` quyết định chấm đặc/rỗng. Tọa độ nằm trong seed `destinations` (chỉ đọc).
- Role/quyền: `member` hành động trên dữ liệu của mình theo quyền sở hữu, không cần action mới (ADR 0025 mục Facts 4).
- Không tìm thấy: bất kỳ khái niệm "đã đi" nào gắn với tài khoản ngoài `planningStatus=completed`, `endDate` đã qua và `OwnReview.visitedOn`. Không có bản đồ thành viên trong code/doc (grep `member-map` = rỗng).

## Điểm của thành viên suy ra từ đâu, ánh xạ ra sao (đề xuất)
Cho `userId` của phiên, mỗi `destinationSlug` biết đến (có trong seed `destinations`, nếu không thì **bỏ**) cho ra **một** điểm:
| Trạng thái điểm | Điều kiện (OR) | Pin (tái dùng quy ước sẵn có) |
|---|---|---|
| **Đã đi** | chuyến `planningStatus='completed'` (kể cả đã archive); hoặc review của chính mình có `visitedOn` ở một `Place` thuộc điểm đó | chấm **đặc**, bán kính = `pinRadius(số lần đi)` |
| **Đã lên kế hoạch** | chuyến `active` với `planningStatus` `draft|planned`, chưa có "đã đi" cho điểm đó | chấm **rỗng** (viền) |
- `số lần đi` = số chuyến `completed` + số ngày `visitedOn` riêng biệt từ review, **không** trùng lặp cùng chuyến/cùng ngày (quy tắc đếm chốt trong ADR). Có thể đơn giản hơn: chỉ đếm chuyến `completed` — hỏi ở Q1.
- Chuyến `archived` mà chưa `completed` **không** tính (đã bỏ). Hàng cũ không có `planningStatus` đọc là `draft` (đã xử lý bởi schema default).
- Ánh xạ về `Destination`: `Trip.destinationSlug` và `Place.destinationSlug` đã **chính là** `Destination.slug` ⇒ không cần bảng ánh xạ; toạ độ, tên, `featured`, `labelSide` lấy từ seed, **chỉ đọc**. Vì vậy nhãn cố định vẫn chỉ cho điểm `featured` (Hà Nội, TP.HCM) — đúng quy tắc trong `docs/features/travel-map.md`; điểm khác hiện tên bằng tooltip/sr-only, vùng bấm 44px giữ nguyên.
- Allow-list gửi xuống component: `{ slug, visits | undefined }` + dữ liệu hiển thị lấy từ seed. **Không** gửi `ownerId`, `tripId`, tiêu đề chuyến, ghi chú, ngân sách, token chia sẻ, nội dung review.

## Constraints / dependencies
- CLAUDE.md quy tắc 1 (VI/EN đủ), 3 (token), 4 (không link/nút chết), 5 (a11y), 6 (Planner map), 8 (dữ liệu thật của chủ), 9–12 (PR, docs, twin VI).
- Phụ thuộc PR #198 (docs quy tắc pin/nhãn, dòng chú giải trên `/map`) đang mở: feature doc mới liên kết sang `travel-map.*` → đợi #198 merge hoặc rebase; không sửa chồng `travel-map.*`.
- ADR 0025 (profile thành viên) còn **Proposed**: nếu sau này chia sẻ bản đồ, phải dùng cùng quy tắc "một tên công khai / `anonymous` luôn thắng / private mặc định".

## Architecture decision / ADR (cần viết)
- **ADR 0029 — Member map** (số theo thứ tự merge; kiểm tra lại lúc viết, ADR mới nhất trên `main` là 0028). Bắt đầu từ `docs/adr/_template.md`; **hai bản** `0029-member-map.md` + `0029-member-map.vi.md`, cùng khung heading, link chéo; đăng ký trong `docs/adr/README.md` **và** `README.vi.md` (test `tests/docs.test.ts` ép). Nội dung: nguồn dữ liệu & quy tắc đếm, tách khỏi `/map` và seed, vị trí trang, khách thấy gì, quyền riêng tư (private-only v1), không migration, phương án đã loại (đổi `/map` theo đăng nhập; lưu "đã đi" thủ công; bản đồ tuyến chuyến).
- **Có thuộc "Planner map" bị hoãn không?** Quy tắc 6 / bảng trong `03-project-chuyen-nha-hung.md` ghi "Planner map, AI suggestions — deliberately deferred by the brief that opened the phase". Văn bản không định nghĩa "Planner map". Đọc theo nghĩa hẹp (bản đồ **trong** Planner: pin hoạt động, tuyến theo ngày, nằm trong trình soạn thảo chuyến) thì bản đồ thành viên **không** thuộc phần hoãn: nó là hình chiếu chỉ-đọc ở cấp quốc gia từ chuyến/review đã có. Đọc theo nghĩa rộng (mọi bản đồ gắn dữ liệu Planner) thì **có**. **Đề xuất:** ADR 0029 xử lý tường minh — coi đây là lát cắt đầu của "bản đồ cho thành viên", và **tách đôi** dòng trong quy tắc 6: "bản đồ thành viên cấp quốc gia" (ship theo ADR 0029) vs "bản đồ tuyến theo chuyến / trong trình soạn thảo" (vẫn hoãn, cần ADR riêng). Sửa chữ trong `CLAUDE.md` quy tắc 6 và `.claude/rules/03-*.md` **chỉ khi chủ dự án đồng ý** (Q0), cùng PR, kèm `docs/architecture.*`. Nếu chủ chọn nghĩa rộng ⇒ dừng, đây thành việc XL cần ADR cho cả "Planner map".

## Interface contract (API, types, DB)
- **[Lát 1]** DB/migration: **không**. API HTTP: **không** (trang server đọc repository trực tiếp, như `home-page.ts`). Nếu sau này cần client fetch ⇒ thêm `GET /api/planner/map` có phạm vi `ownerId` + test.
- **[Lát 1]** Kiểu: `MemberMapState = { status:'guest' } | { status:'empty' } | { status:'ready', points: MemberMapPoint[] }`; `MemberMapPoint = { slug: string; visits?: number }` (không `visits` = đã lên kế hoạch; chỉ dùng cho bản **riêng tư**, không bao giờ serialize ra route công khai). Hàm thuần `buildMemberMapPoints(trips, ownReviews, knownSlugs)`; `getMemberMap()` đọc phiên + repository, mọi lỗi → `guest`.
- Component: `VietnamMap` nhận `Pick<Destination, ...>[]`; trang ghép từ seed theo `slug`. Chú giải riêng cho `/my-map` (đã đi / đã lên kế hoạch), chuỗi i18n mới ở namespace `memberMap`.
- Route: `/my-map` ↔ `{vi:'/ban-do-cua-toi', en:'/my-map'}` trong `src/i18n/routing.ts` (không đụng route tour vĩnh viễn).
- **[Lát 2]** Kiểu công khai **riêng** (không tái dùng `MemberMapPoint`, để không thể vô tình xuất điểm kế hoạch): `PublicMemberMapPoint = { slug: string; visitsBucket: 1 | 2 | 3 }` (bậc thô, bậc cụ thể chốt trong ADR; đề xuất 1 / 2–3 / 4+), chỉ từ chuyến `completed` (không dùng review `visitedOn`), sắp theo `slug` (alphabet), không timestamp. `PublicMemberMap = { displayName: string | null; points: PublicMemberMapPoint[] }` (`displayName` null khi ẩn danh). Cài đặt: `{ userId, token digest SHA-256 | null, shareName: 'anonymous' | 'name', updatedAt }`. API: `PUT /api/planner/map/share` (body `.strict()`: `{ enabled, shareName }`, idempotent giữ token), `POST .../rotate`, `DELETE` (thu hồi, link cũ chết ngay). Route công khai tuân thứ tự kiểm tra ở mục SEC-CHECK #5.

## Tasks by owner
- Architect: ADR 0029 (VI+EN) + đăng ký; cập nhật `docs/architecture.*`; (nếu Q0 = đồng ý) chỉnh quy tắc 6.
- BE: `src/server/planner/member-map.ts` (+ test thuần và test phạm vi `ownerId`).
- FE: `/my-map` page, chỉnh kiểu prop `VietnamMap`, thẻ `MemberMapView` trạng thái guest/empty/ready, link trong `account-menu`/`/my-trips`, `messages/vi.json` + `en.json`.
- Docs: `docs/features/member-map.md` + `.vi.md` (7 mục bắt buộc) + dòng ở `docs/features/README.*`; ghi chú liên kết trong `travel-map.*` sau khi #198 merge. **Người viết feature doc: FE role (owner của code trang), BE role bổ sung mục Data.**
- QC / Security: **NOT RUN** (chỉ chạy khi chủ gọi). **Khuyến nghị mạnh `/sec-check`** trước merge: dính danh tính phiên + dữ liệu cá nhân thành viên (allow-list, cô lập theo `ownerId`, khách không rò rỉ).
- Git: một nhánh `feat/member-map` từ `origin/main` mới nhất, một PR; không commit/push/merge khi chưa được phép.

## File ownership (tránh chồng)
- Mới: `src/server/planner/member-map.ts`, `src/app/[locale]/my-map/page.tsx`, `src/components/map/member-map-view.tsx`, `tests/member-map*.test.ts(x)`, `docs/adr/0029-*`, `docs/features/member-map.*`.
- Sửa nhẹ: `src/components/map/vietnam-map.tsx` (chỉ kiểu prop), `src/i18n/routing.ts`, `messages/*.json`, `src/components/layout/account-menu.tsx`, `docs/adr/README.*`, `docs/features/README.*`, `docs/architecture.*`, `docs/README.*` nếu cần.
- **Không đụng:** `src/content/destinations.ts`, `src/lib/map.ts` (trừ khi cần xuất thêm hàm thuần, nêu rõ), `docs/features/travel-map.*` (thuộc #198).

## Acceptance criteria / tests — **Lát 1**
1. Hàm thuần: `completed` → đặc; `draft|planned` active → rỗng; `archived`+`completed` → đặc; `archived` chưa `completed` → bỏ; điểm có cả hai → đặc; slug lạ (không có trong seed) bị bỏ; đếm không trùng.
2. Cô lập: dữ liệu của thành viên B không bao giờ xuất hiện cho A (test với repository thật hai user); test liệt kê khoá (allow-list) của dữ liệu trả xuống component.
3. Khách/cookie sai/hết hạn/đổi mật khẩu bắt buộc → trạng thái `guest`: **không** đọc store (bộ lọc hình dạng token), trang trả bản đồ trống + CTA đăng nhập; test header `/my-map`: `noindex` **và** `Cache-Control: private/no-store`; test đăng xuất rồi đăng nhập tài khoản khác trên cùng trình duyệt không thấy dữ liệu cũ (router cache phía client).
4. `/map` đầu ra không đổi (test render hiện có + một so sánh); nhãn cố định chỉ ở điểm `featured`; pin ≥44px (tái dùng test core-14).
5. i18n: `tests/i18n.test.ts` xanh; một `<h1>`, landmark, focus, chú giải không chỉ dựa vào màu (đặc/rỗng + chữ).
6. `tests/docs.test.ts` xanh (twin, heading, link, đăng ký, 7 mục). `typecheck`, `lint`, `test` pass và **ghi rõ output**; `build` chạy vì có route mới.

## Acceptance criteria / tests — **[Lát 2]**
1. Enumerating allow-list của JSON/HTML công khai: chỉ `slug`, `visitsBucket`, tên có điều kiện; không có điểm kế hoạch, không timestamp, không review.
2. Cô lập hai user: token của A không bao giờ trả dữ liệu B; PUT/DELETE của B không đổi trạng thái A.
3. 404 đồng nhất (cùng body, cùng độ dài) cho: sai định dạng, token lạ, thu hồi, private, chủ bị ban/disable/soft-delete/xoá; 429 không lộ trạng thái token.
4. Hình chiếu động: xoá chuyến `completed` → điểm biến mất ngay khỏi bản công khai; archive chuyến `completed` → điểm vẫn hiện; archive chuyến chưa `completed` → không hiện.
5. Ẩn danh: không có chuỗi tên nào trong HTML/JSON/metadata/log; user đổi tên hoặc bị xoá không lộ tên cũ; `shareName='name'` đọc `displayName` mới lúc render.
6. CSRF/same-origin: PUT/POST/DELETE từ origin khác bị từ chối; log/audit không chứa token; export không chứa token thô; import không bật chia sẻ; `deleteUser` xoá cài đặt cùng transaction; `docs`/`typecheck`/`lint`/`test`/`build` xanh; `/sec-check` chạy lại trên mã, không BLOCKED.

## Security and migration risks
- Rò rỉ chéo thành viên / lộ danh tính qua cache: trang đọc cookie ⇒ dynamic, `Cache-Control: private/no-store`, không đặt vào layout dùng chung (ADR 0022 đã tránh layout đọc request). Không `generateStaticParams`.
- Lộ nội dung riêng (tiêu đề, ghi chú, ngân sách, nội dung review) qua prop client: chỉ gửi `{slug, visits}` + tra seed.
- Suy luận "đã đi" từ review `visitedOn` do người dùng tự khai ⇒ không dùng cho điều gì ngoài hiển thị riêng tư của chính họ.
- Chia sẻ công khai là **Lát 2** (đã chốt): xem mục SEC-CHECK và Acceptance [Lát 2]. Lớp trung gian (nginx VM, CDN) và router cache phía client của Next phải được nêu trong ADR 0029 cho cả `/my-map` lẫn `/shared-map/*`.
- Migration: **Lát 1 không**; **Lát 2 có** (đảo ngược được, mặc định private/token null). Dữ liệu cũ

## Rollback approach
**Lát 1:** thuần cộng thêm: revert PR gỡ route, module, chuỗi i18n và ADR; không có dữ liệu để khôi phục; kiểu prop `VietnamMap` thu hẹp tương thích ngược. **[Lát 2]:** revert code + migration đảo ngược xoá cột/bảng cài đặt chia sẻ; trước khi rollback phải **thu hồi mọi token đã phát hành** (hoặc tắt route công khai bằng cờ) để link cũ trả 404; không áp dụng migration production bằng agent.

## Budget: max agent invocations; stop condition
Subagent: **0** cho việc thực thi (`security` chỉ chạy khi chủ gọi). Điều kiện dừng: `tests/docs.test.ts`/typecheck đỏ >2 vòng sửa; Lát 1 phát hiện cần migration hoặc API ⇒ quay lại contract; Lát 2 không bắt đầu trước khi ADR 0029 (kèm các yêu cầu SEC-CHECK) được chủ duyệt.

## State: DESIGNED (Lát 1: IN_PROGRESS ở session riêng; Lát 2: chờ ADR)

## Feature document owner (`docs/features/member-map.md` + `.vi.md`, CLAUDE.md rules 11–12)
FE role viết; BE role góp mục Data/How it works phần server; đăng ký ở `docs/features/README.*`.

## Architecture/usage doc updates needed (`docs/architecture.*`, `docs/usage.*`, rule 10)
`docs/architecture.*`: thêm route `/my-map`, module `member-map.ts`, ghi "Planner map" tách đôi và vẫn hoãn phần tuyến chuyến. `docs/usage.*`: chỉ nếu thêm bước kiểm tra thủ công; dự kiến không đổi.

## Câu hỏi ban đầu cho chủ dự án — ĐÃ TRẢ LỜI, chỉ để tham khảo (xem "QUYẾT ĐỊNH ĐÃ CHỐT")
- **Q0. "Planner map" có nghĩa gì?** Khuyến nghị: nghĩa hẹp (bản đồ tuyến/hoạt động trong trình soạn thảo chuyến vẫn hoãn); bản đồ thành viên cấp quốc gia là việc **khác**, cho phép theo ADR 0029 và tách đôi dòng ở quy tắc 6. Phương án: nghĩa rộng ⇒ chuyển XL, ADR cho cả "Planner map".
- **Q1. Nguồn "đã đi"?** Khuyến nghị: chuyến `completed` **và** review `visitedOn`; chuyến `draft|planned` hiện là "đã lên kế hoạch" (chấm rỗng). Phương án: chỉ chuyến `completed` (đơn giản hơn, đếm sạch hơn); hoặc thêm thao tác "tôi đã đến đây" thủ công (cần schema/API mới ⇒ ngoài phạm vi này).
- **Q2. Vị trí?** Khuyến nghị: trang riêng `/my-map` (đối xứng `/my-trips`, `/map` luôn là hành trình của chủ, SEO/cache không phụ thuộc phiên). Phương án: `/map` đổi theo đăng nhập (rủi ro: lẫn dữ liệu, mất cache tĩnh, người dùng tưởng đó là hành trình của chủ).
- **Q3. Khách chưa đăng nhập thấy gì ở `/my-map`?** Khuyến nghị: trang giải thích ngắn + nút đăng nhập, **không** hiện bản đồ của ai; hoặc chuyển hướng `/sign-in`. Có muốn bản đồ mẫu (bản đồ của chủ) làm demo không? (không khuyến nghị, tránh nhầm lẫn.)
- **Q4. Quyền riêng tư:** Khuyến nghị v1 **chỉ riêng tư** (không chia sẻ qua `/shared/[token]`, không công khai trên profile). Có muốn bản chia sẻ ở v2 (liên quan ADR 0025, gate `profilePublicOpen`, Privacy Policy của chủ chưa có)?
- **Q5. Chuyến đã archive:** Khuyến nghị: archive+completed vẫn tính "đã đi"; archive chưa hoàn thành thì bỏ. Đồng ý?
- **Q6. Nhãn cố định:** giữ quy tắc "chỉ `featured`" (thành viên ít điểm sẽ chỉ thấy tooltip). Hay hiện nhãn cho mọi điểm khi số điểm ≤ N? (khuyến nghị giữ nguyên, nhất quán với `/map`.)
- **Q7. Dữ liệu thật của chủ (quy tắc 8):** không cần để làm tính năng này; **không** tạo dữ liệu thành viên giả. Seed demo cho test dùng fixture trong `tests/`, không vào `src/content/`.

## QUYẾT ĐỊNH ĐÃ CHỐT (chủ dự án; ưu tiên cao nhất khi mâu thuẫn)
- Q0: bản đồ thành viên = để thấy mình đã đi những đâu → thuộc **bản đồ cấp quốc gia**, KHÔNG phải bản đồ tuyến trong trình soạn thảo (phần đó vẫn hoãn). ADR 0029 ghi rõ và tách đôi dòng "Planner map" ở quy tắc 6 (chờ chủ xác nhận chữ sửa).
- Q1: hiện **cả hai**: đã đi (chuyến `completed`, đặc) và đã lên kế hoạch chưa đi (`draft|planned`, rỗng).
- Q2: trang riêng **`/my-map`**; `/map` giữ nguyên.
- Q3: khách thấy **bản đồ trống (không pin)** + câu mời: "Hãy lên kế hoạch và thực hiện chuyến đi của bạn để lắp đầy bản đồ" (+ nút tới `/sign-in`). Không có dữ liệu của ai.
- Q4: **có chia sẻ qua token** → Lát 2 (XL). Token riêng của bản đồ (không dùng lại token chuyến), mặc định `private`, thu hồi/đổi được; trang công khai chỉ trả allow-list `PublicMemberMapPoint` (xem Interface [Lát 2]) + tên theo `shareName` (ẩn danh mặc định), `noindex`. Cần: cột/bảng cài đặt theo user, migration + export/import, `PUT/POST/DELETE /api/planner/map/share`, route công khai, `deleteUser` cascade, rate limit, test không lộ. Chi tiết chốt trong ADR 0029 trước khi viết mã Lát 2.
- Q5: lưu trữ (`archived`) chỉ là cất gọn; chuyến chưa `completed` mà archive **không** lên bản đồ; chuyến `completed` rồi archive **vẫn tính đã đi** (chốt bên dưới).
- Q6/Q7: đã giải thích lại cho chủ; mặc định giữ nhãn chỉ `featured`; Q7 = không cần chủ cung cấp gì.
- (Đã đóng) Hai câu mở: chuyến completed-đã-archive vẫn tính; tên khi chia sẻ ẩn danh mặc định.
- **CHỐT (chủ, sau Q5):** chuyến `completed` đã archive **vẫn tính "đã đi"** (chấm đặc) ở cả bản riêng tư lẫn công khai; **xoá hẳn** chuyến thì điểm biến mất. Archive chưa `completed` thì không lên bản đồ.

## SEC-CHECK thiết kế Lát 2 (chủ gọi; PASS_WITH_WARNINGS, chưa BLOCKED) — yêu cầu bắt buộc đưa vào ADR 0029 + test trước khi viết mã Lát 2
Nếu thiếu mục 1–4, review mã sẽ BLOCKED. Chưa xác minh: ADR 0004/0005/0007/0014/0024/0025 nội dung, CSRF của cookie phiên, `rate-limit.ts`, adapter Postgres/export-import, nginx. Phải chạy lại `/sec-check` trên mã Lát 2.
1. **Danh tính:** mặc định `anonymous`; hiện tên chỉ khi chủ chọn `name` riêng cho bản đồ (không thừa hưởng từ chuyến/review); `displayName` đọc mới lúc render, không snapshot; không đưa tên vào title/OG/URL/metadata. `displayName` chỉ `trim().min(2).max(80)` nên có thể chứa email/SĐT: ADR 0029 phải chọn hành động (ví dụ lọc mẫu email/SĐT khi bật `name`, hoặc dùng tên bản đồ riêng có giới hạn độ dài/ký tự) — không đẩy hết sang ADR 0025.
2. **Suy luận riêng tư:** bản công khai chỉ gồm điểm **đã đi** (chốt: không có điểm kế hoạch), `visitsBucket` thô (bậc chốt trong ADR), không timestamp/thứ tự (sắp alphabet), nguồn chỉ chuyến `completed` (không dùng review `visitedOn` tự khai). Ngưỡng tối thiểu số điểm đã đi để bật chia sẻ (chống nhận diện thành viên chỉ có 1 điểm) và việc thành viên được xem trước bản công khai: ADR 0029 quyết định (đề xuất: cho xem trước, cảnh báo khi < 2 điểm).
3. **Hình chiếu động:** xoá chuyến `completed` → điểm biến mất khỏi bản công khai ngay, không cache; archive chuyến `completed` vẫn hiện (khớp CHỐT Q5); có test.
4. **Token riêng:** 43 ký tự/`randomBytes(32)`, lưu **digest SHA-256** (token chuyến hiện lưu thô — bản đồ nên tốt hơn; nếu cần hiển thị lại thì ghi rõ đánh đổi).
5. **404 đồng nhất** cho: sai định dạng, token lạ, thu hồi, private, chủ bị ban/disable/soft-delete/xoá; thứ tự: định dạng → rate limit → tra index → đọc mới → `timingSafeEqual` → chủ còn hoạt động (`isDisabled`) → dựng view.
6. **Cache:** `force-dynamic`, `no-store`, `noindex,nofollow`, `referrer: no-referrer`, không alternates/sitemap/JSON-LD/OG có tên; kiểm tra nginx VM không cache `/shared-map/*`; token nằm trong URL nên log truy cập nginx có thể ghi token thô: ADR 0029 ghi nhận/giảm thiểu (ví dụ loại đường dẫn này khỏi access log hoặc che token).
7. **API:** phiên của chính user, không nhận userId từ body, `.strict()`; CSRF/same-origin mirror ADR 0004 + test origin khác bị từ chối; PUT/DELETE idempotent, có rotate; rate limit mutation riêng và bucket đọc riêng (không dùng chung với chuyến).
8. **Migration/export-import:** mặc định private/token null, migration đảo ngược được; export không chứa token thô; **import không bật chia sẻ**; `deleteUser` xoá cài đặt cùng transaction; ban/soft-delete tắt bản công khai; không áp dụng migration production bằng agent.
9. **Audit:** event bật/tắt/rotate; không ghi token/tên vào log; có test.
Test bắt buộc thêm: enumerating allow-list JSON/HTML công khai; cô lập hai user (token A không trả B; PUT/DELETE của B không đổi A); 404 đồng nhất mọi nhánh; 429 không lộ trạng thái token.
- **CHỐT (chủ, sau sec-check):** bản chia sẻ công khai (Lát 2) **chỉ hiện điểm đã đi**; không hiện điểm đã lên kế hoạch. Bản riêng tư của chính thành viên (Lát 1) vẫn hiện cả hai.
- **CHỐT (chủ):** tên khi chia sẻ = **ẩn danh mặc định**; chỉ hiện tên khi thành viên chọn riêng `name` cho bản đồ (không thừa hưởng từ chuyến/review). Câu mở (b) đã đóng. Không còn câu hỏi mở cho chủ trước khi viết ADR 0029.
