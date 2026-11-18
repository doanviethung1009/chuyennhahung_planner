# Tính năng — Thiết kế chuyến đi (điểm vào Planner)

🇬🇧 English version: [plan-your-trip.md](plan-your-trip.md)

## Mục đích

Điểm vào của Planner. Khách có thể bắt đầu thiết kế chuyến đi ngay qua hai link
thật — một lịch trình có sẵn hoặc một chuyến trống — hoặc nhờ nhà mình gợi ý, việc
mà trang giải thích qua bốn bước và trao những đường liên hệ thật. **Trang không
có form, và đó là chủ đích**: nó dẫn vào Planner chứ không gửi dữ liệu tới Planner,
và một nút submit không có gì phía sau là một nút chết. Trang không hứa AI hay
trình tự lên lịch — cả hai đều đang hoãn.

Bản thân Planner ([ADR 0002](../adr/0002-planner-core.vi.md),
[travel-planner-core.vi.md](travel-planner-core.vi.md)) nằm phía sau hai link đó.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/plan-your-trip` | `/thiet-ke-chuyen-di` | `/en/plan-your-trip` |

Đi vào từ footer, từ khối CTA ở trang chủ, và từ các trang lịch trình.

## Dữ liệu

Không dùng bộ nội dung nào. Mọi thứ trên trang đến từ namespace messages `plan`
(title, description, intro, `startTitle`…`startBlankHint`, `stepsTitle`,
`step1Title`…`step4Detail`, phần liên hệ, `emailSubject`, `emailBody`) cộng với `siteConfig.contactEmail` và
`social` trong [`src/content/site.ts`](../../src/content/site.ts).

`contactEmail` và các handle mạng xã hội **cần chủ nhà xác nhận**: một link
mailto chỉ thật đúng bằng cái hộp thư nằm sau nó.

## Cách hoạt động

Một server component với ba section, mỗi section có tiêu đề riêng gắn bằng
`aria-labelledby`. Section đầu là phần chính, "bắt đầu thiết kế ngay", với hai
`ButtonLink` (≥44px): `/itineraries` (chọn lịch trình có sẵn; mỗi trang lịch trình
lại dẫn tiếp tới `/trip-setup/[template]`, đường này cần slug template nên không thể
là đích duy nhất của trang) và `/my-trips/new` (chuyến trống). Phía dưới, dưới tiêu
đề "hoặc nhờ nhà Hưng gợi ý", là phần giải thích bốn bước dạng danh sách có thứ tự
và khối liên hệ.

Hành động liên hệ là một `mailto:` điền sẵn — tiêu đề và nội dung thư dựng từ các
chuỗi đã dịch qua `encodeURIComponent`, nên khách Việt nhận được một bản nháp
tiếng Việt. Hành động phụ là các kênh mạng xã hội thật (mục email bị lọc khỏi
hàng này vì nó đã là nút chính). Mọi nút ra ngoài đều có nhãn "mở ở tab mới".

Đây đúng là hình dạng mà quy tắc đòi hỏi: affordance thật, trang này không phụ
thuộc server, và không có control nào vô dụng. Trang giữ nguyên dòng nhà mình không
bán tour và không nhận hoa hồng.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/app/[locale]/plan-your-trip/page.tsx`](../../src/app/[locale]/plan-your-trip/page.tsx) | Trang |
| [`src/components/sections/plan-trip-cta.tsx`](../../src/components/sections/plan-trip-cta.tsx) | CTA ở trang chủ |
| [`src/content/site.ts`](../../src/content/site.ts) | Email liên hệ + kênh mạng xã hội |
| [`messages/vi.json`](../../messages/vi.json), [`messages/en.json`](../../messages/en.json) | Namespace `plan` |

## Test

`tests/plan-your-trip-links.test.ts` chứng minh hai đích của link có trong
pathname map và các khóa `plan` mới có ở cả hai file. `tests/routing.test.ts` chứng
minh route tồn tại ở cả hai locale và đi tới được từ điều hướng ở footer, còn
`tests/i18n.test.ts` chứng minh mọi chuỗi `plan` có đủ ở hai file và placeholder
khớp nhau. `npm run verify:ui` chụp trang ở ba độ rộng.

## Giới hạn và câu hỏi còn mở

Trang này không form, không lưu trữ, không server action, không rate limiting —
không dựng sẵn thứ nào, có chủ đích. Không có gợi ý AI và không có trình tự lên
lịch: cả hai đều đang hoãn và cần ADR riêng. Khách chưa đăng nhập mở
`/my-trips/new` thì do trang đó xử lý, không phải trang này.

Trước lúc đó, rủi ro thật lại rất bình thường: một hộp thư không ai trông, và các
handle mạng xã hội chưa từng được kiểm chứng. Cả hai đều có trong
[../usage.vi.md](../usage.vi.md#trước-khi-lên-sóng--việc-của-chủ-nhà).
