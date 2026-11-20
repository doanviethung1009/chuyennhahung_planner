# ADR 0030 — Chia sẻ bản đồ thành viên bằng token: token riêng, hình chiếu công khai chỉ điểm đã đi, ẩn danh mặc định

🇬🇧 English version: [0030-member-map-sharing.md](0030-member-map-sharing.md)

- **Trạng thái:** Đã duyệt
- **Ngày:** 2026-11-20
- **Chủ trì:** system-architect
- **Ảnh hưởng:** bảng mới `member_map_shares` (migration ở số trống kế tiếp và file `db/rollback` tương ứng) và collection `memberMapShares` trong `src/server/persistence/planner-rows.ts` và `planner-transfer.ts`; `src/server/planner/schemas.ts`, `repository.ts` (các method chia sẻ, `deleteUser`), `src/server/planner/member-map.ts` (hình chiếu công khai); route mới `src/app/api/planner/map/share/**` và trang công khai `/shared-map/[token]`; `src/i18n/routing.ts`; `src/server/rate-limit.ts`; `deploy/nginx/default.conf` (một quy tắc `access_log`); danh sách action audit. Task Contract `member-map` (lát 2). Làm rõ bản phác lát 2 trong ADR 0029 (bản đồ thành viên riêng tư, lát 1 — lúc viết chưa có trên `main` nên không đặt link); dựa trên [ADR 0004](0004-planner-identity.vi.md), [ADR 0005](0005-trip-sharing-and-story-cloning.vi.md) và [ADR 0025](0025-member-profiles-and-use-this-trip.vi.md).

## Bối cảnh

Lát 1 cho thành viên một bản đồ riêng tư ở `/my-map`. Chủ dự án đã quyết (2026-11-20): thành viên có thể chia sẻ bản đồ bằng một đường link, bản chia sẻ **chỉ hiện những nơi đã đi**, và tên **ẩn danh mặc định**. Bản rà soát bảo mật của thiết kế (`/sec-check`, PASS_WITH_WARNINGS) nêu chín yêu cầu mà ADR này phải chốt trước khi có mã.

Sự thật từ code:

1. **Chia sẻ chuyến là mẫu để tham khảo, không phải khuôn để chép.** Token chuyến gồm 43 ký tự base64url (`SHARE_TOKEN_PATTERN`, `schemas.ts:105`), tra theo digest SHA-256 rồi đọc lại bản mới và so `timingSafeEqual`; mọi lỗi trả `null` (`getSharedTrip`, `repository.ts:2562-2587`). Nhưng chính token lại được lưu **thô** trên chuyến, và việc tra cứu có chỉ mục digest được cache.
2. **Mutation dùng cookie phải chứng minh nguồn gốc.** `requireSameOrigin` (`src/server/planner/http.ts:116`) từ chối mutation khác site và đòi `Origin` hoặc `Sec-Fetch-Site` với non-GET xác thực bằng cookie.
3. **Tài khoản bị vô hiệu phải biến mất.** `isDisabled(user)` (bị ban hoặc xoá mềm) là cách đăng nhập hiện đã đối xử với chúng (`repository.ts:386`); `deleteUser` tự xoá các dòng của người dùng trong một transaction (`repository.ts:~1070`, như với `termsAcceptances`).
4. **Bảng audit đã có `targetKind: 'user'`** (`schemas.ts:893`) và `action` tự do (≤40).
5. **`displayName` chỉ là `trim().min(2).max(80)`** (`schemas.ts:148`), nên có thể chứa email hay số điện thoại. Gate `profilePublicOpen` của ADR 0025 mới **được thiết kế, chưa xây**: chỉ có trong tài liệu.
6. **Persistence có một mẫu cho bảng theo từng người dùng** (migration `0012_terms_acceptances.sql`: `seq`, `id`, không khoá ngoại, file rollback, import/export trong `planner-transfer.ts`).

Điều chưa biết: bao nhiêu thành viên sẽ chia sẻ; Chính sách riêng tư của chủ có bao gồm tên công khai không (chưa viết); nginx trên VM có cache hay ghi log các đường dẫn này không (repo có `deploy/nginx/default.conf`; VM thật chưa được kiểm tra).

## Quyết định

### 1. Lưu trữ: một dòng cho mỗi thành viên, token lưu dạng digest

