# Tính năng — SEO và metadata

🇬🇧 English version: [seo-and-metadata.md](seo-and-metadata.md)

## Mục đích

Mọi trang đều có URL canonical, bộ `hreflang` đầy đủ, thẻ Open Graph và Twitter,
và JSON-LD ở những chỗ có type schema.org phù hợp. Ở đây đó là chuyện cấu trúc,
không phải bước đánh bóng: một site hai ngôn ngữ với hai URL cho mỗi trang chính
là một bài toán trùng nội dung, nếu bộ alternate không đúng.

## Route

Ba route không phụ thuộc locale nằm ngoài `[locale]` và bị matcher của middleware
loại ra:

| Route | Nguồn |
|---|---|
| `/robots.txt` | [`src/app/robots.ts`](../../src/app/robots.ts) |
| `/sitemap.xml` | [`src/app/sitemap.ts`](../../src/app/sitemap.ts) |
| `/opengraph-image` | [`src/app/opengraph-image.tsx`](../../src/app/opengraph-image.tsx) |

## Dữ liệu

`siteConfig.url` trong [`src/content/site.ts`](../../src/content/site.ts), đọc
`NEXT_PUBLIC_SITE_URL` và mặc định về `https://chuyennhahung.vn`. **Giá trị này
được nướng vào lúc build** — mọi canonical, alternate và mục sitemap đều là URL
tuyệt đối, nên build với giá trị sai là xuất bản URL sai.

Tiêu đề và mô tả lấy từ hai file messages; metadata của từng mục lấy từ các bộ
nội dung (`publishedAt` thành `datePublished`, `cover` thành ảnh OG, `coords` của
điểm đến thành `GeoCoordinates`).

## Cách hoạt động

[`src/lib/metadata.ts`](../../src/lib/metadata.ts) có hai export:

- `buildAlternates(href, locale)` — URL canonical cộng một mục `languages` cho
  mỗi locale, với **`x-default` trỏ về tiếng Việt** vì tiếng Việt là tập khách
  chính.
- `buildPageMetadata({ href, locale, title, description, image, type,
  publishedTime })` — những thứ trên cộng Open Graph (`locale` quy đổi thành
  `vi_VN` / `en_GB`, ảnh 1200×630, `publishedTime` cho bài viết) và thẻ Twitter
  dạng `summary_large_image`.

Mọi trang đều export `generateMetadata` và gọi hàm này. URL được dựng bằng
`getPathname` từ `src/i18n/navigation.ts`, nên đổi một pathname bản địa hoá là tự
lan sang canonical, alternate và sitemap mà không phải sửa lần hai.

`sitemap.ts` phát một mục cho mỗi trang kèm bộ alternate đầy đủ: tám trang tĩnh
cộng mọi chuyện, điểm đến và lịch trình, với `priority` và `changeFrequency` theo
từng loại và `lastModified` lấy từ `publishedAt` của bài viết.

JSON-LD đi qua [`json-ld.tsx`](../../src/components/seo/json-ld.tsx), một
component một dòng biến object thường thành
`<script type="application/ld+json">` — `Article` cho chuyện đi chơi,
`TouristDestination` cho điểm đến, `TouristTrip` kèm `ItemList` từng ngày cho
lịch trình, và `Organization` ở trang giới thiệu.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/lib/metadata.ts`](../../src/lib/metadata.ts) | Dựng canonical + `hreflang` + OG/Twitter |
| [`src/app/sitemap.ts`](../../src/app/sitemap.ts) | Sitemap kèm alternate |
| [`src/app/robots.ts`](../../src/app/robots.ts) | robots.txt |
| [`src/app/opengraph-image.tsx`](../../src/app/opengraph-image.tsx) | Ảnh xã hội mặc định 1200×630 |
| [`src/components/seo/json-ld.tsx`](../../src/components/seo/json-ld.tsx) | Bộ phát JSON-LD |
| [`src/content/site.ts`](../../src/content/site.ts) | `siteConfig.url` |

## Test

Chưa có test riêng cho SEO, và đây là một khoảng trống đã biết. Những gì đang phủ
nó: `tests/routing.test.ts` bảo đảm mọi route tồn tại ở cả hai locale và không có
URL trùng — đúng điều kiện tiên quyết mà bộ alternate dựa vào — và `npm run build`
fail nếu `generateMetadata` của một trang ném lỗi. Bản thân metadata xuất ra thì
chưa được test: một trang mới thiếu `generateMetadata` sẽ không làm bộ test fail.

## Giới hạn và câu hỏi còn mở

Mục sitemap được thêm bằng tay trong `sitemap.ts`. Một route tĩnh mới mà không ai
thêm vào đó thì đơn giản là vắng mặt trong sitemap, và không có test nào bắt.
Đáng sửa: `sitemap.ts` có thể suy ra danh sách trang tĩnh từ `pathnames`, và một
test có thể kiểm mọi `StaticPathname` đều xuất hiện.

Đổi nội dung thì phải build lại để `lastModified` thay đổi; chưa có đường
revalidate. `NEXT_PUBLIC_SITE_URL` chỉ có tác dụng lúc build, nên đổi host nghĩa
là build lại, không phải sửa một biến môi trường — việc này nằm trong danh sách
việc của chủ nhà ở [../usage.vi.md](../usage.vi.md#trước-khi-lên-sóng--việc-của-chủ-nhà).
