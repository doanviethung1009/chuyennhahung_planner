# Cách sử dụng — Chuyện Nhà Hưng

🇬🇧 English version: [usage.md](usage.md)

Cách chạy, kiểm chứng và mở rộng ứng dụng. Muốn biết *nó gồm những gì*, đọc
[architecture.vi.md](architecture.vi.md).

## Yêu cầu

- **Node 24 LTS**, ghim trong `.nvmrc` (`24.22.2`) — chạy `nvm use` trong repo. CI
  đọc cùng file đó, nên máy và CI không thể lệch nhau. `engines.node` là `>=24`, và
  npm cảnh báo nếu dùng bản cũ hơn.
  Override `magic-string` mà Node 20.14 cần đã được gỡ. Vitest vẫn ở 3.x: Node 24
  giờ *cho phép* Vitest 4/5, nhưng việc nâng đó chưa được làm.
- npm (repo có sẵn `package-lock.json`).
- Google Chrome ở đường dẫn mặc định của macOS, chỉ dùng cho `npm run verify:ui`.

## Cài và chạy

```bash
npm install
npm run dev          # http://localhost:3000
```

Tiếng Việt ở `/`, tiếng Anh ở `/en`. Site chạy được mà không cần `.env` nào cả;
mọi biến dưới đây đều có mặc định dùng được, hoặc tự tắt tính năng theo hướng
đóng an toàn.

| Biến | Mặc định | Làm gì |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://chuyennhahung.vn` | Canonical, `hreflang`, sitemap. Phải đặt lúc **build** |
| `ADMIN_API_TOKEN` | *chưa đặt* | Bảo vệ mọi route admin. Chưa đặt, hoặc ngắn hơn 32 ký tự, thì tất cả trả `503` — không bao giờ mở mặc định |
| `TRAVEL_CONTENT_STORE` | `.data/travel-content.json` | Nơi content store nằm |
| `TRAVEL_CONTENT_AUTOSEED` | `true` | Đặt `false` để bỏ qua seed nội dung demo ở lần dùng đầu |
| `PLANNER_STORE` | `.data/planner.json` | Nơi trip của Planner nằm. Tách file khỏi content store một cách có chủ đích. Bị bỏ qua khi đã đặt `PLANNER_DATABASE_URL` |
| `PLANNER_DATABASE_URL` | *chưa đặt* | Chuỗi kết nối PostgreSQL. Đã đặt: Planner dùng PostgreSQL và không bao giờ quay về file ([ADR 0009](adr/0009-postgres-persistence.vi.md)). Là secret — chỉ qua biến môi trường. Xem *Chạy Planner trên PostgreSQL* |
| `DATABASE_POOL_MAX` | `5` | Kích thước connection pool của mỗi tiến trình |
| `TEST_DATABASE_URL` | *chưa đặt* | Database nháp cho `tests/planner-postgres.integration.test.ts`. Chưa đặt thì các test đó bị bỏ qua |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | *chưa đặt* | Đăng nhập Google ([ADR 0007](adr/0007-password-and-google-sign-in.vi.md)). Cần cả hai; thiếu thì các route Google trả 404 và nút bị ẩn. Chỉ phía server — không bao giờ là `NEXT_PUBLIC_*` |
| `GOOGLE_SIGNUP_ENABLED` | `true` | `false` thì lần đăng nhập Google đầu tiên không tạo tài khoản; tài khoản đã có vẫn đăng nhập được |
| `GOOGLE_REDIRECT_URI` | *suy ra* | Ghi đè URL callback; nếu không thì là `NEXT_PUBLIC_SITE_URL` (hoặc origin của request) + `/api/planner/oauth/google/callback`. Phải khớp đúng từng ký tự với Google Cloud Console |

`.data/` đã được gitignore. Planner không seed gì trong đó — xem *Cấp tài khoản
cho một người đi chơi trong Planner* bên dưới.

Mỗi bản clone cần thêm một bước nữa mà git không tự làm được — bật các git hook
đã được theo dõi trong repo, để commit không lọt vào `main`:

```bash
git config core.hooksPath .githooks
```

