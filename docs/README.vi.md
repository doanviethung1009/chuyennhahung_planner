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
| [specs-roadmap.vi.md](specs-roadmap.vi.md) | Spec: các giai đoạn dự án trong một trang — bảng trạng thái, dòng thời gian quyết định, những gì chưa mở, những gì còn cần chủ dự án |
| [specs-product.vi.md](specs-product.vi.md) | Spec: sản phẩm và các khả năng — mục đích, đối tượng và vai trò, bảng khả năng và bề mặt API, các quy tắc mọi thay đổi đều giữ |
| [specs-planner-personalization.vi.md](specs-planner-personalization.vi.md) | Spec (đề xuất): cá nhân hóa và cộng đồng Planner — sở thích người đi, khớp theo luật, "Dùng chuyến này", tin cậy và an toàn, các lát triển khai, câu hỏi còn mở |
| [specs-community-overview.vi.md](specs-community-overview.vi.md) | Spec Community Platform (đề xuất): tổng quan — tầm nhìn, hiện trạng repository, khoảng trống |
| [specs-community-architecture.vi.md](specs-community-architecture.vi.md) | Spec Community Platform (đề xuất): kiến trúc — module, quyết định, luồng |
| [specs-community-database.vi.md](specs-community-database.vi.md) | Spec Community Platform (đề xuất): cơ sở dữ liệu — mô hình dữ liệu, ERD, chỉ mục, migration 0010+ |
| [specs-community-api.vi.md](specs-community-api.vi.md) | Spec Community Platform (đề xuất): API — route, phân quyền, phân trang, lỗi, giới hạn |
| [specs-community-fe.vi.md](specs-community-fe.vi.md) | Spec Community Platform (đề xuất): frontend — trang, luồng, component, trạng thái |
| [specs-community-media.vi.md](specs-community-media.vi.md) | Spec Community Platform (đề xuất): media — lưu ảnh lai, pipeline upload, embed video |
| [specs-community-moderation.vi.md](specs-community-moderation.vi.md) | Spec Community Platform (đề xuất): kiểm duyệt — máy trạng thái tuyển chọn, vai trò, báo cáo |
| [specs-community-security.vi.md](specs-community-security.vi.md) | Spec Community Platform (đề xuất): bảo mật — RBAC, sở hữu, riêng tư, mô hình đe dọa |
| [specs-community-qc.vi.md](specs-community-qc.vi.md) | Spec Community Platform (đề xuất): QC — chiến lược test, nghiệm thu theo phase, lưới hồi quy |
| [specs-community-roadmap.vi.md](specs-community-roadmap.vi.md) | Spec Community Platform (đề xuất): roadmap — phase C1–C7, kế hoạch agent, sổ rủi ro, nhật ký quyết định |
| [specs-admin-workspace.vi.md](specs-admin-workspace.vi.md) | Spec Admin Workspace (đề xuất): rà soát admin portal, kiểm kê Existing/Improvement/Missing/Planned, sitemap và điều hướng, thiết kế theo khu vực, phân tích khoảng trống, vị trí trên roadmap |
| [specs-admin-workspace-impact.vi.md](specs-admin-workspace-impact.vi.md) | Spec Admin Workspace (đề xuất): ảnh hưởng cơ sở dữ liệu, API, RBAC, checklist bảo mật và QC, các cổng của phiên |
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
