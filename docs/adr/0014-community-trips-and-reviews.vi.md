# ADR 0014 — Chuyến đi và đánh giá địa điểm từ cộng đồng: tự nguyện, có kiểm duyệt, thuộc về người đi

🇬🇧 English version: [0014-community-trips-and-reviews.md](0014-community-trips-and-reviews.md)

- **Trạng thái:** Đã chấp nhận — chủ nhà duyệt 2026-11-14; PR 1 (gallery chuyến đi, migration `0005_trip_listing.sql`) và PR 2 (đánh giá, migration `0006_community_reviews.sql`) đã hiện thực
- **Ngày:** 2026-11-14
- **Người sở hữu:** system-architect
- **Người quyết định:** chủ nhà (phạm vi: gallery **và** đánh giá địa điểm; admin duyệt trước khi lên; hiện tên hiển thị, có tuỳ chọn ẩn danh), system-architect (hợp đồng)
- **Ảnh hưởng:** `src/server/planner/**`, `src/server/identity/permissions.ts`, `src/server/persistence/planner-rows.ts` + migration mới, `src/app/api/community/**` (mới), `src/app/api/admin/community/**` (mới), trang chủ, hai trang công khai mới, một trang admin mới, `src/i18n/routing.ts`

## Bối cảnh

[ADR 0005](0005-trip-sharing-and-story-cloning.vi.md) đã đưa chuyến `public` ra dưới dạng
link năng lực và cố ý **không có gallery**: chuyến public được index nhưng không ai tìm
thấy. Chủ nhà nay muốn trang chủ hiển thị chuyến đi của người khác bên cạnh chuyến của
Nhà Hưng, và cho người đi đánh giá địa điểm.

Có hai điều mới về bản chất, không chỉ về mức độ:

1. **Văn bản do người đi viết nằm trên trang nhất của thương hiệu.** Từ trước tới nay
   mọi chuỗi công khai do chủ nhà hoặc editor viết. Tiêu đề và ghi chú hoạt động của
   chuyến là văn bản tự do.
2. **Đánh giá của người không phải thương hiệu.** `TravelReview` (Travel Content,
   ADR 0001) là giọng của thương hiệu, viết dưới principal admin, không gắn với user.
   Đánh giá của người đi là thứ khác: thuộc về một user, bị giới hạn tần suất, có kiểm duyệt.

Phần đã có để dựa vào: projection chia sẻ `SharedTripView` (allow-list, ADR 0005), mô hình
role/`can()` (ADR 0006), guard cổng admin (ADR 0010/0011), hai store của Planner — file JSON
và PostgreSQL (ADR 0009) — và `displayName` của `plannerUsers`.

Điều chưa biết: lượng dữ liệu dự kiến (giả định nhỏ: vài chục listing, vài trăm đánh giá),
và chủ nhà có muốn sửa chuyến đã lên vẫn giữ nguyên trạng thái hay không. Cả hai nằm ở mục Việc kéo theo.

## Quyết định

1. **Listing là lựa chọn thứ ba, tách riêng.** `visibility: 'public'` giữ nguyên nghĩa — một
   link được index. Chuyến chỉ lên trang chủ và gallery khi `listing.status` mới là
   `approved`. `listing` là `{ status: 'none' | 'pending' | 'approved' | 'rejected',
   authorDisplay: 'name' | 'anonymous', requestedAt, decidedAt, decidedBy, rejectReason }`.
   Mặc định `none`; dòng cũ không có trường này đọc là `none` (không cần migrate dữ liệu).
2. **Chủ chuyến yêu cầu, staff quyết định.** `PUT /api/planner/[id]/listing` với
   `{ authorDisplay }` đặt `pending`; yêu cầu chuyến `active` và `public`. `DELETE` đưa về
   `none`. Staff (`editor`, `admin`, service principal) duyệt, từ chối (kèm lý do) hoặc gỡ qua
   `/api/admin/community/trips/[id]`, kiểm soát bằng một action mới `community:moderate` trong
   `ROLE_ACTIONS`. **Không gì lên trang công khai nếu staff chưa quyết định.**
3. **Rời `public` hoặc bị lưu trữ thì listing chấm dứt ngay** (`status → none`). Đổi share
   token giữ nguyên listing; link ở gallery đi theo token mới.
4. **Mọi thay đổi trên chuyến đã lên đều đưa nó về `pending`** và gỡ khỏi trang công khai
   cho tới khi staff duyệt lại — chủ nhà đã xác nhận, không có ngoại lệ cho sửa "nhỏ". Duyệt
   là xác nhận cho nội dung đã xem. Cái giá: chủ chuyến mất chỗ mỗi lần sửa.
5. **Projection của gallery là allow-list mới**, `CommunityTripCard`: `shareToken` (link
   công khai), `title`, `destinationSlug`, `durationDays`, `partySize`, `travelStyle`,
   `activityCount`, `author` (`string | null`; `null` khi ẩn danh — **không bao giờ** là
   email, user id hay `ownerId`). Trang chi tiết là view `/shared/[token]` hiện có. Một test
   liệt kê các trường được phép, như ADR 0005 làm cho share view.
