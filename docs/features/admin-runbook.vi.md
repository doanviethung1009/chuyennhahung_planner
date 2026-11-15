# Tính năng — Tab Runbook cho admin

🇻🇳 English version: [admin-runbook.md](admin-runbook.md)

## Tóm tắt

Một tab **Runbook** trong khu quản trị để quản trị viên đọc danh sách API và các
hướng dẫn vận hành ngay trên trình duyệt, không cần quyền vào repository. Chỉ dành
cho vai trò `admin`: editor hay người dùng đăng nhập khác nhận `404`, khách chưa
đăng nhập được chuyển tới trang đăng nhập rồi quay lại. Nội dung là chính các tài
liệu trong repository nên không lệch khỏi bản đang triển khai. Kết quả khảo sát dẫn
tới việc này: trước đó chưa có danh sách API nào (chỉ có hợp đồng Travel Content ở
[../travel-content-api.vi.md](../travel-content-api.vi.md)), nên đã thêm
[../runbook.vi.md](../runbook.vi.md).

## Đường dẫn

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/admin/runbook` | `/quan-tri/runbook` | `/en/admin/runbook` |

`?doc=<id>` chọn tài liệu; id lạ quay về trang tổng quan. Đã nằm trong header
no-index `/quan-tri/:path*`, `/en/admin/:path*` và dòng disallow của `robots.txt`.

## Dữ liệu

- Đọc Markdown từ `docs/`, không bao giờ từ request: danh sách cho phép đóng `RUNBOOK_DOCS` trong `src/server/runbook/docs.ts` (`runbook`, `deploy-runbook`, `deploy-operations`, `deploy-database`, `deploy-runner`, `travel-content-api`). Ngôn ngữ tiếng Việt đọc bản `.vi.md`.
- Không đọc hay hiển thị thông tin xác thực nào; tài liệu chỉ nhắc bí mật bằng tên.
- Thông điệp: namespace `adminRunbook` và `adminContent.nav.runbook` trong `messages/vi.json`, `messages/en.json`.

## Cách hoạt động

1. `src/app/[locale]/admin/runbook/page.tsx` gọi `requireStaff(..., 'users')`: chưa đăng nhập thì chuyển tới đăng nhập kèm `returnTo`, mật khẩu tạm thì chuyển tới đổi mật khẩu, vai trò không có `user:provision` nhận `notFound()`. Trang là `force-dynamic` và `noindex`.
2. `readRunbookDoc` đọc `docs/<id>[.vi].md` từ `process.cwd()`. Tầng runner của Docker sao chép `docs/` vào `/app/docs` cho việc này.
3. `src/components/runbook/markdown.tsx` phân tích Markdown thành phần tử React (không chuỗi HTML, không `dangerouslySetInnerHTML`). Liên kết chỉ được giữ nếu là `http(s)` hoặc runbook khác trong danh sách cho phép; còn lại hiện thành chữ thường. `#` của tài liệu hiện thành `h2` vì trang giữ `<h1>` duy nhất.
4. `AdminNav` chỉ hiện tab khi người xem quản lý được người dùng. Ẩn không phải là phân quyền: cổng của trang kiểm tra lại.
5. [../runbook.vi.md](../runbook.vi.md) liệt kê mọi route handler; `tests/runbook.test.ts` báo lỗi nếu bảng và `src/app/api/**/route.ts` lệch nhau.

## Tệp

| Đường dẫn | Vai trò |
|---|---|
| `src/app/[locale]/admin/runbook/page.tsx` | Cổng, tab tài liệu, bài viết |
| `src/server/runbook/docs.ts` | Danh sách cho phép và đọc file |
| `src/components/runbook/markdown.tsx` | Trình hiển thị Markdown an toàn |
| `src/components/admin/admin-nav.tsx` | Liên kết Runbook cho admin |
| `src/i18n/routing.ts`, `messages/*.json` | Route và chuỗi |
| `docs/runbook.md`, `docs/runbook.vi.md` | Tổng quan và danh sách API |
| `Dockerfile` | Sao chép `docs/` vào image runner |
| `tests/runbook.test.ts` | Các test bên dưới |

## Kiểm thử

`tests/runbook.test.ts` khẳng định mọi file route và method đều có trong bảng API
(và không thừa), các tài liệu được phép tồn tại ở cả hai ngôn ngữ, mục route, liên
kết nav chỉ cho admin, và trình hiển thị (bảng, code, lọc liên kết, không HTML thô).
Chưa kiểm thử: cổng của trang trong trình duyệt; nó dùng lại `requireStaff`, đã có
test phiên admin.

## Giới hạn và câu hỏi mở

- Tài liệu cập nhật theo lần triển khai (image mang bản sao), không trực tiếp.
- Liên kết `#anchor` trong trang hiện thành chữ; chưa có mục lục.
- Cột "Ai được gọi" của bảng API viết tay; chỉ kiểm tra đường dẫn và method.
- Sơ đồ Mermaid trong vài tài liệu hiện thành khối code.
