# ADR 0002 — Lõi Planner: trip, ngày, activity, chi phí

🇬🇧 English version: [0002-planner-core.md](0002-planner-core.md)

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 09/11/2026
- **Người quyết định**: chủ sản phẩm (mở phase), system-architect (hợp đồng dữ liệu)
- **Thay thế**: không. Mở phase mà [ADR 0001](0001-travel-content-system.vi.md) §4 đã hoãn.
- **Ảnh hưởng**: `src/server/planner/**`, `src/server/persistence/**`, `src/app/api/planner/**`, `src/app/api/admin/planner/**`

## Bối cảnh

Chủ sản phẩm đã mở phase Planner backend và yêu cầu phần lõi của một công cụ lập
kế hoạch chuyến đi: CRUD trip, tạo ngày tự động theo số ngày, activity lấy từ
catalog place hoặc tự tạo, đổi thứ tự và di chuyển activity giữa các ngày, ngân
sách mục tiêu so với chi phí dự kiến và chi phí thực tế, lưu và khôi phục, và
clone từ template được phê duyệt. Ví dụ mẫu là **Đà Lạt, 3 ngày 2 đêm, 2 người,
ngân sách 5.000.000 VND, phong cách lãng mạn**.

Đề bài mô tả cách hiện thực bằng những thứ repo này không có. Nó yêu cầu giữ
"ORM hiện có", lưu tiền dưới dạng Postgres `BIGINT`, và theo "migration hiện có".
Tính đến ADR này, vẫn chưa có database, chưa có ORM và chưa có công cụ migration
nào — đúng như [ADR 0001](0001-travel-content-system.vi.md) §1 đã ghi nhận.
Persistence là một repository nằm trên một JSON document store.

Hai khoảng trống khác còn quan trọng hơn câu hỏi về lưu trữ.

**Không có user nào.** [ADR 0001](0001-travel-content-system.vi.md) §6 cho hệ nội
dung đúng một principal: `ADMIN_API_TOKEN`. Thế là đủ cho các bản ghi biên tập,
vì tất cả đều thuộc về thương hiệu. Nhưng không đủ ở đây, bởi yêu cầu trung tâm
của một công cụ lập kế hoạch là một người đi chơi không được chạm tới trip của
người khác — và "object-level authorization" cần có chủ sở hữu của đối tượng để
đối chiếu.

**Quy tắc 6 trong `CLAUDE.md` đã cấm đúng phần việc này** cho đến khi chủ sản
phẩm mở phase. Giờ họ đã mở, nên quy tắc được thoả mãn chứ không bị bỏ qua. Quy
tắc 2 và chỉ mục ADR đều yêu cầu có một bản ghi trước khi thay đổi topology route
và hợp đồng dữ liệu — tài liệu này chính là bản ghi đó.

## Quyết định

### 1. Persistence: bốn collection chuẩn hoá, nằm sau store interface hiện có

Planner được xây trên kiến trúc đang có ở đây, không phải kiến trúc mà đề bài
giả định. `PlannerRepository` giữ mọi invariant và chỉ nói chuyện với một
`DocumentStore`, nên việc chuyển sang SQL vẫn chỉ là thêm một adapter mới.

Hai thứ được thay đổi để điều đó là thật chứ không phải copy-paste:

- Phần ghi nguyên tử cộng hàng đợi được tách khỏi `content/store.ts` sang
  [`src/server/persistence/json-store.ts`](../../src/server/persistence/json-store.ts)
  và giờ là generic. Content store trở thành một lớp bọc mỏng có kiểu, giữ nguyên
  các signature đã export. Đoạn code persistence tinh vi giờ chỉ tồn tại một chỗ.
- Planner giữ một **document riêng** (`.data/planner.json`, đổi bằng
  `PLANNER_STORE`). Dữ liệu người đi chơi và nội dung biên tập có yêu cầu riêng
  tư, lưu trữ và sao lưu khác nhau; dùng một file nghĩa là một khoá chung và một
  bán kính thiệt hại chung cho cả hai.

Bên trong document đó, bốn collection được **chuẩn hoá** — mảng phẳng với khoá
ngoại, không lồng ngày trong trip như cách hệ nội dung mô hình hoá ngày của
template. Chúng chính là bốn bảng mà cấu trúc này sẽ trở thành, và hai thao tác
đề bài nhấn mạnh nhất — chuyển activity giữa các ngày, và gắn chi phí vào một
activity — rẻ trên cấu trúc phẳng và vướng trên cấu trúc lồng.

