# ADR 0025 — Hồ sơ thành viên và "Dùng chuyến này" (Phase 11): hồ sơ riêng tư mặc định, công tắc sao chép theo từng chuyến, sao chép theo allow-list kèm `origin`

🇻🇳 English version: [0025-member-profiles-and-use-this-trip.md](0025-member-profiles-and-use-this-trip.md)

- **Trạng thái:** Đề xuất
- **Ngày:** 2026-11-17
- **Chủ trì:** system-architect
- **Ảnh hưởng:** mới `src/server/community/profiles.ts` và một method sao chép trong `src/server/planner/repository.ts` (cạnh `duplicateTrip`), `src/server/planner/schemas.ts` (`tripListingSchema`, `tripSchema`, schema hồ sơ, schema `origin`), `src/server/community/events.ts` (action mới), `src/server/persistence/planner-rows.ts` và `planner-transfer.ts`, migration `0015` và `0016`, route mới dưới `src/app/api/planner/profile` và `src/app/api/community/**`, `deleteUser`. `src/server/identity/permissions.ts` và `src/server/community/submission.ts` **không** đổi. Làm rõ thêm, không sửa, [ADR 0014](0014-community-trips-and-reviews.vi.md), [ADR 0015](0015-community-review-author-controls.vi.md), [ADR 0019](0019-community-foundation.vi.md) và [ADR 0024](0024-guest-identity-privacy.vi.md).
- **Thuộc:** Phase 11 (backlog P11-1 và P11-3; P11-2 và P11-4 là phần thực thi); quyết định chủ dự án P11-D1 và P11-D2; rủi ro RK16 trong [specs-community-roadmap.vi.md](../specs-community-roadmap.vi.md).

## Bối cảnh

Phase 10 đã merge: nhật ký audit, limiter PostgreSQL bất đồng bộ, đồng ý Creator Terms theo phiên bản (`requireTermsAccepted`, `src/server/planner/repository.ts:1580`), report, khóa khách HMAC (ADR 0024) và staff xóa review khách. Phase 11 thêm hai thứ thành viên nhìn thấy: **hồ sơ** và **"Dùng chuyến này"** (sao chép một chuyến cộng đồng đã đăng thành bản nháp riêng).

Sự thật từ code:

1. **Tên tác giả hiện là lựa chọn theo từng mục.** `authorDisplaySchema = name | anonymous` (`schemas.ts:71`) nằm trong `listing` của chuyến (`schemas.ts:77-88`) và được chọn ở `requestListing` (`repository.ts:1598`). Thẻ thư viện có `author: string | null` và không có gì khác về người đó (`schemas.ts:708-723`). Review chép `displayName` vào `authorName` **lúc ghi** (`repository.ts:1769`), nên review giữ tên cũ sau khi đổi tên; tác giả trên thư viện đọc từ dòng user. Chưa có thực thể hồ sơ.
2. **Chuyến chưa có khái niệm "người khác được sao chép".** `duplicateTrip` (`repository.ts:1403`) sao chép chuyến **của chính mình** (`requireOwnedTrip`) với mọi dòng, gồm ghi chú tự do và chi phí, và đặt `duplicatedFromTripId`. `Trip` có `listing`, `shareToken`, `visibility`, `note`, `budget` (`schemas.ts:311-343`); không có gì ghi nguồn gốc giữa các người dùng.
3. **Creator Terms đã cấp quyền sao chép, có điều kiện.** Điều 3 "Quyền sao chép và tùy chỉnh Planner" (`src/content/site.ts:68-74` VI, `:91-97` EN; phiên bản `termsVersion = '2026-11-16'`, `:113`) áp dụng "khi người tạo bật tính năng cho phép sao chép": người dùng khác được tạo bản sao trong tài khoản của mình (1), bản sao không đổi bản gốc (2), được chỉnh sửa cho mục đích cá nhân (3), hệ thống giữ thông tin nguồn gốc (4), đăng lại công khai hoặc khai thác thương mại phải trong phạm vi quyền người tạo đã cho (5). Vậy Terms không thiếu quyền. **Cái thiếu là công tắc theo từng chuyến** mà người tạo bật (RK16), cùng nghĩa rõ của điểm 5, vì dữ liệu không nói một người tạo cụ thể đã cho gì.
4. **Vai trò không cần action mới.** `member` không có action staff (`permissions.ts`, `ROLE_ACTIONS`); thành viên thao tác trên dữ liệu của mình theo quyền sở hữu, như chuyến và review. Staff ép ẩn dùng `community:moderate` có sẵn.
5. **Riêng tư đã chốt một phần.** ADR 0024 chốt định danh khách (HMAC, 30 ngày). Văn bản Chính sách riêng tư vẫn của chủ dự án (P11-D1); ADR này không soạn. Hồ sơ thêm văn bản tự do công khai đầu tiên do thành viên viết (bio) và trang công khai tự nguyện đầu tiên về một người.

