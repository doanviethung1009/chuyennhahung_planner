# Tính năng — Hệ thiết kế và design token

🇬🇧 English version: [design-system.md](design-system.md)

## Mục đích

Một ngôn ngữ thị giác ấm, kiểu giấy mộc và đất nung, thống nhất trên toàn site,
định nghĩa một lần để không thể trôi dạt. Accessibility là phần của hệ thống chứ
không phải một bước review: độ tương phản được một test parse CSS thật để kiểm.

## Route

Không có. Tính năng này là nền mà mọi trang render lên trên.

## Dữ liệu

Không dùng bộ nội dung nào. Nguồn chân lý là khối `@theme` trong
[`src/app/globals.css`](../../src/app/globals.css):

- **Bảng màu** — nền kem và cát, primary đất nung (clay), accent ngọc bích
  (jade), điểm nhấn vàng (gold), chữ màu mực (ink).
- **Alias ngữ nghĩa** — `background`, `surface`, `surface-muted`, `foreground`,
  `foreground-muted`, `primary`, `primary-strong`, `primary-foreground`,
  `accent`, `highlight`, `border`, `border-subtle`, `border-strong`, `ring`.
- **Chữ** — `--font-display` (Lora) và `--font-sans` (Be Vietnam Pro), cả hai nạp
  qua `next/font` với subset `vietnamese`, cộng một cỡ chữ `eyebrow` có tracking
  riêng.
- **Bo góc, bóng, chuyển động** — `--radius-xs…2xl` và `--radius-pill`, ba lớp
  bóng ấm và nhẹ, `--ease-gentle` và `--animate-rise`.

Hai alias tồn tại vì lý do accessibility và không được "đơn giản hoá" cho mất đi:
`--color-primary` là `clay-600` chứ không phải `clay-500` vì clay-500 chỉ đạt
3,9:1 với chữ trắng trên nút, còn `--color-border-strong` tồn tại vì các đường
viền trang trí quá nhạt để nhận diện một control theo WCAG 1.4.11.

## Cách hoạt động

Tailwind v4 đi theo hướng CSS-first: mọi token trong `@theme` trở thành một
utility, nên `--color-surface-muted` dùng được ngay dưới dạng `bg-surface-muted`
mà không cần file config. Component chỉ dùng các utility đó và không gì khác —
**một màu, font, bo góc hay bóng đổ hard-code ở bất cứ đâu ngoài `globals.css`
đều là lỗi.** Cần giá trị mới? Thêm token trước.

Lớp base đặt `color-scheme: light`, chiều cao header dính `--header-h` (4rem, từ
`64rem` trở lên là 4.75rem — drawer trên mobile tự trừ theo nó),
chiều cao thanh trên của admin `--admin-bar-h` (3.5rem; thanh bên admin dính
dưới nó — ADR 0023), `text-wrap: balance` cho tiêu đề và `pretty` cho đoạn văn, và font tiếng Việt cho
`body`.

Các primitive trong `src/components/ui/` là nửa còn lại của hệ thống: `Button`
(kèm `buttonClass`, `ButtonLink` và `ButtonExternalLink` — cái sau mang nhãn "mở
ở tab mới"), `Container`, `Section`, `Badge`, `Prose`, `CoverImage`. `CoverImage`
tối ưu các định dạng raster qua `next/image` và chỉ bỏ qua bộ tối ưu với SVG.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/app/globals.css`](../../src/app/globals.css) | Token `@theme` + lớp base — nơi duy nhất định nghĩa token |
| [`src/app/[locale]/layout.tsx`](../../src/app/[locale]/layout.tsx) | Nạp `next/font` với subset `vietnamese` |
| [`src/components/ui/`](../../src/components/ui) | Các primitive dựng trên token |
| [`tests/design-tokens.test.ts`](../../tests/design-tokens.test.ts) | Parse CSS, kiểm tương phản |
| [`scripts/screenshots.mjs`](../../scripts/screenshots.mjs) | Kiểm tra responsive |

## Test

`tests/design-tokens.test.ts` đọc `globals.css`, lần theo các chuỗi `var()`, và
kiểm tra: bộ alias ngữ nghĩa có đủ, chín cặp chữ-nền đạt WCAG AA 4,5:1, bốn cặp
viền-control đạt 3:1, và cả hai bộ chữ được nạp với subset `vietnamese`. Nó đã
bắt được hai lỗi thật — vì thế mới có `clay-600` và `--color-border-strong`.

`npm run verify:ui` chụp 13 route ở 375 / 768 / 1440 và **fail khi tràn ngang**,
đúng cái lỗi mà xem ảnh bằng mắt dễ bỏ sót.

## Giới hạn và câu hỏi còn mở

Chỉ có light mode: `color-scheme: light` được đặt tường minh và chưa có bảng màu
tối. Thêm dark mode nghĩa là một bộ alias ngữ nghĩa thứ hai và một lượt kiểm
tương phản thứ hai — việc thật, không phải một media query.

Test tương phản chỉ phủ những cặp được liệt kê. Một token mới dùng trong một cặp
mà không ai thêm vào `bodyPairs` hay `uiPairs` là chưa được kiểm — mở rộng hai
mảng đó là phần của việc thêm màu, không phải phần tuỳ chọn.

`verify:ui` hard-code đường dẫn Chrome trên macOS, nên viết như hiện tại thì nó
không chạy được trong CI.
