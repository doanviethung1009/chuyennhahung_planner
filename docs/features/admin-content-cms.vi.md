# Tính năng — CMS nội dung quản trị

🇬🇧 English version: [admin-content-cms.md](admin-content-cms.md)

## Mục đích

Biên tập viên và quản trị viên sửa chuyến đi, địa điểm và đánh giá ngay trên trình duyệt, với nội dung tiếng Việt và tiếng Anh đặt cạnh nhau; xuất bản, gỡ hay lưu trữ chuyến đi và duyệt đánh giá mà không cần `curl` hay token. Thiết kế: [ADR 0011](../adr/0011-admin-content-cms.vi.md). Dựa trên khung ở [admin-portal.vi.md](admin-portal.vi.md). Chỉnh sửa được lưu vào kho nội dung, nhưng các trang công khai hiện vẫn đọc từ nội dung có sẵn của website (`src/content/**`), nên thay đổi **chưa** hiện trên trang công khai; các màn hình đều có thông báo này.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/admin/content/stories` | `/quan-tri/noi-dung/chuyen-di` | `/en/admin/content/stories` |
| `/admin/content/stories/[slug]` | `/quan-tri/noi-dung/chuyen-di/[slug]` | `/en/admin/content/stories/[slug]` |
| `/admin/content/places` | `/quan-tri/noi-dung/dia-diem` | `/en/admin/content/places` |
| `/admin/content/places/[slug]` | `/quan-tri/noi-dung/dia-diem/[slug]` | `/en/admin/content/places/[slug]` |
| `/admin/content/reviews` | `/quan-tri/noi-dung/danh-gia` | `/en/admin/content/reviews` |

Đánh giá được sửa ngay trong hàng đợi duyệt nên không có trang riêng cho từng đánh giá. Mọi route nằm dưới tiền tố admin sẵn có nên `robots.ts` và luật `X-Robots-Tag` đã bao phủ; mỗi trang còn đặt `noindex` và không có trong sitemap.

## Dữ liệu

Đọc và ghi `/api/admin/travel/{stories,places,reviews}` (danh sách trả `{ stories|places|reviews, count }`, gồm cả bản nháp và đã lưu trữ, lọc bằng `?status=`) cùng `GET`/`PATCH` từng bản ghi. Mỗi bản ghi có `updatedAt`. Đổi trạng thái dùng `POST .../stories/[slug]/status` và `.../reviews/[id]/status` với `{ action }`. Phong bì lỗi: `{ error: { code, message, issues: [{ path, message }] } }`. Namespace thông điệp: `adminContent` và `admin`.

Các trường sửa được theo `storyUpdateSchema`, `placeUpdateSchema` và `reviewUpdateSchema`. Mỗi trường `{ vi, en }` là một fieldset có legend và hai ô nhập có nhãn. Chưa sửa được tại đây: bảng chi phí thực tế của chuyến đi, địa điểm và đánh giá liên kết, liên kết affiliate của địa điểm, thêm hoặc đổi thứ tự khối bài viết, tạo hoặc xoá bản ghi.

## Cách hoạt động

Mỗi trang là server component: `requireStaff` (`src/lib/admin-gate.ts`, dựng trên `readStaffPageAccess`) đưa khách chưa đăng nhập tới trang đăng nhập kèm `returnTo`, người còn mật khẩu tạm tới trang đổi mật khẩu, và vai trò không có việc gì ở đây tới `notFound()`. Thanh điều hướng là một hàng liên kết phẳng: Người dùng chỉ hiện nếu vai trò có `user:provision`, Chuyến đi, Địa điểm, Đánh giá và Cộng đồng chỉ hiện nếu có `content:write` (không còn nhãn "Nội dung" riêng); API vẫn là bên quyết định quyền. Sau đó trang render một client island gọi `fetch` cùng origin, nên chỉ có một đường ghi.

Khi lưu, chỉ các khoá sửa được được gửi kèm `If-Match: "<updatedAt>"`. Dấu thời gian cũ trả **412** `version_conflict`: màn hình báo có người khác lưu trước và đưa nút tải lại. Lỗi 422 đánh dấu từng trường có `path` dạng dấu chấm nằm trong `issues`. 401 mời đăng nhập lại, 429 báo thời gian chờ. Nút bị vô hiệu khi đang gửi, và kết quả được đọc qua vùng live lịch sự.

- Từ PLACES-UI-S5, mỗi địa điểm trong danh sách và trang sửa có liên kết "Xem trên site" tới trang công khai (`/dia-diem/[slug]`, EN `/places/[slug]`), mở tab mới và có nhãn báo cho trình đọc màn hình (`PlaceSiteLink` trong `community/place-link.tsx`). Địa điểm không có trạng thái nháp nên liên kết không gãy. Chưa làm: liên kết sang hàng đợi review theo từng địa điểm (hàng đợi chỉ lọc theo trạng thái) và số review theo địa điểm (danh sách không trả về); cả hai cần đổi API nên bỏ.

## File liên quan

| Path | Vai trò |
|---|---|
| `src/app/(admin)/[locale]/admin/page.tsx` | Khung: cổng, Người dùng cho admin, tổng quan cho biên tập viên |
| `src/app/(admin)/[locale]/admin/content/**/page.tsx` | Năm trang nội dung |
| `src/lib/admin-gate.ts` | Cổng dùng chung và helper `noindex` |
| `src/components/admin/admin-nav.tsx`, `content-notice.tsx` | Điều hướng theo vai trò; thông báo giới hạn trang công khai |
| `src/components/admin/content/form-kit.tsx` | Trường theo đường dẫn, cặp vi/en |
| `src/components/admin/content/use-record.ts` | Tải, bản nháp, lưu với `If-Match`, đổi trạng thái, ánh xạ lỗi |
| `src/components/admin/content/record-shell.tsx`, `story-editor.tsx`, `place-editor.tsx` | Trang sửa |
| `src/components/admin/content/content-list.tsx`, `review-queue.tsx`, `notices.tsx` | Danh sách, duyệt, UI dùng chung |
| `src/i18n/routing.ts`, `src/lib/return-to.ts` | Route và danh sách `returnTo` |
| `messages/vi.json`, `messages/en.json` | `adminContent`, `admin` |

## Test

`tests/routing.test.ts` cố định các đường dẫn mới; `tests/return-to.test.ts` danh sách cho phép; `tests/i18n.test.ts` sự khớp khoá; `tests/client-boundary.test.ts` việc không file client nào import code server. Cổng API, vai trò và `If-Match` do `tests/admin-content-session.test.ts` (backend) phủ. Chưa test: tương tác của trình sửa trên trình duyệt (chưa có công cụ test DOM).

## Giới hạn và câu hỏi còn mở

- Từ ADR 0012, trang công khai đọc cùng kho nội dung: bản đã xuất bản hiện ở lần tải trang kế tiếp ([public-travel-cms.vi.md](public-travel-cms.vi.md)); bản nháp và bản lưu trữ không hiện.
- Từ P07-16, biên tập viên tạo chuyến đi hoặc địa điểm nháp tại `/admin/content/{stories,places}/new` (`POST` với `content:write`, cùng nguồn gốc, chuyến đi luôn là nháp; server từ chối slug `new`) và lưu trữ chuyến đi từ danh sách hoặc trình sửa. **Địa điểm không có trạng thái nháp hay lưu trữ**, nên địa điểm mới hiển thị công khai ngay và biểu mẫu có cảnh báo; xoá cứng vẫn chỉ dùng token. Chưa có màn hình xoá, mẫu, bộ sưu tập hay kiểm tra toàn vẹn; chưa có nhật ký kiểm toán nên chỉnh sửa không gắn với người sửa.
- Khối bài viết sửa được chữ nhưng chưa thêm, xoá hay đổi thứ tự.
- `If-Match` là tuỳ chọn với người gọi bằng token, nên `curl` vẫn có thể ghi đè.
- Biên tập viên chưa có nút đăng xuất ở trang tổng quan.
