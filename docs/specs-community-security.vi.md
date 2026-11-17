# Spec Community Platform — bảo mật

🇻🇳 English version: [specs-community-security.md](specs-community-security.md)

Trạng thái: **Đề xuất**. Nhãn **[C] [P] [A]**: xem
[specs-community-overview.vi.md](specs-community-overview.vi.md). Đây là mô hình đe dọa lúc
thiết kế, không phải một lần review. Một lần review `security` cho bề mặt cộng đồng **hiện có** đã chạy ngày 2026-11-16 (PASS_WITH_WARNINGS; các phát hiện là mục backlog P10-11 đến P10-16); nó không phủ thiết kế này. Với các phase mới, reviewer **CHƯA CHẠY**; khuyến nghị chạy trước Phase 13 và Phase 14 và chỉ chạy khi chủ dự án yêu cầu (`/sec-check`).

Trạng thái phát hiện (batch 10.6a): P10-15 đã đóng (cổng phía server `contribution_closed`), P10-16 đã đóng (lọc tên dành riêng), P10-12 đóng ở mức code/test, còn kiểm tra proxy thật trên VM thuộc chủ dự án (D10); trần theo giờ toàn cục đã đánh giá và không thêm. P10-11 đã đóng ở mức code/test (batch 10.6b, ADR 0024: khóa khách HMAC, xóa sau 30 ngày, migration `0014`); cần `GUEST_KEY_SECRET` ở mọi môi trường trước khi deploy.

## Mục tiêu và phạm vi

Nói rõ ai được làm gì, ai sở hữu gì, cái gì riêng tư, và lạm dụng bị hạn chế ra sao, cho mọi
tính năng của Community Platform. Ngoài phạm vi: thay đổi đăng nhập, MFA, hay mô hình token admin.

## Yêu cầu

- **S1** RBAC qua hàm thuần `can(identity, action, resource)`; action mới thêm vào
  `ROLE_ACTIONS` trong `src/server/identity/permissions.ts`, không kiểm tra tùy tiện. [C]
- **S2** Quyền sở hữu được ép trong repository, lọc theo `ownerId`/`authorId`, như chuyến
  hiện nay; người không phải chủ nhận `404`. [C]
- **S3** Projection công khai là danh sách cho phép có test liệt kê. [C]
- **S4** Văn bản người dùng được render dạng text; rich text là tài liệu block do React
  render, không bao giờ `dangerouslySetInnerHTML` với dữ liệu người dùng. [P]
- **S5** Ẩn danh nghĩa là ẩn danh: không trường, URL, thông báo hay dòng log nào lộ cho
  người dùng khác mang id, email hay handle của tác giả. [C] (ADR 0014)
- **S6** Sở thích, mục đã lưu và thông báo là riêng tư với chủ của chúng. [P]
- **S7** Endpoint ghi bị giới hạn bởi kho **dùng chung** và theo user, không chỉ theo khóa
  client giả mạo được. [P]
- **S8** Mọi hành động kiểm duyệt hay hạn chế được ghi log kèm người thực hiện. [P]
- **S9** Bí mật ở lại phía server: thông tin đăng nhập kho lưu trữ không bao giờ tới Client
  Component (tiền lệ `tests/client-boundary.test.ts`). [C]

## Thiết kế

### Vai trò và quyền sở hữu

| Tài nguyên | Chủ | Người khác |
|---|---|---|
| Chuyến nháp, nhật ký nháp, tài sản chưa đăng | Tác giả | Nhân viên đọc được trong hàng đợi; không ai khác |
| Mục đã đăng | Tác giả | Mọi người đọc; chỉ nhân viên gỡ |
| Bản sao của một chuyến | Người sao chép | Tác giả nguồn không có quyền truy cập |
| Hồ sơ | User | Công khai chỉ khi user chọn slug công khai |
| Danh sách đã lưu, sở thích, thông báo | User | Không ai, kể cả nhân viên |
| `AuditEvent` (`audit_events`) | Nhân viên | Tác giả thấy sự kiện trên mục của mình |

Principal `service` (`ADMIN_API_TOKEN`) được kiểm duyệt nhưng không bao giờ là tác giả, và
không đọc bản nháp riêng tư. `trip:support-read` vẫn bị từ chối (ADR 0006).

### Mô hình đe dọa (tóm tắt)

