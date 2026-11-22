# ADR 0012 — Trang Travel công khai đọc từ content repository, không đọc từ seed có kiểu

🇬🇧 English version: [0012-public-travel-from-content-repository.md](0012-public-travel-from-content-repository.md)

- **Trạng thái:** Đã chấp nhận (2026-11-12)
- **Ngày:** 2026-11-12
- **Người sở hữu:** system-architect
- **Người quyết định:** chủ dự án (chấp nhận 2026-11-12, đúng như đề xuất), system-architect (hình dạng)
- **Ảnh hưởng:** `src/server/content/public.ts` (mới), `src/server/content/{schemas,repository}.ts`, `src/content/travel/**`, `src/server/planner/catalog.ts`, `src/app/[locale]/{page,stories,destinations}/**`, `src/app/sitemap.ts`, `src/components/{cards,sections}/**`, một script seed mới, `Dockerfile`, `docs/usage.*`, `docs/architecture.*`

## Bối cảnh

[ADR 0011](0011-admin-content-cms.vi.md) cho phép editor sửa story, địa điểm và review ngay trên trình duyệt, nhưng phần ghi chú triển khai của nó đã ghi nhận **bản sửa không bao giờ lên trang công khai**. Đã kiểm chứng trong code:

- `/stories`, `/stories/[slug]`, `/destinations/**`, trang chủ, sitemap và `components/sections/hero.tsx` import seed có kiểu trong `src/content/**` (`stories.ts`, `destinations.ts`, `types.ts`). Chỗ duy nhất một trang công khai đọc repository là `getPublicTemplate` trong `stories/[slug]` và `trip-setup/[template]`.
- Hai bộ dữ liệu là **hai tập khác nhau, không phải hai bản sao**. `src/content/stories.ts` có 6 story; content store chỉ seed đúng một (`ba-ngay-lang-man-o-da-lat`, `src/content/travel/seed.ts`). Đổi trang sang repository mà không nhập chúng thì cả sáu story biến mất.
- Destination (9) và itinerary **không** phải entity của content repository. Repository chỉ kiểm slug theo chúng (`knownDestinationSlugs`, `knownItinerarySlugs` trong `repository.ts`).
- `/reviews` render `VideoReview` (`src/content/video-reviews.ts`): metadata video không có link. `TravelReview` của CMS là bài review viết tay có điểm sao và chưa có trang công khai nào.
- Place **không** có `status` (`placeSchema`); `/api/travel/places` đã liệt kê mọi place.
- `generateStaticParams` và `next build`: build Docker không có database, và hiện `next build` tự seed một `.data/` tạm khi prerender `stories/[slug]` (xem chú thích trong `Dockerfile`). Content store **vẫn là một file JSON** (`instance.ts` gọi `createJsonFileStore`); `CONTENT_DATABASE_URL` của [ADR 0008](0008-postgres-document-store.vi.md) chưa được xây và [ADR 0009](0009-postgres-persistence.vi.md) để content store ngoài phạm vi. JSON store cache document trong tiến trình và giả định chỉ một writer.

Chưa biết: hiện chạy bao nhiêu instance app (chưa kiểm `deploy/compose.app.yml` về số replica); lưu lượng thực; khi nào content store chuyển sang PostgreSQL.

## Quyết định

1. **Một module đọc chỉ-server, `src/server/content/public.ts`,** là nơi duy nhất trang công khai lấy nội dung Travel. Nó xuất `getPublicContent(): Promise<PublicContent>`:

   ```ts
   interface PublicContent {
     listStories(): Promise<PublicStory[]>;                    // chỉ published, mới nhất trước
     getStory(slug: string): Promise<PublicStory | null>;      // null với draft, archived, không tồn tại
     listStoriesForDestination(destinationSlug: string): Promise<PublicStory[]>;
     listSitemapEntries(): Promise<{ slug: string; updatedAt: string }[]>; // published, không noindex
   }
   ```

   Trang không bao giờ import `repository.ts` hay `store.ts` và không gọi route admin. Sau interface có một cặp adapter: `repository` (mặc định) và `static` (đọc `src/content/stories.ts`, vừa là đường rollback vừa là test double). Sắp xếp theo `publishedAt` giảm dần, rồi slug; `listStories` của repository sắp theo ngày chuyến đi nên không dùng để sắp thứ tự.

