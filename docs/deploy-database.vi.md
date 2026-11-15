# Deploy database — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

Runbook từng bước để chuyển app từ các file JSON trong `.data/` sang một PostgreSQL
thật trên **VM riêng**, kèm việc nạp dữ liệu hiện có. Tài liệu gom những gì
[usage.vi.md](usage.vi.md), [ADR 0009](adr/0009-postgres-persistence.vi.md) và
[ADR 0013](adr/0013-content-on-postgres-tables.vi.md) mô tả rời rạc. Không có gì ở đây
được chạy hộ: mọi bước cần quyền cao do chủ dự án tự làm.

🇬🇧 English version: [deploy-database.md](deploy-database.md)

## Cái gì chuyển và cái gì giữ nguyên

| Dữ liệu | Hiện nằm ở | Sau runbook này |
|---|---|---|
| Planner: tài khoản, phiên, chuyến đi, review cộng đồng, hạn chế | `.data/planner.json` | PostgreSQL (`PLANNER_DATABASE_URL`) |
| Travel Content sửa trong admin: địa điểm, bài viết, bộ sưu tập, review, mẫu | `.data/travel-content.json` | PostgreSQL (`CONTENT_DATABASE_URL`) |
| Nội dung cố định của site: `src/content/*.ts`, `messages/*.json`, `site.ts` | repository | không đổi — nằm trong bản build, không phải file lúc chạy |

Hai kho có thể dùng chung một database (`cnh`): bảng của chúng không trùng nhau.
Khi đã đặt URL, app **không bao giờ quay về file**; DB lỗi thì trả `503`, không trả dữ
liệu cũ. `.data/` không bị đụng tới và chính là đường rollback.

## Trước khi bắt đầu

- PostgreSQL 16 hoặc 17 trên VM DB, và quyền shell có `sudo`.
- IP của VM DB (`<DB_IP>`) và của VM app (`<APP_IP>`, ở đây là `192.168.100.140`).
- **Bản backup mới** của `.data/` (chép cả thư mục; trong đó có hash mật khẩu và
  email — chỉ chủ sở hữu được đọc).
- Trên máy chạy import: checkout có dev dependencies (`npm ci`), vì các script chạy
  qua `vite-node`.
- Mật khẩu chỉ gõ trong terminal của anh/chị. Không vào chat, không vào file sẽ
  commit, không nằm trong dòng lệnh dán đi nơi khác.

## Bước 1 — Tạo role và database

Trên VM DB:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE cnh_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password cnh_app
CREATE DATABASE cnh OWNER cnh_app;
REVOKE ALL ON DATABASE cnh FROM PUBLIC;
```

`\password` hỏi mật khẩu ngay trong terminal. Role sở hữu database vì app tự chạy
migration lúc khởi động (rủi ro đã chấp nhận, ADR 0009 §5).

## Bước 2 — Đường truyền mã hóa (CA riêng)

ADR 0009 §5 bắt buộc TLS có xác minh đầy đủ giữa các máy, và driver `pg` đang dùng coi
`require`, `prefer`, `verify-ca` là `verify-full`. Không có CA công khai thì tự tạo CA
riêng **trên VM DB**. Thay `<DB_IP>`.

```bash
sudo install -d -m 750 -o postgres -g postgres /etc/postgresql/ssl
cd /etc/postgresql/ssl

# CA: giữ ca.key chỉ trên VM này, chỉ root đọc.
sudo openssl genrsa -out ca.key 4096
sudo openssl req -x509 -new -key ca.key -sha256 -days 3650 \
  -subj "/CN=Chuyen Nha Hung DB CA" -out ca.crt

# Chứng chỉ server có SAN chứa đúng IP mà URL sẽ dùng.
sudo openssl genrsa -out server.key 2048
sudo openssl req -new -key server.key -subj "/CN=<DB_IP>" -out server.csr
echo "subjectAltName=IP:<DB_IP>" | sudo tee san.ext >/dev/null
sudo openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 825 -sha256 -extfile san.ext

