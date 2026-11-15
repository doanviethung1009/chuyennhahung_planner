# ADR 0007 — Đăng nhập Planner bằng email và mật khẩu, và bằng Google

🇬🇧 English: [0007-password-and-google-sign-in.md](0007-password-and-google-sign-in.md)

- **Trạng thái:** Accepted (đã chấp nhận) — chủ dự án chấp nhận ngày 2026-11-10; phần triển khai nằm trong cùng PR
- **Ngày:** 2026-11-10
- **Người sở hữu:** system-architect
- **Ảnh hưởng:** `src/server/planner/auth.ts`, `src/server/planner/schemas.ts`, `src/server/planner/repository.ts`, `src/server/planner/http.ts`, `src/server/rate-limit.ts`, `src/app/api/planner/session/**`, `src/app/api/planner/oauth/**` (mới), `src/app/api/admin/planner/users/**`, `src/components/planner/sign-in-form.tsx`, `src/app/[locale]/sign-in/page.tsx`, `messages/*.json`

## Bối cảnh

Hiện mỗi người dùng chỉ có đúng một credential: access token 48 byte do
operator cấp qua `POST /api/admin/planner/users`, chỉ trả về một lần
(`PlannerRepository.createUser`, `src/server/planner/repository.ts:286`). Trình
duyệt đăng nhập bằng cách dán token 64 ký tự đó vào `/sign-in`
(`src/components/planner/sign-in-form.tsx`); `POST /api/planner/session` đổi nó
lấy một session cookie `HttpOnly` (`repository.ts:219`, ADR 0004). Sau đó mọi
request đi qua một đường ráp duy nhất, `identify` (`repository.ts:182`), và mọi
phương thức về trip đều lọc theo `ownerId`.

Cách đó chạy được, nhưng nhân viên không thể dùng lâu dài. Token không nhớ được
nên sẽ bị ghi vào sổ tay hay tin nhắn; không gõ được trên điện thoại; mất token
thì operator phải xoay vòng nó. ADR 0004 §6 đã cố ý để mật khẩu, OAuth và MFA
ngoài phạm vi, và nói mỗi thứ cần một quyết định riêng. Nay chủ dự án yêu cầu hai
cách đăng nhập:

1. **Tài khoản do chủ dự án tạo**, đăng nhập bằng email và mật khẩu.
2. **Tài khoản Google**, đăng nhập bằng nút "Đăng nhập bằng Google" — và chủ
   dự án đã quyết định **khách hàng đăng nhập bằng tài khoản Google lần đầu sẽ
   được tạo tài khoản ngay lúc đó**.

Câu trả lời thứ hai thay đổi phạm vi mà ADR 0004 đã viết cho. ADR 0004 chọn
"nhân viên trước, khách hàng có thể sau"; nay khách hàng tự phục vụ, và chỉ qua
Google. Đã biết: chưa có dịch vụ gửi email nên không gửi được gì cho người dùng,
đó là lý do tự phục vụ đi qua Google (Google đã xác minh địa chỉ) chứ không qua
form đăng ký mật khẩu; chưa có OAuth client của Google. Chưa biết: sẽ có bao
nhiêu khách hàng, nhân viên dùng Google Workspace với tên miền công ty hay Gmail
cá nhân, và tài khoản `admin` (ADR 0006) có bắt buộc MFA không.

## Quyết định

1. **Hai credential mới, một session.** Email kèm mật khẩu, và danh tính Google,
   chỉ là hai cách nữa để *lấy* session của ADR 0004 — cùng cookie
   `planner_session`, cùng dòng `plannerSessions`, cùng thời hạn 14 ngày tuyệt
   đối và 7 ngày không hoạt động, cùng kiểm tra CSRF. `identify`,
   `requireOwnedTrip` và mọi phương thức repository bên dưới không đổi. Đăng
   nhập thành công bằng bất kỳ cách nào cũng luôn cấp một session mới.