6. **Đánh giá cộng đồng là entity mới trong store Planner**, `CommunityReview`: `id`,
   `source: 'planner' | 'homepage'`, `authorId` (`null` với khách), `placeSlug` (phải khớp
   một địa điểm đã xuất bản), `rating` 1–5, `body` (≤ 1000 ký tự, văn bản thuần, hiển thị
   như text, không bao giờ là HTML), `lang` (`vi|en`), `visitedOn` (**bắt buộc**, không ở
   tương lai), `authorName` (tên hiển thị; khách tự nhập hoặc để "Khách"), `status: 'pending' |
   'approved' | 'rejected' | 'removed'`, các trường kiểm duyệt, mốc thời gian. Nó nằm **cạnh
   các chuyến đi**, không nằm trong Travel Content: nơi đó chỉ có một principal admin, không có user.
7. **Hai cửa vào, hai quy tắc duyệt (quyết định của chủ nhà).**
   - **Viết trong Planner** (người đi đã đăng nhập, `source: 'planner'`): bắt đầu ở
     `pending` và chỉ hiện sau khi staff duyệt. Mỗi tác giả một đánh giá mỗi địa điểm; gửi
     lại sẽ thay thế và quay về `pending`. Tác giả xem và xoá đánh giá của mình.
   - **Viết trên trang chủ / trang địa điểm bởi khách hoặc bất kỳ ai**
     (`source: 'homepage'`): lên ngay (`approved`), **không duyệt trước**. Staff vẫn có thể
     `remove` sau đó. Vì không ai xem trước, đường này bị chặn bằng cách khác: chỉ văn bản
     thuần (link hiện như chữ, không bấm được), giới hạn 3 lần/giờ theo client key và 20
     lần/ngày tổng cho mỗi địa điểm, một trường honeypot, body 60–1000 ký tự, và phong bì
     429 thông thường. Mỗi khách một đánh giá mỗi địa điểm trên mỗi client key trong 24 giờ.
     Chủ nhà chấp nhận rủi ro còn lại (spam, nội dung xấu còn hiện cho tới khi bị gỡ).
   - **Thông tin chính xác, không bắt buộc đã đến.** Người đánh giá không cần có địa điểm
     trong chuyến, nhưng phải cung cấp dữ liệu có cấu trúc, kiểm tra được: địa điểm chọn
     từ danh mục (không gõ tự do), ngày đến, điểm và nội dung. Đánh giá hiển thị là "tự
     khai", không bao giờ là "đã xác minh".
8. **Đọc công khai** là `GET /api/community/trips` và `GET /api/community/reviews`
   (`?placeSlug=`), chỉ trả dòng `approved`, chỉ đọc, giới hạn tần suất như
   `shareReadLimiter`. Điểm trung bình trên địa điểm chỉ tính đánh giá đã duyệt và ẩn khi
   dưới 3 đánh giá, để một điểm số lẻ không bị trình bày như đồng thuận.
9. **Trang.** Trang chủ có hai mục ("Chuyến đi từ cộng đồng", "Đánh giá mới từ người đi"),
   mỗi mục ẩn khi rỗng — không khung rỗng, không dữ liệu seed giả (CLAUDE.md quy tắc 8).
   Trang mới: `/community-trips` (gallery) và danh sách/form đánh giá trên trang địa điểm
   và điểm đến. Admin: một hàng đợi trong cổng admin hiện có. Mọi chuỗi có cả VI và EN;
   văn bản người dùng viết được hiện đúng như họ viết, theo `lang` của nó.
10. **Lưu trữ.** Cả hai store Planner thêm trường mới: khoá JSON `communityReviews` và
    `listing` trên chuyến; migration PostgreSQL `0005_trip_listing.sql`
    (PR 1) thêm cột JSONB `listing` cho phép null trên `trips`; PR 2 thêm bảng `community_reviews`, phản chiếu trong
    `planner-rows.ts` và `planner-transfer.ts`. Không có khoá ngoại, như ADR 0013. Hoàn
    tác là xoá chúng; khoá thừa đã lưu vẫn đọc được.
11. **Giao thành hai PR**, vì hai bề mặt độc lập: PR 1 gallery chuyến đi (quyết định 1–5,
    nửa chuyến đi của 8 và 9), PR 2 đánh giá cộng đồng (6–7, nửa đánh giá của 8 và 9).
    PR 2 dùng lại hàng đợi duyệt và `community:moderate`.

## Các phương án đã cân nhắc

