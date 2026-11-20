# Tính năng — Chia sẻ bản đồ thành viên (store và API chủ sở hữu)

🇻🇳 English: [member-map-sharing.md](member-map-sharing.md)

## Summary

Thành viên đã đăng nhập có thể bật link chia sẻ bản đồ những nơi mình đã đi, đổi link hoặc thu hồi. Đây là **Lát 2a** của ADR [0030](../adr/0030-member-map-sharing.vi.md): chỉ gồm store, migration và API chủ sở hữu. **Chưa có trang công khai** (`/shared-map/[token]`, Lát 2b) và **chưa có điều khiển trên `/my-map`** (Lát 2c), nên token cấp ở đây chưa mở được gì cho đến khi 2b ra mắt. Mặc định tắt và ẩn danh; token chỉ hiện một lần, chỉ lưu digest SHA-256.

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `GET /api/planner/map/share` | như nhau | như nhau |
| `PUT /api/planner/map/share` | như nhau | như nhau |
| `DELETE /api/planner/map/share` | như nhau | như nhau |
| `POST /api/planner/map/share/rotate` | như nhau | như nhau |

Route API không bản địa hoá. Trang công khai (2b) và điều khiển (2c) không thuộc lát này.

## Data

- Bảng `member_map_shares` (migration `0016`, rollback trong `db/rollback/`, khoá JSON `memberMapShares`): `user_id` (duy nhất), `token_digest` (SHA-256 hex, duy nhất, nullable — null nghĩa là không chia sẻ), `share_name` (`anonymous` | `name`), `created_at`, `updated_at`. Không có khoá ngoại (ADR 0013). Thiếu dòng nghĩa là "không chia sẻ, ẩn danh".
- Token gồm 43 ký tự base64url từ `randomBytes(32)` (`SHARE_TOKEN_PATTERN`). Chỉ trả một lần ở phản hồi cấp token, không bao giờ lưu.
- Kiểu công khai `PublicMemberMap { displayName: string | null; points }` và `PublicMemberMapPoint { slug; visitsBucket: 1 | 2 | 3 }`, tách riêng khỏi mọi kiểu bản đồ riêng tư. Bậc: 1 chuyến → 1, 2–3 → 2, từ 4 → 3.
- Hành động audit trên `targetKind: 'user'`: `map_share_on`, `map_share_off`, `map_share_rotate`, `map_share_name`. Không dòng nào có token hay tên.
- Giới hạn tốc độ: thay đổi chia sẻ có bucket riêng, 20 lần mỗi giờ mỗi thành viên (`WRITE_LIMITS.memberMapShare`); bucket đọc công khai (`memberMapReadLimiter`, 60 lần mỗi phút mỗi client) được định nghĩa sẵn cho Lát 2b, tách khỏi chia sẻ chuyến đi.

## How it works

Chủ thể là người dùng của phiên; không đọc user id hay slug từ body hay path. `plannerRoute` ép quy tắc same-origin cho cookie. Body là schema Zod strict.

- `GET` trả `{ enabled, shareName, visitedPlaces, sparse }`, không bao giờ có token. `sparse` đúng khi dưới 2 điểm đã đi: để cảnh báo ở bản xem trước sau này, không chặn.
- `PUT { enabled, shareName }` idempotent. Bật bản đồ đã có token thì giữ token và không trả token; bật bản đồ chưa có thì cấp token và trả một lần. `shareName: 'name'` bị từ chối `403 share_name_unavailable` cho đến khi có cổng hồ sơ của ADR 0025 (`profilePublicOpen`), và `422 display_name_unsuitable` khi tên hiển thị chứa `@` hoặc có từ 7 chữ số (kiểm tra thứ hai chạy sau khi cổng mở).
- `POST …/rotate` cấp token mới trong cùng transaction làm token cũ chết; bản đồ chưa chia sẻ trả `409 not_shared`. `DELETE` thu hồi và có thể lặp lại.
- `repository.getSharedMemberMap(token)` là hàm tra cứu Lát 2b sẽ gọi: định dạng token, rồi đọc mới, so digest thời gian hằng, chủ chưa bị khoá hay xoá, rồi dựng hình chiếu từ dữ liệu sống (chỉ chuyến đã hoàn thành, kể cả đã lưu trữ, điểm đến có trong catalog, sắp theo slug). Mọi thất bại đều trả `null`.
- `deleteUser` xoá dòng chia sẻ trong cùng transaction. Chủ bị khoá hoặc xoá mềm đọc ra `null` còn dòng vẫn giữ; khôi phục thì link sống lại.
- Export ghi `tokenDigest: null`; import đặt lại mọi dòng về không token và `anonymous`, nên nhập một tệp không bao giờ công khai thứ gì.

## Files

| Đường dẫn | Vai trò |
|---|---|
| `db/migrations/0016_member_map_shares.sql`, `db/rollback/0016_member_map_shares.sql` | Bảng và rollback thủ công |
| `src/server/planner/schemas.ts` | `memberMapShareSchema`, schema đầu vào strict |
| `src/server/planner/member-map-share.ts` | Token, digest, kiểm tra tên, bậc, hình chiếu công khai (hàm thuần) |
| `src/server/planner/repository.ts` | `getMemberMapShare`, `setMemberMapShare`, `rotateMemberMapShare`, `revokeMemberMapShare`, `getSharedMemberMap`, `deleteUser` |
| `src/server/persistence/planner-rows.ts`, `planner-transfer.ts`, `src/server/planner/store.ts` | Ánh xạ bảng, export không có digest, import không bao giờ bật |
| `src/app/api/planner/map/share/route.ts`, `…/rotate/route.ts` | API chủ sở hữu |
| `src/server/rate-limit.ts`, `src/server/planner/instance.ts` | Limiter thay đổi chia sẻ và đọc công khai |

## Tests

`tests/member-map-share.test.ts` (hàm thuần; token hiện một lần và chỉ lưu digest; rotate; revoke idempotent; cổng tên và chặn 422; mọi thất bại đọc ra `null`; allow-list hình chiếu, chuyến hoàn thành đã lưu trữ vẫn hiện, chuyến bị xoá biến mất; hai thành viên cô lập; chủ bị khoá và xoá mềm; `deleteUser`; audit không có token hay tên; export bỏ digest; import không bao giờ bật; tệp cũ không có khoá). `tests/member-map-share-routes.test.ts` (401 cho mọi method, mutation khác origin hoặc không origin bị từ chối, body strict, `share_name_unavailable`, cô lập giữa thành viên, bucket giới hạn riêng, dòng audit). PostgreSQL chỉ được phủ bởi test engine bảng dùng chung; vòng ghi/đọc bảng mới trên cơ sở dữ liệu **chưa** được kiểm (NOT RUN khi không có `TEST_DATABASE_URL`).

## Limits and open questions

- Chưa có trang công khai, điều khiển và bản xem trước (Lát 2b và 2c). Link bị mất phải đổi mới, không hiện lại được.
- Chế độ `name` vẫn đóng cho đến khi `profilePublicOpen` được xây và Chính sách Quyền riêng tư của chủ được công bố (ADR 0030, câu hỏi chủ 1).
- Không agent nào áp dụng migration. Quy tắc nginx cho `/shared-map/*` (không access log, không cache) thuộc Lát 2b và VM thật chưa được kiểm tra.
- Bản đồ thưa vẫn có thể lộ chủ nhân với người đã biết họ; cờ `sparse` chỉ hỗ trợ cảnh báo.
- `/sec-check` cho lát này **chưa chạy**; khuyến nghị chạy (migration, ranh giới tin cậy, xử lý token).
