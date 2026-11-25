# ADR 0035 — Địa điểm có trạng thái xuất bản; CMS tạo bản nháp

🇬🇧 English version: [0035-place-publish-status.md](0035-place-publish-status.md)

- **Trạng thái:** Đề xuất
- **Ngày:** 2026-11-25
- **Người sở hữu:** system-architect
- **Ảnh hưởng:** `src/server/content/schemas.ts` (`placeSchema`, `isPublishedPlace`), `src/server/content/repository.ts`, `src/server/content/public-places.ts`, `src/server/content/public.ts`, `src/server/community/public.ts`, `src/server/planner/repository.ts`, `src/server/persistence/content-rows.ts`, `db/migrations/0017_place_status.sql`, `src/app/api/travel/places/**`, `src/app/api/admin/travel/places/**`, `src/components/admin/content/**`, `docs/features/place-publish-status.*`

## Bối cảnh

Chuyến đi, bộ sưu tập và review có `status` (`draft` → `published` → `archived`). Địa điểm thì không: [ADR 0011](0011-admin-content-cms.vi.md) (P07-16) và [ADR 0026](0026-public-places-routes.vi.md) ghi rằng "địa điểm mới tạo hiển thị công khai ngay". Biểu mẫu chỉ có lời cảnh báo. Vì vậy một lỗi gõ hay địa điểm viết dở sẽ đến tay khách, sitemap, ô chọn địa điểm khi viết review và catalogue của Planner ngay khi lưu.

## Quyết định

1. **`Place` có thêm `status` (`draft` | `published` | `archived`) và `publishedAt`**, dùng cùng từ vựng với chuyến đi. Địa điểm đã lưu mà chưa có `status` được đọc là `published`, nên không địa điểm cũ nào biến mất.
2. **`POST` của trang quản trị tạo bản nháp.** `createPlace(input, { status })` vẫn mặc định `published` để seed và các nơi gọi trong tiến trình không đổi; chỉ `POST /api/admin/travel/places` truyền `draft`.
3. **`POST /api/admin/travel/places/[slug]/status`** (`publish` | `unpublish` | `archive`) đổi trạng thái, dùng action `story:publish` có sẵn (cùng người giữ quyền như xuất bản chuyến đi, theo ADR 0011).
4. **Chỉ địa điểm `published` mới công khai:** `/places`, `/places/[slug]`, trang điểm đến, sitemap, `GET /api/travel/places[/slug]` (tham số `status` do người gọi gửi bị bỏ qua), địa điểm nhúng trong chuyến đi và ô chọn địa điểm khi viết review. Bản nháp hoặc đã lưu trữ trả 404 ở route công khai. Route quản trị thấy mọi trạng thái.
5. **Planner coi địa điểm chưa xuất bản là không tồn tại với tham chiếu mới** (thêm hoạt động, review địa điểm; sao chép template thì hoạt động đó không còn liên kết địa điểm). Hoạt động đã có trong chuyến đi trỏ tới địa điểm sau đó bị gỡ vẫn giữ nguyên và không bị báo là thiếu: báo cáo toàn vẹn và danh sách của nhân viên vẫn tra được.
6. **Ràng buộc tham chiếu, đặt trong content repository.** Gỡ địa điểm (`unpublish`/`archive`) bị từ chối với `invalid_state` khi còn *chuyến đi đã xuất bản* hiển thị nó (danh sách liên quan hoặc block địa điểm). Xuất bản chuyến đi bị từ chối khi còn địa điểm nó hiển thị chưa xuất bản. Bộ sưu tập, mẫu và review nội dung chưa được ràng buộc trong quyết định này.
7. **PostgreSQL:** migration `0017_place_status.sql` thêm `status text NOT NULL DEFAULT 'published'` và `published_at`. Chỉ thêm cột; mọi dòng cũ thành `published`. Có script rollback trong `db/rollback/`.

## Các phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn): dùng lại từ vựng trạng thái của chuyến đi cho `Place` | Một mô hình duy nhất; dùng lại nút trạng thái và huy hiệu của trình sửa | Chạm mọi đường đọc công khai; cần thêm cột |
| B: cờ boolean `isPublic` | Nhỏ hơn | Thêm một từ vựng thứ hai; không có trạng thái lưu trữ; UI lệch nhau |
| C: hộp xác nhận trước khi tạo, không có trạng thái | Không đổi schema | Lưu xong vẫn công khai; không thể chuẩn bị địa điểm trước |

## Hệ quả

Dễ hơn: biên tập viên chuẩn bị địa điểm rồi xuất bản khi sẵn sàng; địa điểm tạo nhầm có thể gỡ mà không cần xoá.

Khó hơn:

- Mọi chỗ đọc địa điểm công khai mới phải dùng `getPublishedPlace` hoặc `status: 'published'`; gọi `listPlaces()` trần sẽ lộ bản nháp. `tests/place-status.test.ts` phủ các nơi đọc hiện có.
- Chuyến đi, bộ sưu tập hay mẫu đang hiển thị một địa điểm mà sau đó bị lưu trữ chỉ được bảo vệ với **chuyến đi** đã xuất bản. Bộ sưu tập, mẫu và review nội dung vẫn giữ tham chiếu treo và trang công khai lặng lẽ bỏ qua.
- Mặc định của `createPlace` là `published`, nên nơi gọi mới quên truyền tuỳ chọn sẽ xuất bản ngay. Hiện route CMS là lối soạn nội dung duy nhất.
- Đổi trạng thái địa điểm chưa ghi vào nhật ký kiểm toán (các loại đối tượng của `audit_events` chưa có `place`).

## Việc kéo theo

- Thêm `place` vào các loại đối tượng kiểm toán và ghi các lần đổi trạng thái.
- Quyết định có cho bộ sưu tập và mẫu chặn việc gỡ địa điểm hay không.
- Rollback: `db/rollback/0017_place_status.sql` có tính phá huỷ (bản nháp thành hiển thị với code cũ); hãy xuất bản hoặc xoá bản nháp trước.
