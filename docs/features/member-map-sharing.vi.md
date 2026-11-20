# Tính năng — Chia sẻ bản đồ thành viên (store, API chủ sở hữu và trang công khai)

🇻🇳 English: [member-map-sharing.md](member-map-sharing.md)

## Summary

Thành viên đã đăng nhập có thể bật link chia sẻ bản đồ những nơi mình đã đi, đổi link hoặc thu hồi. Đây là **Lát 2a** của ADR [0030](../adr/0030-member-map-sharing.vi.md): chỉ gồm store, migration và API chủ sở hữu. Lát **2b** thêm trang công khai `/shared-map/[token]` (bên dưới). Lát **2c** thêm điều khiển và bản xem trước trên `/my-map` (bên dưới), nên thành viên không cần gọi API để cấp link. Mặc định tắt và ẩn danh; token chỉ hiện một lần, chỉ lưu digest SHA-256.

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `GET /api/planner/map/share` | như nhau | như nhau |
| `PUT /api/planner/map/share` | như nhau | như nhau |
| `DELETE /api/planner/map/share` | như nhau | như nhau |
| `POST /api/planner/map/share/rotate` | như nhau | như nhau |

Route API không bản địa hoá. Điều khiển (2c) không thuộc lát này.

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/shared-map/[token]` | `/ban-do-chia-se/[token]` | `/en/shared-map/[token]` |

Trang công khai **chỉ là trang**: không có endpoint JSON công khai.

## Data

- Bảng `member_map_shares` (migration `0016`, rollback trong `db/rollback/`, khoá JSON `memberMapShares`): `user_id` (duy nhất), `token_digest` (SHA-256 hex, duy nhất, nullable — null nghĩa là không chia sẻ), `share_name` (`anonymous` | `name`), `created_at`, `updated_at`. Không có khoá ngoại (ADR 0013). Thiếu dòng nghĩa là "không chia sẻ, ẩn danh".
- Token gồm 43 ký tự base64url từ `randomBytes(32)` (`SHARE_TOKEN_PATTERN`). Chỉ trả một lần ở phản hồi cấp token, không bao giờ lưu.
- Kiểu công khai `PublicMemberMap { displayName: string | null; points }` và `PublicMemberMapPoint { slug; visitsBucket: 1 | 2 | 3 }`, tách riêng khỏi mọi kiểu bản đồ riêng tư. Bậc: 1 chuyến → 1, 2–3 → 2, từ 4 → 3.
- Hành động audit trên `targetKind: 'user'`: `map_share_on`, `map_share_off`, `map_share_rotate`, `map_share_name`. Không dòng nào có token hay tên.
- Giới hạn tốc độ: thay đổi chia sẻ có bucket riêng, 20 lần mỗi giờ mỗi thành viên (`WRITE_LIMITS.memberMapShare`); bucket đọc công khai (`memberMapReadLimiter`, 60 lần mỗi phút mỗi client) được định nghĩa sẵn cho Lát 2b, tách khỏi chia sẻ chuyến đi.

## How it works

Chủ thể là người dùng của phiên; không đọc user id hay slug từ body hay path. `plannerRoute` ép quy tắc same-origin cho cookie. Body là schema Zod strict.

- `GET` trả `{ enabled, shareName, visitedPlaces, sparse }`, không bao giờ có token. `sparse` đúng khi dưới 2 điểm đã đi: để cảnh báo ở bản xem trước sau này, không chặn.
- `PUT { enabled, shareName }` idempotent. Bật bản đồ đã có token thì giữ token và không trả token; bật bản đồ chưa có thì cấp token và trả một lần. `shareName: 'name'` bị từ chối `403 share_name_unavailable` cho đến khi có cổng hồ sơ của ADR 0025 (`profilePublicOpen`), và `422 display_name_unsuitable` khi tên hiển thị (đã chuẩn hoá NFKC, nên ký tự full-width cũng bị tính) chứa `@`, giống địa chỉ web, hoặc có từ 7 chữ số thuộc bất kỳ hệ chữ nào (kiểm tra thứ hai chạy sau khi cổng mở).
- `POST …/rotate` cấp token mới trong cùng transaction làm token cũ chết; bản đồ chưa chia sẻ trả `409 not_shared`. `DELETE` thu hồi và có thể lặp lại.
- `repository.getSharedMemberMap(token)` là hàm tra cứu Lát 2b sẽ gọi: định dạng token, rồi đọc mới, so digest thời gian hằng, chủ chưa bị khoá hay xoá, rồi dựng hình chiếu từ dữ liệu sống (chỉ chuyến đã hoàn thành, kể cả đã lưu trữ, điểm đến có trong catalog, sắp theo slug). Mọi thất bại đều trả `null`.
- `deleteUser` xoá dòng chia sẻ trong cùng transaction. Chủ bị khoá hoặc xoá mềm đọc ra `null` còn dòng vẫn giữ; khôi phục thì link sống lại.
- Export ghi `tokenDigest: null`; import đặt lại mọi dòng về không token và `anonymous`, nên nhập một tệp không bao giờ công khai thứ gì.

### The public page (slice 2b)

- `force-dynamic`; token đọc từ đường dẫn, không cache. Header (khai lại trong `next.config.ts` là `mapSharePaths`): `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`. Metadata chung, không bao giờ phụ thuộc token hay chủ bản đồ: tiêu đề cố định, `robots: noindex`, `referrer: no-referrer`; không alternates, không Open Graph, không JSON-LD. Đường dẫn bị cấm trong `robots.txt` và không có trong sitemap.
- **Một câu trả lời cho mọi lỗi.** `loadSharedMemberMap` (`src/server/planner/shared-map-page.ts`) trả `null` cho token sai hình hoặc lạ, bản đồ đã thu hồi hoặc chưa chia sẻ, chủ bị ban, xoá mềm hay xoá hẳn, lỗi store và cả limiter; trang gọi `notFound()` — cùng một 404. Limiter không có trang 429 riêng, nên không gì cho khách biết đó là trường hợp nào.
- Bản đồ dùng lại `VietnamMap` và quy tắc pin (nhãn cố định chỉ cho điểm `featured`, vùng bấm 44px, chấm đặc = đã đi). Hình chiếu công khai chỉ có điểm đã đi; bậc 1 / 2–3 / 4+ vẽ bằng ba cỡ pin sẵn có (1, 2 và 4 lần). Slug ngoài catalog bị bỏ. Danh sách cạnh bản đồ ghi tên từng nơi và bậc bằng chữ, nên cỡ chấm không là cách duy nhất truyền đạt. `src/content/destinations.ts` không bị sửa.
- Tên chỉ hiện (dạng văn bản thường trong thân trang, ở `<h1>`) khi hình chiếu mang tên, tức chế độ `name` — hiện vẫn đóng, nên mọi bản đồ chia sẻ đều ẩn danh. Tên không vào title, metadata hay URL.
- nginx (`deploy/nginx/default.conf`): hai đường dẫn **không ghi log** (`access_log … if=$cnh_loggable`), bản đồ che token cũng che chúng như lớp phòng thủ thứ hai, và không cấu hình cache nginx. Dòng request thô vẫn có thể xuất hiện trong `error.log`, vốn đã coi là nhạy cảm. **VM thật chưa được kiểm tra:** chủ dự án phải áp dụng cấu hình mới và kiểm (xem runbook vận hành).

### The controls and the preview (slice 2c)

Chỉ UI; API, store và migration của 2a không đổi. Trên `/my-trips` (VI `/chuyen-di-cua-toi`, trang chủ thành viên theo [ADR 0031](../adr/0031-member-home-merge.vi.md)), chỉ với thành viên đã đăng nhập (khách không thấy khối này), có mục "Chia sẻ bản đồ của bạn" dưới bản đồ.

- **Điều khiển** (`MemberMapSharePanel`, client): đọc `GET /api/planner/map/share`, rồi bật chia sẻ (`PUT`), thu hồi (`DELETE`) và đổi link (`POST …/rotate`). Đổi link hỏi xác nhận trước (link cũ chết ngay); bật và thu hồi thì không.
- **Link chỉ hiện một lần.** URL đầy đủ chỉ xuất hiện trong phản hồi cấp hoặc đổi link, trong một ô chỉ đọc với nút sao chép thật (44px). Token nằm trong state của component: không bao giờ ở URL trang, `localStorage`/`sessionStorage`, log hay analytics. "Tôi đã lưu, ẩn đường dẫn", thu hồi, đổi link lần nữa hoặc tải lại trang đều làm nó biến mất; sau đó trang chỉ nói link không được giữ lại, và cách duy nhất để có link mới là đổi link. Sao chép quay về chọn nội dung ô khi origin là http thường.
- **Chế độ tên.** Ẩn danh là mặc định và đang được chọn. "Hiện tên của tôi" là radio thật; nếu API trả `403 share_name_unavailable` (trường hợp hiện nay) nó bị vô hiệu, có ghi chú nói chưa khả dụng và bản đồ vẫn ẩn danh. `422 display_name_unsuitable` nhắc đổi tên hiển thị trước.
- **Lỗi** được thông báo trong vùng `role="alert"` (thành công ở `role="status"`): 401 (có nút đăng nhập), 403, 422, 429 (kèm số phút chờ), 409 `not_shared` (làm mới trạng thái), còn lại là thông báo chung. Chữ nằm ở `messages/*.json` mục `memberMapShare`, VI và EN.
- **Xem trước** (`MemberMapSharePreview`, server): đúng hình chiếu công khai, dựng bởi `resolveMemberMapSharePreview` qua cùng hàm thuần `buildPublicMemberMapPoints` và `sharedMapDestinations` mà trang công khai dùng, nên không thể lệch: chỉ chuyến hoàn thành (đã lưu trữ hay chưa), bậc 1 / 2–3 / 4+, không điểm kế hoạch, không đánh giá, không ngày tháng, và tên người xem sẽ thấy (không có: ẩn danh). Dưới 2 điểm có cảnh báo bản đồ thưa dễ bị nhận ra (cảnh báo, không chặn). Tái dùng `VietnamMap` và quy tắc pin; không sửa `src/content/destinations.ts`. Bản xem trước không phụ thuộc việc chia sẻ đang bật hay tắt.

## Files

| Đường dẫn | Vai trò |
|---|---|
| `db/migrations/0016_member_map_shares.sql`, `db/rollback/0016_member_map_shares.sql` | Bảng và rollback thủ công |
| `src/server/planner/schemas.ts` | `memberMapShareSchema`, schema đầu vào strict |
| `src/server/planner/member-map-share.ts` | Token, digest, kiểm tra tên, bậc, hình chiếu công khai (hàm thuần) |
| `src/server/planner/repository.ts` | `getMemberMapShare`, `setMemberMapShare`, `rotateMemberMapShare`, `revokeMemberMapShare`, `getSharedMemberMap`, `deleteUser` |
| `src/server/persistence/planner-rows.ts`, `planner-transfer.ts`, `src/server/planner/store.ts` | Ánh xạ bảng, export không có digest, import không bao giờ bật |
| `src/app/api/planner/map/share/route.ts`, `…/rotate/route.ts` | API chủ sở hữu |
| `src/server/rate-limit.ts`, `src/server/planner/instance.ts` | Limiter thay đổi chia sẻ và đọc công khai
| `src/app/[locale]/shared-map/[token]/page.tsx`, `src/server/planner/shared-map-page.ts` | Trang công khai; bộ nạp (mọi lỗi → `null`) và cỡ pin |
| `src/components/map/member-map-share-panel.tsx`, `member-map-share-preview.tsx`, `src/server/planner/member-map-share-preview.ts`, `src/app/[locale]/my-trips/page.tsx`, `messages/*.json` (`memberMapShare`) | Lát 2c: điều khiển, link hiện một lần, xem trước |
| `next.config.ts`, `src/app/robots.ts`, `src/i18n/routing.ts`, `messages/*.json` (`sharedMap`), `deploy/nginx/default.conf` | Header, robots, route, chuỗi, quy tắc log | |

## Tests

`tests/member-map-share.test.ts` (hàm thuần; token hiện một lần và chỉ lưu digest; rotate; revoke idempotent; cổng tên và chặn 422; mọi thất bại đọc ra `null`; allow-list hình chiếu, chuyến hoàn thành đã lưu trữ vẫn hiện, chuyến bị xoá biến mất; hai thành viên cô lập; chủ bị khoá và xoá mềm; `deleteUser`; audit không có token hay tên; export bỏ digest; import không bao giờ bật; tệp cũ không có khoá). `tests/member-map-share-routes.test.ts` (401 cho mọi method, mutation khác origin hoặc không origin bị từ chối, body strict, `share_name_unavailable`, cô lập giữa thành viên, bucket giới hạn riêng, dòng audit). `tests/member-map-shared-page.test.ts` (Lát 2b: bộ nạp trả `null` cho token sai hình, lạ, đã thu hồi, chủ bị ban, chủ đã xoá và bị giới hạn tốc độ; hình chiếu chỉ có `slug` và `visitsBucket`, không điểm kế hoạch, không tên; xoá chuyến thì điểm mất, archive chuyến completed thì còn; slug ngoài catalog bị bỏ; header, robots, sitemap, không endpoint JSON, metadata không chứa token hay chủ; khoá VI/EN). `tests/deploy-config.test.ts` phủ quy tắc log nginx và việc không có cache. Lát 2c: `tests/dom/member-map-share-panel.test.tsx` (trạng thái tắt, bật, vừa cấp link, đã chia sẻ; sao chép; link biến mất sau "đã lưu", thu hồi và khỏi storage, URL; đổi link hỏi trước và huỷ thì không gửi gì; `share_name_unavailable` vô hiệu lựa chọn tên; thông báo 401/403/422/429/500; lỗi tải; khớp khoá VI/EN), `tests/member-map-share-preview.test.ts` (khách và cookie sai hình không đọc store; chỉ điểm đã đi, không điểm kế hoạch, không trường thừa; hai thành viên cô lập; đang chờ đổi mật khẩu), `tests/member-map-share-preview-view.test.tsx` (chỉ vẽ điểm được đưa vào, bậc bằng chữ, tên ẩn danh, cảnh báo thưa, slug lạ bị bỏ, thứ tự heading). PostgreSQL chỉ được phủ bởi test engine bảng dùng chung; vòng ghi/đọc bảng mới trên cơ sở dữ liệu **chưa** được kiểm (NOT RUN khi không có `TEST_DATABASE_URL`).

## Limits and open questions

- Link bị mất phải đổi mới, không hiện lại được. Trạng thái bật/tắt đọc lúc tải; hai tab có thể lệch nhau đến khi tải lại (câu trả lời của API vẫn là chuẩn).
- Bản xem trước thêm một lần đọc chuyến của thành viên vào `/my-trips` (đọc riêng, có phạm vi; chưa gộp với bản đồ Lát 1).
- Chế độ `name` vẫn đóng cho đến khi `profilePublicOpen` được xây và Chính sách Quyền riêng tư của chủ được công bố (ADR 0030, câu hỏi chủ 1).
- Không agent nào áp dụng migration. Quy tắc nginx cho `/shared-map/*` đã có trong repository, nhưng VM thật chưa được kiểm tra và quy tắc chưa được áp dụng ở đó.
- Bản đồ thưa vẫn có thể lộ chủ nhân với người đã biết họ; cờ `sparse` chỉ hỗ trợ cảnh báo.
- `/sec-check` cho Lát 2a và 2b **chưa chạy**; khuyến nghị chạy lại cho 2b vì trang công khai nhận bearer token từ URL.
- `/sec-check` cũng được khuyến nghị cho Lát 2c: UI xử lý một link bearer dùng một lần.
- Kết quả trình duyệt của 2c nằm trong handoff `.claude/contracts/handoff/member-map-share-ui.md`.