Chưa biết: lượng sao chép thật; luật sư có coi Điều 3 bao gồm bản sao đã sửa rồi đăng lại không; thành viên có cần trang công khai không (Q1 bên dưới); hạn mức số chuyến mỗi người trong repository (chưa kiểm ở đây; PR kiểm).

## Quyết định

### 1. Hồ sơ thành viên (`member_profiles`)

- **Cấu trúc.** Mỗi thành viên một dòng, 1:1 theo `userId` (khóa chính): `publicSlug` (unique, nullable), `bio` (≤280, văn bản thuần, nullable), `visibility` (`private` | `public`, mặc định `private`), `updatedAt`. **Không có `avatarAssetId`** — upload avatar là Phase 13 và thêm cột khi đó (không schema chết, ADR 0019). Không khóa ngoại (ADR 0013); thiếu dòng được đọc như hồ sơ riêng tư mặc định nên không cần backfill.
- **Riêng tư mặc định; trang công khai tự nguyện.** Thành viên chỉ công khai khi tự chọn slug và đặt `visibility='public'`. Công khai cần đã đồng ý Creator Terms (là đăng bio) và cổng `profilePublicOpen` bên dưới. Còn lại là mặc định riêng tư.
- **Slug.** Người dùng tự chọn (`[a-z0-9-]{3,30}`, không có gạch ở đầu/cuối), **không bao giờ suy ra** từ `handle`, email, id hay tên hiển thị, và danh sách từ dành riêng (từ trong route, `admin`, `quan-tri`, tên site, từ giống staff) bị từ chối. Không có huy hiệu xác minh. Đổi slug thì slug cũ được nhả ngay (không redirect, không cách ly); PR giới hạn tần suất đổi slug bằng limiter bất đồng bộ. Slug đã nhả người khác có thể lấy; danh sách dành riêng và Report là giảm thiểu, không phải cam kết.
- **Allow-list công khai.** Đọc công khai trả đúng: `displayName`, `bio`, `slug` và thẻ các chuyến **đã đăng, không ẩn danh** của thành viên. Không bao giờ có `userId`, `handle`, email, role, timestamp, số lượng mục riêng tư hay nội dung review. Một builder gọi tên từng trường (mẫu `buildCommunityCard`); test liệt kê kiểm.
- **Quy tắc nhất quán tên.** Mỗi người một tên công khai: `users.displayName`. Hồ sơ **không có tên hiển thị riêng**. `authorDisplay = 'anonymous'` luôn thắng: chuyến hay review ẩn danh không bao giờ gắn link tới hồ sơ, không bao giờ nằm trong danh sách của hồ sơ, không bao giờ được nêu tên trong `origin`. Thẻ hay review chỉ link tới hồ sơ khi `authorDisplay = 'name'` **và** hồ sơ công khai. Giữ hành vi hiện có: thẻ thư viện đọc tên hiện tại, review và `origin` giữ ảnh chụp; đổi tên vì vậy không viết lại review cũ (giới hạn đã nêu, không đổi ở đây).
- **Xóa và ẩn.** `deleteUser` xóa dòng hồ sơ trong cùng transaction (cả hai store, cập nhật import/export). Người dùng bị xóa mềm hoặc bị khóa thì hồ sơ đọc `404` (đọc công khai lọc theo người dùng đang hoạt động). Staff ép hồ sơ về `private` và xóa bio bằng `community:moderate`, ghi vào `audit_events` (`targetKind: 'user'`, bắt buộc có lý do, không bao giờ log nội dung bio).
- **API.** `GET/PATCH /api/planner/profile` (hồ sơ của mình; `PATCH` body strict, same-origin, không cần `If-Match` vì dòng nhỏ và last-write-wins), `GET /api/community/profiles/[slug]` (công khai, `404` giống hệt cho trường hợp không có, riêng tư, bị khóa, đã xóa). `profile` được thêm làm đối tượng report vào luồng report hiện có. Chưa có thư mục hay tìm kiếm hồ sơ ở phase này. Route trang thêm vào bản đồ pathname ở PR UI (VI mặc định không tiền tố; bản dịch EN).
- **Cổng `profilePublicOpen`.** Boolean trong cấu hình site như `contributionOpen`, **tắt** cho đến khi chủ dự án đăng Chính sách riêng tư (P11-D1). Khi tắt, `PATCH` từ chối `visibility='public'` với `403 profile_public_unavailable`; hồ sơ riêng tư và hiển thị tên tác giả vẫn chạy. Nhờ đó code ship được trước khi có văn bản chính sách mà không phải bịa ra nó.
- **Audit.** Đổi chế độ ghi `profile_public` / `profile_private` vào `audit_events` (`targetKind: 'user'`, `targetId` = user id, không có nội dung bio).

