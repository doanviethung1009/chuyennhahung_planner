# Tính năng — Đánh giá địa điểm từ cộng đồng

🇬🇧 English version: [community-reviews.md](community-reviews.md)

## Tóm tắt

Người đi có thể đánh giá các địa điểm trong danh mục, khi đã đăng nhập trong Planner hoặc là khách trên trang chủ. Mọi đánh giá lên ngay, không duyệt trước, và staff có thể gỡ sau đó. Đánh giá hiện trên trang chủ và trang điểm đến, luôn ghi rõ là tự khai. Đây là PR 2 của [ADR 0014](../adr/0014-community-trips-and-reviews.vi.md).

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| không có route mới (hiện ở `/`, `/destinations/[slug]`, `/my-trips/[id]`, `/admin/community`) | | |

API: `GET /api/planner/reviews`, `PUT|DELETE /api/planner/reviews/[placeSlug]` (đã đăng nhập), `GET|POST /api/community/reviews` (công khai), `GET /api/admin/community/reviews` và `PATCH /api/admin/community/reviews/[id]` (staff, `community:moderate`).

## Dữ liệu

- `CommunityReview` trong store Planner: `source` (`planner` | `homepage`), `authorId` (null với khách), `placeSlug` (phải là địa điểm trong danh mục), `rating` 1–5, `body` 60–1000 ký tự văn bản thuần, `lang`, `visitedOn` (bắt buộc, không ở tương lai), `authorName` (`null` = ẩn danh), `status` (`approved`, `removed` hoặc `held`; `pending`/`rejected` chỉ còn ở dòng cũ trước quyết định này), `guestKey` (băm, chỉ để chống trùng), các trường kiểm duyệt.
- PostgreSQL: migration `0006_community_reviews.sql` thêm bảng `community_reviews` (không khoá ngoại); `0007_review_hold.sql` thêm `held` vào check status; `0008_review_restrictions.sql` thêm bảng `review_restrictions`; rollback trong `db/rollback/`.
- Đầu ra công khai `PublicCommunityReview`: chỉ `placeSlug`, `rating`, `body`, `lang`, `visitedOn`, `author`, `createdAt`. Không có id, id tác giả, guest key, source hay trường kiểm duyệt.
- Điểm trung bình chỉ hiện từ 3 đánh giá đã duyệt.
- Namespace thông điệp: `communityReviews`, `adminCommunity.reviews`, `adminCommunity.tripsHeading|reviewsHeading`.
- **Cần dữ liệu thật của chủ nhà:** cùng các giá trị `contribution` như chuyến đi cộng đồng; chưa có thì mọi form đánh giá đều đóng.

## Cách hoạt động

1. **Đường Planner:** ở `/my-trips/[id]` có khung liệt kê các địa điểm danh mục trong chuyến. Tác giả viết hoặc sửa đánh giá (`PUT`, giới hạn 5 lần/giờ/người dùng); đánh giá lên `approved` ngay, mỗi tác giả một đánh giá mỗi địa điểm, sửa là thay thế ngay. Tác giả xoá được đánh giá của mình; staff có thể **Gỡ**.
2. **Đường trang chủ:** ai cũng đăng được từ trang chủ mà không cần tài khoản, và lên `approved` ngay. Thay cho duyệt trước là các giới hạn: 3 lần/giờ mỗi client, một đánh giá mỗi địa điểm mỗi client trong 24 giờ, 20 đánh giá mỗi địa điểm mỗi ngày tính chung, trường honeypot ẩn (điền vào sẽ bị bỏ qua nhưng vẫn trả 201 như thường), và chỉ văn bản thuần. Staff chỉ có thể **Gỡ**.
3. **Hỏi tác giả** ([ADR 0015](../adr/0015-community-review-author-controls.vi.md), PR 1): với đánh giá Planner đang hiện, staff chọn **Hỏi tác giả** và viết câu hỏi (`PATCH …/reviews/[id]` với `{ decision: 'hold', reason }`). Đánh giá chuyển `held`: bị ẩn khỏi mọi lượt đọc công khai và điểm trung bình, còn tác giả thấy câu hỏi trong khung đánh giá của Planner. Sửa đánh giá là trả lời và đăng lại ngay (câu hỏi bị xoá); tác giả cũng xoá được. Staff vẫn **Gỡ** được đánh giá đang `held`, và khi đó tác giả không ghi đè được. Đánh giá của khách không `hold` được. Không có email: tác giả chỉ thấy câu hỏi khi mở trang chuyến đi.
4. **Tắt một tác giả** ([ADR 0015](../adr/0015-community-review-author-controls.vi.md), PR 2): admin và service (`community:restrict`, editor thì không) chọn **Tắt tác giả** trên một đánh giá và nêu lý do, theo địa điểm đó hoặc mọi địa điểm (`POST /api/admin/community/restrictions`, `{ reviewId, scope: 'place' | 'all', reason }`; server tự suy ra tác giả từ đánh giá, staff không bao giờ thấy id hay khoá). Khi còn hiệu lực, đánh giá mới của tác giả bị từ chối (403), đánh giá hiện có trong phạm vi bị ẩn lúc đọc và khỏi điểm trung bình; không có gì đã lưu bị đổi, nên **Gỡ** (`DELETE …/restrictions/[id]`) khôi phục lại. Đánh giá đã bị gỡ vẫn bị gỡ. Tác giả thấy lý do và phạm vi trong khung của mình và không mở được form ở đó. Không bao giờ xoá dòng, nên danh sách chính là nhật ký (ai, khi nào, vì sao, ai gỡ). Không tắt được tài khoản staff. Khách bị tắt theo hash của khoá kết nối: mặc định 30 ngày, tối đa 90, và bị từ chối với khoá `unknown` dùng chung; khách được báo rằng đánh giá từ kết nối này đang tạm dừng. Xoá tài khoản thì xoá restriction của nó.
5. Địa điểm chọn từ danh mục và ngày đến bắt buộc, nên thông tin kiểm tra được; đánh giá hiện là "tự khai", không bao giờ là "đã xác minh".
6. Văn bản đánh giá được React hiển thị như text: HTML vô hại và link không bấm được.
7. Xoá tài khoản người dùng thì xoá cả đánh giá của họ.
8. Trang đọc qua `getApprovedReviews` và `getReviewPlaces` (`src/server/community/public.ts`); lỗi store thì không hiện gì thay vì báo lỗi.

