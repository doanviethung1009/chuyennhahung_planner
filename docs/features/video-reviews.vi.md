# Tính năng — Góc review video

🇬🇧 English version: [video-reviews.md](video-reviews.md)

## Mục đích

Một kệ trưng các video ngắn cả nhà đã đăng, cùng hai nút kênh thực sự dẫn tới
chúng. Nó tồn tại để sự hiện diện trên mạng xã hội nhìn thấy được từ site, mà
không giả vờ mình là một trình phát video.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/reviews` | `/goc-review` | `/en/reviews` |

Một khối ở trang chủ render đúng các card này.

## Dữ liệu

[`src/content/video-reviews.ts`](../../src/content/video-reviews.ts) — 6 mục kiểu
`VideoReview`: `id`, `title`, `platform` (`tiktok` / `facebook` / `youtube`),
`durationSeconds`, `destinationSlug`, `cover`, `publishedAt`. Sắp mới nhất trước
qua `videoReviewsNewestFirst`.

**Không có field URL**, và chính sự thiếu vắng đó là toàn bộ thiết kế của tính
năng này.

Link kênh lấy từ `social` trong [`src/content/site.ts`](../../src/content/site.ts),
đã lọc bỏ mục email. Các handle đó là giá trị mặc định **cần chủ nhà xác nhận**.

## Cách hoạt động

Chỉ có server component. `VideoCard` cố ý **chỉ để trình bày**: không thẻ link,
không nút play, không hiệu ứng nhấc lên khi hover. Chúng ta không có URL của từng
video, nên một card link về kênh sẽ ngụ ý rằng nó mở đúng clip đó — một cái link
nói sai về đích đến, còn tệ hơn là không có link. Quy tắc "không link giả, không
nút chết" chính là thứ tạo ra hình dạng này.

Khách đến được clip qua hai nút kênh `ButtonExternalLink` ở đầu trang, đó là
những link duy nhất chúng ta bảo đảm được. Chúng có nhãn "mở ở tab mới" lấy từ
namespace `common`.

`durationSeconds` render qua `formatDuration` thành dạng `m:ss`.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/app/[locale]/reviews/page.tsx`](../../src/app/[locale]/reviews/page.tsx) | Trang, nút kênh, lưới card |
| [`src/components/cards/video-card.tsx`](../../src/components/cards/video-card.tsx) | Card chỉ để trình bày |
| [`src/components/sections/video-reviews-section.tsx`](../../src/components/sections/video-reviews-section.tsx) | Khối ở trang chủ |
| [`src/content/video-reviews.ts`](../../src/content/video-reviews.ts) | Dữ liệu seed + thứ tự mới nhất trước |
| [`src/content/site.ts`](../../src/content/site.ts) | URL kênh — cần handle thật của chủ nhà |

## Test

`tests/content.test.ts` có một case riêng tên `keeps video reviews link-free`,
nên quyết định ở trên không thể bị xoá bỏ một cách vô tình; ngoài ra còn kiểm
`id` video không trùng, `destinationSlug` trỏ đúng, đủ locale và cover tồn tại.

## Giới hạn và câu hỏi còn mở

Các card không phát và không mở gì cả. Muốn chúng bấm được: thêm field URL vào
`VideoReview` trong `src/content/types.ts`, điền cho cả sáu mục, bọc phần thân
card trong một thẻ link, và cập nhật test `keeps video reviews link-free` — test
đó fail là tín hiệu đúng như thiết kế, không phải một vật cản.

Số lượt xem, nhúng video và tự động đồng bộ với TikTok hay Facebook đều ngoài
phạm vi; ở đây không có client API nào, và thêm vào sẽ khiến một site tĩnh phụ
thuộc vào một bên thứ ba ngay lúc build.