### 2. "Dùng chuyến này" (`POST /api/community/trips/[token]/use`)

- **Ai và khi nào.** Thành viên đã đăng nhập, đã đồng ý Creator Terms hiện hành (`requireTermsAccepted`; người sao chép bị ràng buộc bởi Điều 3 điểm 5 nên phải đồng ý trước). Nguồn phải **đang hoạt động, `listing.status = 'approved'`, `visibility = 'public'`, chủ là người dùng đang hoạt động, và `listing.allowCopy = true`**. Mọi trường hợp không đủ đều trả cùng một `404` (không cho dò từng điều kiện). Sao chép chuyến của chính mình là `409 invalid_state` (`own_trip`); chủ dùng `duplicateTrip`. Vì sửa chuyến đã duyệt đưa nó về `pending`, chuyến đang duyệt lại tạm thời không sao chép được; chấp nhận.
- **Công tắc theo chuyến.** `allowCopy` nằm **trong `listing`** (boolean, mặc định `false`, vắng mặt đọc là `false`), người tạo chọn trong body yêu cầu đăng (`{ authorDisplay, allowCopy }`, strict) và về sau đổi được khi đang đăng mà không phải duyệt lại (không phải nội dung). Chỉ người tạo **bật**; staff có thể **tắt** (gỡ). Rút đăng xóa nó cùng `listing`; yêu cầu mới chọn lại, mặc định tắt. Đây là công tắc Điều 3 nhắc tới; không đổi chữ trong Terms.
- **Tắt về sau.** Bản sao mới dừng ngay. **Bản sao đã có vẫn giữ**: Điều 3 cho người sao chép một bản cá nhân và không nói về thu hồi, nên hệ thống không xóa hay chạm vào bản nháp riêng của thành viên. Gỡ vì bản quyền (liên hệ ở ADR 0014) là việc của staff và chủ dự án trên bản sao, ngoài luồng này. Luật sư xác nhận cách đọc này (Q4).
- **Cái được sao chép: phép chiếu công khai, không bao giờ là dòng thô.** Bản sao dựng từ chính phép chiếu đã lọc mà khách đã đọc được qua link chia sẻ (ADR 0005), nên không thể lọt dữ liệu riêng. Trong phép chiếu đó chỉ lấy:
  - chuyến: `title` (+ hậu tố bản sao, ≤120), `destinationSlug`, `durationDays`, `partySize`, `travelStyle`, `pace`, `sourceTemplate`;
  - ngày: `dayNumber`, `title`;
  - hoạt động: `order`, `placeSlug`, `title`, `startTime`, `durationMinutes`, `category`.
  
  **Không sao chép:** mọi `note` tự do (chuyến, ngày, hoạt động), `budget` và mọi chi phí, ước tính chi phí hoạt động (đặt lại mặc định của schema; người sao chép tự nhập), `startDate`/`endDate` và ngày của từng ngày (null; ngày là của người sao chép), `shareToken`, `visibility`, `listing`, `ownerId`, `duplicatedFromTripId`. PR đối chiếu từng tên với phép chiếu và schema hiện tại và fail nếu phép chiếu lộ ít hơn danh sách (khi đó chép ít đi, không bao giờ nhiều hơn). Mọi id đều mới.
