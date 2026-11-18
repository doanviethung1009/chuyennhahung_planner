# Travel Content System — tài liệu API

🇬🇧 English version: [travel-content-api.md](travel-content-api.md)

Năm module: **Travel Stories**, **Travel Places**, **Destination Collections**,
**Travel Reviews** và **Travel Templates** dùng lại được.
Lý do thiết kế và ranh giới giữa các thực thể nằm trong
[ADR 0001](adr/0001-travel-content-system.vi.md). File này là hợp đồng.

AI Planner **không** thuộc phase này, và không có thực thể chuyến đi của người dùng.

## Chuẩn bị

```bash
# Bắt buộc cho mọi route /api/admin/**. Mặc định đóng: không token thì không có API admin.
export ADMIN_API_TOKEN="$(openssl rand -hex 32)"

# Tuỳ chọn
export TRAVEL_CONTENT_STORE=.data/travel-content.json  # giá trị mặc định
export TRAVEL_CONTENT_AUTOSEED=false                   # bỏ qua phần seed demo
```

Lần dùng đầu tiên, một store rỗng sẽ được seed bằng nội dung demo (sáu place ở
Đà Lạt, hai review, một story đã xuất bản, một collection, một template công khai).

## Quy ước

| Chủ đề | Quy tắc |
|---|---|
| Tiền | Mọi trường `*Vnd` là **số nguyên không âm đếm theo đồng**. Không bao giờ là số thực, không bao giờ là đơn vị nhỏ hơn. Tối đa 10^12. |
| Văn bản bản địa hoá | `{ "vi": "…", "en": "…" }` — **bắt buộc cả hai** (quy tắc 1 trong CLAUDE.md). |
| Slug | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, bất biến sau khi tạo. Một URL là một lời hứa. |
| Ngày tháng | `YYYY-MM-DD` cho ngày đi, datetime ISO-8601 cho các mốc thời gian. |
| Khoá lạ | Bị schema loại bỏ, không bao giờ được lưu. |
| Trường dẫn xuất | `actualCostTotalVnd`, `durationDays`, `estimatedTotalVnd`, `placeSlugs`, `version`, `status`, `publishedAt` và `sourceSnapshot` đều **do server sở hữu**. Gửi lên cũng không có tác dụng. |
| Cache | Mọi phản hồi đều là `cache-control: no-store`. |

### Phân quyền

```
Authorization: Bearer <ADMIN_API_TOKEN>
```

So sánh bằng `timingSafeEqual`. Một token ngắn hơn 32 ký tự được coi là cấu hình
sai, không phải là một secret yếu.

**Truy cập bằng session (ADR 0011).** Một số route còn nhận cookie session của trình duyệt (mutation cần chứng minh same-origin): `GET` danh sách `stories`, `places`, `reviews`, và `GET` / `PATCH` của `stories/[slug]`, `places/[slug]`, `reviews/[id]` cùng `PATCH stories/[slug]/places` và, từ P07-16, `POST stories` và `POST places` cần action `content:write` (`editor`, `admin`); `POST stories/[slug]/status` và `reviews/[id]/status` cần `story:publish`. Từ P07-15 (W11), `collections` (`GET`, `POST`), `collections/[slug]` (`GET`, `PATCH`, `DELETE`), `collections/[slug]/status` và `integrity` cũng nhận session với `content:write` (mutation cần chứng minh same-origin, 30 lần/phút/người), và `GET /api/admin/planner/integrity` của Planner nhận session admin với `user:provision` (editor bị từ chối). `PATCH` collection nhận `If-Match: "<updatedAt>"` tuỳ chọn như places (cũ -> 412 `version_conflict`; không có header -> last write wins). Phần còn lại (`DELETE` story/place/review, `templates/**`) vẫn chỉ dùng token.

**Kiểm soát đồng thời lạc quan.** `PATCH` trên các route đó nhận header tuỳ chọn `If-Match: "<updatedAt>"` (`updatedAt` cuối của bản ghi, có ngoặc kép). Nếu bản ghi đã đổi, phản hồi là **412** `version_conflict` và không ghi gì. Không có header thì giữ nguyên ghi sau thắng; header rỗng là `400`.

### Hình dạng lỗi

```json
{ "error": { "code": "invalid_reference", "message": "…", "issues": [ { "path": "placeSlugs[0]", "message": "place \"x\" does not exist" } ] } }
```