2. **Google là cách tự đăng ký duy nhất.** Lần đăng nhập Google đầu tiên có
   email đã xác minh không khớp tài khoản nào thì **tạo một tài khoản mới** —
   tài khoản người đi chơi thường (`role: member` khi ADR 0006 có hiệu lực),
   không có mật khẩu và không có quyền vào chuyến đi của người khác. Tài khoản
   mật khẩu vẫn chỉ do operator tạo; không có form đăng ký mật khẩu, vì không có
   dịch vụ gửi email thì không xác minh được địa chỉ cũng không cho đặt lại mật
   khẩu được. Đăng nhập Google có email khớp với một tài khoản đã có thì **không
   liên kết vào tài khoản đó và cũng không tạo bản trùng**: bị từ chối với
   `link_required`, và chủ tài khoản tự liên kết Google từ một phiên đã đăng
   nhập (xem *Đăng nhập Google*). Email do operator gõ chưa từng được xác minh,
   nên khớp theo nó sẽ trao tài khoản cho ai đang giữ địa chỉ đó. *(Sửa ngày
   2026-11-10 sau security review; bản nháp đầu liên kết theo email.)*

3. **Access token vẫn giữ.** Nó vẫn là credential cho script, curl và test
   (`Authorization: Bearer`) và vẫn chạy ở `POST /api/planner/session`. Form
   đăng nhập hạ nó xuống thành mục phụ "đăng nhập bằng access token" trong lúc
   người dùng hiện có chưa có email; một thay đổi sau sẽ gỡ nó khỏi form khi mọi
   người dùng đã có email.

### Mô hình dữ liệu

`PlannerUser` thêm năm trường **tuỳ chọn**, thiếu thì đọc là `null`, nên file
`.data/planner.json` hiện có vẫn nạp nguyên vẹn (mở rộng trước, thu gọn sau):

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `email` | `string \| null` | Cắt khoảng trắng và chuyển chữ thường khi ghi; duy nhất giữa các người dùng. Không chuẩn hoá gì thêm (giữ nguyên dấu chấm trong địa chỉ Gmail). |
| `passwordHash` | `string \| null` | `scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>`. Null nghĩa là người dùng này không đăng nhập bằng mật khẩu. |
| `mustChangePassword` | `boolean` | True với mật khẩu tạm do operator cấp; bị xoá khi người dùng đổi mật khẩu lần đầu. |
| `googleSub` | `string \| null` | Id chủ thể ổn định của Google (`sub`), duy nhất giữa các người dùng. Được ghi lần đầu người dùng đăng nhập bằng Google. |
| `createdVia` | `'operator' \| 'google'` | Tài khoản được tạo bằng cách nào; thiếu thì đọc là `operator`. Giúp operator phân biệt nhân viên với khách tự đăng ký cho tới khi có vai trò của ADR 0006. |

Tài khoản do Google tạo lấy `displayName` từ claim `name` (cắt còn 80 ký tự,
không có thì dùng phần trước `@` của email) và `handle` suy từ phần trước `@`
của email, chuyển thành slug, trùng thì thêm một chuỗi ngẫu nhiên ngắn. Cả hai
đều không phải credential, và người dùng có thể đổi tên hiển thị sau.

`publicPlannerUserSchema` vẫn bỏ mọi credential: `passwordHash` và `googleSub`
không bao giờ được trả về; `email` được trả cho chính người dùng và cho
operator, kèm hai cờ suy ra `hasPassword` / `hasGoogle` để hiển thị.

Một collection mới, `oauthAttempts`, giữ một lượt đăng nhập Google đang dở:
`{ id, stateHash, nonce, codeVerifier, returnTo, createdAt, expiresAt }`, sống 10
phút, được dọn khi ghi giống như session hết hạn.

### Đăng nhập bằng mật khẩu

- **Hash** bằng `scrypt` của `node:crypto` — không thêm dependency. Tham số bắt
  đầu ở mức cơ sở của OWASP `N=2^17, r=8, p=1`, salt 16 byte, đầu ra 32 byte, và
  được lưu ngay trong từng hash, nên sau này có thể nâng và nâng cấp hash cũ ở
  lần đăng nhập thành công kế tiếp. So sánh bằng `timingSafeEqual`.
- **Chính sách** theo NIST SP 800-63B: tối thiểu 12 ký tự, tối đa 128, ký tự gì
  cũng được, không quy tắc phối hợp, không ép đổi định kỳ.