`pre-commit` từ chối commit khi bạn đang ở `main`, còn `pre-push` từ chối cú push
làm `main` dịch chuyển; cả hai đều chỉ lại đường đi qua branch và PR. Nếu thật sự
cố ý thì ghi đè bằng `--no-verify`.

## Các lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Dev server với Turbopack |
| `npm run build` | Build production — prerender toàn bộ 57 trang |
| `npm start` | Chạy bản build production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, flat config |
| `npm run test` | Vitest, chạy một lượt |
| `npm run db:migrate` | Áp dụng `db/migrations/*.sql` vào `PLANNER_DATABASE_URL`; idempotent. Tuỳ chọn: app chạy cùng đoạn code đó lúc khởi động |
| `npm run planner:import -- <file>` | Nạp một `planner.json` vào Planner PostgreSQL đang trống, có kiểm tra, trong một transaction |
| `npm run planner:export -- <file>` | Ghi Planner PostgreSQL ra `planner.json` (sao lưu và rollback) |
| `npm run verify:ui` | Chụp 13 route ở 375/768/1440 vào `screenshots/`, fail nếu tràn ngang |
| `npm run covers` | Sinh lại tranh cover SVG vào `public/images/covers/` |

`verify:ui` cần một server dev hoặc production đang chạy, và nhận thêm base URL
cùng thư mục xuất tuỳ chọn:
`node scripts/screenshots.mjs http://localhost:3000 out/shots`.

## Định nghĩa "xong"

Mọi thay đổi đều kết thúc bằng ba lệnh này, và phải **nêu đúng kết quả thật**:

```bash
npm run typecheck && npm run lint && npm run test
```

Thay đổi UI thì phải xem lại ở 375px, 768px và 1280px. Nếu có gì fail hoặc bị bỏ
qua, nói ra — báo "xong" trên một lần chạy đang fail là lỗi duy nhất không sửa
lại được ở đây.

`.github/workflows/ci.yml` chạy đúng ba lệnh đó cộng thêm `npm run build` trên mọi
PR vào `main`. Hãy xem nó là ý kiến thứ hai, không phải cổng chặn: các check này
**không thể đặt thành bắt buộc** khi repo còn private trên GitHub Free, vì ở đó
không có branch protection lẫn ruleset. Vì vậy một lần chạy đỏ không ngăn được
merge — vẫn phải có người xem.

## Những việc thường làm

### Thêm một mục nội dung

1. Thêm vào bộ dữ liệu trong `src/content/<collection>.ts`, điền cả `vi` **và**
   `en` cho mọi field `Localized<T>`. `typecheck` sẽ bắt nếu thiếu locale.
2. Slug viết thường, nối bằng gạch ngang, không trùng — `tests/content.test.ts`
   kiểm tra điều này.
3. Chạy `npm run covers` để mục mới có tranh cover, hoặc trỏ `cover` tới một ảnh
   thật trong `public/images/`.
4. Điểm đến còn cần `coords` WGS84 thật; bản đồ chiếu theo toạ độ đó, sai một con
   số là có một cái ghim trông rất thật nằm sai chỗ.

### Cấp tài khoản cho một người đi chơi trong Planner

Tài khoản nhân viên do người vận hành cấp; access token chỉ hiện ra **một lần**
— nếu mất thì xoay vòng lại; không đọc lại được. Khách hàng cũng tự tạo được tài
khoản bằng cách đăng nhập Google (xem bên dưới). Thêm `email` thì response có kèm
`temporaryPassword`, chỉ hiện một lần; người đó đăng nhập ở `/dang-nhap` bằng mật
khẩu này và được đưa tới `/doi-mat-khau` để tự đặt mật khẩu riêng.

```bash
# 1. Một secret thật, tối thiểu 32 ký tự, nếu không mọi route admin trả 503.
export ADMIN_API_TOKEN="$(openssl rand -base64 36)"

# 2. Tạo người đi chơi. Giữ lại `accessToken` trong response.
curl -s -X POST http://localhost:3000/api/admin/planner/users \
  -H "authorization: Bearer $ADMIN_API_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"handle":"hung-tran","displayName":"Hưng Trần"}'

# 3. Chính token đó — không phải token admin — mới chạm được tới trip của họ.
curl -s http://localhost:3000/api/planner -H "authorization: Bearer <accessToken>"
```

