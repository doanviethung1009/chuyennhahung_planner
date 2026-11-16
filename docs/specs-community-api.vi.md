# Spec Community Platform — API

🇻🇳 English version: [specs-community-api.md](specs-community-api.md)

Trạng thái: **Đề xuất**. Nhãn **[C] [P] [A]**: xem
[specs-community-overview.vi.md](specs-community-overview.vi.md). Tài liệu này không xây
route nào; route hiện có nằm ở `src/app/api/community`, `src/app/api/admin/community` và
`src/app/api/planner`.

## Mục tiêu và phạm vi

Hợp đồng HTTP của Community Platform: route, ai được gọi, phân trang, bộ từ vựng lỗi và
giới hạn. Body request và response được kiểm tra bằng zod 4 ở ranh giới tin cậy, như mọi
bề mặt hiện nay. [C]

## Yêu cầu

- **API1** Dùng lại envelope lỗi và `parseJsonBody` hiện có
  (`src/server/content/{errors,http}.ts`). Mã hiện có: `bad_request`,
  `payload_too_large`, `validation_failed`, `unauthorized`, `forbidden`,
  `password_change_required`, `not_found`, `slug_conflict`, `invalid_reference`,
  `invalid_state`, `precondition_required`, `version_conflict`, `rate_limited`,
  `service_unavailable`. Chỉ thêm mã mới khi không mã nào hợp. [C]
- **API2** Ba bề mặt, khớp tiền tố hiện nay: đọc công khai `/api/community`, hành động đã
  đăng nhập `/api/planner` và `/api/media`, nhân viên `/api/admin/community`. [C]
- **API3** Mọi thao tác ghi từ session trình duyệt được kiểm tra same-origin và trả
  `Cache-Control: no-store`; route nhân viên luôn `no-store`. [C] (ADR 0010/0011)
- **API4** Tài liệu sửa được dùng `ETag`/`If-Match`; thiếu header là
  `precondition_required`, cũ là `version_conflict`. [C] (ADR 0002)
- **API5** Người không phải chủ thấy `404 not_found`, không bao giờ `403`, với tài nguyên
  riêng tư của người khác, để không dò id được. [C] (ADR 0005)
- **API6** Danh sách công khai phân trang theo cursor: `?limit` (mặc định 20, tối đa 50) và
  `?cursor` mờ; body là `{ items, nextCursor }`. Không offset. [P]
- **API7** Lượt đọc công khai chỉ trả projection danh sách cho phép (không bao giờ
  `authorId` cho nội dung ẩn danh, không email hay `ownerId`). [C] (ADR 0014)

## Thiết kế

### Đọc công khai (không cần đăng nhập)

| Method và đường dẫn | Mục đích | Trạng thái |
|---|---|---|
| `GET /api/community/trips` | Thư viện; thêm bộ lọc `destination`, `durationMax`, `style`, `partySize`, `sort` | [C] route, [P] bộ lọc |
| `GET /api/community/reviews` | Đánh giá địa điểm | [C] có sẵn |
| `GET /api/community/journals` | Nhật ký đã đăng; lọc `kind`, `placeSlug`, `tag`, `author`, `lang` | [P] |
| `GET /api/community/journals/[slug]` | Một nhật ký đã đăng | [P] |
| `GET /api/community/profiles/[slug]` | Hồ sơ công khai và các mục đã đăng | [P] |
| `GET /api/community/search?q=` | Full-text trên mục đã đăng, lọc `kind` | [P] |
| `GET /api/community/[kind]/[id]/comments` | Bình luận hiển thị, phân trang cursor | [P] |

### Hành động đã đăng nhập

| Method và đường dẫn | Mục đích | Ghi chú |
|---|---|---|
| `PUT/DELETE /api/planner/[id]/listing` | Xin hoặc rút việc đăng | [C] có sẵn |
| `POST /api/community/trips/[token]/use` | Sao chép thành bản nháp riêng | Trả `TripView`; hạn mức sao chép; `404` trừ khi người tạo đã bật sao chép |
| `GET/POST /api/planner/journals` | Liệt kê của tôi / tạo bản nháp | |
| `GET/PATCH/DELETE /api/planner/journals/[id]` | Đọc, sửa (`If-Match`), xóa | Chỉ chủ |
| `POST /api/planner/journals/[id]/{submit,unpublish,archive}` | Chuyển trạng thái do tác giả | `invalid_state` nếu không cho phép |
| `POST /api/media/uploads` | Tạo ý định upload | Kiểm MIME khai báo, kích thước, hạn mức |
| `POST /api/media/uploads/[id]/complete` | Hoàn tất; server xác minh và xử lý | |
| `DELETE /api/media/[id]` | Xóa tài sản của mình | |
| `GET/PATCH /api/planner/profile` | Hồ sơ và chế độ hiển thị của mình | |
| `PUT/DELETE /api/community/follows/[slug]` | Theo dõi, bỏ theo dõi | Idempotent |
| `PUT/DELETE /api/community/[kind]/[id]/{like,save}` | Thích, lưu | Idempotent |
| `POST /api/community/[kind]/[id]/comments` | Bình luận | Chỉ đích đã đăng |
| `DELETE /api/community/comments/[id]` | Xóa bình luận của mình | |
| `POST /api/community/reports` | Báo cáo nội dung | Danh sách lý do cố định |
| `GET /api/planner/notifications`, `POST …/read` | Chuông (Phase 15) | Poll |

