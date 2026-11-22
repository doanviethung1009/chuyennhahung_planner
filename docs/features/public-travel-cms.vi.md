# Tính năng — Trang Travel công khai đọc từ kho nội dung

🇬🇧 English version: [public-travel-cms.md](public-travel-cms.md)

## Mục đích

Trang chủ, danh sách chuyến đi, từng chuyến đi, trang điểm đến và sitemap giờ đọc chuyến đi từ kho nội dung mà biên tập viên sửa trong CMS quản trị, thay vì file seed `src/content/stories.ts`. Bản đã xuất bản hiện ở lần tải trang kế tiếp; chuyến đi nháp, lưu trữ hoặc không tồn tại trả về 404. Thiết kế: [ADR 0012](../adr/0012-public-travel-from-content-repository.vi.md).

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/` | `/` | `/en` |
| `/stories` | `/chuyen-di-choi` | `/en/stories` |
| `/stories/[slug]` | `/chuyen-di-choi/[slug]` | `/en/stories/[slug]` |
| `/destinations/[slug]` | `/kham-pha/[slug]` | `/en/destinations/[slug]` |
| sitemap | `/sitemap.xml` | cùng file |

Không thêm hay đổi route nào. Các redirect `/tour*` vĩnh viễn giữ nguyên.

## Dữ liệu

`getPublicContent()` trong `src/server/content/public.ts` trả `PublicStory` (chỉ bản đã xuất bản): `blocks` (paragraph, heading, image, quote, list, place, cost), `places`, `reviews` đã xuất bản, `seo` (title, description, ogImage, noindex), `updatedAt`, `publishedAtIso`, `plannerTemplateSlug`. Namespace `storyPage` chứa chuỗi mới. Điểm đến, lịch trình và video review vẫn lấy từ `src/content/**`.

## Cách hoạt động

Mọi trang bị ảnh hưởng và sitemap khai báo `dynamic = 'force-dynamic'`; không còn `generateStaticParams` hay `revalidate`, nên `next build` không đọc nội dung. Trang chuyến đi dùng một lần `getStory` mỗi request (React `cache`) cho cả `generateMetadata` và trang. Story null cho metadata `{}` và `notFound()`. `StoryBlocks` hiển thị bảy loại block: trang giữ `h1` duy nhất, block tiêu đề là `h2`/`h3`, ảnh dùng alt của block, các block chi phí liên tiếp thành một danh sách định dạng bằng `formatVnd`. Địa điểm không nhúng thành block có mục "địa điểm" riêng; đánh giá đã xuất bản có mục "đánh giá". Chuyến đi `noindex` có robots `noindex` và rời sitemap. JSON-LD `Article` có `dateModified` và ảnh SEO. Mục lịch trình và nút kêu gọi chỉ hiện khi có `plannerTemplateSlug`; các ngày được nạp từ repository instance, lỗi ở đó thì ẩn mục. Ảnh đi qua `CoverImage`; `canOptimizeImage` (`src/lib/image-src.ts`) cho mọi host https mà `next.config.ts` không liệt kê chạy ở chế độ `unoptimized`, nên ảnh CMS từ host khác không làm sập trang. Lỗi kho là 500, không fallback về seed. `PUBLIC_CONTENT_SOURCE=static` (backend) là đường rollback.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `src/app/[locale]/page.tsx`, `stories/page.tsx`, `stories/[slug]/page.tsx`, `destinations/[slug]/page.tsx` | Đọc chuyến đi qua `getPublicContent()` |
| `src/app/sitemap.ts` | Sitemap bất đồng bộ từ `listSitemapEntries()` |
| `src/components/story/story-blocks.tsx` | Trình hiển thị block và thẻ địa điểm |
| `src/components/cards/story-card.tsx`, `sections/{hero,latest-stories}.tsx` | Nhận dữ liệu dạng `PublicStory` |
| `src/components/ui/cover-image.tsx`, `src/lib/image-src.ts` | Kiểm tra host ảnh được phép |
| `src/components/admin/content-notice.tsx`, `admin/content/story-editor.tsx` | Lời nhắn mới; điểm đến được để trống |
| `messages/vi.json`, `messages/en.json` | `storyPage`, lời nhắn và gợi ý điểm đến |

## Test

`tests/public-travel-pages.test.ts`: force-dynamic và không có static params ở năm module; không import `@/content/stories` trong `app` hay `components`; sitemap chỉ liệt kê chuyến đi đã xuất bản, không noindex, có `lastModified`; slug nháp cho metadata `{}` và 404; JSON-LD `dateModified`, robots noindex, đúng một `h1`; mọi loại block đều hiển thị; ảnh https ngoài Unsplash hiển thị không lỗi. `tests/client-boundary.test.ts` thêm một ca: không trang nào import `server/content/repository` hay `store`. Không kiểm thử: bố cục theo điểm ảnh.

## Giới hạn và câu hỏi còn mở

- Mỗi lượt xem đều đọc kho; chỉ chạy một instance cho đến khi có kho PostgreSQL cho nội dung.
- `gallery` chưa được hiển thị (ảnh gallery không có alt). `actualCost` chưa được hiển thị và không còn đi vào `PublicStory` hay `GET /api/travel/stories*` (STORY-API-PROJ); thêm lại, có chiếu trường, khi chốt bố cục tổng chi phí.
- Ảnh từ host khác `images.unsplash.com` được phục vụ ở chế độ unoptimized; danh sách host trong `src/lib/image-src.ts` phải khớp với `next.config.ts`.
- Các chuyến đi seed mang ngày đi xấp xỉ (chủ sở hữu cần sửa).
- Trang chuyến đi vẫn nạp các ngày của template qua `@/server/content/instance`, vì `PublicStory` chỉ mang slug của template.