- **Kết quả.** Một chuyến `draft` riêng tư mới thuộc người sao chép, `version 1`, `listing = null`, `shareToken = null`, có `origin`. Nguồn chỉ đọc, không bao giờ ghi (có test).
- **`Trip.origin` (ghi công).** Cột JSONB nullable `{ sourceTripId, sourceTitle, sourceAuthor, copiedAt }`:
  - `sourceAuthor` là tên hiển thị của nguồn lúc sao chép, hoặc `null` khi nguồn ẩn danh (**không bao giờ** là user id, handle hay email). `sourceTripId` là nội bộ, không bao giờ serialize.
  - Chỉ hiện cho người sao chép trên chuyến của họ, dạng "Dựa trên «tên» của TÊN" (hoặc "Dựa trên một chuyến cộng đồng" khi ẩn danh). Chỉ có link tới nguồn **khi nguồn còn được đăng**; ngược lại là chữ thường.
  - **Không đồng bộ ngược**, cả hai chiều: bản sao và nguồn không đổi nhau. Nguồn bị rút, gỡ, ẩn hoặc tắt `allowCopy`: bản sao giữ ghi công dạng chữ. Tác giả nguồn bị xóa hẳn: `deleteUser` đặt `sourceAuthor` và `sourceTripId` về null trên mọi bản sao trong cùng transaction; `sourceTitle` giữ (tiêu đề nội dung công khai).
  - `origin` là liên kết giữa các người dùng; `duplicatedFromTripId` vẫn là liên kết chuyến của chính mình và là `null` trên bản sao.
- **Đăng lại bản sao: không có ở Phase 11.** Khi `origin` còn đó, chuyến không thể `public` (`409 invalid_state`, lý do `copy_not_republishable`, ép trong `setVisibility`/`requestListing`); được `private` hoặc `unlisted` (gửi link cho bạn bè là dùng cá nhân). Điều 3 điểm 5 nói "phạm vi quyền người tạo đã cho", mà dữ liệu không có quyền đăng lại theo chuyến, nên mặc định là không. Điều này cũng có nghĩa bản sao không bao giờ vào thư viện hay hàng duyệt ở phase này. Mở sau (công tắc thứ hai, hoặc đăng lại có ghi công bắt buộc qua kiểm duyệt thường) là quyết định riêng cùng luật sư (Q3, RK16) và không cần migration ngoài một trường listing mới.
- **Hạn mức và lạm dụng.** Limiter bất đồng bộ của ADR 0019, khóa theo người dùng: đề xuất 10 bản/giờ và 30/ngày (`429` kèm `Retry-After`, dạng có sẵn); người vượt hạn mức số chuyến (nếu repository có — cần kiểm) bị từ chối như mọi lần tạo. Một người sao chép nhiều lần một nguồn được phép nhưng vẫn tính hạn mức.
- **Audit.** Dòng `audit_events` trên chuyến **nguồn**: `targetKind: 'trip'`, `targetId` = id nguồn, `actorId` = người sao chép, action mới `use`, lý do = id chuyến mới; thêm `allow_copy` / `deny_copy` khi công tắc đổi. Phép chiếu sự kiện cho tác giả (không có danh tính actor) **lọc bỏ `use`**: tác giả không thấy người sao chép hay dấu vết theo người; số lượt sao chép là thống kê Phase 14, không ở đây.
- **Restriction.** Restriction đang hiệu lực trên người sao chép chặn sao chép như mọi thao tác ghi cộng đồng (ADR 0015). Không có action staff mới: staff tắt qua `deny_copy` hoặc gỡ đăng bằng `community:moderate` hiện có.