- **Endpoint:** `POST /api/planner/session` nhận một trong hai body, phân biệt
  theo hình dạng: `{ accessToken }` (không đổi) hoặc `{ email, password }`. Một
  endpoint, một rate limiter, một chỗ ghi cookie.
- **Không lộ danh sách tài khoản:** email không tồn tại, người dùng không có mật
  khẩu và mật khẩu sai đều trả cùng `401 unauthorized` với cùng thông điệp, và
  email không tồn tại vẫn chạy `scrypt` với một hash giả cố định để thời gian
  phản hồi như nhau.
- **Giới hạn tần suất:** `signInLimiter` theo IP hiện có (10/phút) vẫn giữ, thêm
  một limiter thứ hai theo email đã chuẩn hoá (5 lần mỗi 15 phút) để làm chậm
  việc dò một tài khoản từ nhiều địa chỉ. Nó làm chậm chứ không khoá tài khoản,
  nên không thể bị lợi dụng để khoá nhân viên ra ngoài. Cả hai đều nằm trong bộ
  nhớ và theo từng tiến trình (ADR 0005); ở đây chỉ ghi nhận, chưa giải quyết.
- **Mật khẩu tạm:** operator không bao giờ tự chọn mật khẩu cho người dùng.
  `POST /api/admin/planner/users` nhận thêm `email` tuỳ chọn; khi có, server sinh
  một mật khẩu tạm ngẫu nhiên, trả về **một lần** (như access token) và bật
  `mustChangePassword`. Session mở bằng mật khẩu đó chỉ gọi được
  `GET`/`DELETE /api/planner/session` và endpoint đổi mật khẩu; mọi route
  Planner khác trả `403 password_change_required`.
- **Đổi mật khẩu:** `POST /api/planner/password` với
  `{ currentPassword, newPassword }`, bắt buộc cùng nguồn gốc. Nó xoá mọi
  session *khác* của người dùng đó.
- **Đặt lại:** không có tự đặt lại mật khẩu (chưa có dịch vụ gửi email).
  Operator gọi `POST /api/admin/planner/users/:userId/reset-password`, endpoint
  này cấp mật khẩu tạm mới và xoá mọi session của người dùng — cùng ngữ nghĩa
  "đăng xuất mọi nơi" như `rotate-token`.

### Đăng nhập bằng Google

Tự viết luồng authorization code của OpenID Connect với PKCE, gọi các endpoint
Google đã công bố, chỉ dùng `fetch` và `node:crypto`.

- `GET /api/planner/oauth/google/start?returnTo=…` kiểm `returnTo` bằng
  `safeReturnTo` hiện có (`src/lib/return-to.ts`), tạo một dòng `oauthAttempts`
  với `state`, `nonce` và PKCE `code_verifier` ngẫu nhiên, đặt cookie 10 phút
  `HttpOnly; Secure; SameSite=Lax; Path=/api/planner/oauth` chứa `state` gốc, rồi
  trả `302` sang Google với `scope=openid email profile`, `code_challenge_method=S256`,
  `prompt=select_account`.
- `GET /api/planner/oauth/google/callback` yêu cầu `state` trên query trùng với
  cookie và khớp một lượt chưa hết hạn (lượt đó bị tiêu thụ dù kết quả ra sao —
  chỉ dùng một lần). Nó đổi `code` cùng `code_verifier` ở token endpoint của
  Google, server gọi server, kèm client secret, rồi kiểm `id_token`: chữ ký RS256
  theo JWKS của Google (cache theo `Cache-Control`, tải lại một lần khi gặp `kid`
  lạ), `iss` là `https://accounts.google.com` hoặc `accounts.google.com`, `aud`
  bằng client id, `exp` còn hạn, `nonce` khớp, và `email_verified` là `true`. Mọi
  lỗi đều chuyển về `/sign-in` đã bản địa hoá với một mã lỗi thô; chi tiết chỉ ghi
  vào log server, không bao giờ hiện lên trang.
