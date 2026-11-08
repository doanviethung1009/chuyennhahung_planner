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
- thêm một framework, thư viện state, ORM hay hệ CSS
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