sudo chown postgres:postgres server.key server.crt
sudo chmod 600 server.key
sudo chmod 600 ca.key
```

Trong `postgresql.conf` (đường dẫn: `/etc/postgresql/<phiên bản>/main/`):

```conf
listen_addresses = 'localhost,<DB_IP>'
ssl = on
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file  = '/etc/postgresql/ssl/server.key'
```

Trong `pg_hba.conf`, mỗi IP client một dòng và **không** có dòng `host` thường cho
cùng role. Chỉ thêm IP của máy Mac này trong lúc import:

```conf
hostssl  cnh  cnh_app  <APP_IP>/32  scram-sha-256
hostssl  cnh  cnh_app  <MAC_IP>/32  scram-sha-256
```

```bash
sudo systemctl restart postgresql
sudo ufw allow from <APP_IP> to any port 5432 proto tcp
sudo ufw allow from <MAC_IP> to any port 5432 proto tcp
```

Chỉ chép `ca.crt` (**công khai**) tới nơi cần kết nối: VM app tại
`/opt/chuyennhahung/secrets/pg-ca.crt` (`chmod 644`) và máy Mac này, ví dụ `~/cnh-pg-ca.crt`.
`ca.key` và `server.key` không bao giờ rời VM DB.

**Không dùng TLS.** Kết nối LAN thường trái ADR 0009 §5. Chỉ được dùng sau khi chủ dự
án chấp nhận bằng văn bản dưới dạng bản sửa đổi ADR đó, đủ hai ngôn ngữ. Trước đó hãy
dùng bước này.

## Bước 3 — Kiểm tra kết nối

Từ máy Mac này, mật khẩu gõ vào shell (không hiện ký tự):

```bash
read -rs DB_PASS; echo
export PLANNER_DATABASE_URL="postgres://cnh_app:${DB_PASS}@<DB_IP>:5432/cnh?sslmode=verify-full&sslrootcert=$HOME/cnh-pg-ca.crt"
export CONTENT_DATABASE_URL="$PLANNER_DATABASE_URL"
unset DB_PASS
psql "$PLANNER_DATABASE_URL" -c 'select 1'
```

Mật khẩu chứa `@ : / ? # %` phải được percent-encode trong URL. Các biến chỉ tồn tại
trong phiên terminal này, không ghi ra file. Lỗi thường gặp: `certificate verify failed`
nghĩa là SAN thiếu `<DB_IP>` hoặc sai file CA; timeout nghĩa là tường lửa hoặc
`listen_addresses`; `no pg_hba.conf entry` nghĩa là thiếu dòng trên cho IP của client.

## Bước 4 — Migrate

Trong **cùng terminal**:

```bash
npm run db:migrate
```

Mong đợi migration `0001` đến `0008` được áp dụng. Rồi kiểm tra ràng buộc trạng thái
review có `held` (migration `0007`):

```bash
psql "$PLANNER_DATABASE_URL" -tA -c \
  "select pg_get_constraintdef(oid) from pg_constraint where conname = 'community_reviews_status_check'"
```

Nếu migration lỗi, dừng lại và đọc đúng thông báo; không sửa file đã áp dụng. Rollback
thủ công từ `db/rollback/` (sẽ xóa bảng — hãy export trước).

## Bước 5 — Import dữ liệu hiện có

1. Dừng mọi thứ đang dùng các file JSON (dev server, container cũ).
2. Dùng bản sao của file làm nguồn, không dùng file đang chạy.
3. Import từ chối bảng không rỗng; không bao giờ xóa dữ liệu thật để lấy chỗ.

```bash
export TRAVEL_CONTENT_AUTOSEED=false
npm run planner:import -- /path/to/backup/planner.json
npm run content:import -- /path/to/backup/travel-content.json
```

`planner:import` đọc danh mục content để kiểm tra địa điểm, nên phải chạy với cùng
nguồn content như app. Nếu báo lỗi, import content trước.

