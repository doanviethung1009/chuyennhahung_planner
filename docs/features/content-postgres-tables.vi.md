# Tính năng — Travel Content trên các bảng PostgreSQL

🇬🇧 English version: [content-postgres-tables.md](content-postgres-tables.md)

## Mục đích

Travel Content — place, story, collection, review và template — có thể lưu dữ liệu trong
PostgreSQL, mỗi collection một bảng, thay vì một file JSON. Người đọc và editor không thấy
gì thay đổi; chủ nhà có nội dung mà nhiều instance app dùng chung không mất cập nhật, được
database bảo vệ bằng khoá và ràng buộc, và sao lưu được bằng công cụ chuẩn. Quyết định ở
[ADR 0013](../adr/0013-content-on-postgres-tables.vi.md), đối ứng của
[planner-postgres-persistence.vi.md](planner-postgres-persistence.vi.md). Không đặt
`CONTENT_DATABASE_URL` thì không có gì đổi: file JSON khi phát triển, memory store trong
test.

## Route

Không có. API HTTP trong [../travel-content-api.vi.md](../travel-content-api.vi.md) và các
trang public không đổi. Có một hành vi mới: khi đã đặt `CONTENT_DATABASE_URL` mà database
không với tới được, các route nội dung admin và mọi trang public đọc content trả `503` với
mã `service_unavailable` trong envelope lỗi quen thuộc; app không bao giờ lùi về file.

## Dữ liệu

Migration `db/migrations/0004_content.sql` tạo `content_places`, `content_stories`,
`content_collections`, `content_reviews`, `content_templates` và `content_revision` (một
dòng, bộ đếm mà mỗi transaction có ghi đều tăng).

- **Khoá:** `slug` (review: `id`) là khoá chính, nên tính duy nhất do database bảo đảm chứ
  không chỉ repository. Cột ẩn `seq` giữ thứ tự chèn.
- **Cột cho giá trị vô hướng:** trạng thái, ngày (`date`), timestamp (`timestamptz`),
  rating và toạ độ (`double precision`), số tiền VND (`bigint`), số đếm, điểm đến, danh
  mục, phong cách chuyến đi. Enum có ràng buộc `CHECK`; ngày đi của story, toạ độ của place
  và đối tượng của review mỗi thứ được tách thành hai cột.
- **`jsonb` cho cấu trúc:** văn bản song ngữ `{vi, en}`, block của story, gallery, SEO,
  affiliate link, chi phí thực tế, các ngày của template và source snapshot — chúng được
  đọc và ghi như một khối và hiện chưa có truy vấn nào đi sâu vào bên trong.
- **`text[]` cho danh sách slug:** `place_slugs`, `review_ids`, `itinerary_slugs`,
  `destination_slugs`, `story_slugs`.
- **Chưa có khoá ngoại giữa các entity content.** Repository chưa có quy tắc "đang được
  tham chiếu" và template cố ý tồn tại lâu hơn story của nó (ADR 0001 §4), nên FK ở database
  sẽ đổi hành vi ngay trong cùng thay đổi chuyển storage. Kiểm tra toàn vẹn
  (`validateIntegrity`) và kiểm tra khi import vẫn là lớp bảo vệ.
- **Đọc lại.** NULL ở field nullable đọc ra `null`; `bigint` đến repository dưới dạng số;
  timestamp đọc ra chuỗi ISO có mili giây.

## Cách hoạt động

`ContentStore` vẫn là `DocumentStore<ContentData>`; `ContentRepository` và 26 handler không
đổi. Store Postgres là engine bảng mà ADR 0009 đã xây cho Planner, giờ được tham số hoá:
`createPostgresTableStore(pool, { tables, lockKey, revisionTable, label })` trong
`postgres-planner-store.ts`. `transact` là một transaction database: `BEGIN`, advisory lock
(`CONTENT_LOCK_KEY`), nạp năm bảng hoặc dùng lại cache, chạy mutation trên bản sao, chỉ ghi
những dòng khác biệt (khoá theo `slug`), tăng `content_revision`, `COMMIT`. Ném lỗi là
`ROLLBACK`. `read()` là transaction `REPEATABLE READ READ ONLY`. Cache theo từng instance
được kiểm chứng bằng `content_revision`: commit của instance khác làm nó nhích lên, nên một
replica tệ nhất chỉ chậm một request, không bao giờ sai âm thầm.

`src/server/persistence/content-rows.ts` là toàn bộ phần ánh xạ: cột nào giữ field nào của
schema, được parse lúc đọc ra bằng chính các schema zod mà repository dùng. Phần diff, sinh
SQL và dịch lỗi (vi phạm unique thành `409`, lỗi kết nối thành `503` không kèm chi tiết
driver) dùng chung với Planner.

`src/server/content/instance.ts` chọn store. Đặt `CONTENT_DATABASE_URL` nghĩa là
PostgreSQL: instance chạy các migration còn thiếu trước khi phục vụ request, rồi seed nội
dung demo trong lúc giữ một session advisory lock (trừ khi `TRAVEL_CONTENT_AUTOSEED=false`)
để các replica khởi động cùng lúc chỉ seed một lần. Lỗi ở một trong hai bước là `503` và
request kế tiếp thử lại.