- **Khớp hoặc tạo tài khoản**, theo thứ tự sau, trong một transaction của
  store để hai lần đăng nhập đầu đồng thời không tạo ra hai tài khoản:
  1. người dùng có `googleSub` bằng `sub` — đăng nhập;
  2. nếu không, người dùng có `email` bằng email đã xác minh và chưa có
     `googleSub` — từ chối với `link_required`, không đăng nhập ai, không đổi
     gì;
  3. nếu không, người dùng có email đó nhưng `googleSub` là một `sub` *khác* —
     từ chối với `account_conflict` (Google đã gán lại địa chỉ; operator phải
     xem xét);
  4. nếu không, **tạo** người dùng với `email`, `googleSub`,
     `createdVia: 'google'`, không mật khẩu, rồi đăng nhập.
- **Liên kết phải chủ động.** Người dùng đã đăng nhập (phiên cookie, đã đổi
  mật khẩu tạm) mở trang đổi mật khẩu và bấm "Liên kết tài khoản Google":
  `GET /api/planner/oauth/google/start?intent=link` ghi id người dùng vào lượt.
  Callback chỉ liên kết khi trình duyệt *vẫn* đăng nhập đúng người đó, `sub`
  của Google chưa thuộc về ai khác, và người dùng chưa có `sub` nào khác; rồi
  quay về trang tài khoản với `?google=linked` (hoặc mã lỗi) và giữ nguyên
  phiên hiện có. Email Google không cần trùng email tài khoản — mục đích là
  chứng minh kiểm soát được cả hai. Từ đó đăng nhập theo `sub` ổn định của
  Google chứ không theo địa chỉ.
- **Giới hạn đăng ký:** việc tạo tài khoản có limiter riêng theo IP (3 tài
  khoản mới mỗi giờ) bên cạnh `signInLimiter`, vì mỗi lần tạo làm phình một tài
  liệu JSON duy nhất — và vì khoá theo IP lấy từ một header giả được, còn có
  thêm một bucket **toàn cục** 30 tài khoản mới mỗi giờ. Giống các limiter
  khác, nó nằm trong bộ nhớ và theo từng tiến trình.
- **Khối lượng việc có trần, dù client tự nhận là ai.** Tối đa
  `MAX_LIVE_OAUTH_ATTEMPTS` (500) lượt Google đang chờ trên mọi client; vượt
  quá thì `start` trả `rate_limited` và không ghi gì. scrypt chạy sau một cổng
  giới hạn đồng thời — 4 lần cùng lúc (khoảng 512 MB), 32 lần chờ, rồi `429` —
  nên địa chỉ giả không thể làm cạn bộ nhớ.
- **Công tắc tắt đăng ký:** nếu `GOOGLE_SIGNUP_ENABLED` là `false`, bước 4 bị
  bỏ qua và kết quả là `account_not_found` — chủ dự án đóng tự phục vụ mà không
  cần deploy code mới. Mặc định là `true`.
- **Huỷ liên kết:** `DELETE /api/admin/planner/users/:userId/google` xoá
  `googleSub` và xoá mọi session của người dùng đó. Người dùng đã đăng nhập
  cũng tự gỡ được tài khoản của mình bằng `DELETE /api/planner/google` (nút ở
  trang đổi mật khẩu): bị từ chối `409` khi tài khoản chưa có mật khẩu để không
  bị khoá ngoài; các session khác kết thúc, session hiện tại giữ nguyên; gỡ một
  tài khoản chưa liên kết vẫn thành công.
- **Cấu hình:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, và redirect URI suy
  ra từ `NEXT_PUBLIC_SITE_URL` + `/api/planner/oauth/google/callback`. Chỉ phía
  server, không bao giờ là `NEXT_PUBLIC_*`, được `tests/client-boundary.test.ts`
  canh giữ. **Mặc định đóng:** thiếu một trong hai biến thì cả hai route Google
  trả `404` và trang đăng nhập không hiện nút Google, nên site vẫn chạy khi chưa
  cấu hình Google.
- Callback là một `GET` cấp cao nhất đến từ site khác, nên không qua được kiểm
  tra cùng nguồn gốc; `state` gắn với cookie của chính trình duyệt là lớp chống
  CSRF của nó, đồng thời chặn login CSRF (bị đăng nhập vào tài khoản của người
  khác).