## Bước 6 — Xác minh

So số bản ghi với JSON, không in nội dung từng dòng:

```bash
node -e 'const d=require(process.argv[1]);for(const k in d)console.log(k,Array.isArray(d[k])?d[k].length:"-")' /path/to/backup/travel-content.json
psql "$PLANNER_DATABASE_URL" -c '\dt'
psql "$PLANNER_DATABASE_URL" -tA -c "select count(*) from <table>"
```

Sau đó export một vòng rồi so lại số lượng:

```bash
npm run planner:export -- /tmp/planner-check.json
npm run content:export -- /tmp/content-check.json
chmod 600 /tmp/planner-check.json /tmp/content-check.json
```

Cuối cùng chạy app với cả hai URL và `TRAVEL_CONTENT_AUTOSEED=false`, đăng nhập, mở một
chuyến đi và một bài viết. Xóa các file kiểm tra sau đó.

## Bước 7 — Làm cho bền vững

Khi phát triển cục bộ: giữ các biến trong profile shell của riêng anh/chị hoặc công cụ
quản lý bí mật, không đặt trong repository (`.env*` không vào version control).

Trên VM app, đặt chuỗi kết nối trong `.env` của stack (mode `600`), với đường dẫn CA
dùng bên trong container:

```bash
PLANNER_DATABASE_URL=postgres://cnh_app:<password>@<DB_IP>:5432/cnh?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt
CONTENT_DATABASE_URL=postgres://cnh_app:<password>@<DB_IP>:5432/cnh?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt
TRAVEL_CONTENT_AUTOSEED=false
```

```bash
docker compose -f compose.yml -f compose.app.yml -f compose.app.external-db.yml up -d app
```

Overlay [`deploy/compose.app.external-db.yml`](../deploy/compose.app.external-db.yml) đã
mount CA tại `/run/secrets/pg-ca.crt`; hãy chép file vào đó **trước** `up`, nếu không
Docker tạo ra một thư mục thay chỗ.

## Backup và khôi phục

Chạy theo lịch, từ máy có thể tới DB:

```bash
umask 077
pg_dump --format=custom "$PLANNER_DATABASE_URL" > "cnh-$(date +%F).dump"
```

Khôi phục vào database trống bằng `pg_restore --dbname=... cnh-<ngày>.dump`. Hãy thử
khôi phục ít nhất một lần. Bản dump chứa hash mật khẩu và digest token: chỉ chủ sở hữu
đọc được, không để trên ổ chia sẻ. Giữ một bản ngoài VM DB.

## Rollback về file JSON

1. Export trước: `npm run planner:export -- planner.json` và `npm run content:export -- content.json`.
2. Bỏ đặt `PLANNER_DATABASE_URL` và `CONTENT_DATABASE_URL`.
3. Trỏ `PLANNER_STORE` và `TRAVEL_CONTENT_STORE` tới các file vừa export rồi khởi động lại.

Dữ liệu ghi sau lần export cuối sẽ mất, nên hãy export trước khi chuyển về. Thư mục
`.data/` gốc là bản dự phòng cũ hơn.

## Các kiểm tra chưa chạy ở đây

- Test tích hợp cần một database **tạm** trong `TEST_DATABASE_URL`; không có thì bị bỏ
  qua và phải báo là chưa chạy.
- Runbook này viết dựa trên repository, chưa chạy trên server của anh/chị. Hãy báo lại
  những gì đã chạy và những gì lỗi.

## Giới hạn và câu hỏi mở

- Một role vừa migrate vừa phục vụ (rủi ro đã chấp nhận ở ADR 0009).
- Rate limiter nằm trong từng tiến trình, nên chỉ chạy một replica app.
- Tường lửa VM DB, gia hạn chứng chỉ (825 ngày ở đây) và nơi lưu backup do chủ dự án
  vận hành; hãy đặt nhắc việc trước khi chứng chỉ server hết hạn.
