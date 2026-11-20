# Task Contract: MEMBER-MAP — Bản đồ riêng theo thành viên đăng nhập
- Class: **XL** (đã nâng sau quyết định Q4: chia sẻ qua token). Tách làm 2 PR: **Lát 1 = L** (bản đồ riêng tư, không migration), **Lát 2 = XL** (chia sẻ qua token, cần schema/API/migration + `/sec-check`). Bản gốc ghi: L (cắt ngang server read module + route/page + component + i18n + ADR + docs; **không** migration, **không** API mới, **không** schema mới ở phương án khuyến nghị). **Nâng lên XL** nếu chủ dự án chọn chia sẻ công khai bản đồ (Q4) vì chạm quyền riêng tư/danh tính (liên quan ADR 0025).
- Desired outcome / user impact: thành viên đã đăng nhập có một bản đồ Việt Nam của **riêng mình** — nơi mình đã đi / đã lên kế hoạch đi — tách biệt hoàn toàn với `/map` (hành trình của hai vợ chồng chủ site). Khách chưa đăng nhập không thấy dữ liệu của ai.
- Trạng thái: **DESIGNED — CHỜ CHỦ DỰ ÁN DUYỆT (chưa viết mã).**

## Scope IN / OUT
IN (khuyến nghị, chờ duyệt):
- Trang mới **`/my-map`** (VI `/ban-do-cua-toi`), cạnh `/my-trips`, `noindex`, đọc phiên cookie trên server (cùng cách `src/server/planner/home-page.ts`).
- Module server read-only `src/server/planner/member-map.ts`: dựng danh sách điểm của **chính** thành viên theo allow-list.
- Tái sử dụng `VietnamMap` (thu hẹp kiểu prop từ `Destination[]` xuống `Pick<Destination, 'slug'|'name'|'coords'|'visits'|'featured'|'labelSide'>[]`; đầu ra của `/map` giữ nguyên, có test).
- ADR mới, feature doc, cập nhật architecture/usage, i18n VI/EN, link trong menu tài khoản và `/my-trips`.

OUT:
- Không sửa `src/content/destinations.ts` (seed của chủ site) và không trộn dữ liệu thành viên vào `/map`.
- Không đổi `/map` theo trạng thái đăng nhập (xem Q2: khuyến nghị **không**).
- Không chia sẻ công khai / `/shared/[token]` cho bản đồ (v1). Không API `/api/planner/...` mới, không cột/bảng/migration.
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
- DB/migration: **không**. API HTTP: **không** (trang server đọc repository trực tiếp, như `home-page.ts`; tránh mở bề mặt mới). Nếu sau này cần client fetch ⇒ thêm `GET /api/planner/map` có phạm vi `ownerId` + test.
- Kiểu: `MemberMapState = { status:'guest' } | { status:'empty' } | { status:'ready', points: MemberMapPoint[] }`; `MemberMapPoint = { slug: string; visits?: number }` (không `visits` = đã lên kế hoạch). Hàm thuần `buildMemberMapPoints(trips, ownReviews, knownSlugs)` để test độc lập; hàm `getMemberMap()` đọc phiên + repository, mọi lỗi → `guest`.
- Component: `VietnamMap` nhận `Pick<Destination, ...>[]`; trang ghép từ seed theo `slug`. Chú giải riêng cho `/my-map` (đã đi / đã lên kế hoạch), chuỗi i18n mới ở namespace `memberMap`.
- Route: `/my-map` ↔ `{vi:'/ban-do-cua-toi', en:'/my-map'}` trong `src/i18n/routing.ts` (không đụng route tour vĩnh viễn).

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