Số ngày và thứ tự activity **không bao giờ là trạng thái do client cung cấp**.
Ngày luôn là 1..n không có lỗ; activity luôn là 0..m không có lỗ; cả hai được
tính lại từ vị trí sau mỗi lần thay đổi.

### 2. Chữ do người dùng nhập không phải nội dung đa ngữ

Quy tắc 1 trong `CLAUDE.md` — không ship chuỗi nào chỉ có một ngôn ngữ — điều
chỉnh **chữ của sản phẩm**: những chuỗi mà app hiển thị. Tiêu đề một chuyến đi là
thứ người đi chơi tự gõ, bằng ngôn ngữ của họ. Đòi hỏi phải có cả bản tiếng Việt
*và* tiếng Anh cho nó là vô nghĩa, nên chữ của trip, ngày, activity và chi phí là
chuỗi thường, không phải `localizedText`.

Mọi chuỗi Planner mà *app* hiển thị vẫn nằm trong cả hai catalogue thông điệp.
Khi clone một template, phần `localizedText` của nó được thu về phía tiếng Việt,
vì bản clone giờ là chữ của chính người đi chơi, không còn là nội dung biên tập.

### 3. Danh tính: một chủ sở hữu trip thật, vì phân quyền cần có

Collection `plannerUsers` lưu một người đi chơi và một digest SHA-256 của access
token 48 byte. Token được trả về **một lần duy nhất**, khi admin cấp hoặc xoay
vòng nó, và không bao giờ được lưu hay trả lại lần nữa. Việc so sánh dùng
`timingSafeEqual` trên digest có độ dài cố định, và vòng lặp duyệt ứng viên không
thoát sớm.

Phân chia quyền hạn là có chủ ý:

| Principal | Được | Không được |
|---|---|---|
| `ADMIN_API_TOKEN` | tạo, liệt kê, xoay vòng, xoá người đi chơi | đọc hoặc sửa **bất kỳ** trip nào |
| Token của người đi chơi | mọi thứ trên trip của chính họ | biết rằng một trip khác tồn tại |

Truy cập chéo chủ sở hữu trả về **404, không phải 403** — đúng lập trường mà
`getPublishedStory` áp dụng cho một story chưa publish. 403 sẽ xác nhận rằng id
đó tồn tại cho một người không được phép thấy nó.

Đây là mô hình danh tính tạm thời, chọn để giữ quy ước bearer token hiện có chứ
không nhằm đón trước một hệ thống session. Cái nó mua được là phần đắt tiền nếu
sửa sau: mọi trip đều mang `ownerId` và mọi lần đọc, ghi đều được lọc theo nó.
Thay token bằng một session thật chỉ đổi cách lấy `PlannerIdentity` và không chạm
tới bất cứ thứ gì bên dưới.

### 4. Clone template tạo ra một snapshot độc lập

Clone đọc một template **được phê duyệt** — `visibility: 'public'`, chính là khái
niệm "đã phê duyệt" sẵn có của hệ nội dung — và ghi ra những dòng hoàn toàn mới
thuộc về trip mới. Không chia sẻ bất kỳ id nào. Sửa, di chuyển, đổi giá hay xoá
bất cứ gì trong bản clone đều không thể chạm tới template; sửa template về sau
cũng không thể chạm tới bản clone.

Điều đó được bảo đảm bằng cấu trúc, không bằng kỷ luật: cửa sổ duy nhất của
Planner nhìn vào nội dung biên tập là
[`PlannerCatalog`](../../src/server/planner/catalog.ts), một interface chỉ-đọc với
ba phép tra cứu và không có hàm ghi nào. `trip.sourceTemplate` ghi lại nguồn gốc
— slug, tiêu đề, và `version` của template lúc clone, để sự lạc hậu luôn nhìn
thấy được — và không bao giờ được đọc lại để tái tạo trip.

Activity được clone đều ghi là chi phí cả nhóm, vì các con số của một template mô
tả nhóm mà template được viết cho, như một hoá đơn chung, không phải đơn giá mỗi
người.

### 5. Tiền: số nguyên đồng, kèm ranh giới BigInt cho SQL sau này