Trình duyệt không dùng trực tiếp token đó — nó đăng nhập một lần và nhận một
cookie `HttpOnly` ([ADR 0004](adr/0004-planner-identity.vi.md)). Với curl thì
dùng cookie jar:

```bash
# Đăng nhập. Cookie vào jar; JavaScript không bao giờ đọc được nó.
curl -s -c jar.txt -X POST http://localhost:3000/api/planner/session \
  -H 'content-type: application/json' \
  -d '{"accessToken":"<accessToken>"}'

# Đọc thì không cần gì thêm.
curl -s -b jar.txt http://localhost:3000/api/planner

# Request có thay đổi dữ liệu phải nêu Origin cùng origin — đó là luật CSRF mà
# cookie bắt buộc, và request cookie thiếu nó sẽ bị từ chối 403.
curl -s -b jar.txt -X POST http://localhost:3000/api/planner \
  -H 'origin: http://localhost:3000' -H 'content-type: application/json' \
  -d '{"source":"blank","title":"Đà Lạt 3 ngày","destinationSlug":"da-lat","durationDays":3,"partySize":2,"budget":{"targetTotalVnd":5000000}}'

# Đăng xuất.
curl -s -b jar.txt -X DELETE http://localhost:3000/api/planner/session \
  -H 'origin: http://localhost:3000'
```

Một session sống 14 ngày, hoặc 7 ngày nếu không dùng. `rotate-token` đăng xuất
người đi chơi khỏi mọi nơi.

Vai trò ([ADR 0006](adr/0006-unified-identity-and-roles.vi.md)): `role` là
`member` (mặc định), `editor` hoặc `admin`. Hiện chưa có gì áp dụng vai trò — chỉ
ghi lại. Nâng admin đầu tiên bằng admin token; body là strict, nên key nào khác
`role` đều bị từ chối với 422.

```bash
# Tạo thẳng một admin (`role` tùy chọn khi POST).
curl -s -X POST http://localhost:3000/api/admin/planner/users \
  -H "authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d '{"handle":"admin-hung","displayName":"Hưng","role":"admin"}'

# Hoặc nâng một user có sẵn. Gọi lại an toàn; hạ vai trò cũng là lệnh này.
curl -s -X PATCH http://localhost:3000/api/admin/planner/users/<userId> \
  -H "authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d '{"role":"admin"}'
```

Mật khẩu và Google ([ADR 0007](adr/0007-password-and-google-sign-in.vi.md)):

```bash
# Tạo tài khoản nhân viên kèm email: giữ lại `temporaryPassword` (chỉ hiện một lần).
curl -s -X POST http://localhost:3000/api/admin/planner/users \
  -H "authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d '{"handle":"lan-nguyen","displayName":"Lan Nguyễn","email":"lan@example.com"}'

# Quên mật khẩu: cấp mật khẩu tạm mới, và mọi session kết thúc.
curl -s -X POST http://localhost:3000/api/admin/planner/users/<userId>/reset-password \
  -H "authorization: Bearer $ADMIN_API_TOKEN"

# Gỡ liên kết Google.
curl -s -X DELETE http://localhost:3000/api/admin/planner/users/<userId>/google \
  -H "authorization: Bearer $ADMIN_API_TOKEN"
```

Để bật Google ở máy local, tạo một OAuth client loại *Web application* trên Google
Cloud Console, đăng ký `http://localhost:3000/api/planner/oauth/google/callback`
làm redirect URI, rồi đặt `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` trong
`.env.local` (không bao giờ commit). Lần đăng nhập Google đầu tiên với email chưa
có tài khoản sẽ tạo tài khoản mới.
Email đã có tài khoản thì bị từ chối với `link_required` — Google không bao giờ
được liên kết theo email. Người đó đăng nhập bằng mật khẩu rồi bấm "Liên kết tài
khoản Google" ở `/doi-mat-khau`.

Sửa một trip đang có thì cần version lấy từ `ETag` của nó:

```bash
curl -s -X PATCH http://localhost:3000/api/planner/<id> \
  -H "authorization: Bearer <accessToken>" \
  -H 'if-match: "3"' -H 'content-type: application/json' \
  -d '{"partySize":4}'
```

