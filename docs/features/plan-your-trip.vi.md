# Tính năng — Thiết kế chuyến đi (điểm vào Planner)

🇬🇧 English version: [plan-your-trip.md](plan-your-trip.md)

## Mục đích

Trang để khách nhờ nhà mình thiết kế một chuyến đi cho họ. Hiện tại nó giải thích
cách làm việc đó qua bốn bước và trao cho khách những đường liên hệ thật. **Nó
không có form, và đó là chủ đích** — backend của Planner thuộc phase sau, mà một
nút submit không có gì phía sau là một nút chết.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/plan-your-trip` | `/thiet-ke-chuyen-di` | `/en/plan-your-trip` |

Đi vào từ footer, từ khối CTA ở trang chủ, và từ các trang lịch trình.

## Dữ liệu

Không dùng bộ nội dung nào. Mọi thứ trên trang đến từ namespace messages `plan`
(title, description, intro, `step1Title`…`step4Detail`, phần liên hệ,
`emailSubject`, `emailBody`, `browseCta`) cộng với `siteConfig.contactEmail` và
`social` trong [`src/content/site.ts`](../../src/content/site.ts).

`contactEmail` và các handle mạng xã hội **cần chủ nhà xác nhận**: một link
mailto chỉ thật đúng bằng cái hộp thư nằm sau nó.

## Cách hoạt động

Một server component với ba section, mỗi section có tiêu đề riêng gắn bằng
`aria-labelledby`: phần giải thích bốn bước dưới dạng danh sách có thứ tự, khối
liên hệ, và một link dự phòng dẫn sang danh sách lịch trình.

Hành động chính là một `mailto:` điền sẵn — tiêu đề và nội dung thư dựng từ các
chuỗi đã dịch qua `encodeURIComponent`, nên khách Việt nhận được một bản nháp
tiếng Việt. Hành động phụ là các kênh mạng xã hội thật (mục email bị lọc khỏi
hàng này vì nó đã là nút chính). Mọi nút ra ngoài đều có nhãn "mở ở tab mới".

Đây đúng là hình dạng mà quy tắc đòi hỏi: affordance thật, không phụ thuộc
server, và không có control nào vô dụng.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/app/[locale]/plan-your-trip/page.tsx`](../../src/app/[locale]/plan-your-trip/page.tsx) | Trang |
| [`src/components/sections/plan-trip-cta.tsx`](../../src/components/sections/plan-trip-cta.tsx) | CTA ở trang chủ |
| [`src/content/site.ts`](../../src/content/site.ts) | Email liên hệ + kênh mạng xã hội |
| [`messages/vi.json`](../../messages/vi.json), [`messages/en.json`](../../messages/en.json) | Namespace `plan` |

## Test

Được phủ gián tiếp: `tests/routing.test.ts` chứng minh route tồn tại ở cả hai
locale và đi tới được từ điều hướng ở footer, còn `tests/i18n.test.ts` chứng minh
mọi chuỗi `plan` có đủ ở hai file và placeholder khớp nhau. `npm run verify:ui`
chụp trang ở ba độ rộng. Không có test hành vi, vì chưa có hành vi nào.

## Giới hạn và câu hỏi còn mở

Không form, không lưu trữ, không server action, không rate limiting — không dựng
sẵn thứ nào, có chủ đích. Mở phase Planner nghĩa là, theo đúng thứ tự: một ADR
được duyệt cho model dữ liệu và hợp đồng gửi form, rồi backend (validate ngay ở
biên, phân quyền, ghi idempotent, hình dạng lỗi an toàn), rồi mới tới form.

Trước lúc đó, rủi ro thật lại rất bình thường: một hộp thư không ai trông, và các
handle mạng xã hội chưa từng được kiểm chứng. Cả hai đều có trong
[../usage.vi.md](../usage.vi.md#trước-khi-lên-sóng--việc-của-chủ-nhà).