## Acceptance criteria / tests
1. Hàm thuần: `completed` → đặc; `draft|planned` active → rỗng; `archived`+`completed` → đặc; `archived` chưa `completed` → bỏ; điểm có cả hai → đặc; slug lạ (không có trong seed) bị bỏ; đếm không trùng.
2. Cô lập: dữ liệu của thành viên B không bao giờ xuất hiện cho A (test với repository thật hai user); test liệt kê khoá (allow-list) của dữ liệu trả xuống component.
3. Khách/cookie sai/hết hạn/đổi mật khẩu bắt buộc → trạng thái `guest`: **không** đọc store (bộ lọc hình dạng token), trang trả CTA đăng nhập, không có điểm nào; `noindex`.
4. `/map` đầu ra không đổi (test render hiện có + một so sánh); nhãn cố định chỉ ở điểm `featured`; pin ≥44px (tái dùng test core-14).
5. i18n: `tests/i18n.test.ts` xanh; một `<h1>`, landmark, focus, chú giải không chỉ dựa vào màu (đặc/rỗng + chữ).
6. `tests/docs.test.ts` xanh (twin, heading, link, đăng ký, 7 mục). `typecheck`, `lint`, `test` pass và **ghi rõ output**; `build` chạy vì có route mới.

## Security and migration risks
- Rò rỉ chéo thành viên / lộ danh tính qua cache: trang đọc cookie ⇒ dynamic, `Cache-Control: private/no-store`, không đặt vào layout dùng chung (ADR 0022 đã tránh layout đọc request). Không `generateStaticParams`.
- Lộ nội dung riêng (tiêu đề, ghi chú, ngân sách, nội dung review) qua prop client: chỉ gửi `{slug, visits}` + tra seed.
- Suy luận "đã đi" từ review `visitedOn` do người dùng tự khai ⇒ không dùng cho điều gì ngoài hiển thị riêng tư của chính họ.
- Chia sẻ công khai (nếu có, v2): token riêng, `anonymous` thắng, tuân ADR 0025, cần ADR bổ sung + sec-check bắt buộc ⇒ XL.
- Migration: không. Dữ liệu cũ đọc được (default `draft`).

## Rollback approach
Thuần cộng thêm: revert PR gỡ route, module, chuỗi i18n và ADR; không có dữ liệu để khôi phục. Kiểu prop `VietnamMap` thu hẹp tương thích ngược.

## Budget: max agent invocations; stop condition
Subagent: **0** (chưa cần; đề xuất ngoại lệ khi tới bước `/sec-check`, chờ chủ yêu cầu). Điều kiện dừng: chủ chưa trả lời Q0–Q4; `tests/docs.test.ts`/typecheck đỏ >2 vòng sửa; phát hiện cần migration hoặc API ⇒ quay lại contract.

## State: Lát 1 IMPLEMENTED (chờ commit/PR); Lát 2 chưa làm

## Feature document owner (`docs/features/member-map.md` + `.vi.md`, CLAUDE.md rules 11–12)
FE role viết; BE role góp mục Data/How it works phần server; đăng ký ở `docs/features/README.*`.

## Architecture/usage doc updates needed (`docs/architecture.*`, `docs/usage.*`, rule 10)
`docs/architecture.*`: thêm route `/my-map`, module `member-map.ts`, ghi "Planner map" tách đôi và vẫn hoãn phần tuyến chuyến. `docs/usage.*`: chỉ nếu thêm bước kiểm tra thủ công; dự kiến không đổi.

