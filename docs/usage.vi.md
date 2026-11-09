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
| `PLANNER_STORE` | `.data/planner.json` | Nơi trip của Planner nằm. Tách file khỏi content store một cách có chủ đích |

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

Planner không có đăng ký. Mọi người đi chơi đều do người vận hành cấp tài khoản,
và access token chỉ hiện ra **một lần** — nếu mất thì xoay vòng lại; không đọc
lại được.

Có hai loại mã, rất dễ nhầm:

| Mã | Ai giữ | Mở được gì |
|---|---|---|
| `ADMIN_API_TOKEN` | người vận hành (server đọc từ `.env.local`) | API quản trị — tạo người đi chơi, cấp lại mã cho họ |
| `accessToken` | một người đi chơi | các chuyến đi của chính người đó — là mã gõ vào trang `/dang-nhap` |

**Bước 1 — đưa khóa quản trị cho server.** Phải là *server* đọc được khóa; lệnh
`export` trong terminal chỉ có tác dụng với các lệnh gõ ở terminal đó, không tới
được một `npm run dev` đang chạy. Ghi khóa vào `.env.local` (đã gitignore) rồi
khởi động lại dev server (nếu file đã có dòng này thì bỏ qua bước này):

```bash
printf 'ADMIN_API_TOKEN=%s\n' "$(openssl rand -base64 36 | tr -d '\n/+=')" >> .env.local
```

**Bước 2 — nạp cùng khóa đó vào terminal**, đứng ở thư mục chứa `.env.local`, để
`curl` gửi được. Lệnh không in gì ra:

```bash
export ADMIN_API_TOKEN="$(grep '^ADMIN_API_TOKEN=' .env.local | cut -d= -f2-)"
```

**Bước 3 — xác định cổng.** `npm run dev` in ra `Local: http://localhost:<cổng>`.
Nếu 3000 đã có người dùng, Next tự chuyển sang 3001, 3002… và khi đó
`localhost:3000` là server *của người khác*. Dùng đúng cổng server của bạn in ra;
các ví dụ bên dưới ghi 3000.

**Bước 4 — tạo người đi chơi.** Giữ lại `accessToken` trong kết quả: mã chỉ hiện
**một lần**, hệ thống chỉ lưu bản băm.

```bash
curl -s -X POST http://localhost:3000/api/admin/planner/users \
  -H "authorization: Bearer $ADMIN_API_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"handle":"hung-tran","displayName":"Hưng Trần"}'
```

Kết quả thành công có dạng
`{"user":{"id":"usr_…","handle":"hung-tran",…},"accessToken":"…64 ký tự…"}`.
Gửi `accessToken` riêng cho người đi chơi; không dán vào chat, issue hay commit.

Các lệnh quản trị khác cho người đi chơi:

```bash
# Liệt kê người đi chơi (không bao giờ trả về mã).
curl -s http://localhost:3000/api/admin/planner/users \
  -H "authorization: Bearer $ADMIN_API_TOKEN"

# Mất hoặc lộ mã: cấp mã mới. Mã cũ hết hiệu lực ngay và người đó bị đăng xuất
# ở mọi nơi.
curl -s -X POST http://localhost:3000/api/admin/planner/users/<userId>/rotate-token \
  -H "authorization: Bearer $ADMIN_API_TOKEN"
```

Mã của người đi chơi — không phải khóa quản trị — mới mở được chuyến đi của họ:

```bash
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

### Chạy thử Planner từ đầu đến cuối

Toàn bộ hành trình của người đọc trong [tính năng đi theo dấu chân](features/follow-hung-footsteps.vi.md),
làm tay trên trình duyệt. Làm sau mục *Cấp tài khoản cho một người đi chơi trong
Planner*, với `accessToken` của người đó trong tay. Đường dẫn dưới đây là bản
tiếng Việt; site tiếng Anh có cùng các trang dưới `/en`.

1. **Đọc câu chuyện.** Mở `/chuyen-di-choi/di-da-lat-lan-thu-sau`. Gần cuối bài có
   phần "Lịch trình thực tế" (các ngày thật của chuyến đó) và nút để tự lên kế
   hoạch. Hiện đây là câu chuyện duy nhất gắn với một template
   (`da-lat-3-ngay-lang-man`); các câu chuyện khác không có hai phần này.
2. **Tuỳ chỉnh bản sao.** Nút mở `/tao-chuyen-di/da-lat-3-ngay-lang-man`. Điền tên
   chuyến, ngày đi, số người, ngân sách, phong cách, nhịp độ và ghi chú, rồi lưu.
   Chưa cần đăng nhập: bản nháp chỉ nằm trong tab trình duyệt này
   (`sessionStorage`), không lên server.
3. **Đăng nhập.** Lưu khi chưa đăng nhập sẽ chuyển tới `/dang-nhap`. Dán
   `accessToken`. Bạn quay lại form, bản nháp vẫn còn, và chuyến đi được lưu.
   Trình duyệt giờ giữ một cookie phiên `HttpOnly`; bản thân mã không được lưu
   trong trình duyệt.
4. **Tìm trong Chuyến đi của tôi.** `/chuyen-di-cua-toi` liệt kê chuyến đi. Mở nó.
   Ở trang chi tiết bạn đặt được tình trạng kế hoạch (Bản nháp / Đã lên kế hoạch /
   Đã đi xong), nhân bản, lưu trữ và chia sẻ. Bản sao là độc lập: sửa nó không bao giờ
   làm thay đổi template gốc hay câu chuyện.
5. **Chia sẻ.** Trong "Chia sẻ chuyến đi", đổi "Ai xem được":

   | Lựa chọn | Ai mở được link | Công cụ tìm kiếm |
   |---|---|---|
   | Riêng tư | không ai — không có link | — |
   | Ai có đường dẫn đều xem được | ai có link | không lập chỉ mục |
   | Công khai | ai có link | được phép lập chỉ mục |

   Rồi bấm "Sao chép đường dẫn". Link có dạng `/chia-se/<43 ký tự>`.
6. **Mở như người lạ.** Dán link vào cửa sổ ẩn danh. Bạn thấy lịch trình chỉ đọc,
   không có nút sửa, không cần đăng nhập. Bạn không thấy chủ chuyến đi, ghi chú
   chung của chuyến đi hay khoản chi nào.
7. **Thu hồi.** "Tạo đường dẫn mới" làm link cũ chết ngay và tạo link mới; "Ngừng
   chia sẻ" đưa chuyến đi về riêng tư. Tải lại cửa sổ ẩn danh: link cũ giờ hiện
   trang không tìm thấy ("Đi lạc rồi").

Nếu một bước không chạy như trên, xem *Khắc phục sự cố* bên dưới.

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

## Deploy

`npm run build` tạo ra một app prerender hoàn toàn, không phụ thuộc dữ liệu lúc
chạy, nên host Next.js nào cũng được (Vercel, Node server sau nginx, container).
`NEXT_PUBLIC_SITE_URL` phải được đặt lúc **build** — nó được nướng vào canonical,
`hreflang` và sitemap. Đổi nội dung thì phải build lại; hiện chưa có CMS và chưa
có đường revalidate.

## Khắc phục sự cố

| Hiện tượng | Nguyên nhân |
|---|---|
| `require() of ES Module` từ `@tailwindcss/node` | Đang chạy Node cũ hơn `.nvmrc` — chạy `nvm use` |
| `npm warn EBADENGINE` khi cài | Cùng nguyên nhân: Node cũ hơn `.nvmrc`. Chạy `nvm use`, rồi `npm ci` |
| `npm warn install-scripts … not yet covered by allowScripts` | Có dependency mới mang install script, hoặc một package đã duyệt vừa đổi phiên bản — các phê duyệt trong `allowScripts` của `package.json` được ghim theo `pkg@version`. Kiểm tra đúng là package bạn mong đợi, rồi `npm install-scripts approve <pkg>` và commit thay đổi trong `package.json`. Lưu ý `--dry-run` vẫn ghi file ở npm 11.19 |
| Một URL tiếng Việt trả 404 | Pathname chưa có trong `pathnames` ở `routing.ts`, hoặc tên thư mục không khớp pathname nội bộ |
| `MISSING_MESSAGE` lúc chạy | Key chỉ được thêm vào một file messages |
| `npm run verify:ui` không mở được browser | Chrome không nằm ở đường dẫn macOS hard-code trong `scripts/screenshots.mjs` |
| Dấu tiếng Việt hiển thị sai | Thêm font mà thiếu subset `vietnamese` |
| `admin_auth_unconfigured` (503) từ một route admin | **Server** chưa có `ADMIN_API_TOKEN` từ 32 ký tự. Ghi vào `.env.local` và khởi động lại `npm run dev` — `export` ở terminal khác không tới được server đang chạy. Nếu đã có, bạn đang gọi nhầm server: kiểm tra cổng mà `npm run dev` in ra |
| `unauthorized` (401) từ một route admin | Khóa `curl` gửi khác khóa của server. Chạy lại dòng `export … .env.local` ở thư mục chứa đúng `.env.local` đó |
| `localhost:3000` trả lời nhưng là hành vi cũ hoặc ứng dụng khác | Một dev server khác (worktree khác, dự án khác) đang giữ cổng 3000; server của bạn đã chuyển sang 3001+. Dùng cổng được in ra, hoặc dừng server kia |
| Trang đăng nhập báo mã chưa đúng | Phải là `accessToken` của người đi chơi, không phải `ADMIN_API_TOKEN`; hoặc mã đã được cấp lại. Cấp lại lần nữa và dùng mã mới |
| Trang đăng nhập bảo đợi | Giới hạn đăng nhập (10 lần mỗi phút) — đợi đúng thời gian hiển thị |
| Link chia sẻ hiện trang không tìm thấy ("Đi lạc rồi") | Chuyến đi đang riêng tư, đã lưu trữ, hoặc link đã bị thay bằng "Tạo đường dẫn mới" — cố ý trông giống hệt nhau |
