# Tính năng — Địa điểm công khai

🇬🇧 English: [places.md](places.md)

## Summary

Người xem duyệt được các địa điểm của một điểm đến và mở trang riêng cho từng địa điểm: loại, vị trí, mô tả, ảnh, thời lượng gợi ý, chi phí ước tính, điểm và ghi chú của Hưng, cùng các review đã duyệt của người đi (chỉ đọc). Thành viên đã đăng nhập thêm được địa điểm vào một chuyến đi của mình (PLACES-UI-S3). Tiếng Việt là mặc định; tiếng Anh là bản dịch.

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/places/[slug]` | `/dia-diem/[slug]` | `/en/places/[slug]` |

Mục "Địa điểm" nằm trên `/destinations/[slug]`. Không có trang danh sách địa điểm. Xem [ADR 0026](../adr/0026-public-places-routes.vi.md).

## Data

Đọc collection `Place` của content repository (`placeInputSchema`) và review đã duyệt (`getApprovedReviews`). Namespace thông điệp `places` (VI và EN). Địa điểm không có trạng thái publish nên mọi địa điểm trong catalogue đều công khai. Hiển thị: tên, vị trí, loại, ảnh, mô tả, `suggestedMinutes`, `estimatedCostVnd`, `rating`, `personalNote`. Không bao giờ hiển thị: `affiliateLinks`, mốc thời gian. Địa điểm và điểm seed là nội dung chủ dự án cần xác nhận trước khi ra mắt.

## How it works

`getPublicPlaces(destinationSlug?)` và `getPublicPlace(slug)` trong `src/server/content/public-places.ts` chiếu địa điểm về danh sách trường cho phép. Danh sách trả `[]` khi store lỗi nên trang điểm đến ẩn mục. Trang chi tiết trả 404 với slug lạ và để lỗi store nổi lên thành lỗi. Review lấy từ `getApprovedReviews([slug])` và hiển thị bằng `ReviewList`; chưa có review thì hiện một dòng thông báo. Chi phí dưới một triệu đồng viết đủ trong tiếng Việt (`50.000 đ`). Ảnh có alt ghép từ tên địa điểm và số thứ tự ảnh. **Thêm vào chuyến (PLACES-UI-S3):** `PlaceAddToTrip` đọc phiên qua `GET /api/planner/session`. Khách thấy liên kết đăng nhập quay lại đúng trang (`returnTo`). Thành viên mở một khung liệt kê các chuyến đang hoạt động tới điểm đến của địa điểm (`GET /api/planner?destinationSlug=`, tối đa 50, không phân trang), chọn chuyến và ngày, rồi trang gọi `POST /api/planner/[id]/activities` với thời lượng và chi phí gợi ý của địa điểm (phạm vi `group`, không giờ bắt đầu, thêm vào cuối ngày). Khi chọn chuyến, trang đọc thêm `GET /api/planner/[id]` để cảnh báo nếu địa điểm đã có trong chuyến (vẫn thêm lại được) và vô hiệu hóa ngày đã đủ 40 hoạt động. 401 chuyển tới đăng nhập, 404 tải lại danh sách, 409 (chuyến vừa lưu trữ hoặc ngày đầy) và 429 hiện thông báo. Không đổi API hay dữ liệu. Trang là `force-dynamic` và sitemap liệt kê mọi địa điểm kèm `hreflang` (và báo lỗi, không lẳng lặng bỏ địa điểm, khi store sập).

## Files

| Đường dẫn | Vai trò |
|---|---|
| `src/app/[locale]/places/[slug]/page.tsx` | Trang chi tiết địa điểm, metadata, JSON-LD |
| `src/app/[locale]/destinations/[slug]/page.tsx` | Mục "Địa điểm" |
| `src/server/content/public-places.ts` | Đọc địa điểm theo danh sách trường cho phép |
| `src/components/places/place-review-section.tsx` | Khối form review trên trang (PLACES-UI-S2) |
| `src/components/places/place-add-to-trip.tsx`, `add-to-trip-logic.ts` | Khung thêm vào chuyến và các hàm thuần của nó (PLACES-UI-S3) |
| `src/components/cards/place-card.tsx` | Thẻ địa điểm |
| `src/lib/place-format.ts` | Cách viết thời lượng và chi phí |
| `src/i18n/routing.ts`, `src/app/sitemap.ts` | Route và sitemap |
| `messages/vi.json`, `messages/en.json` | Namespace `places` |

## Tests

`tests/places-page.test.ts`: chiếu theo danh sách cho phép và lọc theo điểm đến, slug lạ, store lỗi cho danh sách rỗng, markup thẻ, cặp route, mục sitemap, khớp khóa VI/EN, một `h1` và `notFound()` trên trang. `tests/routing.test.ts`, `tests/i18n.test.ts`, `tests/docs.test.ts` và `tests/client-boundary.test.ts` phủ các quy tắc chung. `tests/place-add-to-trip.test.ts`: lọc chuyến theo điểm đến và trạng thái, ngày đầy và ngày trùng, body request và kẹp thời lượng, lần render đầu trung tính không có nút, khớp khóa VI/EN của `places.addToTrip`. Không có test tự động: luồng mạng của khung và render trọn trang chi tiết (kiểm tay ở 375, 768 và 1280 px).

## Limits and open questions

Chưa có trang danh sách địa điểm, tìm kiếm hay lọc, bản đồ, tạo chuyến ngay trên trang (chỉ có liên kết tới `/my-trips/new`), sửa giờ bắt đầu hay chi phí lúc thêm (sửa trong trình soạn chuyến), chuyến đã lưu trữ. Trang hiện 20 review mới nhất, không phân trang; muốn phân trang phải thêm `limit`/`cursor` vào `GET /api/community/reviews` (quyết định PLACES-UI-S2). Chỉ đề xuất 50 chuyến đang hoạt động gần nhất của điểm đến. Alt còn chung chung cho đến khi schema có alt theo từng ảnh. Chưa hiển thị tọa độ địa điểm. Địa điểm nhập tạm làm placeholder sẽ hiển thị công khai như nó đang có.
