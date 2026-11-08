# Tính năng — <tên>

🇬🇧 English version: [_template.md](_template.md)

<!--
Copy file này thành docs/features/<slug>.vi.md, và copy bản tiếng Anh thành
docs/features/<slug>.md. Giữ đủ bảy tiêu đề `##` ở cả hai file —
tests/docs.test.ts kiểm tra điều này — và giữ cấu trúc tiêu đề giống nhau giữa
hai ngôn ngữ. Đăng ký tính năng vào features/README.md và features/README.vi.md.
Xoá các comment này.
-->

## Mục đích

Tính năng này để làm gì, phục vụ ai, trong hai đến ba câu. Mở đầu bằng giá trị
với người dùng, không phải bằng cách cài đặt.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/example` | `/vi-du` | `/en/example` |

Ghi `Không có` nếu tính năng không thêm route nào.

## Dữ liệu

Các bộ nội dung, type hoặc namespace messages mà nó đọc. Nêu tên những field
mang ý nghĩa thật, và chỉ rõ chỗ nào buộc phải là dữ liệu thật chứ không được là
dữ liệu "trông hợp lý" (toạ độ, handle, thông tin liên hệ).

## Cách hoạt động

Cơ chế: server hay client, cái gì render ở đâu, gọi helper nào trong `lib/`, xử
lý thế nào khi lỗi hoặc khi rỗng. Đủ để người khác sửa được mà không phải đọc hết
mọi file trước.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `src/...` | ... |

## Test

Những file test nào phủ tính năng này và chúng thực sự kiểm tra điều gì. Nếu có
hành vi cố ý không test, nói rõ là cái nào và vì sao.

## Giới hạn và câu hỏi còn mở

Nó không làm được gì, chi phí là gì, cái gì sẽ vỡ nếu phình to, và còn gì đang
chờ dữ liệu thật của chủ nhà hoặc chờ một ADR được duyệt. Một tài liệu tính năng
mà mục này trống thì gần như chắc chắn là chưa viết xong.