### Luồng

```mermaid
sequenceDiagram
  participant B as Trình duyệt
  participant S as Server Planner
  participant G as Google
  B->>S: POST /api/planner/session {email, password}
  S->>S: kiểm scrypt, rate limit
  S-->>B: 201 + Set-Cookie planner_session
  B->>S: GET /api/planner/oauth/google/start
  S-->>B: 302 sang Google + cookie state
  B->>G: đồng ý (openid email profile)
  G-->>B: 302 callback?code&state
  B->>S: GET /api/planner/oauth/google/callback
  S->>G: code + code_verifier + secret
  G-->>S: id_token
  S->>S: kiểm chữ ký, iss, aud, exp, nonce, email_verified; khớp theo sub hoặc tạo người dùng
  S-->>B: 302 returnTo + Set-Cookie planner_session
```

### Quan hệ với ADR 0006

Độc lập và tương thích. ADR 0006 thêm `role` vào cùng dòng người dùng và quyết
định người đã đăng nhập được *làm gì*; ADR này quyết định họ đăng nhập *bằng
cách nào*. Tài khoản admin và editor sẽ đăng nhập qua cùng hai cách này. Việc
`admin` có cần MFA vẫn là câu hỏi mở của chủ dự án trong ADR 0006; ADR này không
trả lời và cũng không chặn nó.

## Các phương án đã cân nhắc

| Phương án | Ủng hộ | Phản đối |
|---|---|---|
| **A (chọn)** — mật khẩu scrypt cho tài khoản do operator tạo, OIDC + PKCE tự viết cho Google kèm tự đăng ký ở lần đăng nhập đầu, cả hai cấp session của ADR 0004 | Không thêm dependency; khách hàng tự phục vụ mà không cần form mật khẩu hay dịch vụ gửi email; một mô hình session, một câu chuyện CSRF, code `ownerId` không đổi; chạy được khi chưa cấu hình Google | Ta tự lo lưu mật khẩu, giới hạn tần suất và các kiểm tra OIDC (`state`, `nonce`, PKCE, chữ ký, claim); bất kỳ ai có tài khoản Google giờ đều tạo được dòng trong store |
| A′ — như A, nhưng Google chỉ liên kết tài khoản operator đã tạo | Không có đăng ký mở; store chỉ phình khi operator thao tác | Khách hàng hoàn toàn không tự phục vụ được, trái với điều chủ dự án yêu cầu |
| B — Auth.js (NextAuth) với provider Credentials + Google | Xử lý OAuth được kiểm duyệt rộng rãi; sau này thêm provider dễ | Framework mới (tự nó đã cần ADR); mô hình session và cookie riêng phải ánh xạ sang `plannerSessions`/`ownerId` hoặc thay thế chúng; provider Credentials cũng không hash mật khẩu hộ ta |
| C — nhà cung cấp hosted (Clerk, Auth0, Firebase Auth) | MFA, đặt lại mật khẩu và email có sẵn | Nhà cung cấp trả phí giữ danh tính nhân viên cho một công cụ nội bộ vài người dùng; khoá chặt vào đúng đường ráp ADR 0004 đã giữ mỏng; phải đi lại toàn bộ đường session |
| D — chỉ Google, không mật khẩu | Ít code nhất; không lưu mật khẩu | Nhân viên không có tài khoản Google, hoặc máy đang đăng nhập tài khoản khác, bị khoá ngoài mà không có đường dự phòng |
| E — mật khẩu kèm tự đăng ký công khai | Khách hàng không có tài khoản Google cũng tự phục vụ được | Cần xác minh email và đặt lại mật khẩu, mà cả hai cần dịch vụ gửi email chưa tồn tại; Google đã xác minh địa chỉ thay ta |

Phương án về nhì là **B**, và lý do nó thua: nó mang vào một hệ session thứ hai
phải hoà giải với hệ ADR 0004 vừa ship, để tiết kiệm phần lớn là đoạn xử lý
redirect của Google — phần nhỏ nhất của thiết kế này. Nếu sau này khách hàng tự
phục vụ với nhiều provider, B là hướng đi, và quyết định 1 giữ cho bước chuyển
đó chỉ chạm tới `identify` và các dòng session.

