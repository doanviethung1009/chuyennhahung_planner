# Spec Admin Workspace — cơ sở dữ liệu, API, RBAC và các cổng

🇻🇳 English version: [specs-admin-workspace-impact.md](specs-admin-workspace-impact.md)

Trạng thái: **Đề xuất** (2026-11-17). Đi kèm [specs-admin-workspace.vi.md](specs-admin-workspace.vi.md);
các ID tính năng `P07-10`…`P07-18` được định nghĩa ở đó và trong
`.claude/contracts/admin-workspace-index.md`. Mọi thay đổi cơ sở dữ liệu, phân quyền, API công
khai hoặc route quan trọng dưới đây cần chủ dự án duyệt kiến trúc trước khi phiên của nó bắt đầu.

## Ảnh hưởng cơ sở dữ liệu

| Tính năng | Thay đổi | Migration |
|---|---|---|
| `P07-10` Shell, `P07-11` Dashboard, `P07-12` Users, `P07-14` Moderation, `P07-15` Collections/Integrity, `P07-17` System | không; đọc store sẵn có | không |
| `P07-13` Audit viewer | đọc `audit_events` từ batch 10.2; có thể thêm index cho bộ lọc actor/ngày, loại sự kiện mới dùng cùng bảng | tối đa một migration index bổ sung, đánh số theo thứ tự merge sau `0010`–`0013` của Phase 10; quyết trong phiên đó khi 10.2 đã merge |
| `P07-16` Create/archive | không; cùng các bảng content (ADR 0013) | không |
| `P07-18` Media | hiện chưa; Phase 08 sở hữu `media_assets` | không |

Không có khóa ngoại giữa các thực thể content (CLAUDE.md quy tắc 6). Cả adapter JSON và
PostgreSQL phải tiếp tục pass; không có gì ở đây ghi loại document mới vào store JSON ngoài các
loại sự kiện mới trong `auditEvents`.

## Ảnh hưởng API

| Endpoint | Thay đổi | Xác thực | Tính năng |
|---|---|---|---|
| `GET /api/admin/overview` | mới, chỉ đọc, `no-store`, số đếm lọc theo action của người gọi | session hoặc service, action staff bất kỳ | `P07-11` |
| `GET /api/admin/planner/users` | bổ sung `limit`, `cursor`, `sort`; mặc định không đổi cho caller cũ | `user:provision` | `P07-12` |
| `GET /api/admin/audit?actor=&targetType=&action=&from=&to=&cursor=` | mới, có phân trang, `no-store` | `audit:read` | `P07-13` |
| `POST /api/admin/travel/stories`, `…/places` | chuyển sang `adminContentRoute` (nhận session) và thêm archive; schema body không đổi | `content:write` | `P07-16` |
| `GET /api/admin/system` | mới, chỉ boolean và định danh | `runbook:read` | `P07-17` |
| Collections, integrity, gỡ Google, rotate-token | không đổi; có màn hình lần đầu | như hiện tại | `P07-15`, `P07-12` |

Mọi handler mới: zod chặt cho query/body, `requireSameOrigin` cho mutation (ADR 0010), phong bì
lỗi dùng chung, không bao giờ trả thông điệp lộ việc bản ghi có tồn tại cho role không được thấy.
Loại bỏ: không có. `docs/runbook.md` liệt kê mọi route handler và `tests/runbook.test.ts` giữ cho
chúng đồng bộ, nên mỗi route mới phải được thêm vào đó.

## Ảnh hưởng RBAC

| Thay đổi | Chi tiết |
|---|---|
| Action mới `audit:read` | `admin`, `super_admin`, `service`. Không cho `editor`: sự kiện trích lý do của người kiểm duyệt, có thể dẫn nguyên văn nội dung người dùng |
| Không thêm action nào khác | System dùng lại `runbook:read` (chỉ super admin); dashboard không cần action, chỉ hiện thẻ mà action của người gọi cho phép |
| Test `ROLE_ACTIONS` | ma trận `tests/planner-roles.test.ts` cập nhật trong cùng PR; trang ma trận role render `ROLE_ACTIONS` và có test fail nếu render thứ khác |
| Không đổi | `canManageRole`, các chốt last-admin, `trip:support-read` vẫn bị từ chối với mọi người |

