# Spec — sản phẩm và các khả năng

🇻🇳 English version: [specs-product.md](specs-product.md)

Chuyện Nhà Hưng để làm gì, ai dùng, hiện cung cấp gì và những quy tắc mọi thay đổi phải giữ. Dòng thời gian và những gì còn mở nằm ở [specs-roadmap.vi.md](specs-roadmap.vi.md); cách dựng nằm ở [architecture.vi.md](architecture.vi.md).

## Mục đích

Một site kể chuyện du lịch ưu tiên tiếng Việt — khẩu hiệu "Đi đâu cũng có chuyện" — kèm Planner lên kế hoạch chuyến đi. Tiếng Việt là sản phẩm, tiếng Anh là bản dịch. Người đọc có thể đọc một chuyện đi, tìm địa điểm trên bản đồ, chép lịch trình thành chuyến đi của mình, lập ngân sách và chia sẻ.

## Ai dùng

| Đối tượng | Nhận được | Thông tin xác thực |
|---|---|---|
| Khách | Chuyện đi, điểm đến, bản đồ, lịch trình, review video, chuyến đi cộng đồng, đánh giá địa điểm của khách | Không |
| Thành viên (người đi) | Mọi thứ trên cộng thêm Chuyến đi của tôi, trình sửa chuyến đi, link chia sẻ, đánh giá của mình | Phiên cookie: mật khẩu, Google, hoặc access token do vận hành viên cấp |
| Biên tập viên | Sửa và xuất bản chuyện đi, địa điểm, đánh giá trong cổng quản trị | Phiên có vai trò `editor` |
| Quản trị viên | Mọi thứ biên tập viên làm, cộng quản lý người dùng và kiểm duyệt cộng đồng; chỉ quản lý tài khoản `member` và `editor` | Phiên có vai trò `admin` |
| Super admin | Mọi thứ quản trị viên làm, cộng Runbook trong trình duyệt và quản lý tài khoản admin | Phiên có vai trò `super_admin` |
| Service principal | Tự động hóa gọi API quản trị; không bao giờ tới trình duyệt | `ADMIN_API_TOKEN` |

Vai trò nằm trên một mô hình người dùng duy nhất và được kiểm bằng hàm thuần `can(identity, action, resource)`; xem [features/admin-roles.vi.md](features/admin-roles.vi.md) và [features/super-admin-accounts.vi.md](features/super-admin-accounts.vi.md).

## Các khả năng

| Mảng | Làm gì | Route (tiếng Việt) | Trạng thái | Tài liệu |
|---|---|---|---|---|
| Chuyện đi chơi | Trang chỉ mục và chi tiết kể chuyện | `/chuyen-di-choi` | Đã xong | [features/stories.vi.md](features/stories.vi.md) |
| Điểm đến | Địa điểm, liên kết chéo với chuyện đi | `/kham-pha` | Đã xong | [features/destinations.vi.md](features/destinations.vi.md) |
| Bản đồ du lịch | Bản đồ SVG với tọa độ thật, không JavaScript phía client | `/ban-do` | Đã xong | [features/travel-map.vi.md](features/travel-map.vi.md) |
| Lịch trình | Kế hoạch theo ngày; URL tour cũ chuyển hướng về đây | `/len-lich-trinh` | Đã xong | [features/itineraries.vi.md](features/itineraries.vi.md) |
| Review video | Thẻ chỉ để xem và nút kênh | `/goc-review` | Đã xong | [features/video-reviews.vi.md](features/video-reviews.vi.md) |
| Thiết kế chuyến đi | Trang chỉ có liên hệ, cố ý không có form | `/thiet-ke-chuyen-di` | Đã xong, chưa nối với Planner | [features/plan-your-trip.vi.md](features/plan-your-trip.vi.md) |
| Đăng nhập | Mật khẩu và Google | `/dang-nhap` | Đã xong | [features/follow-hung-footsteps.vi.md](features/follow-hung-footsteps.vi.md) |
| Chuyến đi của tôi và trình sửa | Tạo, sửa và lập ngân sách chuyến đi; nhân bản chuyện đi | `/chuyen-di-cua-toi` | Đã xong | [features/trip-editor.vi.md](features/trip-editor.vi.md) |
| Link chia sẻ | Xem chỉ đọc kèm dự báo vượt ngân sách | `/chia-se/[token]` | Đã xong | [features/shared-budget-overrun.vi.md](features/shared-budget-overrun.vi.md) |
| Cộng đồng | Chuyến đi công khai và đánh giá của người đi, có kiểm duyệt | `/chuyen-di-cong-dong` | Đã xong | [features/community-trips.vi.md](features/community-trips.vi.md) |
| Cổng quản trị | Người dùng, vai trò, nội dung và kiểm duyệt | `/quan-tri` | Đang làm (Phase 07) | [features/admin-portal.vi.md](features/admin-portal.vi.md) |
| Tab Runbook | Hướng dẫn vận hành ngay trong trình duyệt | `/quan-tri/runbook` | Đã xong, chỉ super admin | [features/admin-runbook.vi.md](features/admin-runbook.vi.md) |

