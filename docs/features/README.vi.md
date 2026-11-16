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
| Cổng quản trị | [admin-portal.vi.md](admin-portal.vi.md) | `/quan-tri` — danh sách, tạo, đổi vai trò và cấp lại mật khẩu người dùng ngay trên trình duyệt, chỉ cho admin (ADR 0010) |
| Lọc người dùng quản trị | [admin-user-filter.vi.md](admin-user-filter.vi.md) | Tìm kiếm (tên, handle, email) và lọc vai trò trên bảng người dùng `/quan-tri`, phía client |
| Tự động deploy lên dev | [auto-deploy-dev.vi.md](auto-deploy-dev.vi.md) | Workflow `deploy-dev`: `main` xanh build image, runner tự host trên VM deploy, health probe và rollback (ADR 0016) |
| Đánh giá cộng đồng | [community-reviews.vi.md](community-reviews.vi.md) | Đánh giá địa điểm của người đi: viết trong Planner thì được duyệt, khách viết ở trang chủ thì lên ngay và staff gỡ được; tự khai, văn bản thuần (ADR 0014, PR 2) |
| Sự kiện kiểm duyệt | [moderation-events.vi.md](moderation-events.vi.md) | Log kiểm toán chỉ-nối-thêm cho mọi hành động cộng đồng (listing, đánh giá, restriction), ghi trong cùng transaction; route staff đọc; lưu 1 năm; gồm máy trạng thái kiểm duyệt (ADR 0019) |
| Điều khoản Người tạo | [creator-terms.vi.md](creator-terms.vi.md) | Thành viên chấp nhận phiên bản Điều khoản Người tạo hiện hành trước khi yêu cầu đăng chuyến hoặc đánh giá Planner được nhận; ghi theo phiên bản, có sự kiện; đọc và rút không bị chặn (ADR 0019 §4) |
| Giới hạn ghi dùng chung | [shared-write-limiter.vi.md](shared-write-limiter.vi.md) | Giới hạn ghi đánh giá (5/giờ mỗi user, 3/giờ mỗi khách) đếm trong PostgreSQL để restart và nhiều instance dùng chung; database sập → 503, không ghi đánh giá (ADR 0019 §3) |
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

## Các phase chưa mở

Không phải tính năng, và không được dựng sớm. Xem
[../architecture.vi.md](../architecture.vi.md#các-phase).

| Phase | Đang chờ |
|---|---|
| Map và gợi ý AI cho Planner | Cố ý hoãn lại theo đề bài đã mở phase Planner |
| Card video bấm được | URL của từng video mà ta chưa có |
| Ảnh thật | Ảnh của chủ nhà |