2. **Ánh xạ (kiểu view là `PublicStory`; `Story` trong `src/content/types.ts` không đổi).** Trường cùng tên đi thẳng qua (`slug`, `title`, `excerpt`, `cover`, `readingMinutes`; mọi trường localized đã là `{ vi, en }` và `localizedTextSchema` bắt buộc cả hai, nên story không thể chỉ dịch một nửa).

   | `Story` trong `src/content/types.ts` | Entity `TravelStory` | View công khai |
   |---|---|---|
   | `body: Localized<string[]>` | `content: StoryBlock[]` (paragraph, heading, image, quote, list, place, cost) | `blocks: StoryBlock[]` — trang render theo block; `body` bị bỏ |
   | `publishedAt: 'YYYY-MM-DD'` | `publishedAt: timestamp \| null` | `publishedAt` = phần ngày UTC (đúng thứ `formatDate` cần) cộng `publishedAtIso` cho JSON-LD |
   | `destinationSlugs: string[]` | `destinationSlug` (một, bắt buộc) | `destinationSlugs = [destinationSlug]` hoặc `[]` |
   | `featured: boolean` | không có | bỏ: không nơi nào đọc (trang chủ dùng mới-nhất-trước) |
   | `plannerTemplateSlug?` | không có (template trỏ ngược bằng `sourceStorySlug`) | `plannerTemplateSlug: string \| null`, lấy từ một trường story mới (bên dưới) |
   | không có | `travelDates`, `gallery`, `actualCost`, `placeSlugs`, `reviewIds`, `itinerarySlugs`, `seo`, `updatedAt` | `places: Place[]`, `reviews: TravelReview[]` (chỉ published), `gallery`, `travelDates`, `updatedAt`, `seo` đã resolve |

   Cần hai thay đổi schema thuần cộng thêm để sáu story tĩnh sống sót khi chuyển: `storyInputSchema.plannerTemplateSlug: slugSchema.nullable().default(null)` (story Đà Lạt tĩnh liên kết một template cắt từ một story *khác*, nên không suy ra được), và `storyInputSchema.destinationSlug` cùng `sourceSnapshotSchema.destinationSlug` thành **nullable** (hai story tĩnh không có destination). Cả hai chỉ mở rộng thứ được chấp nhận, nên mọi document đã lưu vẫn hợp lệ.

   `seo`: `title ?? title`, `description` thay excerpt trong meta, `ogImage ?? cover`, `noindex` được tôn trọng (robots meta, và story rời sitemap). `canonicalPath` và `keywords` **bị bỏ qua** trong ADR này: URL là vĩnh viễn và mọi trang tự canonical kèm `hreflang` (câu hỏi mở 6).

3. **Hiển thị.** Chỉ `status === 'published'` là công khai. Slug không tồn tại, draft hoặc archived trả `null` và trang gọi `notFound()` (404, không bao giờ 403), giống `getPublishedStory` đang làm cho API. Place không có status, nên **không có trang riêng**: một place chỉ được render qua story đã published có tham chiếu nó (`placeSlugs` hoặc block `place`). Place chỉ dùng bởi story chưa published thì không xuất hiện ở đâu trên site; slug không còn resolve được thì bị bỏ qua và ghi log, không render thành link chết. Review theo cùng quy tắc: chỉ hiện bên trong story đã published có liên kết (repository đã từ chối publish story có review chưa published, và từ chối gỡ review mà story published đang liên kết, nên bộ lọc chỉ là lớp phòng thủ thứ hai). `plannerTemplateSlug` giữ hành vi hiện tại: template thiếu hoặc không còn công khai thì mất phần hành trình và nút kêu gọi.

4. **Render và cache: hoàn toàn động, không revalidate theo yêu cầu.** Mọi trang đọc nội dung Travel (`/`, `/stories`, `/stories/[slug]`, `/destinations/[slug]`, sitemap) khai báo `export const dynamic = 'force-dynamic'`; `revalidate = 60` trong `stories/[slug]` bị bỏ. Việc đọc đi qua repository, mà JSON store phục vụ document từ cache trong tiến trình (`json-store.ts`), cache này được cập nhật ngay khi một lần ghi cùng tiến trình xảy ra, nên bản sửa đã publish thấy được ở request kế tiếp, không có cửa sổ trễ và không có hook invalidate nào để quên. Phần tĩnh và rẻ giữ nguyên: `/about`, `/itineraries/**`, `/reviews` (video), `/map` và mọi thứ không liệt kê. Next.js là `^16.4.5`; `next.config.ts` không bật `cacheComponents`, nên `force-dynamic` hoạt động như ở các route API hiện có.

5. **Build khi không có store.** Vì trang là động, `next build` **không** đọc nội dung nào: `generateStaticParams` bị bỏ khỏi `stories/[slug]` và `destinations/[slug]`, sitemap dựng theo request. Bước seed `.data/` tạm khi build biến mất, nên bước xoá nó trong `Dockerfile` có thể đơn giản hoá. Store lỗi lúc request là HTTP 500 và không bao giờ phát sitemap rỗng thay cho sitemap lỗi: **không có fallback im lặng** về seed tĩnh (cùng nguyên tắc [ADR 0009](0009-postgres-persistence.vi.md), "không fallback về JSON").