Thiếu `If-Match` thì nhận 428; version lạc hậu thì 412. Xem
[features/travel-planner-core.vi.md](features/travel-planner-core.vi.md) để có
danh sách endpoint đầy đủ.

### Chạy Planner trên PostgreSQL

Khi đặt `PLANNER_DATABASE_URL`, Planner lưu dữ liệu trong PostgreSQL 16 hoặc 17
([ADR 0009](adr/0009-postgres-persistence.vi.md)); không đặt thì không có gì đổi
— file JSON khi phát triển, memory store khi test. Khi đã đặt, app **không bao
giờ quay về** file JSON: database sập thì các route Planner trả
`503 service_unavailable`.

**Thiết lập một lần, do chủ nhà làm trên máy chạy database.** Tạo một role và
database riêng; không superuser, không `CREATEDB`. Dùng mật khẩu thật lấy từ nơi
lưu secret — `<password>` bên dưới chỉ là chỗ giữ chỗ:

```sql
CREATE ROLE planner LOGIN PASSWORD '<password>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE planner OWNER planner;
```

Không mở cổng 5432 ra giao diện công khai (dùng mạng Docker riêng, không publish
cổng). Vì migration chạy khi khởi động, role của app phải tạo và sửa được bảng:
dùng một role sở hữu database cho cả migrate lẫn chạy app. **Rủi ro đã chấp nhận
(ADR 0009):** nếu credential của app bị lộ hoặc app dính lỗi injection, kẻ tấn
công cũng có quyền DDL. Muốn tách một role chủ cho `npm run db:migrate` khỏi một
role app chỉ có quyền DML (`GRANT SELECT, INSERT, UPDATE, DELETE` trên các bảng
Planner, `USAGE` trên schema) thì cần một công tắc tắt migration khi khởi động, thứ
hiện chưa có.

Nếu một replica khác đang giữ lock migration, lúc khởi động app chờ tối đa 30 giây
rồi trả `503`; các request trong 5 giây sau nhận luôn `503` đó mà không thử lại,
để database đang chết không bị dội request. Biến cũ `DATABASE_URL` bị bỏ qua — app
ghi cảnh báo nếu nó được đặt mà không có `PLANNER_DATABASE_URL`.

Kết nối tới Postgres không mã hoá trên mạng Docker riêng, điều này chỉ chấp nhận
được khi database còn nằm trên cùng máy. Nếu sau này database chuyển sang máy
khác, hãy bắt buộc TLS bằng cách thêm `?sslmode=require` (hoặc `verify-full` kèm
CA của server) vào `PLANNER_DATABASE_URL`.

```bash
# Chuỗi kết nối là secret: chỉ qua biến môi trường, không commit, không log.
export PLANNER_DATABASE_URL='postgres://planner:<password>@<db-host>:5432/planner'

npm run db:migrate                       # tuỳ chọn: app tự migrate lúc khởi động
npm run planner:import -- planner.json   # một lần, để chuyển file JSON hiện có vào
npm run planner:export -- backup.json    # ghi ra planner.json mà JSON store mở được
```

App tự áp dụng các migration còn thiếu ở lần đầu dùng database (trước khi phục vụ
request nào), dưới một advisory lock của PostgreSQL, nên các replica khởi động
cùng lúc chỉ áp dụng mỗi file một lần. Nếu thất bại — database tắt, file hỏng hoặc
bị sửa sau khi đã chạy — route Planner trả `503` và request kế tiếp thử lại; dòng
log chỉ có mã lỗi, nên chạy `npm run db:migrate` để xem thông báo thật.
`db:migrate` chạy cùng đoạn code đó bằng tay (CI, lần import đầu) và áp dụng lần lượt các file đánh số trong `db/migrations/`, mỗi file
trong một transaction riêng, và ghi vào `schema_migrations`; chạy lại thì không
làm gì, và file bị sửa sau khi đã áp dụng sẽ bị từ chối. Rollback của từng
migration nằm trong `db/rollback/` và được chạy tay — nó **xoá bảng**, nên phải
export trước.

