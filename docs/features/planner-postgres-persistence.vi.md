# Tính năng — Planner trên PostgreSQL

🇬🇧 English version: [planner-postgres-persistence.md](planner-postgres-persistence.md)

## Mục đích

Planner — tài khoản, session, lượt đăng nhập Google, trip, ngày, activity và chi
phí — có thể lưu dữ liệu trong PostgreSQL thay vì một file JSON. Người đi chơi
không thấy gì thay đổi; chủ nhà có dữ liệu sống sót khi chạy tiến trình thứ hai,
được bảo vệ bằng ràng buộc của database, và sao lưu được bằng công cụ chuẩn.
Quyết định ở [ADR 0009](../adr/0009-postgres-persistence.vi.md). Không đặt
`PLANNER_DATABASE_URL` thì không có gì đổi: file JSON khi phát triển, memory store khi
test.

## Route

Không có. API HTTP trong [travel-planner-core.vi.md](travel-planner-core.vi.md)
giữ nguyên. Có một hành vi mới: khi đã đặt `PLANNER_DATABASE_URL` mà database không truy
cập được, mọi route Planner trả `503` với code `service_unavailable` trong
envelope lỗi quen thuộc.

## Dữ liệu

Bảy bảng trong `db/migrations/0001_planner.sql`, mỗi bảng một collection của
Planner: `planner_users`, `planner_sessions`, `planner_oauth_attempts`, `trips`,
`trip_days`, `trip_activities`, `trip_expenses`, cộng với `schema_migrations` và
`planner_revision` (migration `0003`: một dòng, bộ đếm mà mọi transaction có ghi
đều tăng, dùng cho cache bên dưới).
Mỗi cột ứng với một field của schema zod trong `src/server/planner/schemas.ts`
(`order` là `sort_order`); cột ẩn `seq` giữ thứ tự chèn để một bảng đọc ra đúng
thứ tự của mảng JSON.

- Duy nhất: handle, token hash, email, Google subject, token hash của session,
  state hash của OAuth, share token, `(trip_id, day_number)`,
  `(day_id, sort_order)` (hai cái sau là deferred để việc đổi thứ tự commit được).
- Khoá ngoại: session và lượt OAuth cascade từ user; ngày, activity và chi phí
  cascade từ trip; activity cascade từ ngày. `owner_id` của trip không cascade —
  repository xoá trip của user trước (ADR 0017) nên database không bao giờ thấy dòng mồ côi.
- Chi phí sao chép đúng repository: xoá activity thì giữ chi phí và ngày của nó
  (`activity_id ON DELETE SET NULL`); ngày còn chi phí thì không xoá được
  (`day_id` NO ACTION), giống `dropDays`. Cả hai đều có test ghim.
- Số tiền `BIGINT` tới repository dưới dạng number qua `normalizeVnd`; timestamp
  là `timestamptz` đọc ra chuỗi ISO (nên `…:00Z` đọc ra `…:00.000Z`);
  `source_template` là `JSONB`. NULL ở field schema đánh dấu `.optional()` đọc ra
  là *vắng mặt*, nên bản ghi bằng đúng cái JSON store trả về — chỉ khác là `null`
  tường minh và vắng mặt là một trong database.

## Cách hoạt động

`DocumentStore` có thêm `transact(mutate)`: một lần đọc-sửa-ghi nguyên tử.
`PlannerRepository.transaction` giờ gọi nó (vẫn áp dụng `withTripDefaults`); các
method khác của repository không đổi. Memory và JSON store cài nó trên hàng đợi
sẵn có; ném lỗi thì không ghi gì.

Store Postgres (`src/server/persistence/postgres-planner-store.ts`) chạy
`transact` như một transaction database: `BEGIN`, `pg_advisory_xact_lock` toàn
cục, nạp cả bảy bảng, chạy mutation trên một bản sao, so bản sao với các dòng đã
nạp theo `id`, chỉ ghi các dòng thay đổi (INSERT cha trước, UPDATE, rồi DELETE con
trước), `COMMIT`. Mọi lỗi — lỗi repository, ràng buộc, mạng — đều là `ROLLBACK`.
`read()` là transaction `REPEATABLE READ READ ONLY`. Mỗi dòng đọc
ra đều được parse bằng đúng schema zod mà kiểu của JSON store lấy từ đó. Phần
diff và ánh xạ dòng là thuần (`planner-rows.ts`) và được unit test offline; mọi
câu lệnh đều tham số hoá, và tên bảng/cột chỉ đến từ một danh sách hằng.