`vndSchema` của hệ nội dung được tái dùng nguyên vẹn: số nguyên đồng, không bao
giờ là số thực, không bao giờ là đơn vị nhỏ, chặn trên ở 10^12. Yêu cầu `BIGINT`
của đề bài được tôn trọng bằng cách làm cho phép ánh xạ trở nên tường minh và an
toàn, chứ không phải bằng cách giả vờ rằng Postgres đã có mặt. Trần đó nằm thấp
hơn `Number.MAX_SAFE_INTEGER` (≈9,007×10^15) rất nhiều, nên mọi số tiền hợp lệ
đều đi qua một vòng `BIGINT` mà không mất chính xác.

[`money.ts`](../../src/server/planner/money.ts) là ranh giới mà một SQL adapter sẽ
cần, và cũng là thứ đề bài yêu cầu:

- `normalizeVnd` nhận `number | bigint | string` — ba hình dạng mà một driver
  `BIGINT` thực sự trả về — và từ chối mọi giá trị mà một double không biểu diễn
  được chính xác. Một `bigint` được kiểm tra khoảng **ở dạng BigInt**, trước khi
  chuyển đổi, vì `Number(số_khổng_lồ)` làm tròn trước.
- `jsonSafe` chuyển đổi sâu mọi `bigint` trên đường trả response, nên việc đưa
  vào một driver như thế sau này không thể biến 200 thành 500 (`JSON.stringify`
  ném lỗi với `bigint` thuần) hay âm thầm trả `"5000000"` ở chỗ đã hứa một số.
- `sumVnd` và `scaleVnd` kiểm tra tổng đang chạy, không chỉ kiểm tra đầu vào.

Ba tổng được theo dõi và **hai trong số đó không bao giờ được cộng vào nhau**:
`targetTotalVnd` (số ta định chi), `estimatedTotalVnd` (chỉ activity) và
`actualTotalVnd` (chỉ chi phí thực tế). Dự toán của một activity và một khoản chi
là hai cách mô tả cùng một số tiền ở hai thời điểm, nên cộng chúng lại sẽ báo
560.000₫ cho một ly cà phê 310.000₫ vốn được dự tính 250.000₫.

`projectedTotalVnd` là con số duy nhất trộn cả hai, và nó làm vậy mà không cộng
trùng: một activity mà id của nó xuất hiện trên một khoản chi được coi là **đã
quyết toán** và không góp thêm gì nữa, nên số dự phóng bằng mọi khoản đã trả cộng
dự toán của mọi activity chưa trả. Đó là lý do `TripExpense.activityId` tồn tại.
Mỗi dòng tiền đều mang `costScope` là `group` hoặc `per_person`, và một số tiền
mỗi người được nhân với số người đúng một lần, trên đường đi vào tổng.

### 6. Tương tranh: một version cho cả aggregate trip, kiểm tra bằng If-Match

`trip.version` tăng sau mỗi lần thay đổi ở bất cứ đâu trong aggregate — dòng
trip, một ngày, một activity, một khoản chi. Response của trip mang nó dưới dạng
`ETag`; các lệnh thay đổi gửi nó lại qua `If-Match`.

- Thiếu, trong một lệnh sửa trạng thái đang có → **428**. Nếu không, hai tab cùng
  sửa một trip sẽ đều ghi, và tab chậm hơn thắng một cách âm thầm.
- Lạc hậu → **412**, và lệnh ghi bị từ chối toàn bộ, không bao giờ áp dụng một
  phần.
- Lệnh thêm (thêm activity hoặc khoản chi) coi nó là tuỳ chọn, vì một lệnh thêm
  không thể ghi đè phần sửa của ai cả — nhưng vẫn kiểm tra khi nó được gửi.

Một bộ đếm cho cả aggregate, thay vì một bộ đếm mỗi dòng, là thứ khiến một lần
sửa dựa trên bản đọc lạc hậu của *bất kỳ* phần nào trong trip đều phát hiện được.

### 7. Giữ phạm vi: không map, không AI

Đề bài nói không thêm cả hai trong đợt này, và cả hai đều không có ở đây.
`DELETE` trên một trip sẽ **lưu trữ** nó; `POST /restore` đưa nó trở lại; xoá vĩnh
viễn cần một yêu cầu thứ hai, tường minh, với `?purge=true` trên một trip đã lưu
trữ. Không có thao tác nào người đi chơi chạm tới trong một yêu cầu mà phá huỷ
được một kế hoạch.