`planner:import` kiểm tra từng bản ghi, chạy kiểm tra toàn vẹn của Planner, rồi
chèn tất cả trong một transaction. Nó từ chối chạy nếu bảng Planner nào đã có
dòng, và bỏ lại các session đã hết hạn. Hãy làm khi app đang dừng, rồi khởi động
app với `PLANNER_DATABASE_URL`. Ba lệnh này chạy qua `vite-node` (phụ thuộc của Vitest)
nên cần cài dev dependencies — chạy từ bản checkout hoặc giai đoạn build, không
phải image runtime `--omit=dev`. Import đọc catalog nội dung để kiểm tra place
nên cần cùng `TRAVEL_CONTENT_STORE` với app.

**Sao lưu.** Làm cả hai: `pg_dump --format=custom "$PLANNER_DATABASE_URL" > planner.dump`
(khôi phục bằng `pg_restore`) và `npm run planner:export -- planner-$(date +%F).json`.
Bản export cũng là đường rollback: bỏ `PLANNER_DATABASE_URL`, trỏ `PLANNER_STORE` vào file
đã export, khởi động lại. Những gì ghi sau lần export cuối sẽ mất, nên export
trước. Cả hai file chứa hash mật khẩu và digest token — chỉ cho chủ sở hữu đọc.
Script export tự đặt quyền `0600`; `pg_dump` thì không, nên chạy
`chmod 600 planner.dump` sau đó (hoặc `umask 077` trước).

**Test với database thật.** Đặt `TEST_DATABASE_URL` trỏ tới một database *nháp*
(không bao giờ là database có dữ liệu thật). `npm run test` khi đó chạy thêm
`tests/planner-postgres.integration.test.ts` trong một schema tạm do chính nó tạo
và xoá. Không có biến này, file đó bị bỏ qua và lần chạy phải được báo là **chưa
chạy**, không phải là đã qua.

### Thêm một chuỗi hiển thị cho người dùng

Thêm key vào **cả** `messages/vi.json` và `messages/en.json`, rồi đọc bằng
`useTranslations` / `getTranslations`. Không bao giờ hard-code chuỗi trong
component. `tests/i18n.test.ts` kiểm tra key khớp nhau, placeholder ICU khớp
nhau, và cảnh báo khi một giá trị tiếng Việt bị copy nguyên sang tiếng Anh.

### Thêm một route

1. Thêm pathname nội bộ cùng đoạn VI và EN vào `pathnames` trong
   [`src/i18n/routing.ts`](../src/i18n/routing.ts).
2. Tạo thư mục tương ứng dưới `src/app/[locale]/`.
3. Export `generateMetadata` dùng `buildPageMetadata` từ
   [`src/lib/metadata.ts`](../src/lib/metadata.ts).
4. Thêm vào `src/app/sitemap.ts`, và vào `primaryNav` / `footerExtraNav` trong
   [`nav-items.ts`](../src/components/layout/nav-items.ts) nếu nó thuộc một menu.
5. Thêm nhãn điều hướng vào cả hai file messages.
6. Thêm route vào `scripts/screenshots.mjs`.
7. Viết tài liệu: một tài liệu tính năng trong
   [`features/`](features/README.vi.md) bằng cả hai ngôn ngữ, và cập nhật bảng
   route trong [architecture.md](architecture.md) cùng
   [architecture.vi.md](architecture.vi.md).

### Thêm một design token

Thêm vào `@theme` trong [`globals.css`](../src/app/globals.css) — nơi duy nhất
được phép — rồi dùng utility sinh ra từ nó. Nếu đó là màu chữ hoặc màu của một
control, mở rộng `tests/design-tokens.test.ts` để tương phản được *kiểm tra*, chứ
không phải được *giả định*.

### Thêm một locale

Ba việc làm cùng lúc: `locales` + `pathnames` trong `routing.ts`, thêm
`messages/<locale>.json`, và thêm key mới vào mọi field `Localized<T>` trong
`src/content/**`. `tests/i18n.test.ts` và `tests/content.test.ts` sẽ fail đến khi
làm đủ cả ba.

## Trước khi lên sóng — việc của chủ nhà

Đây là các giá trị hợp lý nhưng **chưa được kiểm chứng**. Phải xác nhận từng mục:

1. **Handle Facebook** — `src/content/site.ts` đang giả định `chuyennhahung`.
2. **Email liên hệ** — `hello@chuyennhahung.vn` phải tồn tại thật; trang thiết kế
   chuyến đi có link `mailto:` điền sẵn tới địa chỉ này.
3. **URL site** — đặt `NEXT_PUBLIC_SITE_URL`; nó quyết định canonical, `hreflang`
   và sitemap.
4. **Ảnh** — thay tranh SVG sinh tự động bằng ảnh thật.
5. **Đăng nhập Google** — tạo OAuth client của Google, đăng ký redirect URI của
   production, và đặt `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` trong môi trường
   triển khai.
6. **Database của Planner** — tạo role và database PostgreSQL riêng (xem *Chạy
   Planner trên PostgreSQL*), giữ cổng ở mạng riêng, lưu `PLANNER_DATABASE_URL` như một
   secret, có thể chạy `npm run db:migrate` (app tự làm lúc khởi động), và import `planner.json` hiện có một lần.
7. **Thông báo quyền riêng tư** — khách đăng ký bằng Google được lưu tên và email;
   hãy đăng thông báo quyền riêng tư và cách yêu cầu xoá dữ liệu (Nghị định
   13/2023) trước khi bật đăng ký trên production, hoặc đặt
   `GOOGLE_SIGNUP_ENABLED=false` cho tới lúc đó.

## Deploy

`npm run build` tạo ra một site prerender, nên host Next.js nào chạy được Node
cũng dùng được (Node server sau nginx, container). API Planner là ngoại lệ của
"không phụ thuộc dữ liệu lúc chạy": khi đặt `PLANNER_DATABASE_URL` nó cần một PostgreSQL
truy cập được lúc chạy, và file mới trong `db/migrations/` được instance đầu tiên của phiên bản mới áp dụng
dưới một advisory lock (vẫn có thể chạy `npm run db:migrate` trước khi deploy). Không đặt `PLANNER_DATABASE_URL` thì Planner dùng
file JSON và app chỉ chạy được một tiến trình.
`NEXT_PUBLIC_SITE_URL` phải được đặt lúc **build** — nó được nướng vào canonical,
`hreflang` và sitemap. Đổi nội dung thì phải build lại; hiện chưa có CMS và chưa
có đường revalidate.

## Khắc phục sự cố

| Hiện tượng | Nguyên nhân |
|---|---|
| `require() of ES Module` từ `@tailwindcss/node` | Đang chạy Node cũ hơn `.nvmrc` — chạy `nvm use` |
| `npm warn EBADENGINE` khi cài | Cùng nguyên nhân: Node cũ hơn `.nvmrc`. Chạy `nvm use`, rồi `npm ci` |
| `npm warn install-scripts … not yet covered by allowScripts` | Có dependency mới mang install script, hoặc một package đã duyệt vừa đổi phiên bản — các phê duyệt trong `allowScripts` của `package.json` được ghim theo `pkg@version`. Kiểm tra đúng là package bạn mong đợi, rồi `npm install-scripts approve <pkg>` và commit thay đổi trong `package.json`. Lưu ý `--dry-run` vẫn ghi file ở npm 11.19 |
| Route Planner trả `503 service_unavailable` | Đã đặt `PLANNER_DATABASE_URL` mà database không truy cập được hoặc từ chối đăng nhập — kiểm tra host, role và chạy `npm run db:migrate` để xem vì sao migration lúc khởi động thất bại. App cố ý không quay về file JSON |
| `relation "trips" does not exist` | Migration lúc khởi động chưa hoàn tất trên database đó — chạy `npm run db:migrate` và đọc thông báo của nó |
| Một URL tiếng Việt trả 404 | Pathname chưa có trong `pathnames` ở `routing.ts`, hoặc tên thư mục không khớp pathname nội bộ |
| `MISSING_MESSAGE` lúc chạy | Key chỉ được thêm vào một file messages |
| `npm run verify:ui` không mở được browser | Chrome không nằm ở đường dẫn macOS hard-code trong `scripts/screenshots.mjs` |
| Dấu tiếng Việt hiển thị sai | Thêm font mà thiếu subset `vietnamese` |