| Mã | Status | Ý nghĩa |
|---|---|---|
| `bad_request` | 400 | Body không phải JSON hợp lệ |
| `unauthorized` | 401 | Thiếu bearer token hoặc token sai |
| `payload_too_large` | 413 | Body vượt 256 KiB — bị từ chối trước khi được parse |
| `not_found` | 404 | Không có bản ghi nào — cũng là thứ mà một bản ghi chưa xuất bản trả về khi gọi công khai |
| `slug_conflict` | 409 | Slug hoặc id đã bị dùng |
| `invalid_state` | 409 | Bị một quy tắc vòng đời từ chối (xem *Các bất biến*) |
| `validation_failed` | 422 | Schema từ chối payload; `issues` liệt kê đường dẫn từng trường |
| `invalid_reference` | 422 | Đúng cấu trúc nhưng trỏ tới thứ không tồn tại |
| `admin_auth_unconfigured` | 503 | `ADMIN_API_TOKEN` chưa đặt hoặc quá ngắn |

Các vấn đề về tham chiếu được báo **một lần tất cả**, không phải mỗi lượt gọi một lỗi.

Body của request bị giới hạn ở **256 KiB** cho mọi endpoint ghi, kể cả Planner.
`Content-Length` được kiểm trước, nhưng đó chỉ là lời khai, nên body còn được đo
ngay khi đang truyền tới và kết nối bị cắt ngay khi vượt ngưỡng. Giới hạn được áp
*trước khi* payload được parse hay validate — đó mới là thứ ngăn một collection
quá lớn chạm tới bộ validate.

## Endpoint công khai

Chỉ đọc. Chỉ phục vụ story/collection/review đã xuất bản và template công khai;
bản nháp là 404.

| Method | Đường dẫn |
|---|---|
| `GET` | `/api/travel/stories` · `/api/travel/stories/[slug]` |
| `GET` | `/api/travel/places` · `/api/travel/places/[slug]` |
| `GET` | `/api/travel/collections` · `/api/travel/collections/[slug]` |
| `GET` | `/api/travel/reviews` |
| `GET` | `/api/travel/templates` · `/api/travel/templates/[slug]` |

Query khi lấy danh sách: `?destinationSlug=&category=&travelStyle=&limit=50&offset=0`.
Place không có trạng thái xuất bản — một place thì tồn tại hoặc không.

## Endpoint quản trị

| Method | Đường dẫn | Mục đích |
|---|---|---|
| `GET` `POST` | `/api/admin/travel/places` | Danh sách (gồm tất cả) · tạo mới |
| `GET` `PATCH` `DELETE` | `/api/admin/travel/places/[slug]` | Đọc · cập nhật · xoá |
| `GET` `POST` | `/api/admin/travel/stories` | Danh sách (gồm bản nháp) · tạo dưới dạng nháp |
| `GET` `PATCH` `DELETE` | `/api/admin/travel/stories/[slug]` | Đọc · cập nhật · xoá |
| `POST` | `/api/admin/travel/stories/[slug]/status` | `{"action":"publish"\|"unpublish"\|"archive"}` |
| `PATCH` | `/api/admin/travel/stories/[slug]/places` | `{"add":[],"remove":[]}` — thêm place vào một story |
| `GET` `POST` | `/api/admin/travel/collections` | Danh sách · tạo mới |
| `GET` `PATCH` `DELETE` | `/api/admin/travel/collections/[slug]` | Đọc · cập nhật · xoá |
| `POST` | `/api/admin/travel/collections/[slug]/status` | Vòng đời xuất bản |
| `GET` `POST` | `/api/admin/travel/reviews` | Danh sách · tạo mới |
| `GET` `PATCH` `DELETE` | `/api/admin/travel/reviews/[id]` | Đọc · cập nhật · xoá |
| `POST` | `/api/admin/travel/reviews/[id]/status` | Vòng đời xuất bản |
| `GET` `POST` | `/api/admin/travel/templates` | Danh sách · **tạo từ một chuyến đi thật** |
| `GET` `PATCH` `DELETE` | `/api/admin/travel/templates/[slug]` | Đọc · cập nhật · xoá |
| `POST` | `/api/admin/travel/templates/[slug]/reorder` | `{"day":2,"activityIds":[…]}` — sắp xếp lại trong một ngày |
| `POST` | `/api/admin/travel/templates/[slug]/move-activity` | `{"activityId","toDay","toIndex"}` |
| `GET` | `/api/admin/travel/integrity` | Quét tham chiếu trên toàn bộ store |

Một story **luôn được tạo ra ở trạng thái nháp**. Xuất bản là một lượt gọi riêng,
tường minh.

## Các bất biến mà API bảo đảm

