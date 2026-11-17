# Tính năng — Báo cáo nội dung cộng đồng

🇻🇳 English version: [community-reports.md](community-reports.md)

## Summary

Bất kỳ người đọc nào, có hay không có tài khoản, đều có thể báo cáo một **chuyến đi cộng đồng công khai** hoặc một **đánh giá đang hiển thị** với lý do chọn từ danh sách cố định và ghi chú tùy chọn. Staff xem báo cáo ở trang cộng đồng trong admin, đóng từng báo cáo là *bỏ qua* hoặc *đã xử lý*, và mỗi lần đóng đều được ghi lại. **Không** cần chấp nhận Điều khoản Người tạo để báo cáo. Batch 10.5 của ADR [0019](../adr/0019-community-foundation.vi.md); quyết định D7 của chủ dự án (cả chuyến và đánh giá đều báo cáo được).

Chưa làm: tự ẩn theo số báo cáo, báo lại cho người báo cáo, kháng nghị, bình luận hoặc nhật ký làm đích, vai trò moderator, hạn chế người dùng từ màn báo cáo.

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `POST /api/community/reports` | giống | giống |
| `GET /api/admin/community/reports?status=` | giống | giống |
| `POST /api/admin/community/reports/[id]/resolve` | giống | giống |

`POST /api/community/reports` — body `{ targetKind: 'trip' | 'review', shareToken | targetId, reason, note?, website? }`, chặt (thừa khóa → `422`). Chuyến gọi bằng `shareToken` công khai, đánh giá bằng `id` công khai. `reason` là một trong `spam`, `harassment`, `personal_data`, `copyright`, `misleading`, `other`; `note` ≤ 500, văn bản thường. Trả `201 { ok: true }`, `no-store`.
- Thành viên chỉ được nhận diện khi request cùng origin (`Sec-Fetch-Site` vắng hoặc `same-origin`), để trang khác không báo cáo thay họ; nếu không, báo cáo tính là của khách.
- Giới hạn: 10 mỗi ngày theo id thành viên, hoặc theo client key với khách (`WRITE_LIMITS.report`, bộ giới hạn async dùng chung, kiểm trước khi ghi): `429` kèm `Retry-After`. Cơ sở dữ liệu của bộ giới hạn lỗi → `503` và không lưu gì (fail closed).
- Honeypot: `website` có giá trị → trả `201`, không lưu.
- Đích không tồn tại, không công khai, đã gỡ hoặc bị hạn chế đều là một `404 not_found` (không lộ sự tồn tại). Báo cáo mở trùng của cùng người trên cùng đích bị bỏ qua âm thầm và vẫn trả `201`.

`GET /api/admin/community/reports` — `community:moderate`, `no-store`; `?status=open|actioned|dismissed` (bỏ trống = tất cả; giá trị khác → `400`). Mỗi mục: `id`, `targetKind`, `targetId`, `targetLabel`, `targetLive`, `reason`, `note`, `status`, `signedIn`, `createdAt`, `handledAt`, `handledBy`, `handlerReason`. Không bao giờ có id người báo cáo, client key hay share token.

`POST …/[id]/resolve` — `community:moderate`; body `{ outcome: 'dismissed' | 'actioned', reason }` (reason 3–500, chặt). `actioned` chỉ đánh dấu báo cáo: gỡ nội dung vẫn là thao tác gỡ hiện có. Idempotent với cùng kết quả (không thêm sự kiện), `409 invalid_state` với kết quả khác, `404` nếu id không có. Ghi một sự kiện trên **chuyến hoặc đánh giá bị báo cáo** (`report_dismissed` / `report_actioned`, `fromStatus` là `open`).

## Data

`Report` — `id` (`rpt_…`), `reporterId` (thành viên) hoặc `null`, `clientKey` (khách: `HMAC-SHA256(GUEST_KEY_SECRET, client key)` cắt 32 hex, ADR 0024; `null` với thành viên và bị xóa về `null` sau 30 ngày kể từ lúc báo cáo, bản báo cáo vẫn giữ), `targetKind`, `targetId` (id chuyến hoặc id đánh giá; share token được giải mã ở server và không bao giờ lưu), `reason`, `note`, `status`, `createdAt`, `handledAt`, `handledBy`, `handlerReason`. Bảng `reports` (migration `0013_reports.sql`, rollback thủ công `db/rollback/0013_reports.sql`), khóa JSON `reports`, chỉ mục `(status, created_at)`, không khóa ngoại (ADR 0013). Dữ liệu cá nhân: id thành viên hoặc khóa đã băm, và ghi chú tự do (không bao giờ ghi log). Xóa vĩnh viễn tài khoản sẽ xóa báo cáo của thành viên đó. Code cũ từ chối file JSON export có `reports` (`.strict()`).

`PublicCommunityReview` có thêm `id` (id ngẫu nhiên `rev_…` của đánh giá, không cá nhân) để người đọc chỉ đúng đánh giá. Đây là thay đổi duy nhất của một bản chiếu công khai; `tests/community-reviews.test.ts` ("keeps the public projection") nay liệt kê `id` trong các khóa.