### 3. Máy trạng thái và audit

`submission.ts` **không đổi**: `allowCopy` và `origin` trực giao với trạng thái đăng. Sao chép cần `approved` (nên `pending`, `rejected`, đã rút và, khi được thêm, `changes_requested`/`unpublished` đều chặn). Action audit mới là `use`, `allow_copy`, `deny_copy`, `profile_public`, `profile_private`; `events.ts` và phép chiếu cho tác giả thêm chúng kèm test. Review hold/remove và restriction giữ như ADR 0019.

### 4. Migration

Số trống kế tiếp là `0015` (`db/migrations` dừng ở `0014_guest_key_privacy.sql`). **`0015` `member_profiles`** (PR hồ sơ) và **`0016` cột `origin` JSONB null trên trips** (PR sao chép); `allowCopy` không cần DDL vì `listing` đã là cột JSONB (`0005`). Cả hai chỉ thêm, kèm ghi chú rollback, cập nhật import/export và test qua cả hai store (tiền lệ ADR 0014; rollback xóa bảng/cột và mất dữ liệu). Việc này đẩy các số spec database dành cho Phase 12+ lên hai (`journal_posts` → `0017`, v.v.); [specs-community-database.vi.md](../specs-community-database.vi.md) được cập nhật cùng ADR này.

### 5. Thứ tự PR đề xuất

1. **11.1** kho hồ sơ + `GET/PATCH /api/planner/profile` + `deleteUser` xóa kèm (migration `0015`).
2. **11.2** đọc hồ sơ công khai + trang (sau `profilePublicOpen`), link tác giả trên thẻ, đối tượng report `profile`, staff ép riêng tư.
3. **11.3** `allowCopy` trong yêu cầu đăng + công tắc của người tạo, cột `origin` (migration `0016`) và hiển thị; chưa có endpoint sao chép.
4. **11.4** `POST …/use`, limiter, audit, chặn đăng lại, dọn `origin` ở `deleteUser`; rồi **nút** (có thể gộp vào 11.4 nếu nhỏ).

Hồ sơ trước vì độc lập, rủi ro pháp lý thấp hơn và mở đường cho link tác giả; sao chép phụ thuộc câu trả lời Q2–Q4 của chủ dự án, có thể về trong lúc đó.

## Phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn) Hồ sơ riêng tư mặc định, `allowCopy` trong `listing` mặc định tắt, sao chép từ phép chiếu công khai theo allow-list, `origin` là ghi công dạng chữ, không đăng lại ở Phase 11 | Khớp chữ Điều 3 (người tạo bật; dùng cá nhân); không thể chạm dữ liệu riêng; không thêm trạng thái vào `submission.ts`; mở rộng sau không cần migration | Thành viên chưa đăng công khai được bản sao đã sửa; bản sao bị chặn khi nguồn đang duyệt lại; tác giả đổi tên vẫn mang tên cũ trong `origin` cũ |
| B Công tắc theo chuyến cộng thêm công tắc `allowRepublish` ngay | Người tạo cấp quyền mịn hơn | Hai công tắc phải giải thích; kiểm duyệt chuyến phái sinh (trùng lặp, tranh chấp ghi công) đến trước khi luật sư đọc Điều 3 điểm 5 |
| C Sao chép khi chuyến được đăng, không công tắc (coi là cấp quyền chung trong Terms) | Code đơn giản nhất | Trái Điều 3 ("khi người tạo bật"); RK16 vẫn mở |
| D Hồ sơ công khai mặc định | Khám phá nhiều hơn | Lộ tên hiển thị và bio khi chưa có quyết định; trái hướng riêng tư của chủ dự án |