## Câu hỏi cho chủ dự án (khuyến nghị đứng đầu)
- **Q0. "Planner map" có nghĩa gì?** Khuyến nghị: nghĩa hẹp (bản đồ tuyến/hoạt động trong trình soạn thảo chuyến vẫn hoãn); bản đồ thành viên cấp quốc gia là việc **khác**, cho phép theo ADR 0029 và tách đôi dòng ở quy tắc 6. Phương án: nghĩa rộng ⇒ chuyển XL, ADR cho cả "Planner map".
- **Q1. Nguồn "đã đi"?** Khuyến nghị: chuyến `completed` **và** review `visitedOn`; chuyến `draft|planned` hiện là "đã lên kế hoạch" (chấm rỗng). Phương án: chỉ chuyến `completed` (đơn giản hơn, đếm sạch hơn); hoặc thêm thao tác "tôi đã đến đây" thủ công (cần schema/API mới ⇒ ngoài phạm vi này).
- **Q2. Vị trí?** Khuyến nghị: trang riêng `/my-map` (đối xứng `/my-trips`, `/map` luôn là hành trình của chủ, SEO/cache không phụ thuộc phiên). Phương án: `/map` đổi theo đăng nhập (rủi ro: lẫn dữ liệu, mất cache tĩnh, người dùng tưởng đó là hành trình của chủ).
- **Q3. Khách chưa đăng nhập thấy gì ở `/my-map`?** Khuyến nghị: trang giải thích ngắn + nút đăng nhập, **không** hiện bản đồ của ai; hoặc chuyển hướng `/sign-in`. Có muốn bản đồ mẫu (bản đồ của chủ) làm demo không? (không khuyến nghị, tránh nhầm lẫn.)
- **Q4. Quyền riêng tư:** Khuyến nghị v1 **chỉ riêng tư** (không chia sẻ qua `/shared/[token]`, không công khai trên profile). Có muốn bản chia sẻ ở v2 (liên quan ADR 0025, gate `profilePublicOpen`, Privacy Policy của chủ chưa có)?
- **Q5. Chuyến đã archive:** Khuyến nghị: archive+completed vẫn tính "đã đi"; archive chưa hoàn thành thì bỏ. Đồng ý?
- **Q6. Nhãn cố định:** giữ quy tắc "chỉ `featured`" (thành viên ít điểm sẽ chỉ thấy tooltip). Hay hiện nhãn cho mọi điểm khi số điểm ≤ N? (khuyến nghị giữ nguyên, nhất quán với `/map`.)
- **Q7. Dữ liệu thật của chủ (quy tắc 8):** không cần để làm tính năng này; **không** tạo dữ liệu thành viên giả. Seed demo cho test dùng fixture trong `tests/`, không vào `src/content/`.

## QUYẾT ĐỊNH CỦA CHỦ DỰ ÁN (cập nhật, thay các khuyến nghị ở trên)
- Q0: bản đồ thành viên = để thấy mình đã đi những đâu → thuộc **bản đồ cấp quốc gia**, KHÔNG phải bản đồ tuyến trong trình soạn thảo (phần đó vẫn hoãn). ADR 0029 ghi rõ và tách đôi dòng "Planner map" ở quy tắc 6 (chờ chủ xác nhận chữ sửa).
- Q1: hiện **cả hai**: đã đi (chuyến `completed`, đặc) và đã lên kế hoạch chưa đi (`draft|planned`, rỗng).
- Q2: trang riêng **`/my-map`**; `/map` giữ nguyên.
- Q3: khách thấy **bản đồ trống (không pin)** + câu mời: "Hãy lên kế hoạch và thực hiện chuyến đi của bạn để lắp đầy bản đồ" (+ nút tới `/sign-in`). Không có dữ liệu của ai.
- Q4: **có chia sẻ qua token** → Lát 2 (XL). Thiết kế sơ bộ: token chia sẻ **riêng của bản đồ** (không dùng lại token chuyến), mặc định `private`, thu hồi/đổi được, trang công khai chỉ trả allow-list `{slug, visits}` + tên hiển thị theo `authorDisplay` (anonymous luôn thắng), noindex. Cần: cột/bảng cho cài đặt chia sẻ theo user, migration + export/import, API `PUT/DELETE /api/planner/map/share`, route `/shared-map/[token]` (hoặc tương đương), xoá khi `deleteUser`, rate limit, test không lộ. Chi tiết chốt trong ADR 0029 trước khi viết mã Lát 2.
- Q5: lưu trữ (`archived`) chỉ là cất gọn, **không lên bản đồ**. Lưu ý hệ quả: chuyến đã `completed` rồi archive sẽ biến mất khỏi bản đồ (xem câu hỏi mở).
- Q6/Q7: đã giải thích lại cho chủ; mặc định giữ nhãn chỉ `featured`; Q7 = không cần chủ cung cấp gì.
- Câu hỏi mở còn lại: (a) chuyến completed rồi archive có nên vẫn tính "đã đi"? (b) tên hiển thị khi chia sẻ (hiện tên hay ẩn danh).
- **CHỐT (chủ, sau Q5):** chuyến `completed` đã archive **vẫn tính "đã đi"** (chấm đặc). Archive chưa `completed` thì không lên bản đồ. Câu mở (a) đã đóng; câu mở (b) tên khi chia sẻ vẫn mở (mặc định ẩn danh, theo ADR 0025).