**Tham chiếu** — một place phải thuộc về một `Destination` có thật; `placeSlugs`,
`reviewIds` và `itinerarySlugs` của một story đều phải phân giải được; chủ thể của
một review phải phân giải được đúng theo `kind` của nó; `sourceStorySlug` của một
template và `placeSlug` của mọi hoạt động đều phải tồn tại. Một place được nhúng
trong phần nội dung của story thì cũng phải xuất hiện trong `placeSlugs`, nên hai
chỗ đó không bao giờ có thể nói khác nhau.

**Xuất bản** — một story không thể xuất bản khi một review được liên kết vẫn còn
là bản nháp (một trang đang sống không được link tới một trang đang ẩn). Một
collection không thể xuất bản khi nó còn chứa một story chưa xuất bản. Một
template không thể ở trạng thái công khai nếu story nguồn của nó chưa xuất bản.

**Hạ nội dung xuống** — một story hay collection đã xuất bản thì không thể xoá
(phải bỏ xuất bản hoặc lưu trữ trước) để một URL đang sống không bắt đầu trả 404.
Một review không thể bỏ xuất bản khi còn một story đã xuất bản link tới nó. Một
template công khai thì không thể xoá. Một place không thể xoá khi còn thứ gì tham
chiếu tới nó, và lời từ chối **nêu tên mọi chỗ đang tham chiếu**. Một place không
thể bị tách khỏi một story khi còn đang được nhúng trong phần nội dung của story đó.

**Template** — các ngày được đánh số `1..n` và `order` của hoạt động chạy `0..m`
theo cách dựng, chứ không theo dữ liệu đầu vào. `durationDays`,
`estimatedTotalVnd` và `placeSlugs` được dẫn xuất lại ở mỗi lượt ghi. `version`
tăng lên sau mỗi lượt mutation cấu trúc. Một ngày không thể bị để lại với không
hoạt động nào.

**`sourceSnapshot` là bất biến.** Nó đóng băng tiêu đề, destination, ngày đi, tổng
chi phí và các slug place của story nguồn ngay lúc tạo. Sửa *hoặc xoá* story nguồn
cũng không bao giờ làm nó biến đổi — một nguồn đã bị xoá được phần quét toàn vẹn
báo lại như một thông tin, không phải như một lỗi dữ liệu. Một lượt patch không thể
ghi đè nó.

> Thay cả khối `days` sẽ **cấp lại id cho các hoạt động**. Hãy dùng `reorder` và
> `move-activity` khi chỉ muốn đổi thứ tự; hai thứ đó giữ nguyên id.

## Ví dụ chạy thật

```bash
T="Authorization: Bearer $ADMIN_API_TOKEN"
J="content-type: application/json"

# 1. Một place
curl -X POST localhost:3000/api/admin/travel/places -H "$T" -H "$J" -d '{
  "slug":"ho-tuyen-lam","destinationSlug":"da-lat","category":"nature",
  "name":{"vi":"Hồ Tuyền Lâm","en":"Tuyền Lâm Lake"},
  "location":{"vi":"Phường 4","en":"Ward 4"},
  "coords":{"lat":11.8942,"lng":108.4192},
  "description":{"vi":["Hồ giữa rừng thông."],"en":["A lake in the pines."]},
  "suggestedMinutes":120,"estimatedCostVnd":80000,"rating":5 }'

# 2. Xuất bản một story, rồi cắt ra một template công khai từ nó
curl -X POST localhost:3000/api/admin/travel/stories/my-story/status \
  -H "$T" -H "$J" -d '{"action":"publish"}'

# 3. Sắp xếp lại ngày 2
curl -X POST localhost:3000/api/admin/travel/templates/my-template/reorder \
  -H "$T" -H "$J" -d '{"day":2,"activityIds":["act_b","act_a"]}'

# 4. Kiểm tra sức khoẻ tham chiếu
curl localhost:3000/api/admin/travel/integrity -H "$T"
```

## Test

| File | Phủ những gì |
|---|---|
| `tests/travel-content-schemas.test.ts` | Từ chối số thực cho trường VND nguyên, bắt buộc đủ hai locale, quy tắc slug/ngày/ảnh/điểm, loại bỏ khoá lạ |
| `tests/travel-content-auth.test.ts` | Hành vi mặc định đóng, token sai/thiếu tiền tố/quá dài, cách xử lý scheme |
| `tests/travel-content-repository.test.ts` | CRUD, mọi bất biến ở trên, tính bất biến của snapshot, versioning, reorder/move, các lượt ghi chồng nhau |
| `tests/travel-content-api.test.ts` | Route handler thật: map status code, 401 khi không có token, `no-store`, lưu trữ bền qua nhiều instance |
| `tests/travel-content-acceptance.test.ts` | Kịch bản chấp nhận Đà Lạt trong bản yêu cầu |