- Bảng `member_map_shares`, 1:1 theo `user_id` (duy nhất): `token_digest` (SHA-256 hex, 64, **duy nhất, nullable** — null nghĩa là "không chia sẻ"), `share_name` (`anonymous` | `name`, mặc định `anonymous`), `created_at`, `updated_at`. Không khoá ngoại (ADR 0013). Thiếu dòng được hiểu là "không chia sẻ, ẩn danh".
- Token gồm 43 ký tự từ `randomBytes(32)`, cùng dạng với token chuyến. Nó **chỉ hiện một lần**, trong phản hồi cấp hoặc xoay token; chỉ digest được lưu. Cái giá: thành viên làm mất link phải xoay token (link cũ chết). Chấp nhận: đọc được database hay bản backup không được cho ra link dùng được — điều mà token chuyến hiện không đạt (việc làm chặt cho chuyến nằm ngoài phạm vi).
- Migration chỉ thêm, mặc định riêng tư, kèm file rollback. **Không agent nào áp dụng migration lên production.**

### 2. Hình chiếu công khai: chỉ điểm đã đi, thô, ổn định

- Nguồn: các chuyến của thành viên có `planningStatus = completed`, **đã archive hay chưa**; điểm đến phải có trong seed `destinations`. Review và `visitedOn` tự khai **không** được dùng. Điểm đã lên kế hoạch không bao giờ xuất hiện.
- Kiểu `PublicMemberMap = { displayName: string | null; points: PublicMemberMapPoint[] }`, `PublicMemberMapPoint = { slug; visitsBucket: 1 | 2 | 3 }`, là **kiểu riêng** so với điểm riêng tư của lát 1 để không thể vô tình serialize điểm kế hoạch. Bậc: 1 chuyến → 1, 2–3 → 2, từ 4 → 3 (vẽ bằng `pinRadius` sẵn có, ba cỡ). Điểm sắp theo `slug`; không có mốc thời gian, id chuyến, tiêu đề, ngày, số lượng mục riêng tư hay nội dung review.
- Hình chiếu tính từ dữ liệu sống ở mỗi request. Xoá chuyến đã hoàn thành thì điểm biến mất ngay; archive chuyến đã hoàn thành thì điểm vẫn còn (cùng quy tắc với bản riêng tư).
- Thành viên thấy **bản xem trước** đúng bằng hình chiếu công khai trong phần cài đặt chia sẻ trước khi bật. Khi có dưới 2 nơi đã đi, phần cài đặt cảnh báo rằng bản đồ thưa dễ bị nhận ra hơn; đó là cảnh báo, không chặn.

### 3. Tên: ẩn danh mặc định, không thừa hưởng

- `share_name = anonymous` trả `displayName: null`. `name` trả `displayName` của thành viên, **đọc mới lúc render**, không snapshot; đó là cùng một tên công khai như ADR 0025 (không có tên riêng cho bản đồ).
- Chọn `name` bị từ chối bằng `422 display_name_unsuitable` khi `displayName` hiện tại trông như địa chỉ email (chứa `@`) hay số điện thoại (từ 7 chữ số). Thành viên đổi tên trước. Đây là rào chống nhầm lẫn, không phải bằng chứng an toàn danh tính.
- **Cho tới khi `profilePublicOpen` tồn tại và được bật**, `name` bị từ chối bằng `403 share_name_unavailable`: lát 2 ban đầu chỉ ra bản ẩn danh. Cách này dùng lại gate của ADR 0025 thay vì tạo gate khác, và chờ Chính sách riêng tư của chủ (câu hỏi 1).
- Tên không bao giờ xuất hiện trong `<title>`, metadata, Open Graph, URL, log hay dòng audit. Nơi hiện tên thì là văn bản thuần trong thân trang.

### 4. API cho chủ bản đồ (chỉ phiên cookie của chính thành viên)

| Method và đường dẫn | Tác dụng |
|---|---|
| `GET /api/planner/map/share` | `{ enabled, shareName }` — không bao giờ trả token |
| `PUT /api/planner/map/share` | Body strict `{ enabled, shareName }`. Idempotent: bật bản đồ đã có token thì giữ token và không trả token; bật bản đồ chưa có thì cấp token và trả **một lần** |
| `POST /api/planner/map/share/rotate` | Token mới, trả một lần; token cũ chết trong cùng transaction |
| `DELETE /api/planner/map/share` | Thu hồi (`token_digest = null`); lặp lại vẫn thành công |

