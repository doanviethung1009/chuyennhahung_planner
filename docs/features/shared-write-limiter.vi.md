# Tính năng — Giới hạn ghi dùng chung

🇬🇧 English version: [shared-write-limiter.md](shared-write-limiter.md)

## Summary

Hai giới hạn ghi đánh giá — 5 lần mỗi giờ cho mỗi người dùng đã đăng nhập và 3 lần mỗi giờ cho mỗi khách (ADR [0014](../adr/0014-community-trips-and-reviews.vi.md)) — trước đây nằm trong bộ nhớ tiến trình: khởi động lại thì đếm lại từ đầu, hai instance thì gấp đôi giới hạn. Khi Planner chạy trên PostgreSQL, chúng đếm trong một bảng dùng chung: restart vẫn giữ số đếm và mọi instance thấy cùng một số. Nếu không với tới được database thì lần ghi bị từ chối bằng `503`, không bao giờ cho qua (ADR [0019](../adr/0019-community-foundation.vi.md) §3). Khách không thấy gì khác; không có PostgreSQL thì limiter trong tiến trình giữ nguyên.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `PUT /api/planner/reviews/[placeSlug]` | giống | giống |
| `POST /api/community/reviews` | giống | giống |

Phản hồi giữ nguyên: `429 rate_limited` kèm `Retry-After` là số nguyên khi vượt giới hạn; **mới** `503 service_unavailable` (không có `Retry-After`) chỉ khi database của limiter lỗi — và khi đó đánh giá không được ghi.

## Data

Bảng `rate_limit_counters` (migration `0011_rate_limit_counters.sql`, rollback thủ công `db/rollback/0011_rate_limit_counters.sql`): `key` text (SHA-256 hex của tên limiter + khóa người gọi, nên không có địa chỉ hay id người dùng ở dạng rõ), `window_start` bigint (epoch ms), `count` integer; khóa chính `(key, window_start)`; không có khóa ngoại (ADR 0013). Không nằm trong export/import JSON: bộ đếm bỏ đi được. Chỉ là bộ đếm, không bao giờ là nội dung đánh giá.

## How it works

`AsyncRateLimiter { check(key): Promise<RateLimitResult> }` (`src/server/rate-limit.ts`) nằm cạnh `RateLimiter` đồng bộ — vẫn dùng cho lượt đọc, JSON store và mọi limiter khác. `createPostgresRateLimiter` (`src/server/persistence/postgres-rate-limiter.ts`) chạy một câu `INSERT … ON CONFLICT DO UPDATE … RETURNING count` nguyên tử mỗi lần kiểm trên pool **ngoài** transaction và advisory lock của store, nên lần kiểm không chờ lần ghi dài và một lần ghi bị từ chối vẫn được tính. Cửa sổ cố định: `window_start = floor(now / window) × window`; đếm vượt giới hạn → chặn, `Retry-After` = số giây đến hết cửa sổ. Số đếm bị chặn ở `limit + 1` để một đợt flood không làm tràn. Khoảng 10 phút một lần, một lần kiểm xóa các cửa sổ cũ hơn 24 giờ ở nền, bỏ qua lỗi.

`src/server/planner/instance.ts` dựng limiter cùng repository: bộ đếm PostgreSQL trên cùng pool khi có `PLANNER_DATABASE_URL`, nếu không thì limiter trong tiến trình được `asAsyncLimiter` bọc lại. Đã cấu hình database thì không bao giờ lùi về bộ đếm trong tiến trình. Route gọi `(await getWriteLimiters()).plannerReview.check(userId)` / `.guestReview.check(clientKey)` **trước** mọi lần ghi; `service_unavailable` được ném ra thì store không bị chạm tới.

**Thêm một write limiter (10.4, 10.5):** thêm một mục vào `WRITE_LIMITS` trong `rate-limit.ts` (`name`, `limit`, `windowMs` ≤ 24 giờ), thêm vào `buildLimiters` trong `instance.ts`, gọi `check` trước khi ghi.

## Files

| Path | Role |
|---|---|
| `src/server/rate-limit.ts` | `AsyncRateLimiter`, `asAsyncLimiter`, `WRITE_LIMITS` |
| `src/server/persistence/postgres-rate-limiter.ts` | limiter dùng chung |
| `src/server/planner/instance.ts` | chọn limiter, `getWriteLimiters` |
| `src/app/api/planner/reviews/[placeSlug]/route.ts`, `src/app/api/community/reviews/route.ts` | nơi gọi |
| `db/migrations/0011_rate_limit_counters.sql`, `db/rollback/0011_rate_limit_counters.sql` | bảng và rollback |

## Tests

`tests/review-limiter-routes.test.ts` (HTTP 429 + `Retry-After` cho cả hai route, theo người dùng và theo khách; viết và chạy xanh trên code in-memory cũ trước, P10-13); hạn 30 ngày mặc định của restriction khách được kiểm trong `tests/community-reviews.test.ts`. `tests/postgres-rate-limiter.test.ts` (pool giả: khóa băm, fail closed không lộ chi tiết driver, `Retry-After`, nhịp dọn). `tests/review-limiter-fail-closed.test.ts` (cả hai route: `503` và không ghi gì). `tests/postgres-rate-limiter.integration.test.ts` (PostgreSQL thật, đồng hồ inject: hai instance chung số đếm, kiểm đồng thời chính xác, restart giữ số đếm và cửa sổ kế tiếp reset, tên tách biệt, dọn, pool chết thì fail closed) — bỏ qua nếu không có `TEST_DATABASE_URL`; CI chạy. `tests/rate-limit.test.ts` giữ nguyên.

## Limits and open questions

- **`x-forwarded-for` vẫn giả mạo được.** Khóa của khách là hop forwarded đầu tiên; xoay giá trị này vượt được giới hạn 3/giờ. Chưa sửa ở đây (batch 10.6: khóa HMAC và tin cậy header proxy). Trần 20 đánh giá mỗi ngày cho mỗi địa điểm của repository vẫn là lớp đỡ.
- Cửa sổ cố định cho phép tối đa gấp đôi giới hạn quanh ranh giới cửa sổ; limiter in-memory cũ là cửa sổ trượt.
- Một vòng đi database mỗi lần ghi bị giới hạn; chi phí **chưa đo** (giả định: database trong LAN).
- Database giờ là phụ thuộc của hai lần ghi này: khi nó sập chúng trả `503`, như phần còn lại của Planner.
- Chỉ hai limiter này được chuyển; đăng nhập, đăng ký, Google và đọc share vẫn trong tiến trình.
- Rollback: hoàn tác các route và `instance.ts`, chạy SQL rollback bằng tay. Khuyến nghị `/sec-check` trước khi merge, chưa chạy.
