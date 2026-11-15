# Báo cáo kiểm thử deploy — VM 192.168.100.140

Ngày: 2026-11-15 · Người chạy: Claude (từ máy dev + SSH `ubuntu`, chỉ đọc)

## Kết luận
Deploy **đang hoạt động đúng flow**. Một thiếu sót: **chưa có sao lưu**. Rollback và deploy lại đã chạy thật, đạt. Admin/Planner thủ công chưa chạy.

## Đã kiểm tra (PASS)

| # | Kiểm tra | Kết quả |
|---|---|---|
| 1 | 5 lần chạy **Deploy dev** gần nhất (`gh run list`) | cả 5 `success` |
| 2 | Commit đang deploy so với `origin/main` | lần chạy mới nhất ở `0216f46` = đầu `main` → VM khớp `main` |
| 3 | `GET /api/health` | 200 `{"status":"ok"}` |
| 4 | Smoke test 11 route (`/`, `/en`, `/chuyen-di-choi`, `/kham-pha`, `/ban-do`, `/len-lich-trinh`, `/thiet-ke-chuyen-di`, `/dang-nhap`, `/robots.txt`, `/sitemap.xml`, `/api/health`) | tất cả 200 |
| 5 | Header bảo mật trên `/` | có CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| 6 | API admin không token | 401 (đúng, bị chặn) |
| 7 | Content store | `/chuyen-di-choi`, `/kham-pha` trả 200 (có nội dung hay trống: chưa xác nhận) |

## Đã kiểm tra trên VM (SSH `ubuntu`, chỉ đọc)

| # | Kiểm tra | Kết quả |
|---|---|---|
| 8 | `.deployed-tag` | `sha-0216f46…` = đầu `main` (PASS) |
| 9 | Container | app, postgres, nginx đều `healthy`; app chạy image GHCR đúng tag (PASS) |
| 10 | Postgres sống sót qua deploy | postgres start 15:51Z, cũ hơn 4 lần deploy (16:06, 16:17, 16:20, 16:23Z); app được tạo lại 16:23Z → deploy **không** khởi động lại DB (PASS, mục 5 smoke test) |
| 11 | Runner | service `actions.runner.…hung-planner-2-postgres` active (running) (PASS) |
| 12 | Tài nguyên | đĩa 38%, RAM trống ~1.3 GB kể cả cache (PASS) |
| 13 | **Rollback** tới `sha-dc0e432…` (run 43736190345, `workflow_dispatch`, build bị bỏ qua) | run xanh, deploy 24s; `.deployed-tag` đổi, app chạy image cũ, `healthy`, `/api/health` 200 (PASS) |
| 14 | **Deploy lại** `sha-0216f46…` (run 43736275695) | run xanh; `.deployed-tag` và image về `0216f46`, `healthy`, smoke test 11/11 route 200 (PASS) |
| 15 | Postgres qua rollback + deploy lại | `StartedAt` vẫn 15:51:27Z, không bị khởi động lại (PASS) |
| 16 | **Planner qua API** (SSH, chạy trên VM, token admin chỉ nằm trong biến shell) | tạo user test 201 → đăng nhập 201 → tạo chuyến "Test rollback" 201 → đọc lại 200 (PASS) |
| 17 | **Dữ liệu sống sót qua deploy** (run 43738044048, tạo lại `app`) | đăng nhập lại 201, `count: 1`, chuyến "Test rollback" vẫn còn → PostgreSQL ghi bền (PASS) |

## Phát hiện

- **Chưa có cron sao lưu** (không có ở `ubuntu` lẫn `root`) và `/opt/chuyennhahung/backups` đang **trống**.
  Runbook Phase 7 yêu cầu bước này; hiện dữ liệu Planner chưa được sao lưu. (FAIL so với runbook)
- Tên runner là `hung-planner-2-postgres`, khác `cnh-dev-vm` trong runbook. Không ảnh hưởng, đã chạy được.
- Log app có cảnh báo Next.js: `metadataBase` chưa đặt, dùng `http://localhost:3000` cho ảnh Open Graph/Twitter.
  Link chia sẻ mạng xã hội có thể trỏ sai host. Nên rà lại.

## Chưa kiểm tra (NOT RUN)
- Đăng nhập admin trên trình duyệt (`/dang-nhap`, `/quan-tri`)
- Hardening unit, `backup.sh`, khôi phục, xoay vòng secret

## Điểm cần để ý
- Phản hồi có `Strict-Transport-Security` trong khi site chạy HTTP. Trình duyệt bỏ qua header
  này trên HTTP nên chưa gây hại, nhưng nên rà lại khi bật TLS.
- Lần chạy lúc 10:03Z mất 5h50m (nằm `queued` chờ runner, đúng với bài học nhãn `cnh-dev` trong
  runbook). Các lần sau đều dưới 3 phút.
- Xanh ở workflow + `/api/health` không chứng minh migration/Planner chạy tốt (health không chạm DB).
  Cần bước kiểm tra tay Planner ở trên.

## Lưu ý khi test Planner
- `NEXT_PUBLIC_SITE_URL` trên VM là `http://192-168-100-140.nip.io`, **không phải** IP. Request ghi dữ liệu bằng cookie phải gửi `Origin` đúng giá trị này, nếu dùng `http://192.168.100.140` sẽ bị 403 `a cross-site POST is refused`. Runbook nên dùng origin này trong ví dụ.
- Dữ liệu test đã **xóa**: chuyến `trip_e87c87be` (archive 200 rồi purge 204, cần `If-Match: "<version>"`) và user `usr_cc78a71d` (204). File tạm `/tmp/cnh_*` trên VM đã xóa.
- Xóa user bị từ chối 409 khi còn chuyến đi; phải purge chuyến trước.

## Để hoàn tất
1. Thiết lập cron sao lưu (`15 3 * * * cd /opt/chuyennhahung/src/deploy && ./scripts/backup.sh local-db`, chạy bằng root).
2. Bạn tự kiểm tra tay đăng nhập admin và Planner (tạo chuyến đi, tải lại).