6. **Công cụ tìm kiếm.** `generateMetadata` của mọi trang bị ảnh hưởng đọc cùng kết quả `getStory` (một lần gọi mỗi request nhờ React `cache`), giữ `buildPageMetadata` với `hreflang` + `x-default`, và trả `{}` cùng 404 khi story null. JSON-LD `Article` của story có thêm `dateModified` từ `updatedAt` và lấy `image` từ `seo.ogImage ?? cover`. `src/app/sitemap.ts` thành async, lấy story từ `listSitemapEntries()` với `lastModified = updatedAt`; destination, itinerary và trang tĩnh giữ nguyên.

7. **Seed.** Content store nhận sáu story tĩnh qua `src/content/travel/static-stories.ts`, một hàm thuần `staticStoryToInput(story)` tạo `StoryCreateInput`: đoạn văn thành block `paragraph` (script báo lỗi nếu độ dài `vi` và `en` lệch nhau), `seo.description = excerpt`, `travelDates = { start: date, end: date }` (là **xấp xỉ, không phải ngày đi thật** — gắn cờ theo quy tắc 8 của CLAUDE.md), publish với `publishedAt = <date>T00:00:00.000Z`. Hai lối vào: store **mới** nhận chúng từ `seedTravelContent`; store **đã có** (đã chứa story Đà Lạt, nên guard "seed nếu chưa có place" hiện tại sẽ bỏ qua) nhận chúng từ `npm run content:seed-static [--dry-run]` chạy tường minh. Script chỉ tạo slug chưa tồn tại và không bao giờ gọi update, nên không thể ghi đè bản sửa CMS. Cố ý không chạy khi khởi động: restart không được hoàn tác việc xoá của editor. Chạy tay sau khi xoá thì sẽ tạo lại story đó (chấp nhận, có ghi tài liệu).

8. **`src/content/**` sau khi chuyển:** `stories.ts` được giữ làm nguồn seed, adapter `static` và fixture test, không còn là nguồn sống (có chú thích trong code; sửa ở đó không còn đổi production). `destinations.ts`, `itineraries.ts`, `site.ts`, `video-reviews.ts` vẫn là nguồn sống: chúng không phải entity CMS. `types.ts` giữ nguyên.

9. **Ngoài phạm vi, không đụng.** Các redirect tour vĩnh viễn trong `next.config.ts` và route `/tour*` (quy tắc 2 của CLAUDE.md); `/itineraries/**`; destination và bản đồ; `/reviews` (video). `src/server/planner/catalog.ts` lấy `siteStories` (`slug`, `title`, `plannerTemplateSlug`) từ module đọc thay vì `src/content/stories`, để liên kết template-với-story vẫn chạy.

10. **Rollback.** `PUBLIC_CONTENT_SOURCE=static` chọn adapter `static` **lúc request** (trang là động), nên quay lại chỉ là đổi biến môi trường và restart, không phải build lại. Mặc định là `repository` khi được duyệt. Các dòng đã seed nằm lại trong store vô hại. Khi đang ở `static`, bản sửa CMS lại vô hình (trạng thái của ADR 0011). Gỡ adapter và cờ là thay đổi sau.

```mermaid
flowchart LR
  E[Editor, /quan-tri] -->|PATCH, status| A[/api/admin/travel/**]
  A --> R[(Content repository)]
  P[Trang công khai, sitemap] -->|force-dynamic| M[getPublicContent]
  M -->|PUBLIC_CONTENT_SOURCE=repository| R
  M -.->|=static, rollback| S[src/content/stories.ts]
```

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn): trang động trên `public.ts`, không revalidate | Sửa là thấy ngay; đúng với mọi writer (UI admin, `curl`, route tương lai); không cần DB lúc build; một cờ là rollback | Mỗi lượt xem đều đọc store; không có cache trang kiểu CDN; HTML là `no-store` nên nginx không micro-cache được nếu không ghi đè |
| B: `revalidatePath`/`revalidateTag` theo yêu cầu từ các route status, PATCH, create, delete | Trang nhanh nhất | Cache tự host theo từng instance nên instance thứ hai vẫn cũ; mọi writer (kể cả `curl` token và route chưa viết) phải gọi nó, quên một chỗ là trang cũ im lặng; trang danh sách vẫn không prerender được khi không có DB. Chữ ký `revalidateTag` của Next 16 cũng cần kiểm lại |
| C: ISR theo thời gian (`revalidate = 60`, giả định của ADR 0011) | Một dòng; có cache | Sửa trễ tới hết cửa sổ, lâu hơn khi nhiều instance; trang danh sách vẫn cần store lúc build; editor vẫn không tin được "đã lưu là đã lên" |
| D: đổi entity content cho bằng `src/content/types.ts` | Không cần ánh xạ view | Phá mô hình block có kiểu, ngày chuyến đi và SEO mà ADR 0001 và 0011 đã xây; lùi cho CMS |
| E: giữ seed có kiểu, chép bản sửa ngược vào code | Không phải xây gì | Không phải CMS |