## Hệ quả

**Dễ hơn.** Nhân viên đăng nhập bằng thứ họ nhớ được, hoặc bằng tài khoản Google
đã có sẵn trên điện thoại, còn khách hàng bắt đầu lên kế hoạch chỉ với một cú
nhấn mà không cần operator. Operator không còn phải cầm bí mật bearer sống lâu
thay người khác, và quên mật khẩu là một lần đặt lại chứ không phải xoay vòng
token. Đường token, mọi test và mọi ví dụ curl vẫn chạy.

**Khó hơn — và không miễn phí.**

- **Ta lưu dữ liệu cá nhân và hash mật khẩu.** `.data/planner.json` có thêm địa
  chỉ email (dữ liệu cá nhân) và hash mật khẩu, cạnh digest token và session hiện
  có. Dòng "không lưu PII" trong project context không còn đúng, và phải sửa trong
  cùng thay đổi. File này không bao giờ được commit, ghi log hay sao chép vào bản
  sao lưu không kiểm soát.
- **Code mới phải đúng:** tham số scrypt và so sánh thời gian hằng, đường hash
  giả, hai limiter, cổng mật khẩu tạm, và từng kiểm tra OIDC. Bỏ sót một kiểm tra
  (`aud`, `nonce`, `email_verified`, hay `state` dùng một lần) là chiếm được tài
  khoản, không phải lỗi thẩm mỹ.
- **Chi phí mỗi lần đăng nhập:** scrypt ở `N=2^17` dùng khoảng 128 MB và vài chục
  mili giây mỗi lần thử. Đăng nhập đồng thời nhân con số đó lên; các limiter là thứ
  giữ nó trong giới hạn, và chúng theo từng tiến trình.
- **Đăng ký mở là một bề mặt tấn công và chi phí mới.** Ai có tài khoản Google
  cũng tạo được tài khoản, và mỗi tài khoản là một dòng trong một tài liệu JSON
  được đọc ở mọi request. Limiter đăng ký theo từng tiến trình và dựa trên địa
  chỉ có thể giả mạo (ADR 0005), nên nó làm chậm một script vụng chứ không chặn
  được kẻ quyết tâm; chốt chặn thật là `GOOGLE_SIGNUP_ENABLED=false` và, về sau,
  SQL. Người tự đăng ký chỉ tạo và đọc được chuyến đi của chính họ — `ownerId` là
  thứ giữ cho việc đó vô hại.
- **Dữ liệu cá nhân của khách hàng, không chỉ của nhân viên.** Tên và email của
  khách tự đăng ký được lưu lại, kéo theo nghĩa vụ theo quy định bảo vệ dữ liệu
  cá nhân của Việt Nam (Nghị định 13/2023/NĐ-CP): thông báo về quyền riêng tư khi
  đăng ký, mục đích sử dụng được nêu rõ, và cách để yêu cầu xoá tài khoản. ADR này
  không thiết kế các phần đó; nó đánh dấu chúng là điều kiện trước khi bật đăng
  ký trên production.
- **Không liên kết theo email.** Nhân viên muốn dùng thêm Google phải thêm một
  bước — đăng nhập bằng mật khẩu, rồi liên kết Google — đổi lại tài khoản
  không bao giờ bị trao cho người lạ vì operator gõ nhầm địa chỉ hay địa chỉ bị
  tái sử dụng. Khách có email mà operator đã dùng sẽ thấy `link_required` thay
  vì một tài khoản mới.
- **Phụ thuộc ra ngoài:** đăng nhập Google cần server gọi được token endpoint và
  JWKS của Google. Nếu không gọi được, đăng nhập Google lỗi còn đăng nhập mật khẩu
  vẫn chạy.
- **Hạ tầng của chủ dự án:** một OAuth client trên Google Cloud, secret của nó
  trong môi trường triển khai, và redirect URI đăng ký cho từng môi trường (local,
  preview, production).