Chủ thể là user của phiên: không đọc `userId` hay slug từ body hay path. Body là schema Zod `.strict()` kiểm ngay trong handler. Mutation đi qua kiểm tra same-origin sẵn có (sự thật 2) và cùng envelope lỗi. Mutation có **bucket limiter riêng** theo user (đề xuất 20 lần/giờ); lượt đọc công khai có bucket riêng, không dùng chung với chuyến, để bên này không đốt hạn mức bên kia.

### 5. Trang công khai `/shared-map/[token]`

- Route `/shared-map/[token]` ↔ VI `/ban-do-chia-se/[token]`. **Chỉ là trang**: không có endpoint JSON công khai, nên hình chiếu allow-list chỉ có một bề mặt.
- **Một câu trả lời cho mọi lỗi** — `notFound()` cùng thân cho: token sai định dạng, token lạ, đã thu hồi, không chia sẻ, chủ bị ban, chủ bị xoá mềm, chủ đã bị xoá. Thứ tự kiểm tra: định dạng token → limiter đọc (`429` không lộ gì về token) → tra theo digest → **đọc mới** → `timingSafeEqual` trên digest → chủ tồn tại và `!isDisabled` → dựng view. Việc tra cứu đọc thẳng dòng (không chỉ mục cache): bảng nhỏ, limiter chặn chi phí, và loại được trường hợp chỉ mục cũ.
- Header và metadata: `force-dynamic`, `Cache-Control: private, no-store`, `robots: noindex, nofollow`, `Referrer-Policy: no-referrer`, không `alternates`/`hreflang`, không vào sitemap, không JSON-LD, không Open Graph. Tiêu đề chung chung.
- Token nằm trong URL nên access log sẽ chứa nó. `deploy/nginx/default.conf` tắt `access_log` cho hai location này, và nginx không được cache chúng. VM thật do PR kiểm chứng, không giả định.

### 6. Vòng đời, audit và chuyển dữ liệu

- `deleteUser` xoá dòng chia sẻ của thành viên trong cùng transaction. Link của user bị ban hoặc xoá mềm trả 404 trong khi dòng vẫn còn; khôi phục thì link cũ sống lại.
- Dòng audit (`targetKind: 'user'`, `targetId` = id user, cùng transaction): `map_share_on`, `map_share_off`, `map_share_rotate`, `map_share_name`. Không token, không tên, không điểm đến trong bất kỳ dòng, log hay lỗi nào.
- Export (`planner-transfer.ts`) **không** mang `token_digest`. Import tạo mọi dòng với `token_digest = null` và `share_name = anonymous`: **nhập một file không bao giờ công khai thứ gì**.

### 7. Các lát, thứ tự và review

1. **2a** store, migration, API cho chủ, audit, `deleteUser`, transfer — chưa có trang công khai.
2. **2b** trang công khai và test của nó.
3. **2c** điều khiển và bản xem trước trên `/my-map`, cùng việc hiện link một lần.

`/sec-check` chạy trên mã của 2a và 2b (khuyến nghị, do chủ gọi). BLOCKED thì dừng lát đó.

## Phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn) Token riêng, lưu dạng digest, hiện một lần; hình chiếu thô chỉ điểm đã đi; ẩn danh mặc định; chỉ là trang | Database hay backup lộ cũng không cho ra link dùng được; chuyến kế hoạch không bao giờ bị lộ; một bề mặt công khai | Link mất phải xoay token; UI phải cẩn thận hơn (xem trước, hiện một lần) |
| B Dùng lại cơ chế chia sẻ chuyến và lưu token thô | Ít code nhất | Thừa hưởng token thô khi lưu; token chuyến và token bản đồ dễ nhầm |
| C Hiện bản đồ trên hồ sơ công khai của thành viên (ADR 0025) | Dễ được tìm thấy | Hồ sơ chưa xây; ở đó đã loại công khai mặc định; rủi ro dò quét |
| D Thêm endpoint JSON công khai | Cho trang khác nhúng | Bề mặt thứ hai phải allow-list, giới hạn tốc độ và test |

