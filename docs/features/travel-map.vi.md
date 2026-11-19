# Tính năng — Bản đồ hành trình

🇬🇧 English version: [travel-map.md](travel-map.md)

## Mục đích

Một bản đồ Việt Nam được vẽ cách điệu, mỗi điểm đến cả nhà từng tới là một cái
ghim. Nó trả lời câu "nhà mình đã đi những đâu rồi?" chỉ trong một cái nhìn, và
nó chạy được khi tắt JavaScript — không tile, không thư viện bản đồ, không API key.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/map` | `/ban-do` | `/en/map` |

Một biến thể `preview` nhỏ hơn của cùng component xuất hiện ở trang chủ.

## Dữ liệu

Field `coords` của mỗi `Destination` — vĩ độ/kinh độ WGS84 thật — cùng với
`visits`, thứ quyết định kích thước ghim. Không gì khác: đường viền là một hằng số
trong [`src/lib/map.ts`](../../src/lib/map.ts), không phải một file dữ liệu.

## Cách hoạt động

`lib/map.ts` là một module thuần với ba export quan trọng:

- `project(lat, lng)` — phép chiếu equirectangular vào khung 420×820 với padding
  18px, giới hạn trong `lat 8.2–23.6`, `lng 101.9–110.0`. Thô, nhưng đúng ở tỉ lệ
  mà chúng ta vẽ.
- `VIETNAM_OUTLINE_PATH` — đường biên quốc gia 33 điểm, đổi Catmull-Rom → Bézier
  bậc ba và tính một lần lúc nạp module, để danh sách điểm thô hiện ra thành một
  silhouette khép kín mượt mà chứ không phải một đa giác gãy góc.
- `pinRadius(visits)` — `5 + visits * 1.4`, chặn trần ở 11, để nơi đi lại nhiều
  trông lớn hơn mà không lấn cả bản đồ.

Component này là **server** component. Thẻ `<path>` silhouette được
`aria-hidden`, còn các ghim là một `<ul>` gồm các thẻ `Link` thật của `next-intl`
đặt tuyệt đối lên trên. Toàn bộ chuyện accessibility và SEO nằm ở đó: bot thấy
link tới tám trang điểm đến, và người dùng bàn phím tab qua chúng theo thứ tự.

Trên bản đồ đầy đủ (`/map`) chỉ các điểm đến **featured** (`featured: true` trong
`src/content/destinations.ts`, do chủ dự án chọn, không phụ thuộc `visits`) giữ
nhãn tên cố định; mọi ghim còn lại hiện tên qua tooltip khi hover hoặc focus bàn
phím, giống bản xem trước ở trang chủ. Tên vẫn nằm trong accessible name của thẻ
liên kết ở cả hai trường hợp. Nhờ vậy các cụm dày (Hà Nội / Ninh Bình / Hạ Long,
Huế / Hội An / Đà Nẵng) vẫn đọc được ở 375px. Trên cảm ứng không có hover, nên
chạm vào sẽ mở trang điểm đến, nơi tiêu đề có tên.

Việc đơn giản hoá là có chủ đích và được nói rõ: đường bờ biển là cách điệu, còn
các ghim thì không. Vị trí một cái ghim luôn được tính từ toạ độ thật của điểm đến.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/lib/map.ts`](../../src/lib/map.ts) | Phép chiếu, đường viền, bán kính ghim |
| [`src/components/map/vietnam-map.tsx`](../../src/components/map/vietnam-map.tsx) | SVG + ghim dạng link, biến thể `full` / `preview` |
| [`src/app/[locale]/map/page.tsx`](../../src/app/[locale]/map/page.tsx) | Trang bản đồ |
| [`src/components/sections/map-preview.tsx`](../../src/components/sections/map-preview.tsx) | Bản xem trước ở trang chủ |

## Test

`tests/map.test.ts` kiểm tra mọi điểm đến chiếu vào trong khung nhìn, bắc luôn ở
trên nam và đông ở bên phải tây (phép chiếu không bị lật), mọi điểm đến có toạ độ
nằm trong Việt Nam, đường viền là đường khép kín, độ lớn của ghim có chặn trần, chỉ ghim featured mới có nhãn cố định (các ghim còn lại giữ tên dạng `sr-only` cùng tooltip khi focus), và tập featured khớp danh sách chủ dự án đã duyệt.

## Giới hạn và câu hỏi còn mở

Đường viền là silhouette, không phải bản đồ địa chính — không tỉnh, không biên
giới, không nhãn nào ngoài tên điểm đến, và không zoom hay kéo. Phạm vi được
hard-code cho phần đất liền Việt Nam: một điểm đến ngoài phạm vi đó (Côn Đảo ở
rất xa phía nam, hay bất cứ đâu ngoài nước) sẽ bị ép sát biên về mặt hình ảnh và
`tests/map.test.ts` sẽ bắt được.

Các ghim có thể đè nhau khi hai điểm đến ở gần nhau; với tám mục thì chưa xảy ra,
và cách giải quyết thật là xử lý chồng lấn hoặc gom nhóm ghim.