**Cache được kiểm bằng revision.** Mỗi instance store giữ trạng thái đã nạp gần
nhất, gắn với `planner_revision` lúc nạp. `read()` hỏi revision hiện tại trong
cùng snapshot; bằng nhau thì trả một `structuredClone` của cache, không nạp bảng;
khác nhau thì nạp lại bảy bảng. `transact` kiểm tra tương tự sau khi lấy khoá, nên
một lần ghi trên store không đổi cũng không phải nạp lại. Transaction có thay đổi
tăng revision trước `COMMIT` rồi bỏ cache (transaction no-op không đổi gì và để
nguyên revision); `ROLLBACK` giữ nguyên cả cache lẫn revision. Người gọi chỉ nhận
bản sao. Commit của replica khác làm revision đổi, nên một replica chậm nhất là
một request — không bao giờ sai một cách âm thầm. Store cũng có `revision()`;
repository so nó để dựng lại chỉ mục share-token, nên link tạo hoặc thu hồi trên
một replica được replica kia tôn trọng. JSON và memory store không có
`revision()` và giữ hành vi cũ.

Lỗi được dịch và làm sạch: vi phạm unique (`23505`) thành `409` sẵn có; lỗi kết
nối, xác thực, tài nguyên và timeout thành `503`; còn lại thành một lỗi chung chỉ
mang SQLSTATE. Thông điệp của driver — có thể chứa host, role hay nội dung dòng —
không bao giờ được trả về hay log, và chuỗi kết nối không bao giờ xuất hiện.

Chọn store nằm ở `src/server/planner/instance.ts`: đặt `PLANNER_DATABASE_URL` nghĩa là
PostgreSQL và **không bao giờ** quay về file. Khi instance được dựng lần đầu, trước
khi phục vụ request nào, nó chạy các migration còn thiếu (`migrateOnStartup`) trên
một kết nối dưới một advisory lock theo session, giữ suốt phần khởi tạo
`schema_migrations` và mọi file, nên các replica khởi động cùng lúc chỉ áp dụng
mỗi file một lần. Nếu thất bại, route trả `503 service_unavailable` không kèm chi
tiết driver (log chỉ có mã lỗi), pool dở dang được đóng, và request kế tiếp thử
lại.