## Tệp

| Đường dẫn | Vai trò |
|---|---|
| `src/server/planner/schemas.ts` | `communityReviewSchema`, schema đầu vào và quyết định, kiểu công khai/hàng đợi/của tác giả |
| `src/server/planner/repository.ts` | `upsertPlannerReview`, `listOwnReviews`, `deleteOwnReview`, `createGuestReview`, `listApprovedReviews`, `listReviewQueue`, `decideReview` (gồm `hold`), `createRestriction`, `liftRestriction`, `listRestrictions`, `listOwnRestrictions` |
| `src/server/rate-limit.ts` | `plannerReviewLimiter`, `guestReviewLimiter` |
| `src/server/persistence/planner-rows.ts`, `planner-transfer.ts`, `src/server/planner/store.ts`, `db/migrations/0006_community_reviews.sql` | lưu trữ |
| `src/app/api/planner/reviews/**`, `src/app/api/community/reviews/route.ts`, `src/app/api/admin/community/reviews/**` | route |
| `src/components/reviews/*` | danh sách, form, khung Planner |
| `src/components/sections/community-reviews-section.tsx` | mục trang chủ |
| `src/components/admin/community/review-queue.tsx` | hàng đợi staff |

## Kiểm thử

`tests/community-reviews.test.ts`: đánh giá Planner lên ngay và staff gỡ được; mỗi tác giả một đánh giá mỗi địa điểm và sửa là thay thế; chỉ xoá được của mình; từ chối địa điểm lạ và ngày tương lai; xoá cùng tài khoản; đánh giá khách lên ngay và chỉ gỡ được; một đánh giá mỗi client mỗi 24 giờ; 20 mỗi địa điểm mỗi ngày; không lưu địa chỉ; projection công khai có đúng các trường cho phép; ẩn điểm trung bình dưới ba; đánh giá `held` bị ẩn, hiện câu hỏi cho tác giả, được đăng lại khi sửa, gỡ hoặc xoá được, còn đánh giá của khách không `hold` được; restriction chặn và ẩn theo một địa điểm hoặc tất cả, gỡ thì khôi phục, không đụng tác giả khác, có thời hạn và từ chối khoá khách dùng chung, không lộ id hay khoá, biến mất cùng tài khoản (`tests/review-restrictions-routes.test.ts` phủ ai được tắt và gỡ, từ chối cross-site và body strict); schema strict và HTML vô hại. `tests/planner-pg-fixtures.ts` nay ghi một đánh giá mỗi loại nên test ánh xạ dòng và test tích hợp PostgreSQL phủ bảng mới.

Chưa chạy ở đây: test tích hợp PostgreSQL (môi trường này không có database).

## Giới hạn và câu hỏi mở

- Đóng cho tới khi chủ nhà cung cấp điều khoản và đầu mối gỡ nội dung.
- Đánh giá không qua duyệt theo lựa chọn của chủ nhà (cả hai cửa vào): nội dung xấu còn hiện cho tới khi staff gỡ, và giới hạn theo client dựa vào một header có thể bị giả. Khi không có proxy tin cậy, mọi client dùng chung một key nên chỉ một đánh giá khách mỗi địa điểm mỗi ngày lọt qua.
- Tên tác giả Planner là bản chụp lúc gửi; đổi tên tài khoản không đổi nó.
- Người bị tắt có thể mở tài khoản thứ hai; restriction cho khách dựa trên khoá giả được và đôi khi dùng chung nên có hạn. Câu hỏi `held` chỉ đến tác giả khi họ mở trang chuyến đi (không email).
- Không có nút báo cáo, trả lời, thích, ảnh hay huy hiệu đã đến. Không báo cho staff khi có đánh giá mới.
- Trang chủ hiện 3 đánh giá mới nhất, trang điểm đến hiện 6; chưa có trang danh sách riêng hay phân trang.
