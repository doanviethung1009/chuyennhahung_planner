# Tính năng — sổ đăng ký

🇬🇧 English version: [README.md](README.md)

Mỗi tính năng trong app có đúng một tài liệu ở đây, bằng cả hai ngôn ngữ. **Một
tính năng không có trong bảng này là tính năng chưa xong** — `tests/docs.test.ts`
fail khi có tài liệu chưa được đăng ký, và khi một tài liệu đã đăng ký mà thiếu
bản tiếng Việt.

Tính năng mới bắt đầu từ [`_template.md`](_template.md) /
[`_template.vi.md`](_template.vi.md).

| Tính năng | Tài liệu | Nội dung |
|---|---|---|
| i18n và routing | [i18n-and-routing.vi.md](i18n-and-routing.vi.md) | Locale, pathname bản địa hoá, middleware, file messages |
| Chuyện đi chơi | [stories.vi.md](stories.vi.md) | `/chuyen-di-choi` danh sách và chi tiết, phần kể chuyện cốt lõi |
| Điểm đến | [destinations.vi.md](destinations.vi.md) | `/kham-pha` danh sách và chi tiết, trung tâm tham chiếu chéo |
| Bản đồ hành trình | [travel-map.vi.md](travel-map.vi.md) | `/ban-do` — silhouette SVG, toạ độ thật, không cần JS |
| Bản đồ thành viên | [member-map.vi.md](member-map.vi.md) | `/ban-do-cua-toi` — bản đồ riêng của thành viên đăng nhập: chấm đặc đã đi, chấm rỗng đã lên kế hoạch (ADR 0029) |
| Lịch trình | [itineraries.vi.md](itineraries.vi.md) | `/len-lich-trinh` cùng các redirect tour vĩnh viễn |
| Góc review video | [video-reviews.vi.md](video-reviews.vi.md) | `/goc-review` — card cố ý không link, nút kênh |
| Thiết kế chuyến đi | [plan-your-trip.vi.md](plan-your-trip.vi.md) | `/thiet-ke-chuyen-di` — điểm vào Planner, chủ đích không form |
| Hệ thiết kế | [design-system.vi.md](design-system.vi.md) | Token `@theme`, primitive, test tương phản |
| SEO và metadata | [seo-and-metadata.vi.md](seo-and-metadata.vi.md) | Canonical, `hreflang`, sitemap, JSON-LD |
| Đi theo dấu chân nhà Hưng | [follow-hung-footsteps.vi.md](follow-hung-footsteps.vi.md) | Lịch trình trong story, thiết lập chuyến đi, đăng nhập, Chuyến đi của tôi, đường dẫn chia sẻ chỉ đọc |
| Lõi Travel Planner | [travel-planner-core.vi.md](travel-planner-core.vi.md) | `/api/planner` — trip, ngày, activity, chi phí, ngân sách, clone template |
| Planner trên PostgreSQL | [planner-postgres-persistence.vi.md](planner-postgres-persistence.vi.md) | Store theo `PLANNER_DATABASE_URL`, transaction khoá advisory, migration, import và export |
| Travel Content trên PostgreSQL | [content-postgres-tables.vi.md](content-postgres-tables.vi.md) | Store theo `CONTENT_DATABASE_URL`, mỗi collection một bảng trên engine bảng dùng chung, seed dưới lock, import và export |
| Vai trò admin | [admin-roles.vi.md](admin-roles.vi.md) | `role` trên user, `permissions.ts`, `PATCH /api/admin/planner/users/[userId]` để nâng admin đầu tiên |
| Khung quản trị | [admin-shell.vi.md](admin-shell.vi.md) | Một layout cho mọi trang quản trị: thanh bên theo nhóm và theo vai trò, breadcrumb, skip link, menu điện thoại; tổng quan `/admin` và bảng người dùng ở `/admin/users` (ADR 0020) |
| Bảng điều khiển quản trị | [admin-dashboard.vi.md](admin-dashboard.vi.md) | Thẻ trên `/admin` theo vai trò: chuyến đi và đánh giá chờ duyệt, bản nháp chuyến đi/đánh giá, tài khoản, runtime; `GET /api/admin/overview` (P07-11) |
| Cổng quản trị | [admin-portal.vi.md](admin-portal.vi.md) | `/quan-tri` — danh sách, tạo, đổi vai trò và cấp lại mật khẩu người dùng ngay trên trình duyệt, chỉ cho admin (ADR 0010) |
| Lọc người dùng quản trị | [admin-user-filter.vi.md](admin-user-filter.vi.md) | Tìm kiếm (tên, handle, email) và lọc vai trò trên bảng người dùng `/quan-tri`, phía client |
| Xóa địa điểm trong quản trị | [admin-place-delete.vi.md](admin-place-delete.vi.md) | Nút "Xóa địa điểm" ở `/admin/content/places/[slug]` chỉ cho admin và super admin; `content:delete`, hộp xác nhận, 409 `place_in_use` kèm số đếm (CORE-10) |
| Tự động deploy lên dev | [auto-deploy-dev.vi.md](auto-deploy-dev.vi.md) | Workflow `deploy-dev`: `main` xanh build image, runner tự host trên VM deploy, health probe và rollback (ADR 0016) |
| Đánh giá cộng đồng | [community-reviews.vi.md](community-reviews.vi.md) | Đánh giá địa điểm của người đi: viết trong Planner thì được duyệt, khách viết ở trang chủ thì lên ngay và staff gỡ được; tự khai, văn bản thuần (ADR 0014, PR 2) |
| Thêm điểm đến | [more-destinations.vi.md](more-destinations.vi.md) | Tám điểm đến chưa đi (chỉ mô tả khách quan), địa điểm nổi tiếng cho chúng và cho bốn điểm đến cũ, lệnh bổ sung `content:seed-places` |
| Địa điểm công khai | [places.vi.md](places.vi.md) | Trang địa điểm tại `/dia-diem/[slug]` (`/en/places/[slug]`) và mục Địa điểm trên mỗi điểm đến; mọi địa điểm trong catalogue đều công khai; review chỉ đọc (ADR 0026) |
| Sự kiện kiểm duyệt | [moderation-events.vi.md](moderation-events.vi.md) | Log kiểm toán chỉ-nối-thêm cho mọi hành động cộng đồng (listing, đánh giá, restriction), ghi trong cùng transaction; route staff đọc; lưu 1 năm; gồm máy trạng thái kiểm duyệt (ADR 0019) |
| Báo cáo nội dung cộng đồng | [community-reports.vi.md](community-reports.vi.md) | Người đọc (khách hoặc thành viên) báo cáo chuyến hoặc đánh giá công khai; staff bỏ qua hoặc đánh dấu đã xử lý trong hàng đợi admin, mỗi lần xử lý một sự kiện kiểm toán (batch 10.5) |
| Điều khoản Người tạo | [creator-terms.vi.md](creator-terms.vi.md) | Thành viên chấp nhận phiên bản Điều khoản Người tạo hiện hành trước khi yêu cầu đăng chuyến hoặc đánh giá Planner được nhận; ghi theo phiên bản, có sự kiện; đọc và rút không bị chặn (ADR 0019 §4) |
| Giới hạn ghi dùng chung | [shared-write-limiter.vi.md](shared-write-limiter.vi.md) | Giới hạn ghi đánh giá (5/giờ mỗi user, 10/giờ mỗi khách) đếm trong PostgreSQL để restart và nhiều instance dùng chung; database sập → 503, không ghi đánh giá (ADR 0019 §3) |
| Chuyến đi cộng đồng | [community-trips.vi.md](community-trips.vi.md) | Chuyến đi công khai hiện trên trang chủ và `/chuyen-di-cong-dong` sau khi chủ chuyến đồng ý và staff duyệt; mọi sửa đổi xếp lại hàng; tác giả hiện tên hoặc ẩn danh (ADR 0014, PR 1) |
| Trình sửa chuyến đi | [trip-editor.vi.md](trip-editor.vi.md) | Sửa trip ở `/my-trips/[id]`: thông tin chung, ngày, hoạt động (thêm, sửa, xoá, sắp xếp, chuyển ngày), khoản chi; mọi thao tác ghi đều gửi `If-Match` |
| Phát sinh ngân sách khi chia sẻ | [shared-budget-overrun.vi.md](shared-budget-overrun.vi.md) | Trang chia sẻ và trang chủ chuyến hiện tổng dự báo, phần vượt và số tiền mỗi người góp thêm |
| CMS nội dung quản trị | [admin-content-cms.vi.md](admin-content-cms.vi.md) | `/quan-tri/noi-dung/...` — biên tập viên và admin sửa chuyến đi, địa điểm, đánh giá với vi/en song song, xuất bản và duyệt (ADR 0011) |
| Trang Travel công khai từ kho nội dung | [public-travel-cms.vi.md](public-travel-cms.vi.md) | Trang chủ, chuyến đi, điểm đến và sitemap đọc chuyến đi đã xuất bản từ kho nội dung, động, nên sửa trong CMS hiện ngay ở request kế tiếp (ADR 0012) |
| Tài khoản trên header | [header-account.vi.md](header-account.vi.md) | Biểu tượng đăng nhập cho khách, menu tài khoản (Chuyến đi của tôi, mật khẩu, quản trị, đăng xuất) cho thành viên, trên máy tính và điện thoại |
| Continue Planning trên trang chủ | [home-continue-planning.vi.md](home-continue-planning.vi.md) | Dải phía trên hero cho thành viên đã đăng nhập: tạo chuyến đầu tiên, hoặc Continue Planning chuyến chưa xong kế tiếp; khách thấy trang không đổi |
| Tạo chuyến đi trống | [create-blank-trip.vi.md](create-blank-trip.vi.md) | `/my-trips/new` — nút và biểu mẫu tạo chuyến đi trên Chuyến đi của tôi, `source: "blank"` |
| Docker deploy trên một VM | [docker-deploy.vi.md](docker-deploy.vi.md) | Runbook: nginx + app + PostgreSQL tuỳ chọn, trạng thái bind mount, chuẩn bị host, sao lưu |
| Tài khoản super admin | [super-admin-accounts.vi.md](super-admin-accounts.vi.md) | Role `super_admin` (ADR 0017): chỉ nó mở được Runbook, admin không quản lý được tài khoản admin |
| Đăng nhập bằng handle | [handle-sign-in.vi.md](handle-sign-in.vi.md) | Đăng nhập bằng email hoặc mã tài khoản; cấp lại mật khẩu không cần email (ADR 0018) |
| Runbook cho admin | [admin-runbook.vi.md](admin-runbook.vi.md) | `/quan-tri/runbook` — tab chỉ super admin, hiển thị danh sách API và các hướng dẫn vận hành từ `docs/` trên trình duyệt |
| Trình xem nhật ký quản trị | [admin-audit-viewer.vi.md](admin-audit-viewer.vi.md) | `/admin/audit` — đọc log kiểm toán có lọc và phân trang; đổi vai trò, hành động tài khoản và trạng thái bài viết nay ghi sự kiện; `GET /api/admin/audit`, action `audit:read` (P07-13) |
| Trạng thái hệ thống (admin) | [admin-system-status.vi.md](admin-system-status.vi.md) | `/admin/system` — trang chỉ-xem cho super admin: chế độ kho, migration gần nhất, bản dựng, cờ tích hợp, sức khỏe, sao lưu "chưa cấu hình"; `GET /api/admin/system`, action `runbook:read` (P07-17) |
| Người dùng và vai trò (admin) | [admin-users-roles.vi.md](admin-users-roles.vi.md) | `/admin/users/roles` ma trận vai trò chỉ-xem; gỡ liên kết Google và xoay token từ console người dùng; `limit`/`cursor`/`sort` cho `GET /api/admin/planner/users` (P07-12) |
| Bộ sưu tập và toàn vẹn (admin) | [admin-content-collections.vi.md](admin-content-collections.vi.md) | `/quan-tri/noi-dung/bo-suu-tap` và `/toan-ven` — editor sửa bộ sưu tập (`If-Match`, trạng thái xuất bản) và đọc báo cáo toàn vẹn nội dung; admin còn xem báo cáo Planner (P07-15) |
| Lịch trình mẫu (admin) | [admin-content-templates.vi.md](admin-content-templates.vi.md) | `/quan-tri/noi-dung/lich-trinh-mau` — editor sửa mẫu, đổi thứ tự và chuyển hoạt động (`If-Match`), đọc ảnh chụp chuyện nguồn; tạo và xóa vẫn chỉ dùng token (P07-6) |
| Không gian kiểm duyệt (admin) | [admin-moderation-workspace.vi.md](admin-moderation-workspace.vi.md) | `/admin/community` không gian phân loại: số đếm và liên kết nhảy, thứ tự mục cố định, trạng thái rỗng, bố cục thẻ chung, lịch sử từng mục chỉ-đọc (P07-14) |

## Các phase chưa mở

Không phải tính năng, và không được dựng sớm. Xem
[../architecture.vi.md](../architecture.vi.md#các-phase).

| Phase | Đang chờ |
|---|---|
| Bản đồ tuyến theo chuyến (pin và tuyến trong một chuyến) và gợi ý AI | Cố ý hoãn lại theo đề bài đã mở phase Planner |
| Card video bấm được | URL của từng video mà ta chưa có |
| Ảnh thật | Ảnh của chủ nhà |
