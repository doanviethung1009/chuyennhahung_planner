# Tính năng — Sự kiện kiểm duyệt

🇻🇳 English version: [moderation-events.md](moderation-events.md)

## Summary

Mọi hành động cộng đồng đã có (xin đăng và quyết định chuyến, quyết định đánh giá, restriction) giờ để lại một bản ghi chỉ-nối-thêm, ghi trong cùng transaction của Planner store với thay đổi. Staff đọc được lịch sử của một chuyến, đánh giá hoặc người dùng; không ai sửa hay xoá được. Đây là nền móng (ADR [0019](../adr/0019-community-foundation.vi.md) §1–§2): khách và tác giả không thấy gì đổi.

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `GET /api/admin/community/events?targetId=` | như nhau | như nhau |

Chỉ staff (`community:moderate`: editor, admin, service token), `Cache-Control: no-store`. `400` khi thiếu `targetId`, `401` ẩn danh, `403` member. Trả `{ items, count }`, mới nhất trước, tối đa 200. Không có phương thức ghi.

## Data

`AuditEvent` — `id`, `targetKind` (`trip` | `review` | `user`), `targetId`, `actorId` (≤80), `actorKind` (`user` | `service`), `action`, `fromStatus`, `toStatus`, `reason` (≤500, nullable), `createdAt`. Bảng `audit_events` (migration `0010_audit_events.sql`, rollback tay `db/rollback/0010_audit_events.sql`), khoá JSON `auditEvents`; không khoá ngoại (ADR 0013); index `(target_id, created_at)`.

| Đối tượng | Hành động → từ → đến | Người thực hiện |
|---|---|---|
| trip | `request` mọi trạng thái → `pending`; `withdraw` → `draft`; `approve` `pending` → `published`; `reject` `pending` → `rejected`; `remove` `published` → `removed`; `requeue` `published` → `pending` (do sửa) | chủ chuyến / staff / `service` |
| trip | `withdraw` → `draft`, lý do `implicit_end` (rời `public`, lưu trữ, thu hồi link) | `system` (`service`) |
| review | `approve`, `reject`, `hold`, `remove`; `republish` `held` → `approved` (tác giả sửa) | staff / tác giả |
| review | `erase` (ADR 0024 §8) mọi trạng thái → `removed`; lý do chỉ là chữ của staff, không bao giờ là nội dung đã xóa hay khóa; khi xóa, `reason` của các event cũ về review và về hạn chế của khách đó cũng bị bỏ trống — ngoại lệ duy nhất của chỉ-ghi-thêm, chỉ phần lý do (`redactEventReasons`) | admin / `service` |
| review | `guest_limit` (không đổi trạng thái; actor `system`; tối đa một lần mỗi giờ) khi khách chạm giới hạn đánh giá theo giờ | route |
| user | `restrict` → `active`; `lift` `active` → `lifted` (cả khi xoá tài khoản, actor `account deleted`) | staff / `service` |

Tên trạng thái theo máy trạng thái kiểm duyệt `src/server/community/submission.ts` (ADR 0019 §1): `draft`, `pending`, `approved`, `published`, `rejected`, `removed` đang được lưu; `changes_requested`, `unpublished`, `archived` có trong module nhưng chưa lưu. `remove` của staff là `removed` trong module và `rejected` trong listing đã lưu.

Dữ liệu cá nhân: id người thực hiện và lý do có thể trích lời người dùng. Không bao giờ có email, nội dung đánh giá hay guest key; `targetId` của restriction khách là id restriction.

## How it works

`appendEvent(data, event, { id, at })` trong `src/server/community/events.ts` thêm một dòng vào `data.auditEvents` bên trong callback `transaction` của từng phương thức repository, nên sự kiện và thay đổi cùng commit hoặc cùng rollback. Hành động lỗi (sai trạng thái, bị cấm, validation) ném lỗi trước commit nên không ghi gì; no-op idempotent (rút khi không có listing, gỡ restriction đã gỡ, thu hồi chuyến vốn đã private) không ghi gì. Tạo đánh giá hiện ngay không phải hành động kiểm duyệt nên không ghi. Repository chỉ có `listEvents(targetId)`; module không có sửa hay xoá. Lưu giữ: mỗi lần ghi thêm sẽ bỏ sự kiện quá 365 ngày (`AUDIT_RETENTION_DAYS`).

## Files

| Đường dẫn | Vai trò |
|---|---|
| `src/server/community/events.ts` | `appendEvent`, `eventsForTarget`, lưu giữ |
| `src/server/planner/schemas.ts` | `auditEventSchema` |
| `src/server/planner/repository.ts` | một lời gọi `record(...)` mỗi hành động; `listEvents` |
| `src/server/planner/store.ts`, `persistence/planner-rows.ts`, `persistence/planner-transfer.ts` | collection, ánh xạ bảng, schema import/export `.strict()` |
| `src/app/api/admin/community/events/route.ts` | route staff đọc |
| `db/migrations/0010_audit_events.sql`, `db/rollback/0010_audit_events.sql` | bảng và rollback |

## Tests

`tests/moderation-events-cases.ts` (dùng chung) chạy trên memory store trong `tests/moderation-events.test.ts` và trên PostgreSQL trong `tests/planner-postgres.integration.test.ts`: mỗi hành động một sự kiện đúng from/to/actor, lỗi và no-op không ghi, throw sau callback không để lại sự kiện hay thay đổi, không có guest key, không có hàm sửa/xoá. Thêm: lưu giữ, giới hạn reason/actor, export/import khứ hồi và file thiếu `auditEvents`; `tests/moderation-events-route.test.ts` (401/403/200/400, `no-store`, không có phương thức ghi); ca Postgres cho đánh giá và restriction (P10-14). Ca PostgreSQL bị bỏ qua khi thiếu `TEST_DATABASE_URL`; CI vẫn chạy.

## Limits and open questions

- Hàng đợi review hiển thị `guest_limit` thành huy hiệu kèm giờ (`guestLimitAt`, gộp vào hàng đợi phía server); các sự kiện khác vẫn chỉ đọc qua route events.
- Thay đổi vai trò, template và quản trị người dùng chưa được ghi; sự kiện báo cáo và điều khoản đến cùng batch của chúng.
- Chiếu dành cho tác giả (chuyến của mình, không lộ người duyệt) cố ý chưa làm: chưa có UI dùng.
- Rollback: gỡ các lời gọi `record` và route, chạy SQL rollback tay. File JSON export có `auditEvents` bị code cũ từ chối (schema `.strict()`): export bằng schema của bản này trước, hoặc xoá khoá đó.
- Nên chạy sec-check về quyền riêng tư của log; chưa chạy.
