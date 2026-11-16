# Spec Community Platform — frontend

🇻🇳 English version: [specs-community-fe.md](specs-community-fe.md)

Trạng thái: **Đề xuất**. Nhãn **[C] [P] [A]**: xem
[specs-community-overview.vi.md](specs-community-overview.vi.md). Các route liên quan hiện
nay (`src/i18n/routing.ts`): `/community-trips` (`/chuyen-di-cong-dong`), `/my-trips`
(`/chuyen-di-cua-toi`), `/shared/[token]` (`/chia-se/[token]`), `/reviews`
(`/goc-review`), `/admin/community` (`/quan-tri/cong-dong`).

## Mục tiêu và phạm vi

Trang, luồng, component và trạng thái cho Community Platform, mobile trước (375 px, rồi
`md` và `lg`), tiếng Việt trước, theo giọng tạp chí ấm áp, tối giản của thương hiệu. Tài
liệu này không viết code.

## Yêu cầu

- **FE1** Server component mặc định; `'use client'` chỉ cho editor, upload, phản hồi và
  chuông thông báo, mỗi cái có lý do nêu rõ. [C]
- **FE2** Mọi chuỗi trong `messages/vi.json` và `messages/en.json`, khớp từng khóa; mọi
  route mới trong `pathnames` ở cả hai locale. [C]
- **FE3** Chỉ dùng token từ `@theme` trong `src/app/globals.css`; token mới thêm ở đó và
  ghi trong [features/design-system.vi.md](features/design-system.vi.md). [C]
- **FE4** Một `<h1>` mỗi trang, heading có thứ tự, focus nhìn thấy, button và link thật,
  vùng chạm ≥44 px, `alt` có nghĩa (tác giả tự cung cấp cho ảnh). [C]
- **FE5** Không có điều khiển chết: điều khiển mà backend chưa xây hoặc cổng đang đóng thì
  vắng mặt hoặc bị vô hiệu kèm giải thích trung tính và link thật. [C]
- **FE6** Phần không có nội dung đã duyệt thì ẩn, không hiện rỗng, và không có seed giả. [C]
  (ADR 0014)
- **FE7** Văn bản người dùng viết hiện đúng như viết, theo `lang` của nó, dạng text. [C]

## Thiết kế

### Bản đồ trang

| Trang | Route nội bộ | Tiếng Việt | Phase |
|---|---|---|---|
| Khám phá (chuyến, nhật ký, vlog) | `/community` | `/cong-dong` | Phase 10, 12 |
| Chuyến cộng đồng (có sẵn) | `/community-trips` | `/chuyen-di-cong-dong` | có sẵn, thêm bộ lọc ở Phase 10 |
| Chi tiết nhật ký | `/journals/[slug]` | `/nhat-ky/[slug]` | Phase 12 |
| Hồ sơ công khai | `/travellers/[slug]` | `/nguoi-di/[slug]` | Phase 11 |
| Tìm kiếm | `/search` | `/tim-kiem` | Phase 15 |
| Nhật ký của tôi | `/my-journals` | `/nhat-ky-cua-toi` | Phase 12 |
| Trình soạn nhật ký | `/my-journals/[id]` | `/nhat-ky-cua-toi/[id]` | Phase 12 |
| Đã lưu | `/saved` | `/da-luu` | Phase 14 |
| Thông báo | `/notifications` | `/thong-bao` | Phase 15 |
| Sở thích tài khoản | `/account/preferences` | `/tai-khoan/so-thich` | Phase 15 |
| Hàng đợi nhân viên (có sẵn, mở rộng) | `/admin/community` | `/quan-tri/cong-dong` | Phase 10+ |

Đường dẫn tiếng Anh là tên chuẩn nội bộ; đường dẫn tiếng Việt theo quy ước hiện nay và là
đề xuất. Route chỉ vào sitemap nếu công khai.

### Các luồng chính

**Đăng một chuyến.** Trên `/my-trips/[id]` có hai công tắc: "Chia sẻ bằng link" (có sẵn)
và "Đăng lên cộng đồng" (mở một sheet ngắn: tên hiển thị hay ẩn danh, link điều khoản, gửi).
Chip trạng thái: Bản nháp, Đang duyệt, Cần chỉnh sửa (kèm ghi chú), Đã đăng, Chưa được
chấp nhận (kèm lý do), Đã gỡ. Sửa một chuyến đã đăng cảnh báo, trước khi lưu, rằng nó sẽ
quay lại hàng duyệt. [C]

**Dùng chuyến này.** Trên card và trang chi tiết chuyến cộng đồng có nút chính "Dùng chuyến
này". Chưa đăng nhập → đăng nhập, rồi quay lại. Kết quả đưa tới trình soạn của bản sao
với banner "Sao chép từ <tiêu đề> của <tác giả hoặc không có>"; bản sao là riêng tư. [C]

