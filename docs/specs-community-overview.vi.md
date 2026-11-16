# Spec Community Platform — tổng quan

🇻🇳 English version: [specs-community-overview.md](specs-community-overview.md)

Thuộc bộ spec Community Platform. Trạng thái: **Đề xuất** — chưa có gì được xây. Ngày:
2026-11-16. Các spec liên quan: [kiến trúc](specs-community-architecture.vi.md) ·
[cơ sở dữ liệu](specs-community-database.vi.md) · [API](specs-community-api.vi.md) ·
[frontend](specs-community-fe.vi.md) · [media](specs-community-media.vi.md) ·
[kiểm duyệt](specs-community-moderation.vi.md) · [bảo mật](specs-community-security.vi.md) ·
[QC](specs-community-qc.vi.md) · [roadmap](specs-community-roadmap.vi.md). Ghi chú định
hướng hẹp hơn trước đó là [specs-planner-personalization.vi.md](specs-planner-personalization.vi.md);
bộ này thay thế nửa cộng đồng của nó và giữ nửa cá nhân hóa.

**Nhãn dùng trong mọi spec:** **[C]** đã xác nhận bởi chủ dự án hoặc ADR đã chấp nhận ·
**[P]** đề xuất ở đây, cần quyết định · **[A]** giả định, chưa kiểm chứng trong repository.

## Mục tiêu và phạm vi

### Tầm nhìn

Phát triển Chuyện Nhà Hưng từ blog du lịch cộng Planner thành một cộng đồng được tuyển
chọn, nơi người đi lên kế hoạch riêng tư, đăng nhật ký và vlog, khám phá chuyến của
người khác, sao chép một chuyến về tài khoản mình, và theo dõi các tác giả họ tin. Thương
hiệu vẫn ở trung tâm: tuyển chọn, ấm áp, tiếng Việt trước.

### Trong phạm vi

Chuyến công khai/riêng tư, nội dung nháp/đã đăng, sao chép cá nhân có ghi công, bài
nhật ký / blog / vlog, media, hồ sơ, theo dõi, thích, lưu, bình luận, báo cáo, tìm kiếm và
khám phá, thông báo, kiểm duyệt tuyển chọn, và các phase để giao chúng.

### Ngoài phạm vi

