# Tính năng — Chuyến đi cộng đồng

🇬🇧 English version: [community-trips.md](community-trips.md)

## Tóm tắt

Người đi có thể xin cho một chuyến đi công khai của mình hiện trên trang chủ và trang gallery. Không gì được hiển thị cho tới khi staff duyệt, mọi thay đổi sau đó trên chuyến sẽ gỡ nó xuống cho tới khi duyệt lại, và tác giả hiện bằng tên hiển thị hoặc ẩn danh tuỳ chủ chuyến chọn. Đây là PR 1 của [ADR 0014](../adr/0014-community-trips-and-reviews.vi.md); đánh giá địa điểm của người đi là PR 2.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/community-trips` | `/chuyen-di-cong-dong` | `/en/community-trips` |
| `/admin/community` | `/quan-tri/cong-dong` | `/en/admin/community` |

API: `PUT|DELETE /api/planner/[id]/listing` (chủ chuyến), `GET /api/community/trips` (công khai), `GET /api/admin/community/queue` và `PATCH /api/admin/community/trips/[id]` (staff, action `community:moderate`).

## Dữ liệu

- `Trip.listing` — `null` (chưa gửi) hoặc `{ status: pending | approved | rejected, authorDisplay: name | anonymous, requestedAt, decidedAt, decidedBy, rejectReason }`. Dòng cũ không có trường này đọc là `null`.
- `CommunityTripCard` — allow-list công khai: `shareToken`, `title`, `destinationSlug`, `durationDays`, `partySize`, `travelStyle`, `activityCount`, `author` (`null` khi ẩn danh), `approvedAt`. Không bao giờ có email, user id hay `ownerId`.
- PostgreSQL: migration `0005_trip_listing.sql` thêm cột JSONB `trips.listing` cho phép null; rollback trong `db/rollback/`.
- Namespace thông điệp: `community`, `home.community`, `share.listing*`, `adminCommunity`, `adminContent.nav.community`, `nav.communityTrips`.
- **Cần dữ liệu thật của chủ nhà:** `contribution.terms` (VI và EN) và `contribution.takedownContact` trong `src/content/site.ts`. Hiện cả hai là `null` và không có gì được bịa.

## Cách hoạt động

1. Chủ chuyến đặt chuyến ở `public`, rồi trong khung chia sẻ chọn cách hiển thị và gửi. Listing thành `pending` (không tăng version, không cần `If-Match`). Nút bị tắt kèm thông báo trung tính cho tới khi chủ nhà cung cấp điều khoản và đầu mối gỡ nội dung.
2. Staff mở `/quan-tri/cong-dong`: chờ duyệt nằm trên, có link xem chuyến, **Duyệt**, **Từ chối** (bắt buộc lý do) hoặc với chuyến đã duyệt là **Gỡ** (bắt buộc lý do).
3. Trang chủ và `/community-trips` đọc listing đã duyệt qua `getCommunityTrips` (`src/server/community/public.ts`). Lỗi store trả danh sách rỗng, và danh sách rỗng thì ẩn mục trên trang chủ.
4. Mọi thay đổi trên chuyến (`touch`) đưa listing đã duyệt về `pending`. Rời `public`, ngừng chia sẻ hoặc lưu trữ đặt nó về `null`. Đổi share token giữ nguyên listing và link gallery đi theo token mới.
5. Tiêu đề và tên do người đi viết và được hiển thị như văn bản thuần.

## Tệp

| Đường dẫn | Vai trò |
|---|---|
| `src/server/planner/schemas.ts` | `tripListingSchema`, schema yêu cầu/quyết định, `CommunityTripCard`, `ListingQueueItem` |
| `src/server/planner/repository.ts` | `requestListing`, `withdrawListing`, `decideListing`, `listListingQueue`, `listCommunityTrips`, xếp lại hàng trong `touch` |
| `src/server/identity/permissions.ts` | action `community:moderate` (editor, admin, service) |
| `src/server/persistence/planner-rows.ts`, `db/migrations/0005_trip_listing.sql` | cột PostgreSQL |
| `src/app/api/planner/[id]/listing`, `src/app/api/community/trips`, `src/app/api/admin/community/**` | route |
| `src/server/community/public.ts` | module đọc chỉ-server cho các trang |
| `src/components/cards/community-trip-card.tsx`, `src/components/sections/community-trips-section.tsx` | UI công khai |
| `src/app/[locale]/community-trips/page.tsx` | gallery |
| `src/components/planner/share-panel.tsx` | điều khiển của chủ chuyến |
| `src/app/[locale]/admin/community/page.tsx`, `src/components/admin/community/listing-queue.tsx` | hàng đợi staff |
| `src/content/site.ts` | `contribution` (dữ liệu chủ nhà) |

## Kiểm thử

`tests/community-trips.test.ts`: không gì công khai trước khi duyệt; chỉ chuyến public đang hoạt động mới gửi được; rejected/pending/unlisted không lên gallery; mọi sửa đổi xếp lại hàng; rời public hoặc lưu trữ chấm dứt listing; đổi token giữ listing; gỡ và rút; chuyến của chủ khác là `not_found`; card có đúng các trường cho phép và ẩn danh giấu tên, user id, trip id; schema yêu cầu/quyết định là strict. `tests/planner-roles.test.ts` ghim `community:moderate`. `tests/planner-sharing.test.ts` phân loại `listing` là không đưa vào share view.

Chưa chạy ở đây: test tích hợp PostgreSQL (môi trường này không có database), nên cột `listing` chỉ được phủ bởi test ánh xạ dòng.

## Giới hạn và câu hỏi mở

- Tính năng đóng cho tới khi chủ nhà cung cấp điều khoản đóng góp và đầu mối gỡ nội dung.
- Không có thông báo cho staff hay cho chủ chuyến khi có quyết định; hàng đợi được xem bằng cách mở trang.
- Sửa chuyến đã lên luôn mất listing; ngoại lệ chỉ-văn-bản đã được cân nhắc và chủ nhà không chọn.
- Gallery liệt kê 48 chuyến duyệt mới nhất; chưa có tìm kiếm hay phân trang.
- Link gallery mang share token; chấp nhận được chỉ vì chuyến đã listing là public.
- Báo cáo từ người đọc và đánh giá địa điểm của người đi không nằm trong PR này (PR 2).