Bản đồ Planner và gợi ý AI chưa có; xem [specs-roadmap.vi.md](specs-roadmap.vi.md#chưa-mở).

## Các bề mặt API

| Bề mặt | Tiền tố | Ai gọi | Hợp đồng |
|---|---|---|---|
| Travel Content | `/api/travel` | Service principal | [travel-content-api.vi.md](travel-content-api.vi.md) |
| Planner | `/api/planner` | Người đi đã đăng nhập | [features/travel-planner-core.vi.md](features/travel-planner-core.vi.md) |
| Admin | `/api/admin` | Phiên nhân sự hoặc service principal | [runbook.vi.md](runbook.vi.md) liệt kê mọi endpoint |
| Cộng đồng | `/api/community` | Khách và thành viên | [features/community-trips.vi.md](features/community-trips.vi.md) |
| Chuyến đi chia sẻ | `/api/shared` | Ai có link | [features/follow-hung-footsteps.vi.md](features/follow-hung-footsteps.vi.md) |
| Sức khỏe | `/api/health` | Vận hành viên và probe | [runbook-api.vi.md](runbook-api.vi.md) |

## Quy tắc mọi thay đổi đều giữ

1. Có cả VI và EN, từ cùng các khóa thông điệp; không chuỗi hiển thị nào chỉ có một ngôn ngữ.
2. Route tour luôn là redirect vĩnh viễn.
3. Design token chỉ định nghĩa một lần, trong `@theme` ở `src/app/globals.css`.
4. Không link giả, không nút chết.
5. Khả năng truy cập: landmark, một `<h1>`, heading có thứ tự, focus nhìn thấy, vùng bấm tối thiểu 44px, `alt` có nghĩa.
6. Một thay đổi đi qua branch và PR, với `typecheck`, `lint` và `test` đạt và kết quả được nêu rõ.
7. Tài liệu được sửa trong cùng thay đổi, ở cả hai ngôn ngữ.

## Dữ liệu và lưu trữ

| Store | Chứa | Biến PostgreSQL | Khi không đặt |
|---|---|---|---|
| Planner | Người dùng, phiên, chuyến đi, ngày, hoạt động, chi phí, đánh giá | `PLANNER_DATABASE_URL` | File JSON, chỉ để phát triển cục bộ |
| Travel Content | Chuyện đi, địa điểm, đánh giá, template | `CONTENT_DATABASE_URL` | File JSON, chỉ để phát triển cục bộ |

Điểm đến, lịch trình và review video là TypeScript có kiểu trong `src/content/`. Cách chạy, migrate và sao lưu hai store nằm ở [usage.vi.md](usage.vi.md) và [deploy-database.vi.md](deploy-database.vi.md).