Vị trí trả phí hay quảng bá, tin nhắn riêng, phát trực tiếp, chợ, lọc cộng tác trên dữ
liệu hành vi, bản đồ Planner và gợi ý AI (cả hai vẫn đóng, xem
[roadmap](specs-roadmap.vi.md#chưa-mở)), và mọi thay đổi với Phase 00–09.

## Yêu cầu

### Các quyết định đã xác nhận

| Hạng mục | Quyết định | Nhãn |
|---|---|---|
| Kiểm duyệt | Tuyển chọn: nội dung công khai dài được duyệt trước khi lên | [C] |
| Phạm vi duyệt | Tuyển chọn cho chuyến, nhật ký, blog, vlog. Đánh giá địa điểm ngắn giữ ADR [0014](adr/0014-community-trips-and-reviews.vi.md)/[0015](adr/0015-community-review-author-controls.vi.md): lên ngay, nhân viên gỡ | [C] 2026-11-16 |
| Media | Lai: lưu ảnh nội bộ, video dùng nền tảng ngoài | [C] |
| Sao chép | Cá nhân: bản sao độc lập thuộc người sao chép | [C] |
| Triển khai | Theo phase, không đồng loạt | [C] |
| Agent | Mặc định một agent, tối đa hai cùng lúc, ngữ cảnh hẹp | [C] |
| Định danh roadmap | Phase 00–09 trong `.claude/roadmap/PHASES.md` giữ nguyên (05 Story sang Planner, 06 AI Planner, 07 Admin, 08 Media, 09 Production); công việc cộng đồng là **Phase 10–15** (PR #107); C1–C7 chỉ là nhóm spec, xem [roadmap](specs-community-roadmap.vi.md) | [C] |

### Yêu cầu chức năng

| ID | Yêu cầu | Nhãn |
|---|---|---|
| F1 | Chuyến mặc định riêng tư; chủ chuyến có thể chia sẻ link và tách biệt xin đăng lên cộng đồng | [C] (ADR 0005, 0014) |
| F2 | Nội dung đã đăng có tác giả, máy trạng thái và đường gỡ bài | [P] |
| F3 | "Dùng chuyến này" sao chép chuyến đã đăng thành bản nháp riêng; không đồng bộ ngược | [C] |
| F4 | Bài nhật ký, blog, vlog với rich text và media | [P] |
| F5 | Hồ sơ, theo dõi/bỏ theo dõi, thích, lưu, bình luận, báo cáo | [P] |
| F6 | Tìm kiếm, lọc và khám phá nội dung đã đăng | [P] |
| F7 | Thông báo trong ứng dụng (từ Phase 15) | [P] |
| F8 | Nhân viên duyệt, từ chối, yêu cầu sửa, gỡ đăng và xóa được | [P], mở rộng ADR 0014 |

### Yêu cầu phi chức năng

| ID | Yêu cầu | Nhãn |
|---|---|---|
| N1 | Tiếng Việt trước; mọi chuỗi có VI và EN; tìm được tiếng Việt không dấu | [C] |
| N2 | Chạy trên stack Docker một VM hiện có với VM PostgreSQL riêng; ngân sách RAM 16 GB | [A] |
| N3 | Không theo dõi mới, không analytics bên thứ ba | [P] |
| N4 | Server component mặc định; không thêm dependency runtime nếu chưa có ADR | [C] (CLAUDE.md) |
| N5 | Mọi projection công khai là danh sách cho phép có test | [C] (ADR 0005, 0014) |
| N6 | Mỗi phase đảo ngược được: dữ liệu lưu vẫn nằm yên khi gỡ route | [C] (ADR 0014) |

## Đánh giá repository

Đọc ngày 2026-11-16 từ `main` (e362aea); đường dẫn là thật.

| Khu vực | Phát hiện | Bằng chứng |
|---|---|---|
| Stack | Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, next-intl 4, zod 4, `pg`. Dependency runtime chỉ gồm `next next-intl pg react react-dom zod` | `package.json` |
| Rich text, upload, xử lý ảnh | **Không có.** Không editor, không SDK lưu trữ, không thư viện ảnh. Ảnh remote chỉ cho `images.unsplash.com` | `package.json`, `next.config.ts:53` |
| Kho dữ liệu | Kho Planner (user, session, chuyến, đánh giá) và kho Travel Content; mỗi kho chạy PostgreSQL hoặc file JSON; không khóa ngoại | ADR 0009, 0013; `db/migrations/0001`–`0009` |
| Danh tính | Cookie session; đăng nhập mật khẩu, Google, handle; vai trò `member/editor/admin/super_admin`; hàm `can()` thuần | `src/server/identity/permissions.ts`, ADR 0006/0007/0017/0018 |
| Kiểm duyệt | `community:moderate` từ editor trở lên; `community:restrict` từ admin trở lên; không có vai trò `moderator` | `permissions.ts:12-50` |
| Cộng đồng hiện tại | Đăng chuyến (`none/pending/approved/rejected`), đánh giá địa điểm, hạn chế đánh giá, hàng đợi nhân viên | ADR 0014/0015, migration `0005`–`0008` |
| Chia sẻ | `visibility`, share token, danh sách cho phép `SharedTripView`, `duplicateTrip` (chỉ chuyến của chính chủ) | ADR 0005, `repository.ts:1329` |
| Giới hạn tốc độ | Trong bộ nhớ, theo tiến trình; khóa client là header chuyển tiếp, giả mạo được trừ khi proxy ghi đè (nginx ghi đè đã cấu hình và có test trong `tests/deploy-config.test.ts`, cấu hình thật trên VM còn phải xác nhận, P10-12) | `src/server/rate-limit.ts`, ADR 0005 |
| Thông báo, theo dõi, thích, bình luận, báo cáo, tìm kiếm | **Không có** | grep trên `src`, `db/migrations` |
| Bộ gửi email | **Không có** (chặn đặt lại mật khẩu qua email và thông báo email) | [specs-roadmap.vi.md](specs-roadmap.vi.md#chưa-mở) |
| Cổng đóng góp | **Mở**: điều khoản và liên hệ gỡ bài đã được điền; PR #107 Q8 nhờ chủ dự án xác nhận liên hệ là hộp thư có người theo dõi | `contributionOpen`, `src/content/site.ts:102` |
| Triển khai | Docker, nginx, VM app và VM PostgreSQL riêng; auto deploy đã chạy đầu-cuối trên dev VM (báo cáo 2026-11-15, trước PR #93–#105) | [deploy-runbook.vi.md](deploy-runbook.vi.md), ADR 0016 |
| Cloudflare Tunnel, Proxmox | Không có trong repository; lấy từ brief của chủ dự án | [A] |

## Phân tích khoảng trống

| Nhu cầu | Đã có | Khoảng trống |
|---|---|---|
| Đăng một chuyến | Đăng, nhân viên duyệt, xếp hàng lại khi sửa | Phân biệt nháp/đã đăng, `changes_requested`, tác giả gỡ đăng |
| Dùng chuyến của người khác | Sao chép từ story/template; nhân bản chuyến của mình | Sao chép từ chuyến cộng đồng đã đăng, có ghi công |
| Nhật ký, blog, vlog | Chỉ story do nhân viên sửa | Thực thể mới thuộc người dùng, editor, renderer, kiểm duyệt |
| Media | Cover SVG sinh tự động, Unsplash | Pipeline upload, object storage, thumbnail, hạn mức, quét |
| Hồ sơ, theo dõi, thích, lưu, bình luận | `displayName`, `handle` | Toàn bộ, cộng báo cáo và thông báo |
| Vai trò `moderator` | Editor giữ `community:moderate` | Vai trò riêng cần ADR (ADR 0006 đã hoãn) |
| Giới hạn tốc độ dùng chung | Theo tiến trình | Kho dùng chung trước khi có nhiều instance hoặc ghi dễ bị lạm dụng |
| Nhật ký kiểm toán | Không | `audit_events` (Phase 10, P10-1); đồng thời đóng khoảng trống audit log |
| Tìm kiếm | Không | Full-text Postgres với khớp tiếng Việt không dấu |

## Phụ thuộc và bảo mật

Phụ thuộc: trình soạn chuyến (Phase 04), chia sẻ và sao chép (Phase 05), lưu trữ PostgreSQL (mọi bảng mới),
vai trò Phase 07 và cổng quản trị (hàng đợi kiểm duyệt), cổng đóng góp (phải còn mở). Chi
tiết bảo mật ở [bảo mật](specs-community-security.vi.md); rủi ro nổi bật là HTML do người
dùng viết (giải pháp: block có cấu trúc, không bao giờ HTML thô), siêu dữ liệu ảnh lộ GPS
(giải pháp: xóa EXIF khi mã hóa lại), và bộ giới hạn theo tiến trình (giải pháp: limiter ghi dùng chung ở Phase 10).

## Kịch bản kiểm thử

Thuộc [QC](specs-community-qc.vi.md). Nghiệm thu mức tổng quan: khi chưa có dữ liệu cộng đồng mới, mọi trang hiện có hoạt động như trên `main`.

## Câu hỏi còn mở

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| 1 | Hiện có Cloudflare Tunnel đứng trước app không, và Proxmox có phải host duy nhất? | Xác nhận; thiết kế media giả định cả hai |
| 2 | Chính sách handle nào áp cho hồ sơ công khai (ADR 0018)? | Slug công khai riêng, tự nguyện |
| 3 | Chủ dự án muốn vai trò `moderator` ngay hay dùng editor ở các phase đầu? | Editor tới Phase 15 |
