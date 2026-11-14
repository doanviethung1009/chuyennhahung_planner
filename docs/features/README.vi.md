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
| Vai trò admin | [admin-roles.vi.md](admin-roles.vi.md) | `role` trên user, `permissions.ts`, `PATCH /api/admin/planner/users/[userId]` để nâng admin đầu tiên |
| Cổng quản trị | [admin-portal.vi.md](admin-portal.vi.md) | `/quan-tri` — danh sách, tạo, đổi vai trò và cấp lại mật khẩu người dùng ngay trên trình duyệt, chỉ cho admin (ADR 0010) |
| Lọc người dùng quản trị | [admin-user-filter.vi.md](admin-user-filter.vi.md) | Tìm kiếm (tên, handle, email) và lọc vai trò trên bảng người dùng `/quan-tri`, phía client |
| CMS nội dung quản trị | [admin-content-cms.vi.md](admin-content-cms.vi.md) | `/quan-tri/noi-dung/...` — biên tập viên và admin sửa chuyến đi, địa điểm, đánh giá với vi/en song song, xuất bản và duyệt (ADR 0011) |
| Trang Travel công khai từ kho nội dung | [public-travel-cms.vi.md](public-travel-cms.vi.md) | Trang chủ, chuyến đi, điểm đến và sitemap đọc chuyến đi đã xuất bản từ kho nội dung, động, nên sửa trong CMS hiện ngay ở request kế tiếp (ADR 0012) |
| Tài khoản trên header | [header-account.vi.md](header-account.vi.md) | Biểu tượng đăng nhập cho khách, menu tài khoản (Chuyến đi của tôi, mật khẩu, quản trị, đăng xuất) cho thành viên, trên máy tính và điện thoại |
| Tạo chuyến đi trống | [create-blank-trip.vi.md](create-blank-trip.vi.md) | `/my-trips/new` — nút và biểu mẫu tạo chuyến đi trên Chuyến đi của tôi, `source: "blank"` |

## Các phase chưa mở

Không phải tính năng, và không được dựng sớm. Xem
[../architecture.vi.md](../architecture.vi.md#các-phase).

| Phase | Đang chờ |
|---|---|
| Giao diện soạn Planner đầy đủ | API lõi đã ship trong [travel-planner-core.vi.md](travel-planner-core.vi.md); luồng clone và chia sẻ nằm ở [follow-hung-footsteps.vi.md](follow-hung-footsteps.vi.md), nhưng sửa ngày, activity và chi phí trong trình duyệt thì chưa làm |
| Map và gợi ý AI cho Planner | Cố ý hoãn lại theo đề bài đã mở phase Planner |
| Card video bấm được | URL của từng video mà ta chưa có |
| Ảnh thật | Ảnh của chủ nhà |