`npm run db:migrate` chạy cùng đoạn code đó bằng tay: các file đánh số, mỗi file
một transaction và ghi checksum. `npm run planner:import -- <file>` kiểm tra bằng schema zod, chạy
`validateIntegrity()` với catalog nội dung thật, bỏ session đã hết hạn, từ chối
bảng không trống, và chèn trong một transaction. `npm run planner:export -- <file>`
ghi một `planner.json` (quyền 0600) mà JSON store mở được — đường rollback. Cách
vận hành ở [usage](../usage.vi.md#chạy-planner-trên-postgresql).

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `src/server/persistence/json-store.ts` | `DocumentStore.transact` cho memory và JSON store |
| `src/server/persistence/planner-rows.ts` | Bố cục bảng, ánh xạ dòng, diff (thuần) |
| `src/server/persistence/postgres-planner-store.ts` | Transaction khoá advisory, nạp dữ liệu, dịch lỗi |
| `src/server/persistence/postgres-pool.ts` | Một pool `pg` nhỏ; DATE giữ dạng text |
| `src/server/persistence/migrate.ts` | Bộ chạy migration, khoá session, `migrateOnStartup` |
| `src/server/persistence/planner-transfer.ts` | Logic import và export |
| `src/server/planner/instance.ts` | Chọn store theo `PLANNER_DATABASE_URL` |
| `src/server/planner/repository.ts` | `transaction` uỷ quyền cho `store.transact` |
| `src/server/content/errors.ts` | Code mới `service_unavailable` (503) |
| `db/migrations/0001_planner.sql`, `db/migrations/0002_planner_user_role.sql`, `db/migrations/0003_planner_revision.sql`, `db/rollback/*.sql` | Schema (0002 thêm cột `role` của ADR 0006, 0003 thêm bộ đếm revision) và các rollback chạy tay |
| `.github/workflows/ci.yml` | Service `postgres:17` và `TEST_DATABASE_URL`, để bộ test tích hợp chạy trong CI |
| `scripts/db-migrate.ts`, `scripts/planner-import.ts`, `scripts/planner-export.ts` | Điểm vào mỏng, chạy bằng `vite-node` |

## Test

- `tests/document-store-transact.test.ts` — memory và JSON: ném lỗi thì không ghi
  gì (đồng bộ và bất đồng bộ), các transaction chồng nhau được tuần tự hoá không
  mất cập nhật, callback nhận một bản sao riêng.
- `tests/planner-rows.test.ts` — offline: mutation rỗng cho ra không câu lệnh
  nào; insert, update (chỉ cột đổi) và delete cho từng collection; thứ tự an toàn
  với khoá ngoại; đổi thứ tự chỉ là update `sort_order`; giá trị được bind chứ
  không nối chuỗi; mọi collection round-trip bằng đúng bản ghi của JSON store,
  gồm null so với vắng mặt, `false` tường minh, chuỗi BIGINT và timestamp; dòng
  hỏng được báo mà không lộ nội dung.
- `tests/postgres-planner-store.test.ts` — với driver giả: giao thức BEGIN / khoá
  / revision / nạp / COMMIT, ROLLBACK khi ném lỗi, REPEATABLE READ cho đọc, cache theo revision (trúng cache, nạp lại sau commit của bên khác, chỉ trả bản sao, ghi không cần nạp lại, tăng khi commit, không tăng khi no-op, không đổi khi rollback), `23505` thành
  409, mã sự cố thành 503 không kèm thông điệp driver, và một kiểm tra HTTP rằng
  `PLANNER_DATABASE_URL` trỏ vào cổng đóng cho 503 mà không lộ secret.
- `tests/planner-transfer.test.ts` — import từ chối store không trống, file không
  hợp lệ và tham chiếu treo; export rồi import cho kết quả giống hệt.
- `tests/migrate.test.ts` — bộ chạy: mới, đã áp dụng, bị sửa, bị lỗi; khoá bao
  quanh phần khởi tạo và mọi file và luôn được nhả (kết nối mà unlock lỗi thì bị
  huỷ); lớp bọc lúc khởi động trả 503 không kèm chi tiết.
- `tests/planner-share-index-revision.test.ts` — offline: link chia sẻ tạo hoặc thu
  hồi qua một repository được repository khác trên cùng store tôn trọng, và chỉ
  mục được dùng lại khi revision không đổi.
- `tests/planner-postgres.integration.test.ts` — **chỉ khi có
  `TEST_DATABASE_URL`**, nếu không thì bị bỏ qua (báo là chưa chạy): migrate,
  kịch bản kết thúc giống hệt memory store, một luồng lập/sửa/xoá vĩnh viễn đầy
  đủ, các hành động khoá ngoại ở trên, đổi thứ tự với unique deferred, hai
  connection pool không bao giờ mất cập nhật, ghi từ store khác làm cache vô hiệu,
  store có cache nóng không thể ghi đè trạng thái mới hơn (412), rollback không
  đổi revision, đọc nóng bằng đọc nguội, hai migration lúc khởi động đồng thời
  chỉ áp dụng mỗi file một lần, link chia sẻ phân giải qua store thứ hai và dừng
  khi bị thu hồi, 409 khi trùng giữa các tiến trình,
  rollback, và import/export qua database thật.

## Giới hạn và câu hỏi còn mở

- Trúng cache tốn một truy vấn revision, nhưng revision đổi (mọi lần ghi, trên
  bất kỳ replica nào) thì nạp lại mọi dòng Planner, và một khoá toàn cục tuần tự
  hoá việc ghi. Ổn với vài nghìn trip; ngưỡng để chuyển các lệnh đọc nóng (`identify`,
  `listTrips`, `getTrip`) sang truy vấn riêng là p95 trên khoảng 200 ms (ADR 0009).
- Rate limiter vẫn theo từng tiến trình (chỉ mục share-token thì không còn, xem trên).
- Content store của Travel Content vẫn là file JSON.
- Test tích hợp đã chạy cục bộ trên PostgreSQL 14 và chạy trong CI trên
  `postgres:17`; máy của chủ nhà chạy 16 hoặc 17.
  Không có gì dùng quá bản 12, nhưng nên chạy một lần trên đúng bản major thật
  với database nháp.
- `import` và `export` chạy qua `vite-node`, phụ thuộc gián tiếp của Vitest, nên
  cần cài dev dependencies. Nếu không muốn thế trong image runtime, hãy chạy từ
  bản checkout hoặc giai đoạn build.
- Role đặc quyền tối thiểu được viết tài liệu, không được tạo sẵn: đó là bước của
  chủ nhà. Nên chạy `/sec-check` cho adapter, các grant và việc xử lý secret
  trước khi lên sóng.
- Timestamp được chuẩn hoá về dạng ISO có mili giây ở lần ghi đầu tiên. Zod cắt
  khoảng trắng các field chuỗi khi đọc, như khi ghi.
