# Runbook deploy — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

Một tài liệu đưa bạn đi từ một VM Linux trống đến khi app chạy sau nginx và được runner tự
host cập nhật tự động. Nó nối lại những gì được trình bày chi tiết trong
[docker-deploy](features/docker-deploy.vi.md), [deploy-runner](deploy-runner.vi.md),
[deploy-database](deploy-database.vi.md) và [usage → Deploy](usage.vi.md#deploy); hãy làm
theo từ trên xuống, và mở các tài liệu đó khi cần hiểu lý do.

🇬🇧 English version: [deploy-runbook.md](deploy-runbook.md)

## Bạn đang dựng cái gì

Mọi thứ chạy trong Docker trên **một VM**, trừ runner và các công cụ của host.

| Ở đâu | Cái gì |
|---|---|
| Container | `nginx` (cổng 80), `app` (Next.js, cổng 3000 bên trong), `postgres` (chỉ layout `local-db`), `tools` (script chạy một lần) |
| Host | Docker Engine, `ufw`, swap, user `cnh-runner` và GitHub Actions runner (một service systemd), cron sao lưu |
| Bind mount dưới `/opt/chuyennhahung` | `data/app`, `data/postgres`, `logs/nginx`, `import`, `secrets`, `backups` |
| `/opt/chuyennhahung/.env` | toàn bộ secret; mode 640, nhóm `cnh-runner`; không commit |

Một lần cập nhật diễn ra: merge vào `main` → CI xanh → GitHub build image và đẩy lên GHCR →
runner trên VM chạy `deploy/deploy.sh` → `app` khởi động lại với tag mới và phải báo healthy
trong 180 giây, nếu không thì tag trước được khôi phục. **Runner chỉ tạo lại `app`.** nginx và
PostgreSQL phải chạy sẵn, nên bạn dựng chúng bằng tay một lần (Phase 4).

## Chọn layout

| | `local-db` | `external-db` |
|---|---|---|
| PostgreSQL | một container trong stack này | trên VM khác |
| Đường nối | mạng Docker riêng, không TLS | qua LAN, TLS `verify-full` |
| `pg-ca.crt` | **không cần** | bắt buộc, tại `/opt/chuyennhahung/secrets/pg-ca.crt` |
| Thư mục host cho database | `data/postgres` (uid 70) | không có |
| Tham số của `setup-host.sh` | `local-db` | `external-db` |
| `DB_OVERLAY` cho runner | `local-db` | `external-db` (mặc định) |

Chọn một layout trước khi bắt đầu; các phase dưới đây nói rõ chỗ khác nhau.

## Các thành phần được deploy thế nào

Database và app được **deploy riêng**. Mục này cho thấy ai tạo và ai cập nhật từng phần, và điều
gì xảy ra với database trong một bản phát hành.

### Ai tạo và ai cập nhật cái gì

| Thành phần | Do ai tạo | Do ai cập nhật | Trạng thái nằm ở đâu |
|---|---|---|---|
| Container `nginx` | bạn, Phase 4 | bạn, bằng tay, khi `deploy/nginx/` đổi | không có; log ở `logs/nginx` |
| Container `postgres` | bạn, Phase 4 (script init chạy một lần) | bạn, bằng tay, khi nâng cấp image | `data/postgres` trên host |
| Container `app` | runner, ở lần deploy đầu | runner, ở mỗi bản phát hành | database, và `data/app` khi content là file JSON |
| Các bảng trong database (schema) | app, khi nó khởi động | app, khi nó khởi động (migration) | bên trong PostgreSQL |
| `/opt/chuyennhahung/.env` | bạn | bạn, rồi deploy lại `app` | chính file đó |
| Runner | bạn, Phase 5 | tự cập nhật | không có |

Một bản phát hành chỉ đổi container `app` (và, qua nó, các bảng). nginx và PostgreSQL vẫn chạy.

### Luồng 1 — Thiết lập một lần

1. **Bạn**: chuẩn bị VM, các thư mục và `.env` (Phase 1 đến 2).
2. **Bạn**: khởi động PostgreSQL và nginx (Phase 4). Ở lần khởi động đầu, PostgreSQL tạo role
   `cnh_app` và các database từ một thư mục dữ liệu trống.
3. **Bạn**: cài runner (Phase 5).
4. **Runner**: deploy `app` lần đầu (Phase 6). App tự tạo các bảng khi khởi động (Luồng 3).
5. **Bạn**: tạo admin đầu tiên, thiết lập sao lưu (Phase 7).

### Luồng 2 — Một bản phát hành

```mermaid
flowchart TD
  PR["Pull request được merge vào main"] --> CI["CI: typecheck, lint, test, build"]
  CI -->|xanh| PLAN["plan: tag image = sha-commit"]
  PLAN --> BUILD["build image trên GitHub và đẩy lên GHCR"]
  BUILD --> RUN["runner trên VM chạy deploy.sh"]
  RUN --> PULL["docker login, compose pull app"]
  PULL --> UP["compose up -d --no-build --no-deps app"]
  UP --> WAIT{"đang chạy đúng image đích và /api/health OK trong 180 giây?"}
  WAIT -->|có| OK["ghi .deployed-tag, dọn image dangling, lần chạy xanh"]
  WAIT -->|không| BACK["in log của app, khởi động lại tag trước, lần chạy đỏ"]
```

Mỗi lúc chỉ một lần deploy chạy; lần mới hơn chờ. `nginx` và `postgres` không bị đụng tới.
`/api/health` chỉ nói rằng tiến trình đang phục vụ: nó cố ý không chạm vào database, nên một lần
deploy xanh **không** chứng minh được migration hay truy vấn Planner chạy tốt. Hãy chạy
[smoke test](#smoke-test-sau-mỗi-lần-deploy) sau bản phát hành có thêm migration.

### Luồng 3 — Database trong một bản phát hành

Container không bao giờ bị tạo lại. Cái thay đổi là các bảng, và chỉ khi bản mới mang theo các
file mới trong `db/migrations/`.

```mermaid
flowchart TD
  START["container app mới khởi động"] --> LOCK["lấy advisory lock, chờ tối đa 30 giây"]
  LOCK -->|hết giờ| UNAVAIL["Planner trả 503, thử lại ở request kế tiếp"]
  LOCK --> CHECK["so schema_migrations với db/migrations"]
  CHECK -->|không có gì mới| SERVE["phục vụ request"]
  CHECK -->|có file mới| APPLY["áp dụng từng file trong transaction riêng và ghi lại"]
  APPLY --> SERVE
  CHECK -->|một file đã áp dụng bị sửa| REFUSE["từ chối: Planner trả 503"]
```

- Request đầu tiên sau một bản phát hành có thể chậm hơn trong lúc migration chạy.
- Migration lỗi không làm container dừng; các route Planner trả `503` và log chỉ có mã lỗi. Chạy
  `npm run db:migrate` trong container `tools` để thấy thông báo thật.
- Migration là các file SQL thuần, áp dụng một lần và theo thứ tự, và một file đã áp dụng
  không bao giờ được sửa.

### Luồng 4 — Rollback

| Tình huống | Làm gì | Ghi chú |
|---|---|---|
| Lỗi trong code, bản phát hành **không có migration mới** | **Run workflow** với `tag` = `sha-<commit>` trước đó | Nhanh và an toàn: chỉ image đổi |
| Bản phát hành **có thêm migration** và bị lỗi | Ưu tiên sửa tiến: merge một bản phát hành đã sửa. Image cũ chỉ chạy được trên các bảng mới nếu migration chỉ thêm (additive) | Viết migration sao cho bản phát hành trước vẫn chạy được trên chúng |
| Phải hoàn tác các bảng mới | Dừng app, khôi phục bản sao lưu lấy **trước** bản phát hành ([deploy-operations](deploy-operations.vi.md#sao-lưu-và-khôi-phục)), rồi deploy tag cũ | Biện pháp cuối cùng; dữ liệu ghi từ sau bản sao lưu sẽ mất |
| Một file trong `db/rollback/` | Áp dụng bằng tay; nó **xoá bảng**. Export trước | Chỉ cho các bảng migration đó vừa tạo |
| Health check lỗi trong lúc deploy | Tự động: `deploy.sh` khởi động lại tag trước | Nó không bao giờ đụng tới schema |

Hãy sao lưu (`backup.sh`) **trước** mọi bản phát hành thêm file vào `db/migrations/`.

### Luồng 5 — Đổi cấu hình

| Thay đổi | Cách làm |
|---|---|
| Một giá trị runtime trong `/opt/chuyennhahung/.env` (token, mật khẩu, khoá Google) | Sửa file, rồi **Run workflow** với `tag` = nội dung của `.deployed-tag`: cùng image, được tạo lại với giá trị mới (`docker restart` sẽ giữ môi trường cũ) |
| Địa chỉ site (`NEXT_PUBLIC_SITE_URL`, `DEV_SITE_URL`) | Nó được nướng vào image: đặt cả hai, rồi **Run workflow** với `tag` **để trống** để build image mới |
| `deploy/nginx/` hoặc service `postgres` | Deploy không áp dụng; tạo lại service đó bằng tay ([Cập nhật](#cập-nhật-deploy-lại-và-rollback)) |
| Mật khẩu database | Đổi trong PostgreSQL và trong `.env`, rồi deploy lại `app` ([deploy-operations](deploy-operations.vi.md#xoay-vòng-secret)) |

## Phase 0 — Chuẩn bị

- Địa chỉ VM, `<ip-app>` (IP cố định hoặc tên miền), và quyền root hoặc `sudo`.
- Quyền admin trên repository GitHub (để đăng ký runner và chạy workflow).
- Origin công khai của site, ví dụ `http://<ip-app>`. Nó được nướng vào image lúc **build**,
  nên biến repository `DEV_SITE_URL` và `NEXT_PUBLIC_SITE_URL` trong `.env` phải cùng một
  giá trị. `DEV_SITE_URL` mặc định là `http://192.168.100.140`; đặt biến nếu của bạn khác.
- Chỉ `external-db`: địa chỉ VM database `<ip-db>` và cách chép một file sang VM app.

## Phase 1 — VM trống

Với quyền root trên VM.

```bash
apt update && apt -y upgrade
apt install -y acl curl git ufw
ufw default deny incoming && ufw allow 22 && ufw allow 80 && ufw enable
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Cài Docker Engine và plugin Compose v2 từ apt repository của Docker, rồi kiểm tra:

```bash
docker compose version
```

`ufw` không lọc các cổng do Docker publish; stack chỉ publish cổng 80 của nginx. Thêm `443`
khi có TLS phía trước. Trong LAN, giới hạn `22` và `80` theo subnet của bạn.

## Phase 2 — Code, thư mục và cấu hình

### Code và thư mục trên host

```bash
mkdir -p /opt/chuyennhahung
git clone https://github.com/doanviethung1009/chuyennhahung_planner.git /opt/chuyennhahung/src
```

Dùng URL repository thật, kèm deploy key hoặc token chỉ đọc nếu repository là private. Sau đó
chạy thiết lập host **từ thư mục `deploy/`** (đường dẫn tính từ đó):

```bash
cd /opt/chuyennhahung/src/deploy
./scripts/setup-host.sh local-db        # hoặc: external-db
```

Script in ra `Host ready under /opt/chuyennhahung (<layout>).` và tạo các thư mục bind mount
với đúng chủ sở hữu mà container cần. Làm bước này **trước** mọi lệnh `up`: Docker tự tạo
đường dẫn thiếu bằng `root`, và biến một file thiếu thành thư mục.

### File `.env`

Tạo `/opt/chuyennhahung/.env` một lần. Khối lệnh này sinh secret và chỉ ghi vào file; đừng in
file ra hay dán nó ở đâu cả.

```bash
umask 077
CNH=$(openssl rand -hex 24)
cat > /opt/chuyennhahung/.env <<EOF
NEXT_PUBLIC_SITE_URL=http://<ip-app>
TRUST_PROXY_HEADERS=true
ADMIN_API_TOKEN=$(openssl rand -base64 36)
POSTGRES_ADMIN_PASSWORD=$(openssl rand -hex 24)
CNH_APP_PASSWORD=$CNH
PLANNER_DATABASE_URL=postgres://cnh_app:$CNH@postgres:5432/cnh_planner
CONTENT_DATABASE_URL=postgres://cnh_app:$CNH@postgres:5432/cnh_content
GOOGLE_SIGNUP_ENABLED=false
EOF
```

- Chạy **một lần** thôi. PostgreSQL lấy mật khẩu ở lần khởi động đầu; chạy lại sau đó làm
  file và database lệch nhau.
- `CONTENT_DATABASE_URL` là tuỳ chọn; xoá dòng này nếu muốn content vẫn ở file JSON.
- `external-db`: bỏ hai dòng mật khẩu `POSTGRES_*`/`CNH_*` và dùng
  `PLANNER_DATABASE_URL=postgres://cnh_app:<mật-khẩu>@<ip-db>:5432/cnh_planner?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt`.
  Percent-encode `@ : / ? # &` trong mật khẩu.
- Muốn xem file có những biến nào mà không lộ giá trị:
  `sed 's/=.*/=<ẩn>/' /opt/chuyennhahung/.env`.

Quyền nhóm cho runner được đặt ở Phase 5, khi user đã tồn tại.

## Phase 3 — Database

### Layout `local-db`

Không cần cài gì. Ở lần khởi động đầu, container PostgreSQL chạy
`deploy/postgres/init/10-roles-and-databases.sh`, tạo role `cnh_app` và các database
`cnh_planner`, `cnh_content`. Không có TLS và **không có `pg-ca.crt`**.

### Layout `external-db`

Trên **VM database**: cài PostgreSQL 16 hoặc 17, tạo role và database, làm một CA riêng và một
chứng chỉ server có Subject Alternative Name là `IP:<ip-db>`, bật `ssl = on`, thêm một dòng
`hostssl cnh_planner cnh_app <ip-app>/32 scram-sha-256` vào `pg_hba.conf`, và chỉ mở cổng 5432
cho `<ip-app>`. Các lệnh nằm ở
[deploy-database → Bước 2](deploy-database.vi.md#bước-2--đường-truyền-mã-hóa-ca-riêng).
Rồi chép **chỉ** `ca.crt` công khai sang VM app **trước** lần `up` đầu tiên:

```bash
install -m 644 ca.crt /opt/chuyennhahung/secrets/pg-ca.crt
ls -l /opt/chuyennhahung/secrets/pg-ca.crt      # phải là file, không phải thư mục
```

Kiểm tra đường nối từ VM app; kết quả phải kết thúc bằng `Verify return code: 0 (ok)`:

```bash
openssl s_client -starttls postgres -connect <ip-db>:5432 \
  -CAfile /opt/chuyennhahung/secrets/pg-ca.crt </dev/null 2>&1 | grep 'Verify return code'
```

## Phase 4 — Khởi động nginx và PostgreSQL

Chạy mọi lệnh từ `/opt/chuyennhahung/src/deploy`: `--project-directory .` làm Compose dùng các
file của thư mục đó, còn `--env-file` trỏ nó tới file secret.

```bash
cd /opt/chuyennhahung/src/deploy
docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml up -d postgres nginx
```

`external-db`: bỏ `--profile local-db` và chỉ khởi động nginx:

```bash
docker compose --project-directory . --env-file /opt/chuyennhahung/.env -f compose.yml up -d nginx
```

Chờ khoảng 30 giây rồi kiểm tra:

```bash
# postgres và nginx phải ở trạng thái (healthy)
docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml ps
# phải liệt kê cnh_planner và cnh_content, chủ sở hữu cnh_app
docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml exec postgres psql -U postgres -c '\l'
# phải trả 200 và "ok"
curl -i http://localhost/nginx-health
```

Muốn gõ ít hơn, bạn có thể định nghĩa một lối tắt; nó chỉ tồn tại trong shell đã chạy nó, và
phần còn lại của tài liệu viết `dc` cho nó ở những chỗ lệnh lặp lại:

```bash
dc() { docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml "$@"; }
```

Chạy `psql` trong vài giây đầu sẽ lỗi socket: PostgreSQL vẫn đang khởi tạo trên một server
tạm. Chờ rồi chạy lại. Cảnh báo `sh: locale: not found` vô hại trên Alpine. Cho đến khi app
tồn tại, `curl http://localhost/` trả `503` kèm trang bảo trì; đó là bình thường.

## Phase 5 — Runner

Làm theo thứ tự. Giữ runner ở `/home/cnh-runner/actions-runner`, **tuyệt đối không** đặt trong
`/opt/chuyennhahung` (kể cả checkout của repository nằm dưới đó): runner phải liệt kê được mọi
thư mục cha của thư mục nó, mà `cnh-runner` cố ý chỉ có quyền đi qua `/opt/chuyennhahung`
(bước 2). Chạy từ đó nó dừng với lỗi `Access to the path '/opt/chuyennhahung' is denied`.
Đừng mở rộng ACL để sửa; hãy chuyển runner đi chỗ khác.

### Bước 1 — User riêng cho nó

Không mật khẩu, không có đăng nhập shell riêng. Chạy bằng root:

```bash
adduser --disabled-password --gecos "" cnh-runner
usermod -aG docker cnh-runner
id cnh-runner
```

`id` phải liệt kê nhóm `docker`, tương đương root trên VM này. Chỉ dùng tài khoản này cho
runner.

### Bước 2 — Quyền tối thiểu trên stack

```bash
setfacl -m u:cnh-runner:--x /opt/chuyennhahung
touch /opt/chuyennhahung/.deployed-tag && chown cnh-runner /opt/chuyennhahung/.deployed-tag
chgrp cnh-runner /opt/chuyennhahung/.env && chmod 640 /opt/chuyennhahung/.env
sudo -u cnh-runner test -r /opt/chuyennhahung/.env && echo readable
sudo -u cnh-runner docker ps > /dev/null && echo docker-ok
```

Thư mục chỉ được quyền đi qua, nên runner không thay được `.env`. Cả hai lệnh kiểm tra phải
in ra từ của chúng.

### Bước 3 — Tải và đăng ký

Trên GitHub: **Settings → Actions → Runners → New self-hosted runner → Linux x64**. Chạy các
lệnh tải của trang đó dưới user `cnh-runner`, từng lệnh một:

```bash
sudo -iu cnh-runner
mkdir -p ~/actions-runner && cd ~/actions-runner
pwd
```

`pwd` phải in `/home/cnh-runner/actions-runner`. Dán các lệnh tải của trang vào đó cho tới khi
`ls config.sh run.sh svc.sh` liệt kê đủ ba file. Trang đó cũng hiển thị một **token đăng ký
dùng một lần**: chỉ gõ trong terminal của bạn, không dán vào chat hay file nào.

```bash
./config.sh --url https://github.com/<owner>/<repo> --token <TOKEN-TỪ-TRANG-GITHUB> \
  --labels cnh-dev --name cnh-dev-vm
```

Dùng đúng `--labels cnh-dev`: workflow chọn runner bằng `runs-on: [self-hosted, linux, cnh-dev]`,
nên runner thiếu nhãn `cnh-dev` sẽ không bao giờ nhận được job và lần chạy nằm `queued` mãi.
Nếu bạn đã dùng lệnh mặc định của trang GitHub và thiếu nhãn, hãy thêm sau (xem bảng xử lý sự
cố và phần kiểm tra bên dưới Bước 6). Tên runner mặc định là tên máy khi bạn nhấn Enter; không
sao, và tên unit ở bước 5 đi theo nó.

Khi nó kết thúc bằng `Settings Saved`, thoát shell của `cnh-runner`:

```bash
exit
```

### Bước 4 — Cài thành service

Bằng root:

```bash
cd /home/cnh-runner/actions-runner
./svc.sh install cnh-runner
./svc.sh start
./svc.sh status
systemctl list-units 'actions.runner.*' --no-legend
```

Chỉ tiếp tục khi `status` báo `active (running)`. Lệnh cuối in ra **tên unit** của service,
được giải thích ở bước tiếp theo.

### Bước 5 — Báo cho nó biết layout

**Unit là gì.** systemd, trình quản lý service của Linux, mô tả mỗi service nó chạy bằng một
file cấu hình gọi là *unit*; tên của nó kết thúc bằng `.service`. Khi bạn chạy
`./svc.sh install cnh-runner`, script của GitHub đã tạo một unit cho runner, để runner tự chạy
khi máy khởi động và tự khởi động lại khi lỗi. Tên được ghép theo dạng
`actions.runner.<owner>-<repo>.<tên-runner>.service`; với repository này và tên runner dùng ở
trên, nó phải là
`actions.runner.doanviethung1009-chuyennhahung_planner.cnh-dev-vm.service`. Hãy giữ tên thật
trong một biến; biến chỉ tồn tại trong shell hiện tại, nên ở shell mới hãy chạy lại hai dòng
này trước khi dùng `$UNIT`:

```bash
UNIT=$(systemctl list-units 'actions.runner.*' --no-legend | awk '{print $1}')
echo "$UNIT"
```

`echo` phải in đúng một tên; nếu không in gì, service ở bước 4 chưa được cài.

`deploy.sh` đọc hai thiết lập từ môi trường của runner: `STACK_DIR` (nơi có `.env` và
`.deployed-tag`) và `DB_OVERLAY` (`local-db` hoặc `external-db`; mặc định là `external-db`).
Chúng được đặt trong một drop-in systemd: file trong `$UNIT.d/` được gộp đè lên unit mà
`svc.sh` sinh ra, nên chạy lại `svc.sh` không ghi đè mất nó. Ghi nó bằng root, với
`DB_OVERLAY=external-db` cho layout còn lại:

```bash
mkdir -p /etc/systemd/system/$UNIT.d
```

```bash
cat > /etc/systemd/system/$UNIT.d/environment.conf <<'EOF'
[Service]
Environment=STACK_DIR=/opt/chuyennhahung
Environment=DB_OVERLAY=local-db
EOF
```

```bash
systemctl daemon-reload && systemctl restart $UNIT
systemctl show $UNIT -p Environment
```

Lệnh `cat` ghi mọi dòng cho tới dòng `EOF` đứng riêng (phải bắt đầu sát lề trái, không có gì
đứng trước) vào file; dấu nháy quanh `'EOF'` ngăn shell mở rộng bất cứ thứ gì bên trong.
`daemon-reload` bảo systemd đọc lại các file unit còn `restart` áp dụng chúng. Lệnh cuối phải
hiện cả hai biến. Chỉ định nghĩa chúng ở **một** chỗ: drop-in trong
[deploy-runner](deploy-runner.vi.md) cũng đặt chúng, và file sau đè lên file trước.

### Bước 6 — Hardening unit

Bước này **không bắt buộc** và nên làm **sau** lần deploy thành công đầu tiên (Phase 6): runner
vẫn chạy được khi thiếu nó, và một thiết lập quá chặt có thể làm hỏng deploy theo cách khó nhận
ra. Hãy bỏ qua bây giờ, deploy xong rồi quay lại, áp dụng nó và chạy **Deploy dev** lại để
chứng minh nó vẫn chạy. `deploy.sh` chạy `docker login`, lệnh này ghi
`/home/cnh-runner/.docker/config.json`; vì vậy thư mục đó nằm trong `ReadWritePaths` bên dưới,
và nó phải tồn tại trước. Dùng biến `$UNIT` ở bước 5, bằng root:

```bash
install -d -m 700 -o cnh-runner -g cnh-runner /home/cnh-runner/.docker
```

```bash
cat > /etc/systemd/system/$UNIT.d/hardening.conf <<'EOF'
[Service]
PrivateTmp=true
ProtectHome=read-only
ReadWritePaths=/home/cnh-runner/actions-runner /home/cnh-runner/.docker /opt/chuyennhahung
ProtectKernelTunables=true
ProtectControlGroups=true
Restart=on-failure
RestartSec=10
EOF
```

```bash
systemctl daemon-reload && systemctl restart $UNIT
systemctl status $UNIT --no-pager | head -5
```

| Thiết lập | Tác dụng lên tiến trình runner |
|---|---|
| `PrivateTmp=true` | `/tmp` riêng, các service khác không thấy |
| `ProtectHome=read-only` | `/home` chỉ đọc với nó … |
| `ReadWritePaths=…` | … trừ các đường dẫn này: thư mục của chính nó, `/home/cnh-runner/.docker` (đăng nhập registry) và `/opt/chuyennhahung` (nó ghi `.deployed-tag` ở đó) |
| `ProtectKernelTunables=true`, `ProtectControlGroups=true` | `/proc/sys`, `/sys` và cây cgroup chỉ đọc |
| `Restart=on-failure`, `RestartSec=10` | khởi động lại 10 giây sau khi crash |

Nó chỉ giam tiến trình runner. Nó **không** kiểm soát được những gì runner làm qua Docker:
thành viên nhóm `docker` tương đương root, nên ranh giới thật là ai được quyền push
workflow (xem [deploy-runner](deploy-runner.vi.md)). Đừng thêm `NoNewPrivileges`,
`ProtectSystem=strict` hay `PrivateDevices` khi chưa thử: Docker cần socket và cgroup của nó.

Trên trang Runners của GitHub, runner hiện **Idle** với nhãn `cnh-dev`. Kiểm tra nhãn từ bất kỳ
máy nào có `gh` đã đăng nhập; kết quả phải chứa `cnh-dev`:

```bash
gh api repos/<owner>/<repo>/actions/runners --jq '.runners[]|[.id,.name,.status,([.labels[].name]|join(","))]|@tsv'
```

Nếu không có, hãy thêm nhãn — **nhưng chỉ sau Bước 5**, vì ngay khi runner có nhãn, mọi job đang
chờ sẽ chạy, và thiếu `DB_OVERLAY=local-db` nó sẽ deploy với mặc định `external-db` (và Docker
tạo một thư mục tên `pg-ca.crt`). Trên GitHub: **Settings → Actions → Runners →** chọn runner
**→ Labels**, hoặc:

```bash
gh api -X POST repos/<owner>/<repo>/actions/runners/<runner-id>/labels -f 'labels[]=cnh-dev'
```

## Phase 6 — Deploy lần đầu

1. Mở **Actions → Deploy dev**. Một lần chạy đang chờ runner sẽ tự bắt đầu; nếu không thì
   **Run workflow** trên `main` với `tag` để trống (build trên GitHub, rồi job trên VM deploy).
2. Trên VM:
   ```bash
   cat /opt/chuyennhahung/.deployed-tag               # sha-<commit>
   curl -i http://<ip-app>/api/health                 # 200 {"status":"ok"}
   cd /opt/chuyennhahung/src/deploy      # các file compose nằm ở đây
   docker compose --project-directory . --env-file /opt/chuyennhahung/.env --profile local-db -f compose.yml ps    # app, nginx, postgres: healthy
   ```
3. Kiểm tra PostgreSQL không bị khởi động lại bởi lần deploy: tuổi `STATUS` của nó trong
   `dc ps` không được rơi về vài giây sau một lần deploy sau đó. Nếu có, xem
   [Giới hạn](#những-gì-đã-được-kiểm-chứng).

## Phase 7 — Sau lần deploy đầu

> **Định nghĩa `dc` trước.** `dc` (và mọi lệnh `docker compose` trong phase này và bảng xử lý
> sự cố) chỉ chạy trong shell mà bạn đã gõ hàm một dòng ở
> [Phase 4](#phase-4--khởi-động-nginx-và-postgresql) trong phiên đó; shell mới hoặc lần đăng nhập SSH
> mới thì mất. Thiếu `--env-file /opt/chuyennhahung/.env`, lệnh `docker compose` trần sẽ báo
> *required variable CNH_APP_PASSWORD is missing*.

- **Admin đầu tiên.** Dùng service token, qua nginx (app không publish cổng riêng). Giữ lại
  `temporaryPassword` trong phản hồi; nó chỉ hiện một lần.
  ```bash
  TOKEN=$(grep '^ADMIN_API_TOKEN=' /opt/chuyennhahung/.env | cut -d= -f2-)
  curl -s -X POST http://localhost/api/admin/planner/users \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d '{"handle":"admin","displayName":"Admin","email":"you@example.com","role":"admin"}'
  ```
  Đăng nhập tại `/dang-nhap?returnTo=/quan-tri`, rồi đặt mật khẩu mới ở `/doi-mat-khau`.
  Cách khác, `npm run admin:create` trong container `tools`, build một image trên VM và cần
  `APP_SRC=..` đứng trước lệnh `docker compose`; xem
  [usage → Đăng nhập với tư cách admin](usage.vi.md#đăng-nhập-với-tư-cách-admin).
- **Vai trò từ VM.** Có thể đặt role khi tạo hoặc đổi sau bằng cùng service token (`$TOKEN` như
  trên). Chỉ service token mới tạo được `super_admin` đầu tiên, role duy nhất mở tab Runbook
  ([ADR 0017](adr/0017-super-admin-role.vi.md)). Các role: `member`, `editor`, `admin`, `super_admin`.
  ```bash
  # tạo user kèm role (temporaryPassword chỉ hiện một lần)
  curl -s -X POST http://localhost/api/admin/planner/users \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d '{"handle":"hung","displayName":"Hưng","email":"you@example.com","role":"super_admin"}'
  # tìm id của user
  curl -s http://localhost/api/admin/planner/users -H "authorization: Bearer $TOKEN"
  # đổi role của user có sẵn
  curl -s -X PATCH http://localhost/api/admin/planner/users/<userId> \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d '{"role":"super_admin"}'
  ```
  Hoặc không cần token, trong container `tools` (cùng lưu ý `APP_SRC=..` ở trên):
  `npm run admin:create -- --email you@example.com --name "Hưng" --role super_admin`.
  `super_admin` cuối cùng không bị hạ role hay xóa.
- **Sao lưu.** `crontab -e` →
  `15 3 * * * cd /opt/chuyennhahung/src/deploy && ./scripts/backup.sh local-db`.
  Chép `/opt/chuyennhahung/backups` ra ngoài VM. Với `external-db`, dump thêm trên VM database.
  Khôi phục, log, xoay vòng secret và dọn dẹp nằm ở [deploy-operations](deploy-operations.vi.md).
- **Sau đó.** Đăng nhập Google đang bị ẩn có chủ đích: nó cần cả `GOOGLE_CLIENT_ID` lẫn
  `GOOGLE_CLIENT_SECRET`, và Google chỉ chấp nhận redirect URI `http://` thuần cho `localhost`,
  nên nó không thể chạy trên `http://<ip-app>`. Vì thế nó chạy trên máy bạn mà không chạy ở đây.
  Trước hết là TLS phía trước nginx; rồi đặt `DEV_SITE_URL` và `NEXT_PUBLIC_SITE_URL` thành
  origin https và deploy lại; rồi đăng nhập Google. Danh sách việc của chủ nhà trước khi ra
  mắt nằm ở [usage → Trước khi lên sóng](usage.vi.md#trước-khi-lên-sóng--việc-của-chủ-nhà).

## Smoke test sau mỗi lần deploy

Chạy nó sau lần deploy đầu tiên, sau mỗi bản phát hành bạn quan tâm, và sau khi khôi phục hay
xoay vòng secret. Từ bất kỳ máy nào tới được VM (thay `<ip-app>`):

```bash
for p in / /en /chuyen-di-choi /kham-pha /ban-do /len-lich-trinh /thiet-ke-chuyen-di /dang-nhap /robots.txt /sitemap.xml /api/health; do
  printf '%-22s' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "http://<ip-app>$p"
done
```

Mỗi dòng phải kết thúc bằng `200`. `404` hoặc một trang rỗng ở `/chuyen-di-choi` hay `/kham-pha`
nghĩa là content store đang trống: xem
[usage → Nạp các bài viết tĩnh vào content store](usage.vi.md#nạp-các-bài-viết-tĩnh-vào-content-store).

Rồi kiểm tra bằng tay trên trình duyệt:

1. **Header bảo mật.** `curl -sI http://<ip-app>/` cho thấy `Content-Security-Policy`,
   `X-Frame-Options` và `X-Content-Type-Options`.
2. **Đăng nhập.** Đăng nhập bằng tài khoản admin, mở `/quan-tri`, và thấy danh sách người dùng.
3. **Planner.** Tạo một chuyến đi, thêm một ngày và một hoạt động, tải lại trang: dữ liệu vẫn còn.
   Mở link chia sẻ của nó trong cửa sổ ẩn danh: nó hiện chuyến đi mà không cần đăng nhập. Planner
   chưa có trình soạn thảo trong trình duyệt, nên để kiểm tra bằng `curl`, hãy gửi mọi thao tác
   ghi dùng cookie với `Origin` bằng giá trị của `NEXT_PUBLIC_SITE_URL` (đọc bằng
   `docker exec chuyennhahung-app-1 printenv NEXT_PUBLIC_SITE_URL`). Trên VM dev nó là
   `http://192-168-100-140.nip.io`, **không phải** IP; `Origin` là IP sẽ bị từ chối với
   `403 a cross-site POST is refused`. Riêng đăng nhập thì không cần `Origin`.
4. **Cả hai ngôn ngữ.** `/` và `/en` đều hiển thị, và nút chuyển ngôn ngữ giữ nguyên trang.
5. **Database sống sót qua lần deploy.**
   ```bash
   docker inspect -f '{{.State.StartedAt}}' chuyennhahung-postgres-1
   cat /opt/chuyennhahung/.deployed-tag
   ```
   Thời điểm khởi động của PostgreSQL phải cũ hơn lần deploy này; một lần deploy không được
   khởi động lại nó.
6. **Rollback chạy được.** Một lần, vào lúc rảnh: **Run workflow** trên `main` với `tag` là một
   `sha-<commit>` cũ hơn; lần chạy xanh và `.deployed-tag` hiện tag đó. Rồi deploy lại bản mới nhất.

## Cập nhật, deploy lại và rollback

| Mục tiêu | Cách làm |
|---|---|
| Phát hành | Merge một pull request vào `main`; xem **Actions → Deploy dev** |
| Deploy lại hoặc rollback bằng tay | **Run workflow** trên `main` với `tag` = `sha-<commit>` (không build) |
| Tạm dừng deploy | `systemctl stop <unit>`; các job chờ trong hàng đợi |
| Đổi `deploy/nginx/` hoặc service postgres | Deploy không áp dụng: tự chạy lệnh ở Phase 4 với `up -d nginx` (hoặc `restart nginx`) |
| Đổi `.env` | Sửa file, rồi chạy **Deploy dev** lại để `app` khởi động lại với nó |

Lần chạy chỉ thành công nếu `app` báo healthy trên image đích trong 180 giây; nếu không, tag
trước được khôi phục và lần chạy thất bại. Rollback **không** hoàn tác migration. Đừng trộn
`up -d --build` bằng tay với runner cho cùng một bản phát hành: runner cần image GHCR.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân và cách sửa |
|---|---|
| `./deploy/scripts/setup-host.sh: command not found` | Bạn đã ở sẵn trong `deploy/`; chạy `./scripts/setup-host.sh <layout>` |
| `setfacl: command not found` | `apt install -y acl` |
| `unknown user cnh-runner`, `invalid group: cnh-runner` | User chưa được tạo (Phase 5 bước 1) |
| `couldn't find env file: /opt/chuyennhahung/.env` | File chưa có (Phase 2), hoặc `cnh-runner` không đọc được (Phase 5 bước 2) |
| `psql … .s.PGSQL.5432 failed` ngay sau lần `up` đầu | PostgreSQL vẫn đang khởi tạo; chờ 15 giây rồi thử lại |
| `sh: locale: not found` trong log postgres | Vô hại trên Alpine |
| `Access to the path '/opt/chuyennhahung' is denied` khi chạy runner | Thư mục runner nằm dưới `/opt/chuyennhahung`; chuyển nó sang `/home/cnh-runner/actions-runner` và `chown -R cnh-runner:cnh-runner` (Phase 5) |
| `compose file "/opt/chuyennhahung/compose.yml" is invalid … no such file` | Bạn không đứng trong `/opt/chuyennhahung/src/deploy`; hãy `cd` tới đó trước (các file compose nằm trong checkout, không phải trong `/opt/chuyennhahung`) |
| Một lần chạy **Deploy dev** nằm `queued` hoặc `pending` mãi | Không runner online nào có nhãn `cnh-dev` (Phase 5, phần kiểm tra dưới Bước 6); hoặc một lần chạy cũ đang giữ nhóm concurrency `deploy-dev` và lần này chờ phía sau |
| `./config.sh: No such file` | Chưa tải gói runner; Phase 5 bước 3 |
| Lần `up` đầu tạo ra một thư mục tên `pg-ca.crt` | File chưa tồn tại trước `up` (`external-db`); xoá thư mục, chép CA, `up` lại |
| `http://<ip-app>/` hiện trang bảo trì | Bình thường trước lần deploy đầu; sau đó xem `dc ps` và log của app |
| Deploy lỗi ở bước đọc `.env` | `chgrp cnh-runner` / `chmod 640` (Phase 5 bước 2) |
| Pull từ registry bị từ chối | Trên GitHub → Packages → `chuyennhahung-app` → settings, cấp cho repository này quyền đọc |
| Các route Planner trả `503` | Database không kết nối được hoặc từ chối đăng nhập: kiểm tra `dc ps`, URL và mật khẩu |
| Một thao tác admin, hoặc một thao tác ghi Planner dùng cookie, trả `403` | `NEXT_PUBLIC_SITE_URL` không phải origin chính xác của trang (scheme, host, port); với `curl`, `Origin` phải bằng nó, và trên VM dev đó là host `nip.io`, không phải IP |
| PostgreSQL từ chối mật khẩu sau khi bạn sinh lại `.env` | Nó giữ mật khẩu từ lần khởi động đầu; nếu chưa có dữ liệu thật, dừng nó và làm rỗng `/opt/chuyennhahung/data/postgres`, rồi `up` lại |

## Những gì đã được kiểm chứng

Trên VM dev ngày 2026-11-15, với output thật của chủ nhà: `setup-host.sh local-db`, tạo `.env`
với mode 640 và nhóm `cnh-runner`, khởi động PostgreSQL và nginx (script init tạo role và cả hai
database, hai container đều healthy, `nginx-health` trả 200), user `cnh-runner` trong nhóm
`docker`, đăng ký runner, chạy nó như một service với drop-in `environment.conf`, và **lần
deploy đầu tiên qua runner**: workflow xanh, `/api/health` trả 200 qua nginx, `.deployed-tag`
ghi đúng commit và container `app` chạy image từ registry và healthy.

Lần deploy đó dạy hai điều, nay đều được xử lý trong tài liệu này: runner đã đăng ký mà thiếu
nhãn `cnh-dev`, nên job nằm `queued` cho tới khi thêm nhãn và khởi động lại service; và
`depends_on: postgres` của `app` khiến Compose **tạo lại container PostgreSQL** ở lần deploy đầu
đó (thời điểm `CREATED` của nó là vài giây, không phải vài giờ), vì stack đã được khởi động từ một
đường dẫn checkout khác. Các lần deploy sau không lặp lại điều này: PostgreSQL giữ nguyên
`StartedAt` qua hai lần deploy tiếp theo, một lần không có và một lần có `--no-deps`. Vì vậy cờ
này là một **biện pháp phòng ngừa**, được test bằng Docker giả, và VM **chưa** cho thấy nó tạo ra
khác biệt; nó bảo vệ khi một bản phát hành sau định nghĩa lại service database. Hãy kiểm tra mục 5
của smoke test sau một bản phát hành có đụng tới `deploy/compose.yml`.

**Chưa kiểm chứng:** hardening unit, tạo admin, `backup.sh` (lệnh Compose của nó sai với layout
này, đã được sửa và test bằng Docker giả, nhưng chưa chạy trên VM), mọi bước khôi phục và xoay
vòng trong [deploy-operations](deploy-operations.vi.md), chính smoke test, và mọi bước của
`external-db` (CA, TLS, `pg_hba.conf`). Coi chúng là chưa xác nhận cho đến khi bạn đã chạy, và
sửa tài liệu này ở chỗ thực tế khác đi.

## Tài liệu liên quan

- [deploy-operations](deploy-operations.vi.md) — vận hành hằng ngày: log, khởi động lại, khôi phục, xoay vòng secret, dọn dẹp, nâng cấp, sự cố.
- [docker-deploy](features/docker-deploy.vi.md) — stack, các file của nó, bind mount, cập nhật bằng tay.
- [deploy-runner](deploy-runner.vi.md) — runner chi tiết: vì sao là service, bạn chấp nhận gì, hardening.
- [auto-deploy-dev](features/auto-deploy-dev.vi.md) và [ADR 0016](adr/0016-auto-deploy-dev.vi.md) — workflow và quyết định.
- [deploy-database](deploy-database.vi.md) — chuyển dữ liệu JSON hiện có sang PostgreSQL, TLS, import.
- [usage → Deploy](usage.vi.md#deploy) — tham chiếu, biến môi trường, thiết lập admin và Google.