## Checklist bảo mật

Áp dụng cho mọi phiên tính năng; `/sec-check` là **NOT RUN** tới khi chủ dự án gọi, và được khuyến
nghị sau `P07-13` (đọc dữ liệu cá nhân mới), `P07-16` (route ghi mới) và `P07-17`.

- [ ] Server quyết định quyền truy cập (`requireStaff`, rồi API); sidebar hiện/ẩn chỉ là trang trí.
- [ ] 404 cho role không có quyền vào trang, như hiện nay; không thêm "oracle" 403-so-với-404.
- [ ] Không có `ADMIN_API_TOKEN`, `process.env` hay import `src/server` dưới `src/components/admin` (`tests/admin-portal.test.ts`, `tests/client-boundary.test.ts`).
- [ ] Không có giá trị secret trong response hay trên màn hình; `/admin/system` trả boolean có/không.
- [ ] Mutation cùng origin; secret dùng một lần chỉ ở state React và response `no-store`.
- [ ] Audit viewer: lý do được escape khi render, không email, không guest key, không chất liệu mật khẩu.
- [ ] Giới hạn phân trang áp ở server; bộ lọc được validate, không SQL thô, không quét không giới hạn.
- [ ] Trang admin `noindex`; không thêm gì vào sitemap hay allow-list của `robots`.
- [ ] Rate limit: dùng lại limiter có sẵn; không có module limiter mới.

## Checklist QC

`/qc-check` là **NOT RUN** tới khi chủ dự án gọi. Mỗi phiên báo cáo kiểm tra là PASS kèm output
hoặc NOT RUN.

- [ ] Chạy test tập trung trước, rồi `npm run typecheck`, `npm run lint`, `npm run test` ở cổng tích hợp; `npm run build` trước PR.
- [ ] Mọi chuỗi hiển thị có trong `messages/vi.json` và `messages/en.json` (`tests/i18n.test.ts`).
- [ ] Một `<h1>` mỗi trang, heading theo thứ tự, landmark (`nav`, `main`), focus nhìn thấy, vùng bấm ≥44px, `alt` nơi có ảnh, không `href="#"`.
- [ ] 375 / 768 / 1280px: không cuộn ngang, sidebar dùng được bằng bàn phím.
- [ ] Ma trận role theo route: ẩn danh → đăng nhập kèm `returnTo`; member → 404; editor, admin, super admin → chỉ màn của mình.
- [ ] URL hiện có vẫn hoạt động; allow-list `returnTo` bao gồm đường dẫn mới và vẫn từ chối các biến thể gần giống (`tests/return-to.test.ts`).
- [ ] Cả hai store ở nơi tính năng đọc dữ liệu (ca Postgres bị bỏ qua cục bộ nếu thiếu `TEST_DATABASE_URL`; PR nêu rõ ca nào đã chạy).
- [ ] Tài liệu tính năng hai ngôn ngữ, dòng trong `docs/features/README.*`, `docs/architecture.*` và `.claude/context/project-context.md` được sửa.

## Các cổng của phiên

| Cổng | Ai | Bằng chứng |
|---|---|---|
| Duyệt kiến trúc | chủ dự án | ADR 0020 Accepted; contract từng tính năng `READY`; bắt buộc cho hạng mục cơ sở dữ liệu, `audit:read`, route và API công khai |
| Triển khai | một phiên tính năng, một contract | ghi chú bàn giao ngắn dưới `.claude/contracts/handoff/` |
| QC và bảo mật | chủ dự án gọi `/qc-check`, `/sec-check` | verdict được trích trong PR |
| Architect review | phiên architect | diff khớp phạm vi file của contract |
| Merge | chủ dự án | không phiên nào tự merge PR của mình |