**Đảo ngược** nghĩa là gỡ hai route OAuth, các endpoint đổi/đặt lại mật khẩu và
nhánh `{ email, password }`, rồi bỏ qua các trường tuỳ chọn mới; access token vẫn
là credential gốc nên không ai bị khoá ngoài và không cần migration dữ liệu.

## Việc tiếp theo

Code, sau khi ADR được chấp nhận (backend-engineer, rồi frontend-engineer):

- Schema: các trường tuỳ chọn `email`, `passwordHash`, `mustChangePassword`,
  `googleSub`; `oauthAttempts`; ràng buộc duy nhất khi ghi và trong lượt kiểm
  integrity (email trùng, `googleSub` trùng, hash sai định dạng, lượt đăng nhập
  hết hạn).
- `auth.ts`: `hashPassword`, `verifyPassword`, hash giả; một module OIDC Google
  trong `src/server/planner/` (URL authorize, đổi token, cache JWKS, kiểm
  `id_token`).
- Route: nhánh `{ email, password }` của `POST /api/planner/session`,
  `POST /api/planner/password`, `GET /api/planner/oauth/google/{start,callback}`,
  `POST /api/admin/planner/users/:userId/reset-password`,
  `DELETE /api/admin/planner/users/:userId/google`, và `email` khi tạo người dùng.
- Giao diện: trang đăng nhập có email/mật khẩu, nút "Đăng nhập bằng Google" chỉ
  hiện khi đã cấu hình, mục phụ access token, trang đổi mật khẩu, và mọi chuỗi có
  trong cả `messages/vi.json` lẫn `messages/en.json`.
- Test: hash rồi kiểm lại và đọc tham số; cùng 401 cho email không tồn tại, không
  có mật khẩu và sai mật khẩu; limiter theo email; cổng mật khẩu tạm; đổi mật khẩu
  xoá các session khác; đặt lại xoá mọi session; từ chối `state` không khớp,
  `state` dùng lại, lượt hết hạn, sai `aud`, sai `iss`, token hết hạn, sai chữ ký,
  sai `nonce`, `email_verified: false`; khớp theo `sub`, email khớp →
  `link_required` và không đổi gì, liên kết chủ động từ một phiên (và bị từ
  chối khi là phiên khác, `sub` đã thuộc người khác hoặc `sub` thứ hai), trần
  lượt đang chờ, bucket đăng ký toàn cục, cổng đồng thời của scrypt,
  không khớp thì tạo người dùng `member` với `createdVia: 'google'` và không mật
  khẩu, lần đăng nhập thứ hai dùng lại tài khoản đó, hai lần đăng nhập đầu đồng
  thời chỉ tạo một người dùng, handle trùng được thêm hậu tố, `sub` xung đột →
  `account_conflict`, limiter đăng ký, và `GOOGLE_SIGNUP_ENABLED=false` →
  `account_not_found`; route Google trả 404 khi chưa cấu hình;
  đường bearer không đổi; client-boundary vẫn pass.

Tài liệu cần cập nhật trong cùng thay đổi: tài liệu tính năng
[travel-planner-core.vi.md](../features/travel-planner-core.vi.md) và bản song
ngữ, phần danh tính trong [architecture.vi.md](../architecture.vi.md) và bản song
ngữ, tác vụ đăng nhập trong [usage.vi.md](../usage.vi.md) và bản song ngữ, và
`.claude/context/project-context.md` (dữ liệu nhạy cảm).

Cần chủ dự án quyết:

1. Chấp nhận hay bác bỏ ADR này.
2. Tạo OAuth client trên Google Cloud (loại Web application) và đăng ký redirect
   URI cho từng môi trường; đặt `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` trong
   môi trường triển khai — không bao giờ để trong repository hay gửi qua chat.
3. Nhân viên có dùng Google Workspace với tên miền công ty không? Nếu có, đăng
   nhập Google có thể bắt buộc thêm tên miền đó (claim `hd`) — một dòng giới hạn.
4. Tài khoản `admin` có bắt buộc MFA không (đang mở trong ADR 0006).
5. Thông báo quyền riêng tư cho khách đăng ký bằng Google, và cách khách yêu cầu
   xoá tài khoản — cần có trước khi bật đăng ký trên production.
