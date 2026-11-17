# Tính năng — Địa điểm công khai

🇬🇧 English: [places.md](places.md)

## Summary

Người xem duyệt được các địa điểm của một điểm đến và mở trang riêng cho từng địa điểm: loại, vị trí, mô tả, ảnh, thời lượng gợi ý, chi phí ước tính, điểm và ghi chú của Hưng, cùng các review đã duyệt của người đi (chỉ đọc). Tiếng Việt là mặc định; tiếng Anh là bản dịch.

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/places/[slug]` | `/dia-diem/[slug]` | `/en/places/[slug]` |

Mục "Địa điểm" nằm trên `/destinations/[slug]`. Không có trang danh sách địa điểm. Xem [ADR 0026](../adr/0026-public-places-routes.vi.md).

## Data

Đọc collection `Place` của content repository (`placeInputSchema`) và review đã duyệt (`getApprovedReviews`). Namespace thông điệp `places` (VI và EN). Địa điểm không có trạng thái publish nên mọi địa điểm trong catalogue đều công khai. Hiển thị: tên, vị trí, loại, ảnh, mô tả, `suggestedMinutes`, `estimatedCostVnd`, `rating`, `personalNote`. Không bao giờ hiển thị: `affiliateLinks`, mốc thời gian. Địa điểm và điểm seed là nội dung chủ dự án cần xác nhận trước khi ra mắt.

## How it works

`getPublicPlaces(destinationSlug?)` và `getPublicPlace(slug)` trong `src/server/content/public-places.ts` chiếu địa điểm về danh sách trường cho phép. Danh sách trả `[]` khi store lỗi nên trang điểm đến ẩn mục. Trang chi tiết trả 404 với slug lạ và để lỗi store nổi lên thành lỗi. Review lấy từ `getApprovedReviews([slug])` và hiển thị bằng `ReviewList`; chưa có review thì hiện một dòng thông báo. Chi phí dưới một triệu đồng viết đủ trong tiếng Việt (`50.000 đ`). Ảnh có alt ghép từ tên địa điểm và số thứ tự ảnh. Trang là `force-dynamic` và sitemap liệt kê mọi địa điểm kèm `hreflang`.

## Files

| Đường dẫn | Vai trò |
|---|---|
| `src/app/[locale]/places/[slug]/page.tsx` | Trang chi tiết địa điểm, metadata, JSON-LD |
| `src/app/[locale]/destinations/[slug]/page.tsx` | Mục "Địa điểm" |
| `src/server/content/public-places.ts` | Đọc địa điểm theo danh sách trường cho phép |
| `src/components/cards/place-card.tsx` | Thẻ địa điểm |
| `src/lib/place-format.ts` | Cách viết thời lượng và chi phí |
| `src/i18n/routing.ts`, `src/app/sitemap.ts` | Route và sitemap |
| `messages/vi.json`, `messages/en.json` | Namespace `places` |

## Tests

`tests/places-page.test.ts`: chiếu theo danh sách cho phép và lọc theo điểm đến, slug lạ, store lỗi cho danh sách rỗng, markup thẻ, cặp route, mục sitemap, khớp khóa VI/EN, một `h1` và `notFound()` trên trang. `tests/routing.test.ts`, `tests/i18n.test.ts`, `tests/docs.test.ts` và `tests/client-boundary.test.ts` phủ các quy tắc chung. Không có test tự động: render trọn trang chi tiết (kiểm tay ở 375, 768 và 1280 px).

## Limits and open questions

Chưa có trang danh sách địa điểm, tìm kiếm hay lọc, bản đồ, form review (contract sau), nút thêm vào chuyến. Alt còn chung chung cho đến khi schema có alt theo từng ảnh. Chưa hiển thị tọa độ địa điểm. Địa điểm nhập tạm làm placeholder sẽ hiển thị công khai như nó đang có.