**Viết nhật ký.** Trình soạn block: tiêu đề, đoạn, trích dẫn, liên kết địa điểm; khối ảnh và nhúng video đến ở Phase 13. Tự lưu nháp với `If-Match`; upload ảnh có tiến trình và thử lại từng ảnh; bảng trạng
thái liệt kê điều đang chặn việc gửi duyệt (tài sản đang xử lý, thiếu tiêu đề, thiếu
`lang`). Gửi → Đang duyệt.

**Khám phá và lọc.** Card có ảnh bìa, tiêu đề, tác giả hoặc "Người đi", phong cách và thời
lượng. Bộ lọc thu gọn thành sheet trên mobile. Sắp xếp "Hợp với bạn" chỉ xuất hiện khi có
sở thích và luôn có "Xem tất cả". Kết quả rỗng giải thích nên nới bộ lọc nào.

**Hàng đợi kiểm duyệt (nhân viên).** Bảng trên desktop, card trên mobile; xem trước đúng
như người đọc sẽ thấy, khác biệt so với bản đã duyệt gần nhất, các thao tác Duyệt, Yêu cầu
sửa (bắt buộc ghi chú), Từ chối (bắt buộc lý do), Gỡ.

**Báo cáo.** Một điều khiển "Báo cáo" nhỏ trên mọi card và bình luận công khai; hộp thoại
với các lý do cố định; lời xác nhận giải thích điều xảy ra tiếp theo.

### Component (mới, trong `src/components/community/`)

`CommunityTripCard`, `JournalCard`, `AuthorLine`, `StatusChip`, `PublishSheet`,
`UseTripButton`, `ReportDialog`, `BlockEditor` (client), `MediaUploader` (client),
`VideoEmbed` (bấm để tải), `FollowButton`, `LikeSaveBar`, `CommentThread`,
`NotificationBell`, `FilterSheet`, `ModerationDiff`. Dùng lại `src/components/story/story-blocks.tsx`
để đọc nhật ký nếu bộ block phù hợp. [A]

### Trạng thái mọi trang đều định nghĩa

Đang tải (skeleton, không nhảy bố cục), rỗng, lỗi có thử lại, nháp ngoại tuyến được giữ,
bị cấm (hiển thị như không tìm thấy với mục riêng tư), cổng đóng (thông báo trung tính),
đang xử lý (media), xung đột (nhắc tải lại khi `412`).

### Ghi chú responsive và truy cập

Một cột ở 375 px; hai cột card ở `md`; ba ở `lg`. Thanh công cụ editor dùng được bằng bàn
phím và không để nội dung bị bàn phím ảo che. Hộp thoại giữ focus và trả focus. Trạng thái
truyền đạt bằng chữ, không chỉ bằng màu. Số phản hồi được đọc ở mức lịch sự. Độ tương phản
theo các test token hiện có.

## Luồng xử lý và trạng thái lỗi

| Tình huống | UI |
|---|---|
| Upload lỗi | Lỗi ngay trên ảnh kèm thử lại; bản nháp vẫn dùng được |
| Hai tab sửa một nhật ký | `412` → nhắc tải lại, giữ bản chữ cục bộ |
| Nguồn của bản sao bị rút | Chữ banner còn, link bị gỡ, không lỗi |
| User bị cấm | Điều khiển ghi được thay bằng thông báo hạn chế |
| Đích của thông báo không còn | Hiện "Không còn khả dụng", đánh dấu đã đọc |

## Phụ thuộc và bảo mật

Cần API ở [API](specs-community-api.vi.md) và pipeline media ở
[media](specs-community-media.vi.md). Editor là ứng viên dependency mới và cần ADR; editor
tự viết trên contenteditable là rủi ro đã biết và không được khuyến nghị. [P] Render nội
dung người dùng chỉ qua renderer block, theo [bảo mật](specs-community-security.vi.md).

## Kịch bản kiểm thử

Test component cho mỗi trạng thái; đường chỉ dùng bàn phím qua đăng chuyến và viết nhật ký;
kiểm tra ảnh chụp ở 375 / 768 / 1280 bằng `npm run verify:ui`; `tests/i18n.test.ts` cho
tính khớp; `tests/client-boundary.test.ts` cho import chỉ ở server; token tương phản.

## Câu hỏi còn mở

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| 1 | Một trung tâm `/community` hay giữ `/community-trips` làm cửa chính? | Trung tâm ở Phase 12; giữ route hiện có chạy |
| 2 | Thư viện editor nào, khi có yêu cầu ADR? | Quyết trong ADR của Phase 12 |
| 3 | Tác giả có thấy ai đã thích hay theo dõi không? | Chỉ số đếm ở Phase 14 |