Runner-up: **B**. Thua vì phạm vi đăng lại là quyết định của chủ dự án và luật sư (P11-D2), và công tắc thứ hai khó gỡ khi người tạo đã dùng; A chừa chỗ để thêm.

## Hệ quả

Dễ hơn: một quyền cấp theo từng chuyến bảo vệ được và khớp Terms; không trường riêng tư nào lọt vào bản sao; link tác giả và trang hồ sơ dựa trên một quy tắc tên; phần thêm là phần cộng (một cột, một bảng).

Khó hơn, và không miễn phí:

- **Người tạo phải chủ động** cho phép sao chép; mặc định tắt nên lúc đầu "Dùng chuyến này" sẽ ít người dùng.
- **Danh sách sao chép là hợp đồng**: trường mới của `Trip` mặc định *không* được chép; mỗi trường thêm sau phải có mục chủ ý và test liệt kê.
- **Bản sao đã có tồn tại sau khi tắt** theo thiết kế; người tạo muốn xóa một bản sao phải qua liên hệ gỡ, và luật sư phải đồng ý cách này khớp Điều 3.
- **Tên cũ còn lại** trong `origin.sourceAuthor` và review sau khi đổi tên (ảnh chụp); chỉ xóa hẳn mới dọn.
- **Không đăng lại** ở phase này có thể gây thất vọng; quy tắc ép ở repository nên mở là một thay đổi code có chủ đích.
- **Cửa sổ duyệt lại** chặn sao chép chuyến tác giả vừa sửa.
- **Chiếm slug và giả danh** chỉ được giảm thiểu (danh sách dành riêng, report, ép riêng tư), không ngăn hẳn.
- **Hoàn tác** làm mất hồ sơ thành viên và mọi `origin`, bản sao mất ghi công.
- **Công tắc hồ sơ công khai vẫn tắt** cho đến khi chủ dự án đăng Chính sách riêng tư.

### Rủi ro và cách giảm

| Rủi ro | Cách giảm |
|---|---|
| Liệt kê người dùng qua slug | Slug do người dùng chọn, không thư mục hay tìm kiếm, `404` giống hệt cho không có/riêng tư/bị khóa/đã xóa, đọc công khai qua limiter công khai, test liệt kê |
| Lộ tác giả ẩn danh qua `origin`, danh sách hồ sơ hay link | `anonymous` thắng ở mọi phép chiếu; `origin.sourceAuthor = null`; `sourceTripId` không bao giờ serialize; test trên mọi body công khai (S5) |
| Cày sao chép và cào dữ liệu | Limiter theo giờ/ngày mỗi người, nguồn chỉ là phép chiếu, không chép ghi chú hay chi phí, audit trên nguồn |
| RK16: Điều 3 so với tính năng | Công tắc mặc định tắt; không đăng lại; luật sư đọc Điều 3 so với tính năng trước khi 11.4 ship (Q3, Q4) |
| Lạm dụng bio (link, dữ liệu cá nhân, quấy rối) | Văn bản thuần ≤280 hiển thị trơ, đối tượng report `profile`, staff ép riêng tư |
| Riêng tư của tên mới công khai | `profilePublicOpen` đóng cho đến khi đăng chính sách; chỉ tự nguyện |

## Việc tiếp theo