| Phương án | Điểm cộng | Điểm trừ |
|---|---|---|
| A (đã chọn) `listing` opt-in riêng + staff duyệt trước; đánh giá là entity trong store Planner | Khớp lựa chọn của chủ nhà; link `public` giữ nghĩa; user chia sẻ link mà không bị đưa lên trang chủ; không có văn bản người dùng chưa duyệt trên trang nhất | Phải có người duyệt; sửa là mất chỗ; công việc staff tăng theo lượng |
| B Tự động liệt kê mọi chuyến `public` | Không thêm trạng thái, không hàng đợi | Trái với "admin duyệt trước"; spam và lời lẽ xấu lên trang chủ; người chỉ muốn một link bị đưa ra làm tiêu điểm |
| C Duyệt sau (lên ngay, staff gỡ) | Người đi không phải chờ | Vi phạm hiện ra cho tới khi có người để ý; chủ nhà đã chọn duyệt trước |
| D Đưa đánh giá cộng đồng vào Travel Content | Dùng lại `TravelReview` và UI admin | Sai mô hình principal (một token admin, không có user), trộn giọng thương hiệu với người lạ, và `TravelReview` có trường chỉ dành cho thương hiệu |
| E Chụp snapshot chuyến khi duyệt và hiển thị snapshot | Văn bản được duyệt đúng là thứ hiển thị; sửa không làm mất listing | Bản sao thứ hai của dữ liệu chuyến, nội dung cũ, thêm lưu trữ và chuyện đồng bộ |

Phương án về nhì cho chuyến đi là E; nó thua vì phức tạp so với lượng dữ liệu dự kiến —
duyệt lại ở quyết định 4 đơn giản và an toàn hơn. Xem lại nếu chủ chuyến phàn nàn việc sửa làm rơi listing.

## Hệ quả

Dễ hơn: trang chủ có nội dung thật của người đi; `public` giữ nguyên nghĩa; tái sử dụng
kiểm duyệt, role và cổng admin; đánh giá gắn vào các slug địa điểm có sẵn.

Khó hơn, và không miễn phí:

- **Phải có người duyệt** chuyến và đánh giá viết trong Planner; không có staff thì các
  mục đó vẫn trống. Đánh giá của khách trên trang chủ lên ngay không qua duyệt nên nội dung
  xấu chỉ được dọn sau. Không có nút báo cáo cho người đọc (ngoài phạm vi).
- **Nội dung do người dùng tạo đầu tiên trên site.** Phỉ báng, spam, dữ liệu cá nhân trong
  ghi chú và bản quyền giờ đã có thể xảy ra; duyệt trước giảm nhưng không loại bỏ rủi ro,
  và việc gỡ chỉ staff làm được. Điều khoản/quyền riêng tư cho người đóng góp là việc của
  chủ nhà (xem Việc kéo theo).
- **Tên tác giả công khai** là dữ liệu cá nhân. Mặc định phải là lựa chọn của user
  (`authorDisplay`), ẩn danh phải thực sự ẩn tên, và xoá tài khoản hoặc chuyến phải gỡ khỏi
  trang công khai.
- **Hai bề mặt duyệt** (chuyến, đánh giá) chung một hàng đợi và một quyền mới; role
  `moderator` sau này là quyết định riêng (ADR 0006).
- **Điểm trung bình mẫu nhỏ.** Ẩn khi dưới 3 đánh giá; không xếp hạng theo điểm.
- **Đổi schema cả hai store** cùng import/export, nên migration cần ghi chú rollback và test qua cả hai store.
- **Bề mặt tìm kiếm/SEO lớn hơn**: listing và đánh giá đã duyệt được index; sitemap thêm
  `/community-trips`. Văn bản đánh giá không vào structured data cho tới khi đủ lượng.
- Hoàn tác: gỡ route và mục trang; `listing` và `communityReviews` đã lưu nằm yên không tác dụng.

## Việc kéo theo

- Hợp đồng và phân chia việc: `.claude/contracts/community-trips-and-reviews.md`.
- Khi chấp nhận: cập nhật `docs/architecture.md` + `.vi.md` (route, dữ liệu, ranh giới, giai
  đoạn) và `.claude/context/project-context.md`; tài liệu tính năng
  `docs/features/community-trips.*` (PR 1) và `docs/features/community-reviews.*` (PR 2).
- **Chủ nhà đã trả lời (2026-11-14):** mọi sửa đổi trên chuyến đã lên đều xếp lại hàng
  đợi; đánh giá viết trong Planner được duyệt, đánh giá của khách trên trang chủ thì không;
  không bắt buộc đã đến nhưng phải có dữ liệu có cấu trúc chính xác; điều khoản và đầu mối
  gỡ nội dung — **chủ nhà cung cấp, không bịa**.
- **Cổng chặn trước khi chạy thật:** văn bản điều khoản đóng góp và đầu mối yêu cầu gỡ nội
  dung được đọc từ cấu hình site (`src/content/site.ts`, dữ liệu của chủ nhà). Cho tới khi
  điền đủ cả hai, nút "Hiện ở trang chủ" và mọi form đánh giá hiển thị ở trạng thái tắt
  kèm thông báo trung tính — không email giả, không link giữ chỗ (CLAUDE.md quy tắc 4 và 8).
- Còn mở: xác nhận các giới hạn đánh giá của khách (3 lần/giờ theo client key); có cần
  báo cho staff khi có đánh giá mới của khách không.
- Nút báo cáo, trả lời, thích, tải ảnh và role `moderator` mỗi thứ cần quyết định riêng.