## Hệ quả

**Điểm tốt.** Ship được trên hạ tầng đang có; `typecheck`, `lint` và `test` đều
chạy offline. Quyền sở hữu, validation, tương tranh và các quy tắc ngân sách đều
được diễn đạt trong repository và được 65 test bao phủ, nên việc chuyển sang SQL
là cộng thêm chứ không phải viết lại. Kịch bản demo và phép clone template được
kiểm thử trên nội dung seed thật, không phải fixture.

**Điểm dở.** Persistence chỉ an toàn trong một process, thừa hưởng từ
[ADR 0001](0001-travel-content-system.vi.md) §1 — hàng đợi nội bộ tuần tự hoá các
lệnh ghi trong một process Node và không làm được điều đó giữa hai process, nên
triển khai nhiều instance vẫn là mốc phải chuyển sang SQL. Do đó tương tranh lạc
quan bảo vệ trước hai *người dùng* tranh nhau, không bảo vệ trước hai *instance*
tranh nhau. Mô hình danh tính là tạm thời và không có tự đăng ký, đặt lại mật
khẩu hay hết hạn session; người vận hành cấp tài khoản cho từng người bằng tay.
Không có ràng buộc toàn vẹn nào bên dưới repository, nên một file JSON bị sửa tay
vẫn có thể tạo ra tham chiếu treo — Planner chưa có hàm quét `validateIntegrity()`
riêng, và đó là khoảng trống rõ nhất còn lại.

**Việc tiếp theo, mỗi việc cần ADR hoặc phase riêng.** Một session hoặc nhà cung
cấp danh tính thật; chọn engine SQL và viết migration đầu tiên; một hàm quét toàn
vẹn cho Planner; giao diện Planner, thuộc frontend và chưa bắt đầu; gợi ý map và
AI, vốn đã được đề bài hoãn lại.

## Hình dạng SQL mà cấu trúc này sẽ thành

Ghi lại ngay bây giờ, khi lập luận còn mới, để migration đầu tiên là một việc
chép lại chứ không phải một cuộc khảo cổ.

| Collection | Bảng | Cột tiền | Index migration phải tạo |
|---|---|---|---|
| `users` | `planner_users` | — | `unique(handle)`, `unique(token_hash)` |
| `trips` | `trips` | `budget_target_vnd BIGINT` | `(owner_id, status)`, `(owner_id, start_date)` |
| `tripDays` | `trip_days` | — | `unique(trip_id, day_number)` |
| `tripActivities` | `trip_activities` | `estimated_cost_vnd BIGINT` | `unique(trip_id, day_id, "order")`, `(place_slug)` |
| `tripExpenses` | `trip_expenses` | `amount_vnd BIGINT` | `(trip_id)`, `(activity_id)`, `(trip_id, paid_on)` |

Mọi `ownerId`, `tripId`, `dayId` và `activityId` trở thành khoá ngoại.
`trips.version` trở thành cột khoá lạc quan, và phép kiểm `If-Match` trở thành
`UPDATE … WHERE id = $1 AND version = $2`, với số dòng bằng 0 làm phát sinh đúng
lỗi 412 đó. `costScope` và `category` trở thành enum hoặc check constraint.

## Dữ liệu chủ sản phẩm vẫn phải cung cấp

Theo quy tắc 8 trong `CLAUDE.md`, những thứ sau cố tình để trống thay vì điền
bằng giá trị mặc định nghe có vẻ thật:

- **Tài khoản người đi chơi.** Không seed tài khoản nào. Một trip demo được seed
  sẽ là một trip không thuộc về ai, mà invariant quan trọng nhất ở đây là mọi trip
  đều có chủ. Bản demo Đà Lạt nằm trong
  [`tests/planner-acceptance.test.ts`](../../tests/planner-acceptance.test.ts).
- **`ADMIN_API_TOKEN`** phải được đặt thành một secret thật, dài tối thiểu 32 ký
  tự, trước khi có thể cấp tài khoản cho bất kỳ người đi chơi nào. Nếu chưa đặt,
  các route admin trả 503.
- **Chính sách lưu trữ dữ liệu.** Trip đã lưu trữ được giữ vô thời hạn; chưa ai
  nói dữ liệu người đi chơi nên được giữ bao lâu, nên không có gì làm nó hết hạn.
