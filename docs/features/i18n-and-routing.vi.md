# Tính năng — i18n và routing

🇬🇧 English version: [i18n-and-routing.md](i18n-and-routing.md)

## Mục đích

Khách Việt nhận URL tiếng Việt không có prefix; tiếng Anh là một lựa chọn chủ
động ở `/en`. Đây là tính năng mà mọi tính năng khác đứng lên: một route không có
trong bản đồ pathname thì không tồn tại ở cả hai ngôn ngữ.

## Route

Toàn bộ route của app, ở cả hai locale. Xem bảng đầy đủ trong
[../architecture.vi.md](../architecture.vi.md#routing-và-bản-địa-hoá). Các route
không phụ thuộc locale (`robots.txt`, `sitemap.xml`, `/opengraph-image`) nằm
ngoài `[locale]` và bị matcher của middleware loại ra.

## Dữ liệu

`messages/vi.json` và `messages/en.json` chứa mọi chuỗi hiển thị, chia theo
namespace (`nav`, `common`, `home`, `plan`, `reviews`, …). Hai file này giống
nhau từng key, kể cả placeholder ICU, và điều đó được test bảo đảm.

`src/i18n/routing.ts` chứa `locales`, `defaultLocale` và `pathnames` — nguồn
chân lý duy nhất cho việc mỗi locale hiển thị URL nào.

## Cách hoạt động

`src/middleware.ts` chạy middleware của `next-intl` trên `routing`, đổi đường dẫn
bản địa hoá đi vào thành pathname nội bộ khớp với thư mục `app/[locale]`.
`localePrefix` là `as-needed`, nên VI không có prefix.

`localeDetection` **tắt có chủ đích**: Accept-Language sẽ đẩy một khách Việt dùng
điện thoại cài tiếng Anh sang trang tiếng Anh — một mặc định sai cho tập khách
gần như toàn bộ là người Việt. `/` luôn là tiếng Việt; tiếng Anh đến từ bộ đổi
ngôn ngữ hoặc một link `/en`.

Component import `Link`, `redirect`, `usePathname` và `getPathname` từ
`src/i18n/navigation.ts`, không bao giờ từ `next/link` — import thẳng `next/link`
sẽ bỏ qua bản đồ pathname bản địa hoá và in ra URL nội bộ.

Hai type bắt buộc link đúng: `AppPathname` (mọi route nội bộ) và
`StaticPathname`, loại bỏ các route `[slug]` để một route động không bao giờ bị
đưa vào menu như một mục phẳng.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/i18n/routing.ts`](../../src/i18n/routing.ts) | Locale, mặc định, bản đồ pathname bản địa hoá, type route |
| [`src/i18n/navigation.ts`](../../src/i18n/navigation.ts) | Nguồn hợp lệ duy nhất của `Link` / `getPathname` |
| [`src/i18n/request.ts`](../../src/i18n/request.ts) | Locale và nạp messages theo từng request |
| [`src/middleware.ts`](../../src/middleware.ts) | Xác định locale; matcher loại `/api`, `/_next`, `/opengraph-image`, `*.*` |
| [`messages/vi.json`](../../messages/vi.json), [`messages/en.json`](../../messages/en.json) | Hai file chuỗi |
| [`src/components/layout/locale-switcher.tsx`](../../src/components/layout/locale-switcher.tsx) | Đổi ngôn ngữ mà vẫn ở đúng trang đang xem |

## Test

- `tests/routing.test.ts` — mọi pathname có đủ ở mọi locale, đoạn động giống nhau
  giữa các locale, không URL nào trùng trong cùng một locale, VI không prefix,
  `localeDetection` tắt, mọi mục điều hướng trỏ tới route tĩnh thật, đủ sáu mục
  điều hướng chính.
- `tests/i18n.test.ts` — key giống nhau, không giá trị rỗng, placeholder ICU
  giống nhau, và một "chim báo mỏ" fail khi một giá trị tiếng Việt bị copy nguyên
  sang tiếng Anh (có một danh sách ngoại lệ nhỏ cho tên thương hiệu).

## Giới hạn và câu hỏi còn mở

Chỉ có `vi` và `en`. Thêm locale thứ ba là ba thay đổi phải làm cùng nhau
(`routing.ts`, một file catalogue mới, mọi field `Localized<T>` trong
`src/content/**`) và phần nội dung mới là phần nặng nhất — tám điểm đến, sáu
chuyện, bốn lịch trình và sáu review video đều có văn bản riêng cho từng locale.

Sau này muốn bật locale detection thì phải có ADR; nó thay đổi ý nghĩa của `/`
với tập khách đang có.
