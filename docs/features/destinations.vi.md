# Tính năng — Điểm đến

🇬🇧 English version: [destinations.md](destinations.md)

## Mục đích

Những nơi cả nhà đã thực sự đặt chân tới, kể theo tinh thần "những nơi mình đã
khám phá" chứ không phải một danh mục sản phẩm. Một điểm đến là trung tâm mà
chuyện đi chơi, lịch trình và review video đều trỏ về, và là điểm tựa của bản đồ
hành trình.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/destinations` | `/kham-pha` | `/en/destinations` |
| `/destinations/[slug]` | `/kham-pha/[slug]` | `/en/destinations/[slug]` |

## Dữ liệu

[`src/content/destinations.ts`](../../src/content/destinations.ts) — 8 mục kiểu
`Destination`: `slug`, `name`, `area`, `region` (`north` / `central` / `south`),
`terrain` (núi, biển, đảo, thành phố, đồng quê, cao nguyên), `coords`, `summary`,
`body`, `bestSeason`, `firstVisited`, `visits`, `tags`, `cover`.

Hai field buộc phải là **dữ liệu thật, không phải dữ liệu hợp lý**:

- `coords` là vĩ độ/kinh độ WGS84. Bản đồ chiếu theo đó, nên sai một con số là có
  một cái ghim trông rất tự tin nằm ở sai tỉnh.
- `area` được chọn theo địa lý ("Đông Bắc", "Cao nguyên đá Đồng Văn") thay vì
  theo đơn vị hành chính, để không chết khi tỉnh thành sắp xếp lại.

`firstVisited` và `visits` mang tinh thần "nhà mình đã ở đó" và quyết định kích
thước ghim trên bản đồ.

Helper: `destinationBySlug`, `getDestination(slug)`.

## Cách hoạt động

Cả hai trang là server component; trang chi tiết prerender mọi slug theo từng
locale qua `generateStaticParams` và gọi `notFound()` khi slug lạ.

Trang chi tiết ghép các tham chiếu chéo theo một chiều duy nhất: nó hỏi
`getStoriesForDestination` và `getItinerariesForDestination` về mọi thứ đang trỏ
tới điểm đến này, nên một bài viết mới tự xuất hiện ở trang điểm đến mà không phải
sửa gì trong điểm đến. Review video khớp qua `destinationSlug`.

JSON-LD `TouristDestination` được phát ra, mang toạ độ thật dưới dạng
`GeoCoordinates` và vùng miền dưới dạng `PostalAddress`.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/app/[locale]/destinations/page.tsx`](../../src/app/[locale]/destinations/page.tsx) | Trang danh sách |
| [`src/app/[locale]/destinations/[slug]/page.tsx`](../../src/app/[locale]/destinations/[slug]/page.tsx) | Trang chi tiết, tham chiếu chéo, JSON-LD |
| [`src/components/cards/destination-card.tsx`](../../src/components/cards/destination-card.tsx) | Card |
| [`src/components/sections/explored-destinations.tsx`](../../src/components/sections/explored-destinations.tsx) | Khối ở trang chủ |
| [`src/content/destinations.ts`](../../src/content/destinations.ts) | Dữ liệu seed + hàm tra cứu |

## Test

- `tests/content.test.ts` — slug không trùng và an toàn cho URL, mọi field
  `Localized<T>` đủ hai locale, `cover` có file thật trên đĩa.
- `tests/map.test.ts` — mọi điểm đến có toạ độ nằm trong phạm vi thật của Việt
  Nam, và mọi ghim sau khi chiếu đều rơi vào trong khung nhìn.

## Giới hạn và câu hỏi còn mở

Chưa lọc theo vùng hay địa hình, dù cả hai field đã có và phần UI thì rẻ — với tám
điểm đến, một thanh lọc là trang trí nhiều hơn là hữu ích. Chưa có chỉ mục ngược:
các hàm tra tham chiếu chéo quét toàn bộ bộ dữ liệu ở mỗi lần build, điều đó miễn
phí ở quy mô này và sẽ cần một map khi vượt vài trăm mục.

Ảnh cover là SVG sinh tự động. `bestSeason` là câu văn biên tập, không phải dữ
liệu có cấu trúc, nên không lọc được nếu không đổi schema.
