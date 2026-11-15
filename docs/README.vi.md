# Tài liệu — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

Thư mục này là bản ghi chép chính thức về ứng dụng: nó gồm những gì, chạy ra sao,
và mỗi tính năng một tài liệu. Đây là tài liệu sống, không phải tài liệu lưu trữ —
một thay đổi chưa được phản ánh ở đây thì chưa được coi là xong.

**Mọi tài liệu trong `docs/` đều tồn tại hai bản:** tiếng Anh ở `<tên>.md` và
tiếng Việt ở `<tên>.vi.md`. Bản tiếng Anh là bản gốc (khớp với comment trong code
và với README); bản tiếng Việt là bản dịch đầy đủ, không phải bản tóm tắt, và giữ
đúng cấu trúc tiêu đề. `tests/docs.test.ts` sẽ fail nếu thiếu một bản, nếu cấu
trúc hai bản lệch nhau, hoặc nếu tài liệu chưa được liệt kê trong mục lục dưới đây.

🇬🇧 English version: [README.md](README.md)

## Tài liệu nền tảng

| Tài liệu | Nội dung |
|---|---|
| [architecture.vi.md](architecture.vi.md) | Hình dạng runtime, routing, luồng dữ liệu, ranh giới module, các phase |
| [usage.vi.md](usage.vi.md) | Cài đặt, chạy, test, kiểm tra, deploy và các luồng việc hằng ngày |
| [travel-content-api.vi.md](travel-content-api.vi.md) | Hợp đồng API của Travel Content System — endpoint, quy ước, mã lỗi, các bất biến |
| [runbook.vi.md](runbook.vi.md) | Runbook: nơi bắt đầu — hướng dẫn nào trả lời câu hỏi nào, kiểm tra nhanh và danh sách mọi endpoint API; hiển thị cho admin tại `/quan-tri/runbook` |
| [deploy-operations.vi.md](deploy-operations.vi.md) | Runbook: vận hành app đã deploy — kiểm tra, log, khởi động lại, sao lưu và khôi phục, xoay vòng secret, đĩa, nâng cấp, sự cố |
| [deploy-runbook.vi.md](deploy-runbook.vi.md) | Runbook: một hướng dẫn đi thẳng từ VM trống đến khi app chạy và tự deploy — chọn layout, host, `.env`, database, runner, deploy lần đầu, xử lý sự cố |
| [deploy-database.vi.md](deploy-database.vi.md) | Runbook: chuyển dữ liệu JSON sang PostgreSQL trên VM riêng — role, TLS, migrate, import, xác minh, backup, rollback |
| [deploy-runner.vi.md](deploy-runner.vi.md) | Runbook: cài runner deploy tự host trên VM dev thành service systemd đã hardening — user, ACL, đăng ký, hardening unit, kiểm tra |
| [runbook-google-sign-in.vi.md](runbook-google-sign-in.vi.md) | Runbook: bật và vận hành đăng nhập Google trên VM dev — redirect URI, `.env`, áp dụng qua deploy, kiểm tra, lỗi, rollback |
| [runbook-api.vi.md](runbook-api.vi.md) | Runbook: vận hành các API trên VM dev — nhóm API và credential, smoke test sau deploy, bảng lỗi, lời gọi của operator, rollback |

## Tính năng

Mỗi tính năng một tài liệu, đăng ký trong [features/README.vi.md](features/README.vi.md).

Tính năng mới bắt đầu từ [features/_template.vi.md](features/_template.vi.md).

## Quyết định kiến trúc

Các ADR nằm trong [adr/](adr/README.vi.md), đánh số `NNNN-slug.md`, viết theo
[adr/_template.vi.md](adr/_template.vi.md).

## Cách thêm tài liệu cho một tính năng

1. Copy `features/_template.md` thành `features/<feature-slug>.md` và điền đủ mọi
   mục. Giữ nguyên bảy tiêu đề — `tests/docs.test.ts` kiểm tra điều này.
2. Copy tiếp thành `features/<feature-slug>.vi.md` và dịch trọn vẹn. Cùng cấu
   trúc tiêu đề, nội dung bằng tiếng Việt.
3. Thêm một dòng cho tính năng vào bảng trong `features/README.md` **và**
   `features/README.vi.md`.
4. Nếu tính năng làm thay đổi bản đồ route, hợp đồng dữ liệu, ranh giới module
   hoặc ranh giới phase, cập nhật luôn `architecture.md` và `architecture.vi.md`.
   Nếu nó thay đổi cách chạy hoặc vận hành app, cập nhật `usage.md` và
   `usage.vi.md`.
5. Nếu tính năng dựa trên một quyết định không hiển nhiên và có đánh đổi thật,
   viết ADR trước rồi link từ tài liệu tính năng sang.
6. Chạy `npm run test` và nêu rõ kết quả thật.

## Văn phong

- Mở đầu bằng việc thứ đó dùng để làm gì, không phải nó được xây thế nào.
- Link tới file thật bằng đường dẫn tương đối trong repo, để tài liệu đi lại được.
- Nói rõ chi phí và giới hạn. Tài liệu chỉ kể điểm mạnh là tài liệu quảng cáo.
- Đánh dấu rõ những chỗ cần dữ liệu thật của chủ nhà (handle, email, số điện
  thoại) thay vì để lại một giá trị giả trông như thật.
