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

`/map` đọc `?province=` (cùng hàng chip và `parseDestinationProvince` với `/destinations`): ghim và danh sách thu hẹp theo một tỉnh ngay trên server. Giá trị lạ thì hiện tất cả; URL đã lọc là `noindex, follow` với canonical về bản đồ gốc. Vì đọc `searchParams` nên `/map` được render theo từng request, không còn prerender.

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
link tới cả mười sáu trang điểm đến, và người dùng bàn phím tab qua chúng theo thứ tự.

Trên bản đồ đầy đủ (`/map`) chỉ các điểm đến **featured** (`featured: true` trong
`src/content/destinations.ts`, do chủ dự án chọn, không phụ thuộc `visits`) giữ
nhãn tên cố định; mọi ghim còn lại hiện tên qua tooltip khi hover hoặc focus bàn
phím, giống bản xem trước ở trang chủ. Tên vẫn nằm trong accessible name của thẻ
liên kết ở cả hai trường hợp. Nhờ vậy các cụm dày (Hà Nội / Ninh Bình / Hạ Long,
Huế / Hội An / Đà Nẵng) vẫn đọc được ở 375px. Một điểm featured có thể đặt `labelSide` để ghi đè phía nhãn mặc định (trái, phải hoặc trên) khi nhãn
lân cận va chạm (Hà Nội phía trên chấm, TP. Hồ Chí Minh bên phải). Trên cảm ứng không có hover, nên
chạm vào sẽ mở trang điểm đến, nơi tiêu đề có tên.

**Quy tắc ghim và nhãn hiện tại** (nơi duy nhất ghi gộp lại):

| Khía cạnh | Quy tắc |
|---|---|
| Vị trí | `project(lat, lng)` từ `coords` thật của điểm đến; chấm đặt đúng tâm điểm đó |
| Kích thước chấm | bán kính `min(5 + visits × 1.4, 11)` CSS px (`pinRadius`; không có `visits` tính là 0): đường kính 10px khi chưa đi, 12.8px khi 1 lần, 22px từ 5 lần trở lên (chạm trần ở 5 lần, nên Ninh Bình và Đà Lạt trông bằng nhau). Là px CSS cố định, không co giãn theo bản đồ |
| Kiểu chấm | đặc = đã đến (`isVisited`); vòng rỗng = chưa đến |
| Vùng bấm | thẻ `<a>` là hình vuông `MAP_TARGET_PX` = 44px, tâm đúng chấm, không phụ thuộc kích thước chấm |
| Nhãn cố định | chỉ variant `full` và `featured: true`; hiện tại là **Hà Nội** và **TP. Hồ Chí Minh** |
| Phía nhãn | `labelSide(x)` (nửa trái → phải, nửa phải → trái) trừ khi điểm đến đặt `labelSide` (`left` / `right` / `top`) |
| Các ghim còn lại | tên dạng `sr-only` cùng tooltip khi hover/focus; `preview` không bao giờ có nhãn cố định |
| Chú giải | khung "Ký hiệu" ở trang `/map` giải thích kích thước chấm, vòng rỗng và cách hiện tên (`legendVisits`, `legendNotVisited`, `legendNames` trong `messages/*.json`) |
| Ai quyết định | danh sách featured và mọi `labelSide` ghi đè là **dữ liệu của chủ dự án** (CLAUDE.md quy tắc 8): chỉ thêm hoặc bớt điểm featured khi chủ dự án đồng ý |
| Trước khi đổi | mở `/map` ở 375px và 768px: không hai nhãn cố định nào chồng nhau, không nhãn nào đè lên ghim khác, không bị cắt, mọi hộp ghim ≥44px, và Tab hiện tooltip ở ghim không featured |

Việc đơn giản hoá là có chủ đích và được nói rõ: đường bờ biển là cách điệu, còn
các ghim thì không. Vị trí một cái ghim luôn được tính từ toạ độ thật của điểm đến.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/lib/map.ts`](../../src/lib/map.ts) | Phép chiếu, đường viền, bán kính ghim |
| [`src/components/ui/province-filter-nav.tsx`](../../src/components/ui/province-filter-nav.tsx) | Hàng chip tỉnh dùng chung với `/destinations` |
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

Các ghim có thể đè nhau khi hai điểm đến ở gần nhau; với mười sáu ghim thì có vài cặp
đè nhau (ví dụ Hội An và Đà Nẵng; xem quy tắc nhãn ở trên), và cách giải quyết thật là xử lý chồng lấn hoặc gom
nhóm ghim. Hiện chỉ có hai nhãn cố định nên nhãn không va nhau.
