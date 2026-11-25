# Tính năng — Trạng thái xuất bản của địa điểm

🇬🇧 English version: [place-publish-status.md](place-publish-status.md)

## Summary

Địa điểm nay có cùng vòng đời với chuyến đi: `draft`, `published`, `archived`. Biên tập viên tạo địa điểm trong trang quản trị sẽ có một bản nháp mà khách không thấy, rồi xuất bản từ trình sửa khi đã sẵn sàng. Quyết định: [ADR 0035](../adr/0035-place-publish-status.vi.md).

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/admin/content/places` (bộ lọc và huy hiệu trạng thái) | `/quan-tri/noi-dung/dia-diem` | `/en/admin/content/places` |
| `/admin/content/places/[slug]` (nút xuất bản / gỡ / lưu trữ) | `/quan-tri/noi-dung/dia-diem/[slug]` | `/en/admin/content/places/[slug]` |
| `POST /api/admin/travel/places/[slug]/status` | như nhau | như nhau |

Route địa điểm công khai không đổi; địa điểm chưa xuất bản trả 404.

## Data

`Place.status` (`draft` | `published` | `archived`) và `Place.publishedAt` (`null` cho đến lần xuất bản đầu). Địa điểm đã lưu mà không có `status` được đọc là `published`. PostgreSQL: `content_places.status` (mặc định `published`) và `published_at`, thêm bởi `db/migrations/0017_place_status.sql`. Khoá thông điệp: `adminContent.create.placeNote` và `adminContent.errors.invalid_state` (VI và EN).

## How it works

`createPlace(input, { status })` mặc định `published`; `POST` của trang quản trị truyền `draft`. `setPlaceStatus` xuất bản, gỡ (về `draft`) hoặc lưu trữ, và từ chối gỡ khi còn chuyến đi đã xuất bản hiển thị địa điểm. `setStoryStatus('publish')` từ chối khi còn địa điểm của chuyến đi chưa xuất bản. Các nơi đọc công khai (`public-places.ts`, `public.ts`, `community/public.ts`, `GET /api/travel/places`) chỉ đọc địa điểm `published`. Planner từ chối hoạt động hoặc review mới trỏ tới địa điểm chưa xuất bản nhưng giữ nguyên cái đã có. Trình sửa quản trị dùng lại các nút trạng thái của chuyến đi (`RecordShell` với `lifecycle`).

## Files

| Đường dẫn | Vai trò |
|---|---|
| `src/server/content/schemas.ts` | `placeSchema.status`, `isPublishedPlace` |
| `src/server/content/repository.ts` | Tuỳ chọn của `createPlace`, `getPublishedPlace`, `setPlaceStatus`, chặn xuất bản chuyến đi |
| `src/app/api/admin/travel/places/[slug]/status/route.ts` | Endpoint đổi trạng thái |
| `src/server/persistence/content-rows.ts`, `db/migrations/0017_place_status.sql` | Cột PostgreSQL |
| `src/components/admin/content/place-editor.tsx`, `content-list.tsx` | Nút trạng thái và bộ lọc |

## Tests

`tests/place-status.test.ts`: tạo mặc định và tạo nháp, địa điểm cũ không có status, lọc ở danh sách và đọc công khai, vòng đời, và hai ràng buộc với chuyến đi. `tests/travel-content-api.test.ts`: `POST` quản trị trả bản nháp và route công khai trả 404 đến khi xuất bản. `tests/runbook.test.ts` kiểm tra route đã được ghi tài liệu. Chưa phủ: các nút trong trình sửa trên trình duyệt (môi trường này không có jsdom) và migration PostgreSQL trên database thật.

## Limits and open questions

Bộ sưu tập, mẫu và review nội dung chưa bị chặn trỏ tới địa điểm nháp hoặc đã lưu trữ; trang công khai lặng lẽ bỏ qua. Đổi trạng thái chưa ghi vào nhật ký kiểm toán. Thay đổi này chưa áp migration `0017` lên database nào.