Thời gian giữ bộ đếm của bộ giới hạn dùng chung tăng từ 2 giờ lên 48 giờ để cửa sổ 24 giờ vừa (`COUNTER_RETENTION_MS`, `src/server/persistence/postgres-rate-limiter.ts`).

## How it works

`PlannerRepository.createReport` chạy trong một transaction của kho: xác định đích (chuyến phải đang active, công khai, listing đã duyệt; đánh giá phải đã duyệt và không bị ẩn bởi hạn chế), bỏ báo cáo mở trùng, rồi thêm dòng. `listReports` xếp báo cáo mở trước (cũ nhất trước), rồi đã đóng (mới nhất trước), tối đa 200, và đặt `targetLive: false` khi đích đã gỡ hoặc không còn công khai, để giao diện staff cho thấy không còn gì để xử lý. `resolveReport` ghi cập nhật báo cáo và sự kiện trong một transaction qua `appendEvent`.

Giao diện: `src/components/reports/report-button.tsx` — nút thật (≥44px) mở `<dialog>` modal gốc (trình duyệt giữ focus trong hộp thoại, Escape đóng, focus quay về nút), `<select>` lý do, `<textarea>` ghi chú, honeypot ẩn, thông báo trạng thái. Nút nằm trên mỗi thẻ chuyến cộng đồng (anh em với liên kết thẻ, không nằm trong) và trên mỗi đánh giá. Admin: `src/components/admin/community/report-queue.tsx`, một mục trên `/admin/community` dưới hàng đợi đánh giá, có bộ lọc trạng thái và ô ghi chú quyết định cho mỗi báo cáo đang mở. Chuỗi: `communityReports` và `adminReports` trong `messages/vi.json` và `messages/en.json`.

## Files

| Đường dẫn | Vai trò |
|---|---|
| `src/server/planner/{schemas,store,repository}.ts` | `reportSchema`, body, `createReport`, `listReports`, `resolveReport`, `PublicCommunityReview.id` |
| `src/server/persistence/{planner-rows,planner-transfer}.ts`, `postgres-rate-limiter.ts` | ánh xạ bảng, import/export chặt, thời gian giữ |
| `src/server/{rate-limit.ts,planner/instance.ts}` | bộ giới hạn `report` |
| `src/app/api/community/reports/route.ts`, `src/app/api/admin/community/reports/**` | routes |
| `src/components/reports/report-button.tsx`, `src/components/admin/community/report-queue.tsx`, thẻ chuyến, danh sách đánh giá, trang admin | giao diện |
| `db/migrations/0013_reports.sql`, `db/rollback/0013_reports.sql` | bảng và rollback |

## Tests

`tests/community-reports-cases.ts` (dùng chung) chạy trên kho memory trong `tests/community-reports.test.ts` và trên PostgreSQL trong `tests/planner-postgres.integration.test.ts` (bỏ qua nếu không có `TEST_DATABASE_URL`; CI chạy): khách và thành viên, chuyến và đánh giá, không lưu hay trả token / client key, đích không tồn tại và không công khai, trùng, xử lý một lần với một sự kiện, đánh giá đã gỡ không còn xử lý được, xóa tài khoản. `tests/community-reports-routes.test.ts`: `201`, no-store, cross-site coi như khách, `404` giống nhau, `422`, honeypot, `429` + `Retry-After`, staff `401`/`403`/`200`, resolve idempotent với một sự kiện. `tests/community-reports-fail-closed.test.ts`: bộ giới hạn lỗi → `503`, không lưu gì. Test bản chiếu công khai chỉ đổi vì `id`; `tests/planner-rows.test.ts` liệt kê bảng mới trong thứ tự xóa.

## Limits and open questions

- **Quyền riêng tư của khóa khách (ADR 0024, batch 10.6b).** `clientKey` của khách là băm có khóa, bị xóa sau 30 ngày bởi lượt dọn trong các giao dịch ghi sau đó. Thiếu `GUEST_KEY_SECRET` thì báo cáo của khách trả `503` và không lưu. Địa chỉ thô trong log nginx nằm ngoài ứng dụng.
- Giới hạn của khách dựa trên `x-forwarded-for`, client có thể giả mạo (batch 10.6a đã ghim hành vi sau nginx của repo, nơi nó không giả được; cấu hình thật trên VM là việc chủ dự án kiểm, D10); quy tắc chống trùng theo người báo cáo cũng dùng cùng khóa.
- Không có ngưỡng, không báo lại người báo cáo, không kháng nghị. Báo cáo về mục đã gỡ vẫn nằm trong danh sách và được đánh dấu không còn xử lý được.
- Rollback: gỡ nút và các route; chạy SQL rollback bằng tay; các dòng đã lưu vô hại, và `id` của đánh giá để lại cũng không sao.
- Khuyến nghị `/sec-check` (đường ghi ẩn danh, dữ liệu cá nhân trong ghi chú), chưa chạy.
- Giao diện ở 375 / 768 / 1280 chưa được kiểm tra trong trình duyệt.
