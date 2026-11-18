# Vận hành deploy — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

Những việc cần làm **sau khi** app đã chạy: theo dõi, đọc log, khởi động lại, sao lưu và
khôi phục, xoay vòng secret, giữ cho đĩa không đầy, nâng cấp, và xử lý khi có sự cố. Tài liệu
giả định layout `local-db` trên một VM do [deploy-runbook](deploy-runbook.vi.md) dựng; chỗ nào
`external-db` khác thì phần database chạy trên VM DB.

🇬🇧 English version: [deploy-operations.md](deploy-operations.md)

Chưa lệnh nào dưới đây được chạy trên VM thật, trừ chỗ
[deploy-runbook](deploy-runbook.vi.md#những-gì-đã-được-kiểm-chứng) nói là đã chạy. Hãy thử từng
lệnh một lần vào lúc rảnh, và sửa tài liệu này ở chỗ khác với thực tế.

## Kiểm tra định kỳ

| Tần suất | Kiểm tra | Lệnh hoặc nơi xem |
|---|---|---|
| Hằng ngày | Site trả lời | `curl -s -o /dev/null -w '%{http_code}\n' http://<ip-app>/api/health` → `200` |
| Hằng ngày | Ba container healthy | `docker ps --format '{{.Names}}  {{.Status}}'` |
| Hằng ngày | Bản sao lưu gần nhất có và không rỗng | `ls -lh /opt/chuyennhahung/backups \| tail -3` |
| Hằng tuần | Đĩa | `df -h /opt /var/lib/docker` |
| Hằng tuần | Runner Idle, lần deploy gần nhất xanh | GitHub → Settings → Actions → Runners; Actions → Deploy dev |
| Hằng tháng | Khôi phục thật sự chạy được | [Khôi phục PostgreSQL](#khôi-phục-postgresql-local-db) vào một database thử |

## Log

Tên container là `chuyennhahung-app-1`, `chuyennhahung-nginx-1` và `chuyennhahung-postgres-1`.

```bash
docker logs --tail 100 chuyennhahung-app-1
docker logs -f chuyennhahung-app-1                 # theo dõi liên tục; Ctrl-C để dừng
docker logs --tail 100 chuyennhahung-postgres-1
tail -n 100 /opt/chuyennhahung/logs/nginx/access.log
tail -n 100 /opt/chuyennhahung/logs/nginx/error.log
```

Runner là một service systemd: `journalctl -u <unit> -n 100 --no-pager` (tên unit nằm trong
[deploy-runbook](deploy-runbook.vi.md), Phase 5). Log của một lần deploy nằm trên GitHub ở
**Actions → Deploy dev → lần chạy đó**. Đọc log trước khi dán ở bất cứ đâu: nó có thể chứa địa
chỉ và, sau một lỗi, các mảnh của một request.

## Khởi động lại và dừng

| Mục tiêu | Lệnh |
|---|---|
| Khởi động lại một container | `docker restart chuyennhahung-app-1` (hoặc `-nginx-1`, `-postgres-1`) |
| Đưa site vào bảo trì | `docker stop chuyennhahung-app-1`; nginx khi đó trả trang bảo trì (503). Bật lại bằng `docker start chuyennhahung-app-1` |
| Áp dụng `.env` đã đổi | **Không** dùng `docker restart` (nó giữ môi trường cũ). Chạy **Deploy dev** trên `main` với `tag` = nội dung của `/opt/chuyennhahung/.deployed-tag`; container được tạo lại với giá trị mới |
| Dừng mọi thứ | `docker stop chuyennhahung-app-1 chuyennhahung-nginx-1 chuyennhahung-postgres-1` |
| Bật lại sau khi dừng | `docker start chuyennhahung-postgres-1 chuyennhahung-nginx-1 chuyennhahung-app-1` |

Các container có `restart: unless-stopped`, nên chúng tự lên lại sau khi khởi động lại máy hay
Docker, miễn là service Docker được bật (`systemctl is-enabled docker`). Sau khi reboot, kiểm
tra `docker ps` và service runner ở trạng thái `active (running)`.

## Sao lưu và khôi phục

### Sao lưu

`deploy/scripts/backup.sh local-db` ghi `/opt/chuyennhahung/backups/<ngày-giờ>/` gồm
`app-data.tgz` (thư mục content store) và, với `local-db`, `cnh_planner.dump` và
`cnh_content.dump` (`pg_dump --format=custom`). Nó đọc `/opt/chuyennhahung/.env` cho Compose,
không để lại file dump rỗng, và xoá các thư mục sao lưu cũ hơn 14 ngày. Chạy nó từ cron bằng
root (runbook, Phase 7, có dòng mẫu) và thử một lần bằng tay:

```bash
cd /opt/chuyennhahung/src/deploy && ./scripts/backup.sh local-db
ls -lh /opt/chuyennhahung/backups/*/
```

Các bản dump chứa hash mật khẩu và digest token: giữ thư mục chỉ chủ sở hữu đọc được. Một bản
sao lưu trên cùng đĩa không sống sót khi đĩa hỏng. **Hãy chép `/opt/chuyennhahung/backups` sang
máy khác**, ví dụ bằng `rsync` từ máy của bạn, và giữ ít nhất một bản mà VM không ghi đè được.
Với `external-db`, script chỉ nén content store; hãy dump database ngay trên VM DB bằng cron
riêng.

### Khôi phục PostgreSQL (local-db)

Luôn tập khôi phục vào một database thử trước (`createdb`, `pg_restore -d <tên-thử>`), rồi mới
làm thật. Với khôi phục thật, dừng app để không có gì ghi trong lúc đó:

```bash
docker stop chuyennhahung-app-1
docker exec -i chuyennhahung-postgres-1 pg_restore -U postgres --clean --if-exists -d cnh_planner < /opt/chuyennhahung/backups/<stamp>/cnh_planner.dump
docker exec -i chuyennhahung-postgres-1 pg_restore -U postgres --clean --if-exists -d cnh_content < /opt/chuyennhahung/backups/<stamp>/cnh_content.dump
docker start chuyennhahung-app-1
```

`--clean --if-exists` xoá các đối tượng rồi tạo lại, nên dữ liệu ghi sau `<stamp>` sẽ mất.
`pg_restore` có thể in cảnh báo; hãy đọc chúng, và kết thúc bằng
[smoke test](deploy-runbook.vi.md#smoke-test-sau-mỗi-lần-deploy).

### Khôi phục content store

Với các file trong `data/app` (dùng khi `CONTENT_DATABASE_URL` để trống):

```bash
docker stop chuyennhahung-app-1
tar -xzf /opt/chuyennhahung/backups/<stamp>/app-data.tgz -C /opt/chuyennhahung/data
chown -R 1000:1000 /opt/chuyennhahung/data/app
docker start chuyennhahung-app-1
```

## Xoay vòng secret

Xoay vòng khi nghi ngờ lộ, khi người biết secret rời đi, và theo lịch bạn chọn. Đừng bao giờ gõ
secret mới vào chat.

### ADMIN_API_TOKEN

Sinh giá trị mới vào `.env`, rồi tạo lại app để nó đọc:

```bash
NEW=$(openssl rand -base64 36)
sed -i "s|^ADMIN_API_TOKEN=.*|ADMIN_API_TOKEN=$NEW|" /opt/chuyennhahung/.env
```

Sau đó chạy **Deploy dev** với `tag` = nội dung của `.deployed-tag`. Ai giữ token cũ sẽ bị khoá.

### Mật khẩu database

Đổi role trong PostgreSQL **và** trong `.env`; hai nơi phải khớp. Với role của ứng dụng:

```bash
NEW=$(openssl rand -hex 24)
docker exec chuyennhahung-postgres-1 psql -U postgres -c "ALTER ROLE cnh_app PASSWORD '$NEW'"
sed -i "s/^CNH_APP_PASSWORD=.*/CNH_APP_PASSWORD=$NEW/; s#cnh_app:[^@]*@#cnh_app:$NEW@#" /opt/chuyennhahung/.env
```

Rồi chạy **Deploy dev** như trên. `POSTGRES_ADMIN_PASSWORD` chỉ được dùng khi cluster được tạo
lần đầu, nên chỉ đổi `.env` thì không có tác dụng: dùng thêm `ALTER ROLE postgres PASSWORD …`
và giữ hai nơi khớp nhau.

### Registry, runner và Google

- Đăng nhập registry dùng token của chính job cho một lần pull; không có gì để xoay vòng.
- Token đăng ký runner chỉ dùng một lần. Để đăng ký lại: dừng service, chạy
  `./config.sh remove` với token gỡ từ GitHub, rồi đăng ký lại
  ([deploy-runner](deploy-runner.vi.md)).
- `GOOGLE_CLIENT_SECRET`: tạo secret mới trong Google Cloud Console, đặt vào `.env`, chạy
  **Deploy dev**, rồi xoá secret cũ.

Sau mọi lần xoay vòng, chạy smoke test.

## Đĩa và dọn dẹp

```bash
df -h /opt /var/lib/docker
docker system df
du -sh /opt/chuyennhahung/data/* /opt/chuyennhahung/logs /opt/chuyennhahung/backups
```

- **Image cũ.** `deploy.sh` chỉ dọn image dangling; mọi tag đã deploy đều còn. Xoá các image
  không container nào dùng: `docker image prune -a` (image của app, nginx và postgres đang
  chạy được giữ lại). Rollback về một tag đã xoá sẽ pull lại nó từ registry.
- **Log của Docker.** Mặc định log container tăng không giới hạn. Giới hạn cho mọi container
  mới trong `/etc/docker/daemon.json`, rồi `systemctl restart docker` và tạo lại container
  (một lần deploy tạo lại `app`):
  ```json
  { "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
  ```
- **Log nginx** nằm trên host (`logs/nginx/access.log`, `error.log`).
  [`deploy/logrotate/chuyennhahung`](../deploy/logrotate/chuyennhahung) giữ access log
  14 ngày và error log 30 ngày; `deploy/scripts/setup-host.sh` cài nó vào
  `/etc/logrotate.d/`. Access log dùng định dạng riêng, ghi đường dẫn đã chuẩn hoá (không có
  query string), che các đường dẫn chứa token chia sẻ (`/chia-se/`, `/shared/`,
  `/api/shared/`, có hoặc không có tiền tố `/vi`, `/en`) và không bao giờ ghi `Cookie`, `Authorization` hay `Referer`. nginx vẫn có
  thể ghi nguyên dòng request vào `error.log`, nên coi file đó là nhạy cảm. Reload nginx sau
  khi đổi định dạng. Container cũng tự giới hạn log (10 MB × 3) và bộ nhớ (`APP_MEM_LIMIT`,
  `POSTGRES_MEM_LIMIT`) trong các file compose. `limit_req` tính theo địa chỉ client: sau proxy hay tunnel khác phải thêm `set_real_ip_from` trước, nếu không mọi client dùng chung một bucket. Hãy xoay vòng hoặc xoá `access.log` được ghi trước khi áp dụng định dạng này (dòng cũ chứa nguyên dòng request). Stack có nginx riêng (`deploy/nginx-app.conf`) giữ định dạng log của nó: repo này không kiểm soát. Chưa kiểm chứng trên VM.
- **Bản sao lưu** cũ hơn 14 ngày được script xoá; bản chép ra khỏi VM do bạn tự dọn.

## Nâng cấp

- **App** được phát hành bằng cách merge vào `main` ([deploy-runbook](deploy-runbook.vi.md)).
- **Image nginx và PostgreSQL** được ghim theo tag minor (`nginx:1.27-alpine`,
  `postgres:17-alpine`). Sao lưu trước; rồi, từ `/opt/chuyennhahung/src/deploy`,
  `docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml pull postgres nginx`
  và cùng lệnh đó với `up -d postgres nginx`. Việc này tạo lại chúng: sẽ có một khoảng gián
  đoạn ngắn. Phiên bản **major** của PostgreSQL (17 → 18) không thể làm bằng cách đổi tag trên
  thư mục dữ liệu có sẵn: dump, khởi động cluster mới, khôi phục.
- **Hệ điều hành và Docker Engine**: `apt update && apt upgrade` vào giờ vắng, reboot nếu
  kernel đổi, rồi kiểm tra `docker ps` và runner. Cân nhắc `unattended-upgrades` cho bản vá
  bảo mật.
- **Runner** tự cập nhật. Nếu nó kẹt, dừng service, giải nén bản mới vào thư mục của nó và
  khởi động lại.

## Khi có sự cố

| Triệu chứng | Xem đầu tiên | Nguyên nhân có thể và bước tiếp |
|---|---|---|
| Site hiện trang bảo trì (503) | `docker ps` | `app` đã dừng hoặc không healthy: `docker logs --tail 100 chuyennhahung-app-1`, rồi `docker start chuyennhahung-app-1` |
| Site không trả lời | `docker ps`, `ufw status` | `nginx` tắt, hoặc firewall chặn cổng 80: `docker start chuyennhahung-nginx-1` |
| Các trang Planner trả 503 | `docker logs --tail 100 chuyennhahung-postgres-1` | Database tắt hoặc mật khẩu không còn khớp `.env` |
| Một lần deploy lỗi và đã rollback | Actions → Deploy dev → lần chạy đó | Log cho thấy health check và những dòng cuối của app; sửa rồi merge lại. Rollback không hoàn tác migration |
| Một lần deploy nằm `queued` | Trang Runners | Runner offline hoặc thiếu nhãn `cnh-dev` |
| `No space left on device` | `df -h`, `docker system df` | [Đĩa và dọn dẹp](#đĩa-và-dọn-dẹp) |
| Nghi lộ một secret | — | [Xoay vòng](#xoay-vòng-secret) nó, rồi đọc log nginx và app quanh thời điểm đó |
| Dữ liệu sai hoặc mất | `ls /opt/chuyennhahung/backups` | [Khôi phục](#sao-lưu-và-khôi-phục) bản sao lưu tốt gần nhất |

## Giới hạn

- Không có giám sát và cảnh báo: phải có người nhìn. Một dịch vụ kiểm tra uptime miễn phí trên
  `/api/health` là bước rẻ nhất để bắt đầu.
- Một VM, một replica, và bản sao lưu nằm cùng đĩa cho tới khi bạn chép đi.
- HTTP thường trên một IP. TLS và tên miền đi trước; xem gạch đầu dòng cuối của Phase 7 trong
  [deploy-runbook](deploy-runbook.vi.md).
- Các bước khôi phục, xoay vòng, logrotate và nâng cấp ở trên chưa được kiểm chứng trên VM.