- Thực thi: các PR 11.1–11.4 ở trên; mỗi PR kèm tài liệu tính năng từ `docs/features/_template.md` cả hai ngôn ngữ và dòng trong sổ đăng ký (hồ sơ; dùng chuyến này), cập nhật [architecture.vi.md](../architecture.vi.md) (route, dữ liệu, phase), [usage.vi.md](../usage.vi.md) nếu cổng cấu hình đặt bằng biến môi trường, và mục Phase 11 của roadmap.
- Test: hồ sơ mặc định riêng tư; liệt kê allow-list (hồ sơ và `origin`); tác giả ẩn danh vắng mặt ở hồ sơ, danh sách, link thẻ và `origin`; slug duy nhất, từ dành riêng, độc lập với `handle`; `404` giống hệt cho không có/riêng tư/bị khóa; xóa tài khoản xóa hồ sơ và đặt tác giả `origin` về null trên bản sao; ma trận cổng sao chép (chưa đăng nhập, chưa đồng ý Terms, chưa duyệt, không công khai, `allowCopy` tắt, chuyến của mình, người bị restriction); bản sao không chứa trường bị loại (ghi chú, chi phí, ngân sách, ngày, token, listing); dòng nguồn giống hệt trước và sau; bản sao là nháp riêng tư với id mới; bản sao bị từ chối khi `public` và khi yêu cầu đăng; tắt `allowCopy` chặn bản mới và giữ bản cũ; limiter `429` (giờ/ngày); dòng audit và phép chiếu cho tác giả; migration `0015`/`0016` up/down trên cả hai store và import/export round trip.
- Tài liệu: [specs-community-database.vi.md](../specs-community-database.vi.md) và bản EN (số migration, hình dạng `origin`) cập nhật cùng ADR này; `.claude/roadmap/backlog.md` (P11-1 trỏ vào đây; P11-D2 viết lại) và `PHASES.md`; không sửa ADR nào đã Accepted. `/sec-check` độc lập trên allow-list, ẩn danh và liệt kê trước khi 11.4 merge: NOT RUN (khuyến nghị chạy).
- Quyết định cần chủ dự án (khuyến nghị đứng trước):
  1. **Trang hồ sơ công khai có ở Phase 11 hay chỉ tên tác giả?** Khuyến nghị: ship trang sau `profilePublicOpen` (11.2). Phương án lùi: chỉ tên trên thẻ; bỏ 11.2 và slug.
  2. **Ai được bật sao chép?** Khuyến nghị: chỉ người tạo, theo từng chuyến, mặc định tắt; staff được tắt.
  3. **Có cho đăng lại bản sao không?** Khuyến nghị: không ở Phase 11 (chỉ dùng cá nhân và link unlisted); cùng luật sư quyết phase sau có cho không, kèm ghi công bắt buộc và kiểm duyệt thường.
  4. **Khi người tạo tắt sao chép, bản sao đã có có giữ không?** Khuyến nghị: giữ; luật sư xác nhận cách đọc Điều 3.
  5. **Chính sách riêng tư cần gì trước khi mở trang công khai?** Tối thiểu: bio và tên hiển thị trở thành công khai khi tự nguyện, cách chuyển về riêng tư hay xóa, và câu 30 ngày của khóa khách (ADR 0024); văn bản là của chủ dự án.
  6. **Người sao chép có phải đồng ý Creator Terms trước không?** Khuyến nghị: có (họ bị ràng buộc bởi Điều 3 điểm 5).
  7. **Hạn mức và trường chi phí:** đề xuất 10/giờ và 30/ngày; ước tính chi phí hoạt động không chép. Xác nhận hoặc đổi.
  8. **Chữ trong Terms:** việc riêng của chủ dự án (D5) chỉnh cho khớp (ví dụ nhắc ảnh/video khi chưa có upload). Sửa sẽ nâng `termsVersion` và buộc đồng ý lại; ADR này không sửa.