| Mối đe dọa | Đường vào | Biện pháp |
|---|---|---|
| XSS lưu trữ | Nội dung nhật ký, bình luận, tiêu đề, bio | Tài liệu block, render dạng text, kiểm tra chặt, CSP; không có đường nhập HTML |
| File độc hại | Upload ảnh đa định dạng hay quá lớn | Kiểm magic byte, mã hóa lại toàn bộ, giới hạn điểm ảnh và byte, key cách ly |
| Lộ vị trí | GPS trong EXIF | Metadata bị xóa khi mã hóa lại; chứng minh bằng test fixture |
| Lộ danh tính ẩn danh | Tác giả ẩn danh lộ qua `origin` của bản sao, thông báo, sitemap hay trường API | `origin` và payload dựng từ danh sách cho phép; test liệt kê mọi body công khai |
| Dò id | Thăm dò id bản nháp riêng tư | `404` cho người không phải chủ; id ngẫu nhiên |
| IDOR trên media | Đoán key lưu trữ | Key không đoán được, tài sản chưa đăng chỉ phục vụ qua URL ký |
| SSRF | Server fetch URL do người dùng cung cấp (video) | Không bao giờ fetch; chỉ tách thành provider và id |
| Clickjacking, embed lẫn | Iframe bên thứ ba | Danh sách cho phép `frame-src`, bấm để tải, host tăng cường riêng tư |
| Spam và brigading | Bình luận hàng loạt, báo cáo hàng loạt | Bộ giới hạn dùng chung, hạn mức mỗi user, hạn chế (ADR 0015), loại trùng báo cáo, ngưỡng chỉ giữ bình luận |
| Cày bản sao, cào dữ liệu | Sao chép hay crawl hàng loạt | Hạn mức sao chép hằng ngày, bộ giới hạn đọc công khai, `robots` cho nội dung chưa đăng |
| CSRF | Ghi từ site khác | `requireSameOrigin` trên mọi lệnh ghi dùng cookie |
| Khuếch đại chiếm tài khoản | Session bị đánh cắp dùng để đăng | Đăng vẫn được tuyển chọn; đổi mật khẩu buộc xác thực lại (có sẵn) |
| Lạm quyền nội bộ | Nhân viên xóa hay đọc quá nhiều | Log hành động, `community:restrict` vẫn chỉ cho admin |
| Dữ liệu cá nhân trong văn bản công khai | Số điện thoại hay địa chỉ trong ghi chú | Lý do báo cáo, nhân viên duyệt, điều khoản đóng góp (việc của chủ dự án) |
| Phỉ báng, bản quyền | Khiếu nại bên thứ ba | Liên hệ gỡ bài là cổng lên sóng (`contributionOpen`) |

### Quyền riêng tư

Dữ liệu cá nhân thêm vào: bio và avatar hồ sơ (công khai chỉ khi chọn), sở thích, mục đã
lưu, theo dõi, thông báo. Quy tắc: tự nguyện, xóa được, không bao giờ vào log, nằm trong
tuyên bố riêng tư của chủ dự án; xóa cứng tài khoản thì xóa hoặc ẩn danh mọi thứ. Không
analytics, không pixel theo dõi, không font hay embed bên thứ ba tải trước khi đồng ý.

## Luồng xử lý và trạng thái lỗi

| Tình huống | Hành vi |
|---|---|
| User bị hạn chế ghi | Bị từ chối với thông điệp hạn chế hiện có; vẫn đọc được |
| Lạm dụng báo cáo (một user báo mọi thứ) | Báo cáo của user đó bị giới hạn tốc độ, rồi bị ngưỡng bỏ qua, vẫn được ghi log |
| Lộ thông tin đăng nhập kho lưu trữ | Xoay khóa; tài sản được ký lại; không có thông tin đăng nhập nào trong repository hay log |
| Tài khoản bị xóa | Mục đã đăng ẩn ngay; xóa hẳn sau thời gian lưu giữ |

## Phụ thuộc và bảo mật

Phụ thuộc kho giới hạn tốc độ dùng chung, cập nhật CSP cho host video, và cổng đóng góp.
Dependency runtime mới (editor, thư viện ảnh) là quyết định chuỗi cung ứng cần ADR và rà
soát `allowScripts`.

## Kịch bản kiểm thử

Ma trận route × vai trò; ma trận `can` mở rộng cho action mới; `404` theo quyền sở hữu;
bộ XSS trong mọi trường văn bản người dùng render vô hại; fixture GPS; test liệt kê tính
ẩn danh trên mọi body công khai và thông báo; CSRF trên từng lệnh ghi; bộ giới hạn giữ được
qua hai instance mô phỏng; bí mật vắng mặt trong bundle client.

## Câu hỏi còn mở

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| 1 | Đăng bài có cần email đã xác minh khi đã có bộ gửi email không? | Xem lại khi đó |
| 2 | Tài khoản nhân viên có `community:moderate` có bắt buộc MFA không? | Quyết định trước Phase 14 (PR #107 Q6 hoãn MFA và ghi rủi ro); MFA chưa xây |
| 3 | Slug hồ sơ công khai: độc lập với `handle`? | Có |
| 4 | Điều 3 của Terms đã cho phép sao chép khi người tạo bật tính năng. Công tắc sao chép theo từng chuyến mặc định thế nào, và bản sao được đăng lại hay chỉ dùng cá nhân? | Công tắc mặc định tắt; chủ dự án quyết định phạm vi đăng lại trước khi Dùng chuyến này ra mắt; luật sư đọc Điều 3 so với tính năng (rủi ro RK16) |