Phương án á quân B thua vì một lý do: nó chỉ đúng khi mọi writer đều nhớ invalidate và chỉ có một instance. A cũng có thể chuyển thành B sau này, vì module đọc là điểm nối và không hợp đồng trang nào đổi.

## Hệ quả

Dễ hơn: bản sửa của editor lên công khai ngay; sitemap, metadata và JSON-LD cùng một nguồn; trang chuyển từ file có kiểu sang một hàm mà các card đã nhận props kiểu `Story` không phải đổi; rollback chỉ là một biến.

Khó hơn:

- **Chi phí mỗi request.** Mỗi lượt xem story và trang chủ đều đọc store. Với cache JSON trong tiến trình thì rẻ, nhưng chưa đo; phải đo trước khi khẳng định. Trang chủ, trước đây tĩnh, nay là động.
- **Đa instance giờ lộ ra.** JSON content store có một writer mỗi tiến trình; chạy nhiều hơn một instance app thì sửa ở A không thấy ở B. API vốn đã vậy, nhưng trang công khai nay phụ thuộc vào nó. Cách chữa là content store PostgreSQL (bước 1 của ADR 0008, chưa xây) và nó trở thành điều kiện tiên quyết để chạy hai instance. Đến lúc đó app phải giữ một instance cho nội dung.
- **Mở rộng schema.** `destinationSlug` thành nullable và story có `plannerTemplateSlug`; form story admin, bộ lọc `listStories`, snapshot template và kiểm tra integrity phải xử lý null.
- **Bộ render story.** Trang chi tiết phải render bảy loại block (hiện chỉ render đoạn văn), gồm block `place` và `cost`, với heading dễ truy cập (block chỉ dùng `h2`/`h3`).
- **Dữ liệu seed xấp xỉ.** Sáu story có ngày chuyến đi bằng ngày publish cho tới khi chủ dự án sửa.
- **Hai story cùng chủ đề.** `di-da-lat-lan-thu-sau` tĩnh và `ba-ngay-lang-man-o-da-lat` của CMS cùng tồn tại sau khi chuyển.
- **Lệch pha.** Sau cutover `src/content/stories.ts` là cái bẫy: sửa ở đó không đổi gì ở production.
- **Không có audit ai publish** (như ADR 0011).

## Việc tiếp theo

- Task Contract: `.claude/contracts/public-travel-from-content-repo.md`. Trạng thái DESIGNED; ADR này đã được chấp nhận; còn chờ PR #41 merge. Tài liệu tính năng `docs/features/public-travel-cms.md` + `.vi.md` (frontend-engineer).
- Khi chấp nhận: đổi trạng thái, rồi cập nhật `docs/architecture.md` + `.vi.md` (bảng route/caching, dòng backlog Phase 07 "trang công khai đọc seed có kiểu"), `docs/usage.*` (`PUBLIC_CONTENT_SOURCE`, `content:seed-static`, số trang khi build, build Docker) và `.claude/context/project-context.md`. Quyết định 8 của ADR 0011 bị quyết định 4 ở đây thay thế.
- Câu hỏi mở cho chủ dự án:
  1. Mặc định `PUBLIC_CONTENT_SOURCE` khi cutover: `repository` ngay, hay `static` cho tới khi script seed đã chạy trên VM?
  2. Chấp nhận `travelDates = ngày publish` cho sáu story được seed, hay cung cấp ngày thật?
  3. Mở rộng `destinationSlug` thành nullable (ADR này), hay gán destination cho hai story chưa có?
  4. Place không có `status` và `/api/travel/places` liệt kê tất cả: thêm status ngay, hay chấp nhận?
  5. `/reviews` có nên liệt kê cả review viết tay đã published (UI mới), hay chỉ hiện bên trong story?
  6. Tôn trọng `seo.canonicalPath` và `keywords`, hay tiếp tục bỏ qua?
  7. Editor xem trước bản nháp: có cần không, và qua route nào?
  8. Hiện app có phải một instance không, và khi nào cần content store PostgreSQL?
  9. Có chấp nhận việc story đã xoá bị tạo lại sau khi chạy tay `content:seed-static` không?
