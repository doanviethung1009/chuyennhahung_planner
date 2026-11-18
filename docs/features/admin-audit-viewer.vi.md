# Tính năng — Trình xem nhật ký quản trị

🇻🇳 English version: [admin-audit-viewer.md](admin-audit-viewer.md)

## Summary

Admin trả lời được "ai đã làm gì, lúc nào" ở một trang. `/admin/audit` liệt kê log kiểm toán chỉ-nối-thêm (batch 10.2) có lọc và phân trang, và các hành động tài khoản, nội dung trước đây không để lại dấu vết nay ghi sự kiện: đổi vai trò, tạo người dùng, đặt lại mật khẩu, khóa và mở khóa, xóa mềm, khôi phục, xóa vĩnh viễn, gỡ liên kết Google, xoay token, xuất bản, gỡ xuất bản và lưu trữ bài viết. Chỉ đọc: không có cách sửa, xóa hay xuất sự kiện (P07-13, đóng giới hạn ADR 0010 "admin nào cũng reset mật khẩu admin khác mà không ghi").

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/admin/audit` | `/quan-tri/nhat-ky` | `/en/admin/audit` |
| `GET /api/admin/audit` | như nhau | như nhau |

Cả hai cần action mới `audit:read` (admin, super admin, service token; **không** có editor). Editor nhận `403` từ API và `404` admin thông thường từ trang. Query: `actor`, `targetType` (`trip` | `review` | `user` | `story`), `action`, `from`, `to` (ngày hoặc ngày-giờ; ngày trần là cả ngày UTC), `limit` (1–100, mặc định 50), `cursor`. Đầu vào sai trả `422`. Phản hồi `{ items, count, nextCursor }`, mới nhất trước, `Cache-Control: no-store`.

## Data

`AuditEvent` giống [moderation-events](moderation-events.vi.md), thêm loại đối tượng `story` (migration `0015_audit_admin_events.sql`: mở rộng check `target_kind` và thêm chỉ mục `(created_at DESC, id DESC)` và `(actor_id, created_at DESC)`; rollback thủ công `db/rollback/0015_audit_admin_events.sql`). Sự kiện admin dùng `targetKind: user` (`targetId` = id tài khoản) hoặc `story` (slug).

| Hành động | Action | Từ → đến |
|---|---|---|
| tạo người dùng | `user_create` | → vai trò |
| đổi vai trò | `role_change` | vai trò cũ → mới |
| đặt lại mật khẩu | `password_reset` | – |
| khóa / mở khóa | `ban` / `unban` | `active` ↔ `banned` |
| xóa mềm / khôi phục | `soft_delete` / `restore` | `active` ↔ `deleted` |
| xóa vĩnh viễn | `purge` | `deleted` (hoặc `active` nếu qua service token) → – |
| gỡ Google | `google_unlink` (chỉ khi có liên kết) | – |
| xoay token | `token_rotate` | – |
| trạng thái bài viết | `publish` / `unpublish` / `archive` | trạng thái → trạng thái |

Người thực hiện là id tài khoản, hoặc `service` với admin token. Không lưu hay trả email, mật khẩu, token hay khóa khách; API thêm handle của người thực hiện để hiển thị. `reason` là văn bản thuần, được escape khi hiển thị.

## How it works

Hành động trên người dùng ghi qua `PlannerRepository.record` **trong cùng transaction** với thay đổi, nên ghi lỗi thì không còn cả hai; hành động không đổi gì hoặc bị từ chối không ghi gì. Trạng thái bài viết nằm ở kho Travel Content, một kho khác, nên sự kiện của nó là lần ghi thứ hai (`recordAdminEvent`) ngay sau khi ghi nội dung thành công: không thể chung transaction, và lỗi giữa hai lần ghi sẽ mất sự kiện (xem giới hạn). Trang là server component với form GET thường (chạy không cần JavaScript, URL chia sẻ được) và gọi cùng `listAuditEvents` như API. Thứ tự `(createdAt, id)` giảm dần nên con trỏ là thứ tự toàn phần, trang không chồng lấn. Action chưa có nhãn (loại cộng đồng cũ) hiển thị như đã lưu.

## Files

| Đường dẫn | Vai trò |
|---|---|
| `src/server/identity/permissions.ts` | action `audit:read` |
| `src/server/planner/repository.ts` | ghi sự kiện, `listAuditEvents`, `recordAdminEvent`, hàm con trỏ |
| `src/server/planner/schemas.ts` | loại đối tượng `story` |
| `src/app/api/admin/audit/route.ts` | API đọc |
| `src/app/api/admin/travel/stories/[slug]/status/route.ts` | sự kiện bài viết |
| `src/app/(admin)/[locale]/admin/audit/page.tsx`, `src/components/admin/audit/audit-table.tsx` | trang, form lọc, bảng |
| `src/lib/admin-gate.ts`, `src/i18n/routing.ts`, `messages/*.json` | cổng, link sidebar, route, chuỗi (`adminAudit`) |
| `db/migrations/0015_audit_admin_events.sql` | check loại và chỉ mục |

## Tests

`tests/admin-audit-cases.ts` (chạy trên memory; trên PostgreSQL qua `planner-postgres.integration.test.ts` khi có DB test): mỗi hành động một sự kiện, không có khi không đổi hoặc lỗi, rollback cùng thay đổi, không có email/mật khẩu/token trong sự kiện, lọc và con trỏ. `tests/admin-audit.test.ts`: 401/403/200 theo vai trò, `no-store`, validate `422`, phân trang xác định, không lộ bí mật trong phản hồi, sự kiện bài viết, không có đường HTML thô trong trang. `planner-roles.test.ts` (ma trận), `admin-portal.test.ts` (sidebar), `admin-layout.test.ts` (editor 404), `runbook.test.ts`, `i18n.test.ts`. Không test: trang render trong trình duyệt ngoài lượt kiểm tay 375/768/1280 ghi trong PR.

## Limits and open questions

Sự kiện bài viết không cùng transaction với ghi nội dung. Địa điểm chưa có trạng thái xuất bản nên chưa có sự kiện địa điểm; đổi trạng thái bộ sưu tập và đánh giá chưa được ghi (ngoài hợp đồng). Route gỡ Google và xoay token chỉ nhận token nên người thực hiện là `service`. Kho JSON lọc trong bộ nhớ, đủ với khối lượng lưu một năm. Lưu giữ vẫn 1 năm (10.2). Sự kiện báo cáo và điều khoản chờ 10.4/10.5. Khuyến nghị chạy `/sec-check` trước khi merge (đọc dữ liệu cá nhân mới).
