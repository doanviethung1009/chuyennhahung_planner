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
| [0008](0008-postgres-document-store.vi.md) | PostgreSQL làm document store dùng chung: mỗi document JSON thành một dòng JSONB với `transact` khoá dòng, cache đọc kiểm bằng revision và rate limit trên Postgres, để app chạy được nhiều instance; bảng chuẩn hoá để sang bước 2 | Đã chấp nhận |
| [0009](0009-postgres-persistence.vi.md) | Planner trên bảng PostgreSQL chuẩn hoá (bước 2 của ADR 0008, làm thẳng cho Planner): `transact` của store chạy dưới advisory lock, nạp rồi chỉ ghi các dòng đã đổi; `pg` với migration SQL thuần và không ORM; không quay về JSON khi đã cấu hình database | Đã chấp nhận |
| [0010](0010-admin-portal-session-authorization.vi.md) | Cổng quản trị: các handler quản lý user hiện có chấp nhận service token hoặc session cookie có role qua `can()`; role đọc mỗi request, session admin ngắn hơn, same-origin cho mọi mutation, chặn khoá admin cuối và tự đổi quyền ở tầng repository, 404 cho người không phải admin, bí mật hiện một lần trong response `no-store` | Accepted |
| [0011](0011-admin-content-cms.vi.md) | CMS nội dung quản trị: sửa story, địa điểm và duyệt review trên trình duyệt qua `adminContentRoute` hỗ trợ session dùng lại resolver principal của planner, một action mới `content:write`, editor được vào `/quan-tri`, đồng thời lạc quan `If-Match: updatedAt` tuỳ chọn, tạo/xoá/template giữ chỉ-token | Đã chấp nhận |
| [0012](0012-public-travel-from-content-repository.vi.md) | Trang Travel công khai đọc từ content repository: một module đọc chỉ-server `getPublicContent` kèm adapter `static` để rollback, chỉ published và 404 nếu không, render hoàn toàn động thay vì revalidate, không cần DB lúc build, seed 6 story tĩnh idempotent không ghi đè, thêm hai trường story | Đã chấp nhận |
| [0013](0013-content-on-postgres-tables.vi.md) | Travel Content trên các bảng PostgreSQL chuẩn hoá: mỗi collection một bảng sau repository không đổi, một engine bảng dùng chung với Planner, cột có kiểu cộng JSONB cho cấu trúc, `CONTENT_DATABASE_URL` không lùi về file, chưa có khoá ngoại, seed dưới lock, script import/export | Đã chấp nhận |
| [0014](0014-community-trips-and-reviews.vi.md) | Chuyến đi và đánh giá địa điểm từ cộng đồng: trạng thái `listing` opt-in riêng với staff duyệt trước, projection allow-list `CommunityTripCard`, đánh giá của người đi là entity trong store Planner (mỗi tác giả một đánh giá mỗi địa điểm, giới hạn tần suất, văn bản thuần), action `community:moderate`, giao thành hai PR | Đã chấp nhận (đã hiện thực) |
| [0015](0015-community-review-author-controls.vi.md) | Quyền của staff với tác giả đánh giá: câu hỏi của staff trong ứng dụng với trạng thái tạm ẩn `held` thay cho email, và các dòng `ReviewRestriction` đảo ngược được chặn ghi mới và ẩn đánh giá hiện có theo một địa điểm hoặc cả tài khoản Planner, biến thể chặn khách theo key có thời hạn, action mới `community:restrict` | Đã chấp nhận (PR 1 và PR 2 đã hiện thực) |
| [0016](0016-auto-deploy-dev.vi.md) | Tự động deploy `main` lên VM dev: CI xanh trên `main` build image dev trên GitHub đẩy vào GHCR, runner tự host trên VM kéo về, probe `/api/health` và rollback khi lỗi; mỗi môi trường một image, rollback khôi phục image không khôi phục schema | Đã chấp nhận (đã chạy từ đầu đến cuối trên VM dev, 2026-11-15) |
| [0017](0017-super-admin-role.vi.md) | Role super admin: `super_admin` giữ riêng `runbook:read` (Runbook trả 404 cho admin/editor), admin chỉ thao tác trên tài khoản member/editor (tạo, đổi role, đặt lại mật khẩu), bảo vệ super admin cuối cùng, khóa cùng xóa mềm và xóa cứng tài khoản staff, người đầu tiên được nâng bằng service token | Đã chấp nhận (hiện thực qua hai PR) |
| [0018](0018-handle-sign-in.vi.md) | Đăng nhập bằng email hoặc mã tài khoản (`identifier`), giữ nguyên 401 chung và giới hạn tốc độ; cấp lại mật khẩu không còn cần email | Đã chấp nhận |
| [0019](0019-community-foundation.vi.md) | Nền tảng cộng đồng (phase C1): một máy trạng thái kiểm duyệt thuần trên luồng đăng hiện có, log `ModerationEvent` chỉ nối thêm ghi trong cùng transaction, và limiter dùng chung trên PostgreSQL cho các đường ghi (cửa sổ cố định, từ chối khi lỗi); `Trip.origin`, báo cáo và hồ sơ hoãn tới nơi dùng đầu tiên | Đã chấp nhận |
| [0020](0020-admin-workspace-shell.vi.md) | Khung Admin Workspace: một `layout.tsx` admin với sidebar theo nhóm nhận biết role, `/admin` thành dashboard và console người dùng chuyển sang `/admin/users`, route bổ sung cho collections, integrity, audit và system, một action mới `audit:read`, không store hay đường xác thực mới | Đã chấp nhận |
| [0021](0021-personalized-home.vi.md) | Trang chủ cá nhân hóa: một tài liệu công khai không cookie cho mọi người; nội dung cá nhân điền ở trình duyệt từ phép chiếu allow-list `GET /api/planner/home` mới; xếp hạng theo luật ở trình duyệt trên pool công khai; không thêm route | Đề xuất |
| [0022](0022-home-mvp-server-session.vi.md) | MVP trang chủ đọc cookie phiên ở server chỉ cho `/` (dải chuyến đầu tiên và Continue Planning), trang khách giống hệt từng byte, `private, no-store` cho request có cookie; thay thế ADR 0020 cho MVP | Đã chấp nhận |
| [0023](0023-admin-root-layout.vi.md) | Admin Workspace có root layout riêng (route group `(admin)`), thanh trên và `AdminPageHeader` dùng chung; header và footer công khai không render trong admin; module font dùng chung; tinh chỉnh ADR 0020 | Đã chấp nhận |
| [0024](0024-guest-identity-privacy.vi.md) | Định danh khách và quyền riêng tư (D4): khóa khách thành HMAC-SHA256 với secret phía server (cả khóa limiter), định danh khách bị xóa sau 30 ngày, restriction khách tối đa 30 ngày, khóa hiện có bị migration xóa; nội dung Chính sách riêng tư và xóa dữ liệu khách là task riêng của chủ dự án/staff | Đã chấp nhận |
| [0025](0025-member-profiles-and-use-this-trip.vi.md) | Hồ sơ thành viên và "Dùng chuyến này" (Phase 11): `member_profiles` 1:1, riêng tư mặc định, trang slug công khai tự nguyện sau `profilePublicOpen`; công tắc `allowCopy` theo chuyến trong `listing` (mặc định tắt, Điều 3 Terms); bản sao dựng từ phép chiếu công khai theo allow-list, ghi công `Trip.origin` dạng chữ, chưa cho đăng lại bản sao; migration `0015`/`0016` | Đề xuất |