`npm run content:import -- <file>` kiểm tra `travel-content.json` bằng schema của
repository, chạy kiểm tra toàn vẹn, từ chối bảng không rỗng và chèn trong một transaction.
`npm run content:export -- <file>` ghi ra file mà store JSON mở được (mode `0600`) — đường
rollback. `npm run db:migrate` migrate mọi database có đặt URL, và `npm run
content:seed-static` bổ sung vào store đang được chọn. Cách vận hành ở
[usage](../usage.vi.md#chạy-travel-content-trên-postgresql).

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `db/migrations/0004_content.sql`, `db/rollback/0004_content.sql` | Schema và rollback thủ công |
| `src/server/persistence/content-rows.ts` | Danh sách bảng và ánh xạ cột cho năm collection |
| `src/server/persistence/planner-rows.ts` | Phần ánh xạ dòng và diff dùng chung (giờ tham số hoá theo danh sách bảng và khoá) |
| `src/server/persistence/postgres-planner-store.ts` | Giao thức transaction/cache dùng chung (`createPostgresTableStore`), `CONTENT_LOCK_KEY` |
| `src/server/persistence/postgres-content-store.ts` | Store content: engine cộng tham số của content |
| `src/server/persistence/content-transfer.ts` | Logic import và export |
| `src/server/persistence/migrate.ts` | `migrateOnStartup` nhận một nhãn cho log và câu 503 |
| `src/server/content/instance.ts` | Chọn store theo `CONTENT_DATABASE_URL`, seed dưới một lock |
| `scripts/content-import.ts`, `scripts/content-export.ts`, `scripts/db-migrate.ts`, `scripts/content-seed-static.ts` | Điểm vào, chạy bằng `vite-node` |
| `deploy/compose.app.yml` | Ghi chú về khi nào được scale app |

## Test

- `tests/content-rows.test.ts` — offline: mỗi field của schema đều có cột; mỗi bản ghi seed
  round-trip bằng đúng những gì store JSON giữ; mutation không đổi gì thì không sinh câu
  lệnh; update chỉ mang các cột thay đổi và khoá theo `slug` (review theo `id`); danh sách
  slug bind dạng `text[]` và giá trị không bao giờ bị nối vào chuỗi; dòng hỏng được báo theo
  bảng và khoá, không kèm nội dung.
- `tests/content-transfer.test.ts` — offline: import vào store trống, từ chối store không
  trống (không ghi gì), file sai được báo theo đường dẫn mà không in lại nội dung, tham chiếu
  treo bị từ chối, export rồi import ra kết quả giống hệt.
- `tests/content-database-selection.test.ts` — cổng đóng trả `503` không lộ secret hay host
  (và không lùi về file); store dùng khoá lock riêng, đọc bảng revision riêng và nạp năm
  bảng theo thứ tự; no-op không tăng revision.
- `tests/planner-rows.test.ts`, `tests/postgres-planner-store.test.ts`,
  `tests/migrate.test.ts`, `tests/planner-transfer.test.ts` — không đổi, và là bằng chứng
  rằng việc dùng chung engine không làm đổi Planner.
- `tests/content-postgres.integration.test.ts` — **chỉ khi có `TEST_DATABASE_URL`**, nếu
  không thì bị bỏ qua (báo là chưa chạy): migration `0004` được áp dụng, seed ra trạng thái
  giống hệt memory store, luồng sửa/xuất bản/gỡ/xoá ra giống hệt, danh sách slug, ngày, enum
  và field nullable nguyên vẹn trong bảng, khoá chính và ràng buộc `CHECK` do database
  cưỡng chế (`23505`, `23514`), hai connection pool ghi cùng lúc không mất cập nhật, lần ghi
  của instance khác được thấy ở lần đọc kế tiếp, và mutation ném lỗi không làm đổi dữ liệu
  hay revision.

## Giới hạn và câu hỏi còn mở

- Revision đổi (mọi lần ghi, trên bất kỳ replica nào) thì nạp lại cả năm bảng, và một lock
  toàn cục tuần tự hoá việc ghi content. Ổn với hàng trăm story; ngưỡng để chuyển các lần
  đọc nóng (`getPublicContent`, các endpoint danh sách) sang truy vấn có đích là p95 đọc
  trên khoảng 200 ms hoặc dung lượng content trên khoảng 5 MB (ADR 0013).
- Chưa có khoá ngoại và quy tắc "đang được tham chiếu": vẫn được phép xoá một place mà story
  liệt kê, như trước. Đây là một quyết định riêng.
- Phần ánh xạ phải theo kịp schema. `tests/content-rows.test.ts` hỏng khi một field của
  schema không có cột, nhưng một cột mới vẫn cần migration viết tay.
- Bảng của cả hai store có thể cùng nằm trong một database (mỗi store chạy toàn bộ bộ
  migration). Vô hại, và là cái giá của một runner.
- Test tích hợp đã chạy local với PostgreSQL 14 và cũng chạy trong CI với `postgres:17`; VM
  của chủ nhà chạy 16 hoặc 17. Nên chạy một lần với đúng major version thật bằng database
  scratch.
- Request đầu tiên sau mỗi lần deploy phải chờ migration và, trên database mới, cả seed.
  Rate limiter theo process, vốn không liên quan, vẫn là giới hạn việc scale app.
- Khuyến nghị chạy `/sec-check` cho chuỗi kết nối mới, migration và các file import/export
  trước lần deploy production đầu tiên; việc này chưa được chạy.
