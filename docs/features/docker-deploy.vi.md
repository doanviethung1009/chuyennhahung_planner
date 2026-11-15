# Tính năng — Deploy bằng Docker trên một VM

🇬🇧 English version: [docker-deploy.md](docker-deploy.md)

## Mục đích

Chủ nhà chạy được cả site trên một VM Linux bằng Docker Compose: nginx đứng trước,
app Next.js phía sau, và PostgreSQL nằm trong cùng stack hoặc trên VM khác. Mọi trạng
thái — content store, cluster PostgreSQL, log, bản sao lưu — là **bind mount** dưới
`/opt/chuyennhahung`, nên thấy được trên host và không mất khi `docker compose down -v`.
Tài liệu này là runbook từng bước; phần tham chiếu nằm ở
[usage → Deploy](../usage.vi.md#deploy).

## Route

Không có. Bề mặt HTTP duy nhất thêm vào host là `GET /nginx-health` (liveness của nginx,
không proxy); `GET /api/health` của app đã có sẵn.

## Dữ liệu

Không đổi mô hình dữ liệu của ứng dụng. Các thư mục bind mount:

| Đường dẫn trên host (`DEPLOY_ROOT`) | Trong container | Chủ sở hữu | Chứa |
|---|---|---|---|
| `data/app` | `app`, `tools`: `/app/.data` | uid 1000 (`node`) | Content store JSON (khi `CONTENT_DATABASE_URL` để trống) |
| `data/postgres` | `postgres`: `/var/lib/postgresql/data` | uid 70 | Cluster PostgreSQL (chỉ layout local-db) |
| `logs/nginx` | `nginx`: `/var/log/nginx` | root | log truy cập và log lỗi |
| `import` | `tools`: `/import` (chỉ đọc) | uid 1000 | `planner.json` cho `planner:import` |
| `secrets/pg-ca.crt` | `app`, `tools`: `/run/secrets/pg-ca.crt` (chỉ đọc) | root, 644 | CA công khai của DB ngoài (layout external-db) |
| `backups` | — | root, 750 | đầu ra của `backup.sh` |

Secret (`ADMIN_API_TOKEN`, mật khẩu database, Google client secret) chỉ nằm trong
`deploy/.env` (mode 600, không commit). `NEXT_PUBLIC_SITE_URL` là **build arg**: đổi nó
phải chạy lại `up -d --build`.

## Cách hoạt động

Hai layout, chọn bằng một file overlay; `compose.app.bind.yml` thêm vào cả hai.

1. **Chuẩn bị VM** (Ubuntu 24.04 hoặc tương tự, Docker Engine + Compose v2, 2 GB RAM cộng
   swap vì `next build` ngốn RAM nhất):
   ```bash
   sudo ./deploy/scripts/setup-host.sh external-db   # hoặc: local-db
   ```
   Script tạo các thư mục bind mount với đúng chủ sở hữu. Làm **trước** `up`: Docker tự
   tạo đường dẫn thiếu bằng `root`, và biến file thiếu thành thư mục, làm app hỏng.
2. **Cấu hình**: `cp deploy/.env.example deploy/.env && chmod 600 deploy/.env`, rồi điền
   (`openssl rand -base64 36` cho `ADMIN_API_TOKEN`). DB ngoài: đặt CA tại
   `/opt/chuyennhahung/secrets/pg-ca.crt` và `PLANNER_DATABASE_URL` có
   `sslmode=verify-full`. DB cùng stack: đặt `POSTGRES_ADMIN_PASSWORD`, `CNH_APP_PASSWORD`
   và hai `*_DATABASE_URL` trỏ tới host `postgres`.
3. **Khởi động** (từ `deploy/`):
   ```bash
   # PostgreSQL trên VM riêng
   docker compose -f compose.yml -f compose.app.yml -f compose.app.bind.yml \
     -f compose.app.external-db.yml up -d --build
   # PostgreSQL trong stack này
   docker compose --profile local-db -f compose.yml -f compose.app.yml \
     -f compose.app.bind.yml -f compose.app.local-db.yml up -d --build
   ```
   Migration tự chạy khi app dùng database lần đầu (ADR 0009). Script init của
   `postgres` (`deploy/postgres/init/`) chạy **một lần**, trên thư mục dữ liệu trống, tạo
   role `cnh_app` và hai database `cnh_planner` / `cnh_content`.
4. **Kiểm tra**: `curl -i http://<ip-vm>/api/health` → `200 {"status":"ok"}`;
   `docker compose ps` báo `healthy`; mở `/`, `/en`, đăng nhập, tạo trip.
5. **Cập nhật**: `git pull`, chạy lại đúng lệnh `up -d --build`. Trong lúc app khởi động
   lại, nginx trả `maintenance.html` (503). **Rollback**: checkout commit trước rồi chạy
   lại; khôi phục `backups/<stamp>/` nếu dữ liệu đã đổi.
6. **Sao lưu**: `./scripts/backup.sh <layout>` từ cron (hằng ngày). local-db dump cả hai
   database bằng `pg_dump --format=custom`; external-db chỉ nén `data/app` — dump ngay
   trên VM database. Khôi phục: `pg_restore` vào database mới; giải nén `app-data.tgz`
   vào `data/` khi app đã dừng.

Mạng: `edge` (nginx ↔ app) và `backend` (`internal: true`, app ↔ postgres, không ra
ngoài). Chỉ nginx publish port. nginx **ghi đè** `X-Forwarded-For` và
`X-Forwarded-Proto` (rate limiter dựa vào chúng) và phân giải `app` theo từng request
nên khởi động được trước app.

### Server mới từ đầu

Mọi thứ cần có trên một VM Ubuntu 24.04 trắng, theo thứ tự. Placeholder: `<ip-vm>`,
`<ip-db>`, `<repo-url>`.

1. **VM**: 2 vCPU, 2 GB RAM (4 GB an toàn hơn), ổ 20 GB; thêm 2 GB swap
   (`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`,
   thêm một dòng vào `/etc/fstab`). IP tĩnh hoặc tên miền. SSH bằng key, tắt đăng nhập mật khẩu.
2. **Firewall**: mở 22 và 80 (thêm 443 khi có TLS), chặn phần còn lại
   (`ufw default deny incoming && ufw allow 22 && ufw allow 80 && ufw enable`). Trong LAN thì giới hạn
   theo subnet. Port do Docker publish bỏ qua `ufw`: stack chỉ publish port của nginx.
3. **Docker**: cài Docker Engine và plugin Compose v2 từ apt repository của Docker,
   `usermod -aG docker <user>`, đăng nhập lại, kiểm `docker compose version`.
4. **Code**: `git clone <repo-url> /opt/chuyennhahung/src && cd /opt/chuyennhahung/src/deploy`.
   (Repository private thì dùng deploy key hoặc token chỉ đọc.)
5. **Database** — chọn một:
   - *VM riêng* (`external-db`): trên VM DB cài PostgreSQL 16/17, tạo role `cnh_app` và database
     `cnh_planner` (tuỳ chọn `cnh_content`), chứng chỉ server có SAN chứa `<ip-db>`, một dòng
     `hostssl` trong `pg_hba.conf` chỉ cho `<ip-vm>/32`, và chỉ mở 5432 cho `<ip-vm>`
     ([usage → Chạy Planner trên PostgreSQL](../usage.vi.md#chạy-planner-trên-postgresql)).
     Chép CA (công khai) sang VM app tại `/opt/chuyennhahung/secrets/pg-ca.crt`, mode 644.
   - *Cùng stack* (`local-db`): không cần cài gì; script init tạo role và database.
6. **Host**: `sudo ./scripts/setup-host.sh <layout>`.
7. **Env**: `cp .env.example .env && chmod 600 .env`; đặt `NEXT_PUBLIC_SITE_URL`
   (`http://<ip-vm>` hoặc tên miền https), `ADMIN_API_TOKEN`, các giá trị database.
8. **Up**: lệnh `up -d --build` của layout bạn chọn (lần build đầu mất vài phút).
9. **Kiểm tra**: `curl -i http://<ip-vm>/api/health`; mở site; rồi tạo admin đầu tiên bằng
   admin token ([usage → Tài khoản và mật khẩu](../usage.vi.md#tài-khoản-và-mật-khẩu--tóm-tắt)).
10. **Sao lưu**: `crontab -e` → `15 3 * * * cd /opt/chuyennhahung/src/deploy && ./scripts/backup.sh <layout>`;
    chép `/opt/chuyennhahung/backups` ra ngoài VM.
11. **Sau đó**: TLS (certbot, hoặc load balancer cùng `real_ip_header`), đặt
    `NEXT_PUBLIC_SITE_URL` thành origin https và build lại, rồi đăng nhập Google
    ([usage → Cấu hình đăng nhập Google](../usage.vi.md#cấu-hình-đăng-nhập-google)). Trước khi có
    người dùng thật: các việc của chủ nhà ở [usage → Trước khi lên sóng](../usage.vi.md#trước-khi-lên-sóng--việc-của-chủ-nhà).

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `Dockerfile`, `.dockerignore` | Image: target `runner` và `tools` (đã có) |
| `deploy/compose.yml` | nginx, service `postgres` tuỳ chọn, mạng, bind mount |
| `deploy/compose.app.yml` | Service `app` và `tools` (đã có; nay truyền thêm `CONTENT_DATABASE_URL`) |
| `deploy/compose.app.bind.yml` | Thay named volume `app-data` bằng bind mount trên host |
| `deploy/compose.app.local-db.yml`, `deploy/compose.app.external-db.yml` | Overlay theo layout database (đã có) |
| `deploy/nginx/default.conf`, `deploy/nginx/maintenance.html` | Reverse proxy và trang bảo trì |
| `deploy/nginx-app.conf` | Đoạn header cho stack đã có nginx riêng (đã có) |
| `deploy/postgres/init/10-roles-and-databases.sh` | Tạo role và database ở lần khởi động đầu |
| `deploy/.env.example` | Mọi biến, cho cả hai layout |
| `deploy/scripts/setup-host.sh`, `deploy/scripts/backup.sh` | Chuẩn bị host và sao lưu |

## Test

Không có test tự động: đây là file hạ tầng và không test nào trong `tests/` chạy Docker.
`tests/docs.test.ts` kiểm tra tài liệu. Đã kiểm tay: cú pháp shell (`bash -n`) và parse
YAML của mọi file compose. **Chưa chạy**: `docker compose config`, `docker build` và
deploy thật — máy dev không có Docker và chưa đụng tới VM nào.

## Giới hạn và câu hỏi còn mở

- **Chưa thử trên VM.** Chạy `docker compose … config` trước, và smoke test trên VM thử
  trước khi dựa vào. Cần xác nhận bằng `docker compose ps` rằng profile `postgres` được
  khởi động như dependency của `app` (`depends_on`).
- HTTP thường: cookie không có `Secure`, HSTS bị bỏ qua, đăng nhập Google không chạy
  được trên IP. Bước kế tiếp là TLS (certbot hoặc load balancer phía trước); sau đó đặt
  `NEXT_PUBLIC_SITE_URL` thành origin https và build lại.
- Chỉ một replica `app`; rate limiter nằm trong bộ nhớ và content JSON store là một file
  (ADR 0013).
- Role của app sở hữu database và migrate lúc khởi động (rủi ro đã chấp nhận, ADR 0009).
- `backup.sh` không chép bản sao ra khỏi VM và không có giám sát host. Bản sao ngoài host
  và cảnh báo là việc của chủ nhà.
- Đẩy image lên registry và workflow deploy trên CI nằm ngoài phạm vi (CLAUDE.md: không
  deploy khi chủ nhà chưa cho phép).
