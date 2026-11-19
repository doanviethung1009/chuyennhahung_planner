# Tính năng — Địa điểm công khai

🇬🇧 English: [places.md](places.md)

## Summary

Người xem duyệt được các địa điểm của một điểm đến và mở trang riêng cho từng địa điểm: loại, vị trí, mô tả, ảnh, thời lượng gợi ý, chi phí ước tính, điểm và ghi chú của Hưng, cùng các review đã duyệt của người đi (chỉ đọc). Thành viên đã đăng nhập thêm được địa điểm vào một chuyến đi của mình (PLACES-UI-S3). Tiếng Việt là mặc định; tiếng Anh là bản dịch.

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/places` | `/dia-diem` | `/en/places` |
| `/places/[slug]` | `/dia-diem/[slug]` | `/en/places/[slug]` |

`/places` (`/dia-diem`, `/en/places`) là trang danh sách có tìm kiếm (PLACES-UI-S6); mục "Địa điểm" vẫn nằm trên `/destinations/[slug]`. Xem [ADR 0026](../adr/0026-public-places-routes.vi.md).

## Data

Đọc collection `Place` của content repository (`placeInputSchema`) và review đã duyệt (`getApprovedReviews`). Namespace thông điệp `places` (VI và EN). Địa điểm không có trạng thái publish nên mọi địa điểm trong catalogue đều công khai. Hiển thị: tên, vị trí, loại, ảnh, mô tả, `suggestedMinutes`, `estimatedCostVnd`, `rating`, `personalNote`. Không bao giờ hiển thị: `affiliateLinks`, mốc thời gian. Địa điểm và điểm seed là nội dung chủ dự án cần xác nhận trước khi ra mắt.

## How it works

`getPublicPlaces(destinationSlug?)` và `getPublicPlace(slug)` trong `src/server/content/public-places.ts` chiếu địa điểm về danh sách trường cho phép. Danh sách trả `[]` khi store lỗi nên trang điểm đến ẩn mục. Trang chi tiết trả 404 với slug lạ và để lỗi store nổi lên thành lỗi. Review lấy từ `getApprovedReviews([slug])` và hiển thị bằng `ReviewList`; chưa có review thì hiện một dòng thông báo. Chi phí dưới một triệu đồng viết đủ trong tiếng Việt (`50.000 đ`). Ảnh có alt ghép từ tên địa điểm và số thứ tự ảnh. **Thêm vào chuyến (PLACES-UI-S3):** `PlaceAddToTrip` đọc phiên qua `GET /api/planner/session`. Khách thấy liên kết đăng nhập quay lại đúng trang (`returnTo`). Thành viên mở một khung liệt kê các chuyến đang hoạt động tới điểm đến của địa điểm (`GET /api/planner?destinationSlug=`, tối đa 50, không phân trang), chọn chuyến và ngày, rồi trang gọi `POST /api/planner/[id]/activities` với thời lượng và chi phí gợi ý của địa điểm (phạm vi `group`, không giờ bắt đầu, thêm vào cuối ngày). Khi chọn chuyến, trang đọc thêm `GET /api/planner/[id]` để cảnh báo nếu địa điểm đã có trong chuyến (vẫn thêm lại được) và vô hiệu hóa ngày đã đủ 40 hoạt động. 401 chuyển tới đăng nhập, 404 tải lại danh sách, 409 (chuyến vừa lưu trữ hoặc ngày đầy) và 429 hiện thông báo. Không đổi API hay dữ liệu. Trang là `force-dynamic` và sitemap liệt kê mọi địa điểm kèm `hreflang` (và báo lỗi, không lẳng lặng bỏ địa điểm, khi store sập).

**Trang danh sách (PLACES-UI-S6):** `/places` render phía server từ `searchParams`: `q` (tên hoặc vị trí, tiếng nào cũng được, có hoặc không dấu — "da lat" và "Đà Lạt" ra cùng kết quả), `destination`, `category` và `page` (24 mục/trang). Tìm kiếm là `<form>` GET thuần (chạy cả khi tắt JavaScript); điểm đến hoặc danh mục lạ bị bỏ, `q` được cắt khoảng trắng và giới hạn 80 ký tự, `page` sai thành 1, trang vượt quá cuối hiện trang cuối. `searchPublicPlaces` trong `src/server/content/public-places.ts` lọc và phân trang trên catalogue đã cache (xem **Tải và cache** bên dưới; quy tắc khớp giống `listPlaces` với `q`, API: xem [travel-content-api.vi.md](../travel-content-api.vi.md)), và reject khi store lỗi (trang báo lỗi thay vì hiện "không có kết quả"). Liên kết phân trang là `<a>` thật và giữ `q` cùng bộ lọc. Thẻ dùng lại `PlaceCard`; tiêu đề là `h1` → `h2` ẩn "Kết quả" → `h3` mỗi thẻ. Có số kết quả, trạng thái rỗng và "Xóa bộ lọc". SEO: trang đầu không lọc được index; trang có `q`, bộ lọc hoặc `page > 1` là `noindex, follow` với canonical về `/places`; `/places` có trong sitemap ở cả hai ngôn ngữ. `q` không bao giờ bị log và chỉ được in qua React (đã escape). Có liên kết từ trang danh sách điểm đến (liên kết "Xem tất cả địa điểm") và cột "Khám phá" ở footer. Kích thước catalogue hiện tại: 6 địa điểm seed; quét chuỗi con đủ dùng đến vài nghìn mục, quá đó nên chuyển tìm kiếm xuống store.

**Tải và cache (places-list-load):** đường đọc công khai không còn lặp `listPlaces` từng 100 mục ở mỗi request. `src/server/content/public-places.ts` đọc cả catalogue bằng một lần gọi `listPlaces`, chiếu về `PublicPlace`, rồi giữ danh sách đó trong bộ nhớ `CATALOGUE_TTL_MS` = 10 giây (`src/server/public-catalogue-cache.ts`, dùng chung qua `globalThis`). `q`, `destination`, `category` và `page` áp lên danh sách này, nên bao nhiêu lượt tìm khác nhau cũng chỉ tốn một lần đọc store mỗi cửa sổ. Các request đồng thời dùng chung một lần đọc; lần đọc lỗi không bao giờ được cache, nên store sập vẫn reject (trang báo lỗi, sitemap thất bại). Độ mới: sau mọi request đổi trạng thái trong tiến trình này, `invalidateOverviewCacheAfter` xoá cache, nên admin sửa hoặc xoá thì thấy ngay; instance khác thấy trong vòng 10 giây. Trang vẫn `force-dynamic` (phụ thuộc `searchParams`) và không thêm rate limit: bộ giới hạn của repo chạy theo từng tiến trình và khoá bằng header giả được, còn việc đọc giờ không còn tăng theo lượng request. Không đổi `GET /api/travel/places`, hình dạng JSON, quy tắc `noindex` hay allow-list. Không cần ADR (ADR 0026 không quy định đường đọc).

## Files

| Đường dẫn | Vai trò |
|---|---|
| `src/app/[locale]/places/[slug]/page.tsx` | Trang chi tiết địa điểm, metadata, JSON-LD |
| `src/app/[locale]/destinations/[slug]/page.tsx` | Mục "Địa điểm" |
| `src/server/content/public-places.ts` | Đọc địa điểm theo danh sách trường cho phép và `searchPublicPlaces` |
| `src/server/public-catalogue-cache.ts` | Cache catalogue trong bộ nhớ 10 giây và cách xoá cache |
| `src/app/[locale]/places/page.tsx` | Trang danh sách, quy tắc `noindex` (PLACES-UI-S6) |
| `src/components/places/places-list-params.ts`, `places-filter-form.tsx`, `places-pagination.tsx` | Đọc query, form GET, liên kết phân trang |
| `src/lib/fold.ts` | Làm phẳng chữ dùng chung (cả `slugify`) |
| `src/components/places/place-review-section.tsx` | Khối form review trên trang (PLACES-UI-S2) |
| `src/components/places/place-add-to-trip.tsx`, `add-to-trip-logic.ts` | Khung thêm vào chuyến và các hàm thuần của nó (PLACES-UI-S3) |
| `src/components/cards/place-card.tsx` | Thẻ địa điểm |
| `src/lib/place-format.ts` | Cách viết thời lượng và chi phí |
| `src/i18n/routing.ts`, `src/app/sitemap.ts` | Route và sitemap |
| `messages/vi.json`, `messages/en.json` | Namespace `places`, `placesList`, `nav.places` |

## Tests

`tests/places-search.test.ts` (làm phẳng chữ gồm `đ`, `listPlaces` với `q` trước phân trang, giới hạn `q` và 422, route `GET /api/travel/places?q=`) và `tests/places-list-page.test.ts` (bản đồ route, mục sitemap, quy tắc noindex, query liên kết, khớp khóa). `tests/places-page.test.ts`: chiếu theo danh sách cho phép và lọc theo điểm đến, slug lạ, store lỗi cho danh sách rỗng, markup thẻ, cặp route, mục sitemap, khớp khóa VI/EN, một `h1` và `notFound()` trên trang. `tests/routing.test.ts`, `tests/i18n.test.ts`, `tests/docs.test.ts` và `tests/client-boundary.test.ts` phủ các quy tắc chung. `tests/place-add-to-trip.test.ts`: lọc chuyến theo điểm đến và trạng thái, ngày đầy và ngày trùng, body request và kẹp thời lượng, lần render đầu trung tính không có nút, khớp khóa VI/EN của `places.addToTrip`. Không có test tự động: luồng mạng của khung và render trọn trang chi tiết (kiểm tay ở 375, 768 và 1280 px).

## Limits and open questions

Nội dung khách thấy có thể cũ tới 10 giây khi sửa xảy ra ở instance khác (instance đã sửa thì mới ngay); cache giữ một catalogue đã chiếu cho mỗi tiến trình. Tìm kiếm chỉ là chuỗi con (không xếp hạng, không chịu lỗi chính tả, không gợi ý tự động, không sắp xếp); chưa lọc theo điểm; chưa có bản đồ, tạo chuyến ngay trên trang (chỉ có liên kết tới `/my-trips/new`), sửa giờ bắt đầu hay chi phí lúc thêm (sửa trong trình soạn chuyến), chuyến đã lưu trữ. Trang hiện 20 review mới nhất, không phân trang; muốn phân trang phải thêm `limit`/`cursor` vào `GET /api/community/reviews` (quyết định PLACES-UI-S2). Chỉ đề xuất 50 chuyến đang hoạt động gần nhất của điểm đến. Alt còn chung chung cho đến khi schema có alt theo từng ảnh. Chưa hiển thị tọa độ địa điểm. Địa điểm nhập tạm làm placeholder sẽ hiển thị công khai như nó đang có.

**API công khai (PLACES-API-PROJ).** `GET /api/travel/places` và `/[slug]` trả cùng allow-list với các trang (`toPublicPlace`); không có `affiliateLinks`, timestamp hay `coords`. Test: `tests/places-api-public-projection.test.ts`.