Phương án á quân là **B**. Nó thua vì một lý do: cách lưu token không nên chép một mẫu yếu hơn sang tính năng mới.

## Hệ quả

Dễ hơn: thành viên cho người khác xem mình đã đi đâu mà người xem không cần tài khoản; không có gì riêng tư hay hướng về tương lai có thể chạm tới theo thiết kế; thu hồi có hiệu lực ngay và link vô dụng khi không còn dòng.

Khó hơn, và không miễn phí:

- **Link mất không khôi phục được**, chỉ thay mới.
- **Hai việc của chủ chặn chế độ hiện tên:** Chính sách riêng tư và `profilePublicOpen`; tới lúc đó chỉ ra bản ẩn danh.
- **Bản đồ thưa vẫn có thể khiến người đã quen biết nhận ra chủ nhân** (một nơi chỉ họ từng đến); bản xem trước và cảnh báo giảm chứ không xoá được rủi ro này.
- **Quy tắc nginx và việc kiểm tra VM là việc thật** và không thể chứng minh chỉ từ repo.
- **Không cache khi tra trang:** mỗi lượt xem đọc dòng chia sẻ và các chuyến của thành viên; limiter chặn chi phí, và tài khoản rất lớn là cùng lưu ý về quy mô như lát 1.
- Hoàn tác sẽ bỏ bảng và mọi link đã cấp; trước khi rollback phải thu hồi mọi token hoặc tắt route để link cũ trả 404.

### Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Tên lộ qua `displayName` chứa thông tin liên lạc | Rào `422`, chế độ tên bị gate, tên chỉ nằm trong thân trang, không vào metadata hay log |
| Suy ra sự tồn tại của token hay tài khoản | Một 404 cho mọi lỗi, so sánh thời gian hằng, limiter không lộ gì |
| Dữ liệu riêng tư hay kế hoạch lọt vào thân công khai | Kiểu công khai riêng, test liệt kê khoá, nguồn chỉ điểm đã đi, bậc thô |
| Link lưu thô bị lộ từ backup | Chỉ lưu digest; export bỏ nó; import không bao giờ công khai |
| Mutation khác site lên cài đặt | Quy tắc same-origin sẵn có cộng test từ origin khác |
| Token nằm trong access log hay cache CDN | nginx `access_log off`, không cache, `no-store`, `no-referrer` |

## Việc tiếp theo

- Triển khai: các lát 2a–2c; mỗi lát cập nhật tài liệu tính năng hai ngôn ngữ (`docs/features/member-map.*`) và các dòng `docs/architecture.*` (route, dữ liệu, API). Số migration lấy theo thứ tự merge (ADR 0025 cũng dành `0016`/`0017`).
- Test: liệt kê khoá allow-list của thân công khai; điểm chỉ kế hoạch hay chỉ có review không xuất hiện; chuyến hoàn thành đã archive vẫn hiện, chuyến bị xoá thì mất; hai thành viên cô lập (token của A không bao giờ trả B; `PUT`/`DELETE` của B không đổi A); cùng một 404 cho mọi nhánh lỗi kể cả chủ bị ban, xoá mềm, đã xoá; `429` không lộ gì; mutation khác origin bị từ chối; không có token trong audit, log hay export; import không bao giờ bật chia sẻ; `deleteUser` xoá dòng; HTML và JSON ẩn danh không chứa chuỗi tên nào, và tên cũ của người đã đổi tên hay đã xoá không bao giờ xuất hiện.
- Review: `/sec-check` trên mã của 2a và 2b: NOT RUN (khuyến nghị). Kiểm tra nginx trên VM không cache hay ghi log các đường dẫn này.
- Quyết định của chủ (khuyến nghị đứng đầu):
  1. **Chế độ hiện tên.** Khuyến nghị: ra bản chỉ ẩn danh trước, mở `name` cùng `profilePublicOpen` khi Chính sách riêng tư được công bố. Phương án khác: dựng một gate riêng cho bản đồ.
  2. **Bậc số lần đi.** Khuyến nghị: 1, 2–3, từ 4. Phương án khác: chỉ "đã đi", không có cỡ.
  3. **Hiện link một lần.** Khuyến nghị: có (chỉ lưu digest). Phương án khác: lưu thô để xem lại được, đổi lại là kho lưu yếu hơn.
