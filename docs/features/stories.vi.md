# Tính năng — Chuyện đi chơi

🇬🇧 English version: [stories.md](stories.md)

## Mục đích

Trái tim của site: những bài kể lại ở ngôi thứ nhất về các chuyến đi mà cả nhà
thực sự đã đi. Chính phần này làm nên một trang kể chuyện thay vì một bản catalog,
và mọi bộ dữ liệu khác đều dẫn ngược về đây.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/stories` | `/chuyen-di-choi` | `/en/stories` |
| `/stories/[slug]` | `/chuyen-di-choi/[slug]` | `/en/stories/[slug]` |

## Dữ liệu

[`src/content/stories.ts`](../../src/content/stories.ts) — 6 mục kiểu `Story`:
`slug`, `title`, `excerpt`, `body` (mảng đoạn văn, có bản địa hoá),
`publishedAt` (ngày ISO, dùng cho `datePublished` và để sắp thứ tự),
`readingMinutes`, `destinationSlugs`, `cover`, `featured`.

`destinationSlugs` phải trỏ tới điểm đến có thật — `tests/content.test.ts` fail
nếu có tham chiếu treo.

Các helper xuất kèm dữ liệu: `storiesNewestFirst`, `storyBySlug`,
`getStory(slug)`, `getStoriesForDestination(destinationSlug)`.

## Cách hoạt động

Cả hai trang là server component. Trang danh sách render `storiesNewestFirst` qua
`StoryCard`; trang chi tiết tra bằng `getStory` và gọi `notFound()` khi không
thấy, lúc đó `not-found.tsx` bản địa hoá sẽ hiện ra.

`generateStaticParams` prerender mọi slug ở mọi locale lúc build. Các đoạn văn
render qua primitive `Prose` để chữ nghĩa nhất quán mà không cần pipeline
markdown. Ngày tháng do `formatDate` trong
[`src/lib/format.ts`](../../src/lib/format.ts) định dạng với `vi-VN` / `en-GB` và
timezone UTC cố định, nên một bài không bao giờ lệch ngày tuỳ nơi render.

Mỗi bài còn phát JSON-LD `Article` và cấp dữ liệu cho khối "chuyện mới nhất" ở
trang chủ.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/app/[locale]/stories/page.tsx`](../../src/app/[locale]/stories/page.tsx) | Trang danh sách |
| [`src/app/[locale]/stories/[slug]/page.tsx`](../../src/app/[locale]/stories/[slug]/page.tsx) | Trang chi tiết, `generateStaticParams`, JSON-LD |
| [`src/components/cards/story-card.tsx`](../../src/components/cards/story-card.tsx) | Card |
| [`src/components/sections/latest-stories.tsx`](../../src/components/sections/latest-stories.tsx) | Khối ở trang chủ |
| [`src/content/stories.ts`](../../src/content/stories.ts) | Dữ liệu seed + hàm tra cứu |

## Test

`tests/content.test.ts` phủ slug (không trùng, an toàn cho URL), tham chiếu chéo
(`destinationSlugs` trỏ đúng), đủ locale cho mọi field `Localized<T>`, và mỗi
`cover` có file thật trên đĩa. Phần hiển thị được kiểm bằng mắt qua
`npm run verify:ui`, công cụ này chụp trang danh sách và
`/chuyen-di-choi/ba-ngay-o-ha-giang-khong-co-ke-hoach` ở ba độ rộng.

## Giới hạn và câu hỏi còn mở

Chưa có tag, chưa có tìm kiếm, chưa phân trang — với sáu bài thì cả ba đều không
đáng, nhưng vượt khoảng ba mươi bài thì cả ba thành việc thật. Phần thân bài chỉ
là mảng đoạn văn: không có tiêu đề con, ảnh chèn hay trích dẫn nổi bên trong một
bài. Muốn có thân bài phong phú thì phải chọn giữa pipeline markdown hoặc một
kiểu block trong `src/content/types.ts`, và đó là quyết định xứng đáng có một ADR
thay vì vá dần.

Ảnh cover vẫn là SVG sinh tự động cho tới khi chủ nhà đưa ảnh thật.
