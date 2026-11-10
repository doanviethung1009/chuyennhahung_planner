# Bản ghi quyết định kiến trúc (ADR)

🇬🇧 English version: [README.md](README.md)

Mỗi quyết định một file, `NNNN-slug.md`, đánh số theo thứ tự ra quyết định và
không bao giờ đánh số lại. Thuộc sở hữu của `system-architect`. Mỗi ADR có cả hai
ngôn ngữ; bản mới bắt đầu từ [`_template.md`](_template.md) /
[`_template.vi.md`](_template.vi.md).

Phải có ADR — không phải tuỳ chọn — cho các việc sau:

- bỏ hoặc đổi đích các redirect tour vĩnh viễn trong `next.config.ts`
- thay đổi topology route hoặc bản đồ pathname bản địa hoá
- mở phase backend Planner (model dữ liệu và hợp đồng gửi form trước đã) — đã làm trong [0002](0002-planner-core.vi.md); một phase *tiếp theo*, như giao diện Planner hay gợi ý AI, cần ADR riêng
- thêm một framework, thư viện state, ORM hay hệ CSS, hoặc nâng major một thư viện validate input từ bên ngoài — xem [0003](0003-zod-4.vi.md)
- bật dò locale theo Accept-Language
- thay nội dung seed có type bằng một CMS hoặc database

Viết quyết định trước, rồi vẽ sơ đồ nếu hình ảnh giúp được — bằng một block
Mermaid ngay trong ADR, ở cả hai bản ngôn ngữ. Sơ đồ chỉ vẽ lại một quyết định;
nó không ra quyết định.

Những quyết định mà site đang đứng trên — và không cần một bản ghi riêng — được mô tả
trong [../architecture.vi.md](../architecture.vi.md); còn cái gì *thay đổi* một trong số đó
thì cần một ADR ở đây.

| ADR | Quyết định | Trạng thái |
|---|---|---|
| [0001](0001-travel-content-system.vi.md) | Travel Content System: thực thể có type nằm sau một interface store, chưa có database, validation bằng `zod`, auth admin mặc định đóng | Đã chấp nhận |
| [0002](0002-planner-core.vi.md) | Lõi Planner: bốn collection trip chuẩn hoá, chủ sở hữu trip thật với phân quyền theo đối tượng, bản clone template độc lập, ngân sách số nguyên đồng kèm ranh giới BigInt, tương tranh bằng `If-Match` | Đã chấp nhận |
| [0003](0003-zod-4.vi.md) | Nâng `zod` lên 4.x để xoá GHSA-mrhx-c7xc-m3w5 thay vì rào nó sau cap body; di trú hai chỗ gọi deprecated, đã kiểm hành vi không đổi | Đã chấp nhận |
| [0004](0004-planner-identity.vi.md) | Danh tính Planner: session cookie `HttpOnly` đổi từ access token hiện có, nằm sau một đường ráp `resolveIdentity`, với CSRF là chi phí tường minh | Đã chấp nhận |
| [0005](0005-trip-sharing-and-story-cloning.vi.md) | Chia sẻ chuyến đi và nhân bản từ câu chuyện: link chia sẻ năng lực không đoán được với bản chiếu chỉ-đọc đã lọc, trạng thái kế hoạch tách khỏi vòng đời, attribution do server suy ra, rate limit trong bộ nhớ | Đã chấp nhận |
| [0006](0006-unified-identity-and-roles.vi.md) | Danh tính và vai trò thống nhất: `role` trên một mô hình user duy nhất, hàm thuần `can(identity, action, resource)`, `ADMIN_API_TOKEN` hạ thành service principal không bao giờ tới trình duyệt, template và trip tách bạch | Accepted (bước 1–2 đã hiện thực; 3–4 thuộc Phase 07) |
| [0007](0007-password-and-google-sign-in.vi.md) | Đăng nhập bằng mật khẩu và Google: tài khoản do operator tạo đăng nhập bằng email và mật khẩu hash bằng scrypt, còn đăng nhập Google (OIDC + PKCE tự viết) liên kết tài khoản sẵn có theo email hoặc tạo tài khoản member ở lần đầu; cả hai cấp session của ADR 0004 | Đã chấp nhận |