### Nhân viên

| Method và đường dẫn | Mục đích | Action cần có |
|---|---|---|
| `GET /api/admin/community/queue?kind=&status=` | Đang chờ, bị báo cáo, bị giữ | `community:moderate` |
| `POST /api/admin/community/{kind}/[id]/decision` | `{ decision, reason? }`: approve, reject, request_changes, unpublish, remove, restore | `community:moderate` (`restore` cần `community:restrict`, [P]) |
| `GET /api/admin/community/reports`, `POST …/[id]/resolve` | Xử lý báo cáo | `community:moderate` |
| `GET /api/admin/community/events?targetId=` | Log kiểm duyệt | `community:moderate` |
| `…/restrictions` | Hạn chế user hiện có, mở rộng sang nhật ký, bình luận, sao chép | `community:restrict` |

### Tóm tắt phân quyền

| Người gọi | Được |
|---|---|
| Ẩn danh | Đọc công khai; đánh giá khách theo ADR 0014 |
| Member | Bản nháp và chuyến của mình; gửi duyệt, thích, lưu, theo dõi, bình luận, báo cáo, dùng chuyến |
| Editor | Kiểm duyệt (`community:moderate` hiện nay) |
| Admin / super admin | Kiểm duyệt, hạn chế user |
| Service principal | Chỉ route nhân viên; không bao giờ đóng vai tác giả |

## Luồng xử lý và trạng thái lỗi

| Tình huống | Phản hồi |
|---|---|
| Không có session ở route cần đăng nhập | `401 unauthorized` |
| User bị cấm hoặc hạn chế ghi | `403 forbidden` kèm thông điệp hạn chế hiện có |
| Cổng đóng (`contributionOpen` false) | `503 service_unavailable` ở thao tác ghi cộng đồng; đọc không ảnh hưởng. Đề xuất: việc server có ép cổng hay chỉ UI là quyết định mở P10-15 của chủ dự án |
| Nhật ký không ở trạng thái cho phép hành động | `409` qua `invalid_state` |
| Sửa trên bản cũ | `412 version_conflict` |
| Ghi quá nhiều | `429 rate_limited` kèm `Retry-After` |
| Body quá giới hạn (nhật ký 200 KB JSON, bình luận 1000 ký tự) | `413 payload_too_large` / `422 validation_failed` |
| Id không tồn tại hoặc không thuộc chủ | `404 not_found` |
| Media chưa `ready` lúc gửi duyệt | `422 validation_failed` nêu tên tài sản |

Giới hạn tốc độ (đề xuất, theo user trừ khi nói khác): bình luận 10/giờ, theo dõi 60/giờ,
thích 120/giờ, báo cáo 10/ngày, sao chép chuyến 10/ngày, upload 30/ngày và 200 MB đang
chờ, gửi duyệt nhật ký 5/ngày. Ẩn danh: 60 lượt đọc/phút theo khóa client, như
`shareReadLimiter`.

## Phụ thuộc và bảo mật

Cần kho giới hạn tốc độ dùng chung (quyết định D8 trong
[kiến trúc](specs-community-architecture.vi.md)) trước khi các route ghi ra mắt; bộ giới
hạn theo tiến trình hiện nay giả mạo được (ADR 0005). Chi tiết ở
[bảo mật](specs-community-security.vi.md).

## Kịch bản kiểm thử

Ma trận route × người gọi (ẩn danh, member, chủ, member khác, editor, admin, service, bị
cấm) với status mong đợi; phân trang ổn định khi có chèn; PUT/DELETE idempotent; các nhánh
`If-Match`; tác giả ẩn danh vắng mặt trong mọi body; hành vi khi cổng đóng.

## Câu hỏi còn mở

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| 1 | Một đoạn `/{kind}/[id]/…` chung hay một route cho mỗi loại? | Chung, kiểm theo enum |
| 2 | Bình luận có cần email xác minh khi đã có bộ gửi email không? | Sau này; chưa phải bây giờ |
