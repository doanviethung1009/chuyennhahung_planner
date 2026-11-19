# ADR 0026 — Route Địa điểm công khai: `/dia-diem/[slug]` và `/places/[slug]`, mọi địa điểm trong catalogue đều công khai

🇬🇧 English: [0026-public-places-routes.md](0026-public-places-routes.md)

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-18
- **Chủ sở hữu:** system-architect
- **Ảnh hưởng:** `src/i18n/routing.ts` (một pathname), file mới `src/app/[locale]/places/[slug]/page.tsx`, module đọc mới `src/server/content/public-places.ts`, `src/app/[locale]/destinations/[slug]/page.tsx`, `src/app/sitemap.ts`, `messages/*.json`. Không đổi database, API hay migration. Task Contract `PLACES-UI-S1`.

## Bối cảnh

Địa điểm có trong content repository và trong `GET /api/travel/places`, người đi có thể review chúng ([ADR 0014](0014-community-trips-and-reviews.vi.md)), nhưng chưa có trang công khai nào hiển thị một địa điểm. Cấu trúc route là quy tắc cần ADR ([architecture.vi.md](../architecture.vi.md) đặt mẫu: pathname nội bộ tiếng Anh, URL theo từng locale).

Sự thật từ code: địa điểm không có trạng thái publish hay archive (`publishStatusSchema` chỉ áp cho story và collection); địa điểm có `affiliateLinks` và mốc thời gian không dùng để hiển thị; `images` là danh sách URL không có alt.

## Quyết định

1. **URL.** Nội bộ `/places/[slug]`; tiếng Việt `/dia-diem/[slug]` (không tiền tố), tiếng Anh `/en/places/[slug]`. Slug là slug trong catalogue, cố định vĩnh viễn. Bước này chưa có trang danh sách địa điểm: địa điểm được liệt kê trên trang điểm đến (`/destinations/[slug]`).
2. **Mọi địa điểm trong catalogue đều công khai.** Không có trạng thái nháp để lọc; bỏ một địa điểm khỏi catalogue thì trang của nó trả 404.
3. **Đường đọc.** Trang đọc qua `src/server/content/public-places.ts`, chiếu địa điểm về danh sách trường cho phép (không có `affiliateLinks`, không có mốc thời gian). Lỗi khi liệt kê trả danh sách rỗng nên trang điểm đến ẩn mục; trang chi tiết để lỗi store nổi lên thành lỗi thay vì 404 giả. Slug lạ trả 404.
4. **Ảnh.** Schema không có alt, nên ảnh mang alt ghép từ tên địa điểm và số thứ tự ảnh, theo ngôn ngữ trang. Thẻ dùng ảnh trang trí đặt cạnh tên.
5. **Review chỉ đọc ở đây.** Trang dùng lại `getApprovedReviews` và `ReviewList`. Form review thuộc contract sau.
6. **Render.** `force-dynamic`, như mọi trang đọc nội dung Travel ([ADR 0012](0012-public-travel-from-content-repository.vi.md)); sitemap liệt kê từng địa điểm kèm `hreflang`.

## Hệ quả

- Thêm một cặp route cố định; đổi sau này cần ADR thay thế.
- Địa điểm nhập tạm làm placeholder sẽ hiển thị công khai; chủ dự án rà nội dung catalogue trước khi ra mắt.
- Alt còn chung chung cho đến khi schema có alt theo từng ảnh (thay đổi riêng).

## Bổ sung — route danh sách (PLACES-UI-S6, 2026-11-19)

Hệ quả "không có trang danh sách" không còn đúng: `/places` (`/dia-diem`, `/en/places`) là route cố định thứ hai, danh sách có tìm kiếm và lọc. Quyết định 7 và 8 của core-completion-index: `GET /api/travel/places` thêm `q` tuỳ chọn, tương thích ngược (cắt khoảng trắng, 1–80 ký tự, tìm chuỗi con thuần không phân biệt hoa thường và dấu trên tên và vị trí, chạy trước phân trang; không dựng mẫu từ input). Danh sách chỉ được index khi không lọc ở trang 1; các trạng thái khác là `noindex, follow` với canonical về `/places`. Phép chiếu công khai vẫn là allow-list. Chi tiết: [places.vi.md](../features/places.vi.md). Không đánh lại số.
