# Feature — Admin system status

🇻🇳 English: [admin-system-status.md](admin-system-status.md)

## Summary

Super admin trả lời các câu hỏi đầu tiên của người vận hành trên một trang: mỗi miền dữ liệu chạy trên kho nào, cơ sở dữ liệu có trả lời không, migration áp dụng gần nhất, bản dựng đang chạy, tích hợp nào đã cấu hình và health probe có đạt không. Chỉ để xem: không nút, không log, không bí mật hay host (P07-17).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/system` | `/quan-tri/he-thong` | `/en/admin/system` |
| `GET /api/admin/system` | giống nhau | giống nhau |

Cả hai cần `runbook:read` (chỉ super admin). Admin và editor nhận `403` từ API và `404` admin quen thuộc từ trang; service token nhận `403` (không có action này); ẩn danh nhận `401`. `Cache-Control: no-store`.

## Data

Không lưu gì. Phản hồi là `SystemStatus` có danh sách cho phép trong `src/server/admin/system.ts`: `planner` và `content` (`store` `postgres|file`, `database` `ok|unreachable|not_applicable`, `lastMigration` là tên tệp hoặc null), `build` (`version`, `buildId`), `integrations` (`googleSignIn`, `adminApiToken`, `siteUrl` dạng boolean; `publicContentSource` `repository|static`), `health` (`ok|failed`), `backups` (luôn `not_configured`).

## How it works

Chế độ kho suy ra từ việc **có mặt** của `PLANNER_DATABASE_URL` / `CONTENT_DATABASE_URL`; URL chỉ được đưa cho một pool `pg` một kết nối chạy `SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1` rồi đóng. Mọi lỗi thành `unreachable`; thông báo của driver không bao giờ được đọc. Tên migration phải khớp mẫu tệp migration. Health probe gọi cùng handler với `/api/health` ngay trong tiến trình. `buildId` là `.next/BUILD_ID` của Next (null nếu không có). Dòng sao lưu là hằng số: chưa có thông tin sao lưu (quyết định D10 của chủ dự án).

## Files

| Path | Role |
|---|---|
| `src/server/admin/system.ts` | trạng thái theo danh sách cho phép và các probe |
| `src/app/api/admin/system/route.ts` | API đọc |
| `src/app/(admin)/[locale]/admin/system/page.tsx`, `src/components/admin/system/system-status.tsx` | trang |
| `src/lib/admin-gate.ts`, `src/i18n/routing.ts`, `messages/*.json` | liên kết sidebar (Vận hành), route, chuỗi (`adminSystem`) |

## Tests

`tests/admin-system.test.ts`: 401/403/200 theo vai trò và service token, `no-store`, tập field cố định, test sentinel (URL cơ sở dữ liệu, khóa Google, URL trang, admin token, đường dẫn kho đặt trong env mà không xuất hiện trong phản hồi), đường DB-down (`unreachable`, không 500, không chữ của driver), hiển thị sidebar và cổng của trang. `runbook.test.ts` giữ bảng API đồng bộ. Chưa kiểm thử: trang trong trình duyệt ngoài lượt thủ công ghi trong PR.

## Limits and open questions

Khi cơ sở dữ liệu của **Planner** hỏng, super admin không đăng nhập được (phiên nằm ở đó), nên trang chỉ vào được khi Planner còn trả lời; sự cố Content hiện là `unreachable`. Sao lưu giữ "chưa cấu hình" tới khi chủ dự án cung cấp thông tin. Khuyến nghị `/sec-check` trước khi merge (rủi ro lộ thông tin).
