# Tính năng — Lõi Travel Planner

🇬🇧 English version: [travel-planner-core.md](travel-planner-core.md)

## Tóm tắt

Cho phép người đi chơi lập một chuyến đi thật và giữ lại nó: một trip với mỗi
ngày đi là một ngày trong kế hoạch, activity lấy từ catalog place hoặc tự nghĩ ra
tại chỗ, một ngân sách mục tiêu đặt cạnh chi phí của kế hoạch và số tiền đã thực
trả, và một bản clone từ template lịch trình đã được phê duyệt để làm điểm bắt
đầu. Nó phục vụ người đi chuyến đó, không phải người biên tập — mỗi trip thuộc về
đúng một người đi chơi và không ai khác thấy được, kể cả admin token của chính
site.

Đây là phase backend mà quy tắc 6 trong [`CLAUDE.md`](../../CLAUDE.md) đã giữ lại
cho đến khi chủ sản phẩm mở, được quyết định trong
[ADR 0002](../adr/0002-planner-core.vi.md). Chưa có giao diện Planner; đợt này
ship API và các quy tắc miền bên dưới nó.

## Route

Không có route trang nào. Tính năng này là một bề mặt API, nên không thêm gì vào
bản đồ pathname bản địa hoá.

Đăng nhập — không cần thông tin xác thực nào để gọi; đây chính là cách lấy nó
([ADR 0004](../adr/0004-planner-identity.vi.md)).

| Method | Đường dẫn | Làm gì |
|---|---|---|
| `POST` | `/api/planner/session` | Đổi access token lấy một session cookie `HttpOnly` |
| `DELETE` | `/api/planner/session` | Đăng xuất: xoá dòng session và xoá cookie |

Endpoint cho người đi chơi — xác thực bằng **session cookie** đó, hoặc bằng
`Authorization: Bearer <planner access token>` cho curl, script và test. Chủ sở
hữu được lấy từ thông tin xác thực, không bao giờ từ payload hay query string.

Mọi request **có thay đổi dữ liệu** còn phải nêu `Origin` hoặc `Sec-Fetch-Site`
cùng origin, và request xác thực bằng cookie thì buộc phải nêu một trong hai —
nếu không sẽ nhận `403 forbidden`. Đó là chi phí của việc cookie được gửi tự
động; xem *Cách hoạt động*.

| Method | Đường dẫn | Làm gì |
|---|---|---|
| `GET` | `/api/planner` | Các trip của người gọi. Chỉ trip đang hoạt động, trừ khi `?status=archived` |
| `POST` | `/api/planner` | Tạo trip và các ngày của nó. `source: "blank"` hoặc `source: "template"` |
| `GET` | `/api/planner/:id` | Toàn bộ trip: các ngày kèm activity, chi phí, ngân sách |
| `PATCH` | `/api/planner/:id` | Tiêu đề, ngày tháng, số ngày, số người, ngân sách, phong cách, nhịp đi, ghi chú |
| `DELETE` | `/api/planner/:id` | Lưu trữ nó. `?purge=true` xoá hẳn một trip đã lưu trữ |
| `POST` | `/api/planner/:id/restore` | Đưa một trip đã lưu trữ trở lại |
| `GET` | `/api/planner/:id/budget` | Chỉ phần tổng hợp ngân sách |
| `PATCH` | `/api/planner/:id/days/:dayNumber` | Đặt tiêu đề và ghi chú cho một ngày |
| `POST` | `/api/planner/:id/activities` | Thêm một activity vào một ngày |
| `PATCH` | `/api/planner/:id/activities/:activityId` | Sửa một activity tại chỗ |
| `DELETE` | `/api/planner/:id/activities/:activityId` | Xoá một activity |
| `PATCH` | `/api/planner/:id/reorder` | `op: "reorder-day"` hoặc `op: "move-activity"` |
| `POST` | `/api/planner/:id/expenses` | Ghi nhận tiền đã trả |
| `PATCH` | `/api/planner/:id/expenses/:expenseId` | Sửa một khoản chi |
| `DELETE` | `/api/planner/:id/expenses/:expenseId` | Xoá một khoản chi |

Endpoint cho người vận hành — `Authorization: Bearer <ADMIN_API_TOKEN>`. Những
route này cấp tài khoản người đi chơi và **không đọc hay sửa được trip nào**.

| Method | Đường dẫn | Làm gì |
|---|---|---|
| `GET` | `/api/admin/planner/users` | Liệt kê người đi chơi. Không bao giờ trả về digest của token |
| `POST` | `/api/admin/planner/users` | Tạo một người đi chơi, trả token của họ **một lần** |
| `POST` | `/api/admin/planner/users/:userId/rotate-token` | Cấp token mới, vô hiệu token cũ |
| `DELETE` | `/api/admin/planner/users/:userId` | Xoá một người đi chơi không sở hữu trip nào |
| `GET` | `/api/admin/planner/integrity` | Quét tham chiếu và cấu trúc. Chỉ báo định danh, không bao giờ báo nội dung trip |

Mã lỗi theo đúng envelope của Travel Content System
([travel-content-api.vi.md](../travel-content-api.vi.md)), cộng thêm hai mã cho
tính năng này: `precondition_required` (428) và `version_conflict` (412).

## Dữ liệu

Bốn collection trong `.data/planner.json` (đổi bằng `PLANNER_STORE`), tách riêng
khỏi content store, cộng thêm một collection thứ năm cho chủ sở hữu. Hình dạng và
validator nằm trong [`schemas.ts`](../../src/server/planner/schemas.ts) — mọi type
đều được `z.infer` từ chính schema validate nó.

| Collection | Sẽ thành | Field chính |
|---|---|---|
| `users` | `planner_users` | `handle`, `displayName`, `tokenHash` (SHA-256, không bao giờ trả về) |
| `sessions` | `planner_sessions` | `userId`, `tokenHash` (SHA-256 của giá trị cookie không mang nghĩa), `createdAt`, `lastSeenAt`, `expiresAt` |
| `trips` | `trips` | `ownerId`, `destinationSlug`, `startDate`, `durationDays`, `partySize`, `budget.targetTotalVnd`, `status`, `sourceTemplate`, `version` |
| `tripDays` | `trip_days` | `tripId`, `dayNumber` (1..n), `date` (dẫn xuất), `title`, `note` |
| `tripActivities` | `trip_activities` | `tripId`, `dayId`, `order` (0..m), `placeSlug`, `title`, `estimatedCostVnd`, `costScope`, `category` |
| `tripExpenses` | `trip_expenses` | `tripId`, `dayId`, `activityId`, `amountVnd`, `costScope`, `category`, `paidOn` |

Tham chiếu tới các thực thể đang có đều bằng slug và được kiểm tra khi ghi:
`destinationSlug` → [`destinations.ts`](../../src/content/destinations.ts),
`placeSlug` → place của Travel Content System, `templateSlug` → một
`TravelTemplate` **public**.

Những field mang trọng lượng thật:

- **`costScope`** (`group` | `per_person`) là giá trị dễ sai nhất trong việc tính
  ngân sách chuyến đi — "500k cho bữa tối" mang nghĩa khác nhau giữa hai người và
  mỗi người — nên nó tường minh trên mọi dòng tiền và không bao giờ được suy ra.
- **`activityId` trên một khoản chi** là thứ nối một lần trả tiền với thứ nó đã
  trả, và do đó là thứ ngăn một activity và khoản chi của nó bị tính hai lần.
- **`version`** là bộ đếm khoá lạc quan cho cả trip.
- **`tokenHash`** không được xuất hiện trong bất kỳ response nào — dù của user
  hay của session. Có một test khẳng định điều đó, và một test nữa khẳng định giá
  trị cookie của session cũng không xuất hiện trong store hay trong response.
- **`expiresAt` và `lastSeenAt`** là hai trục mà một session chết theo: 14 ngày
  tuyệt đối, 7 ngày không hoạt động. `SESSION_ABSOLUTE_DAYS` và
  `SESSION_IDLE_DAYS` là hằng số đơn lẻ, vì chủ sản phẩm còn để mở con số.

Tiền là số nguyên đồng ở mọi nơi, chặn trên ở 10^12 theo `vndSchema` của hệ nội
dung. Ở đây không có gì cần dữ liệu thật của chủ sản phẩm; điều kiện vận hành duy
nhất là một `ADMIN_API_TOKEN` thật.

## Cách hoạt động

Chỉ phía server — route handler và một repository, không có code client và không
có component nào.

Một request đi vào qua [`plannerRoute`](../../src/server/planner/http.ts): hàm này
lấy repository dùng chung cho cả process, biến thông tin xác thực của request
thành một `PlannerIdentity`, thực thi luật cùng origin, và map mọi `ContentError`
được ném ra sang status của nó. Cả ba việc đều nằm ở đó chứ không nằm trong các
handler, nên không route riêng lẻ nào có thể quên bất kỳ việc nào. Handler nhận
id của chủ sở hữu và truyền nó vào mọi lời gọi repository.

**Hai thông tin xác thực, một danh tính.** `identify()` thử session cookie trước
rồi lùi về `Authorization: Bearer` — chính đường ráp `resolveIdentity` duy nhất mà
ADR 0004 dựng quanh. Trình duyệt đăng nhập một lần ở
`POST /api/planner/session`, đổi access token do người vận hành cấp lấy một token
cookie không mang nghĩa, và thứ được lưu là *digest* của nó, đúng như `tokenHash`
của user. Access token vẫn là thông tin xác thực gốc: cookie chỉ là một tay cầm
có hạn và thu hồi được trên nó. Một session chết ở 14 ngày tuyệt đối hoặc 7 ngày
không hoạt động, cái nào đến trước, và được dọn khi nó được dùng lần sau hoặc ở
lần đăng nhập kế tiếp. `lastSeenAt` được ghi nhiều nhất mỗi giờ một lần, vì cập
nhật nó theo từng request sẽ biến mỗi lần đọc thành một lần ghi store và tuần tự
hoá cả API phía sau đó. Xoay vòng token của một người sẽ xoá session của người
đó, nên `rotate-token` chính là nút "đăng xuất khỏi mọi nơi". Một cookie *cũ*
được bỏ qua để lùi về đường bearer, nên một cookie sót lại không làm vỡ script;
còn một cookie *hết hạn* thì báo rõ, vì nó có giải được và một lý do thì hữu ích
hơn im lặng.

**CSRF là cái giá của cookie.** Bearer token chỉ được gắn khi ta chủ động gắn;
cookie thì trình duyệt tự gắn vào mọi request tới origin của ta, kể cả request do
một site khác gây ra. Nên mọi request có thay đổi dữ liệu sẽ bị từ chối 403 nếu
nó nêu một origin khác, và request xác thực bằng cookie bị từ chối nếu nó không
nêu origin nào cả — trình duyệt luôn nêu với request không phải GET. Đăng nhập
cũng chịu đúng luật đó, vì một POST từ site khác tới đó có thể trao cho trình
duyệt của nạn nhân một session thuộc về kẻ tấn công. `SameSite=Lax` là lớp thứ
hai, không phải lớp này: nó là hành vi của trình duyệt, và server không giả định
client thực thi nó.

[`PlannerRepository`](../../src/server/planner/repository.ts) giữ toàn bộ quy tắc.
Mọi lần đọc và ghi đều đi qua `requireOwnedTrip`, hàm này ném **404 cho trip của
người đi chơi khác** — đúng lập trường mà `getPublishedStory` áp dụng cho một
story chưa publish, nên API không bao giờ xác nhận một id tồn tại với người không
được phép thấy nó. Lệnh ghi chạy trong `transaction`, một chu trình
đọc-sửa-ghi được tuần tự hoá trên store; một lần ném lỗi ở bất cứ đâu bên trong
sẽ bỏ toàn bộ thay đổi, nên một lần validate thất bại không thể để lại nửa cái
activity.

Số ngày và thứ tự activity không bao giờ được tin từ client. Tạo một trip sẽ sinh
ngày 1..n từ `durationDays` và gán ngày tháng từ `startDate`; đổi một trong hai
sẽ gán lại ngày hoặc thêm ngày, và việc rút ngắn một trip qua một ngày vẫn còn
activity hay khoản chi sẽ bị từ chối thay vì phá dữ liệu âm thầm. Đổi thứ tự yêu
cầu một phép hoán vị đúng các id của ngày đó; di chuyển một activity sẽ đánh số
lại cả hai ngày và kéo theo khoản chi được liên kết, nên tổng theo ngày vẫn đúng.

Ngân sách được tính lại sau mỗi lần đọc bởi
[`budget.ts`](../../src/server/planner/budget.ts) và không bao giờ được lưu — một
tổng dẫn xuất mà lưu được là một tổng dẫn xuất có thể sai. Ba con số được giữ
tách biệt: mục tiêu, kế hoạch (`estimatedTotalVnd`, chỉ activity) và tiền đã trả
(`actualTotalVnd`, chỉ khoản chi). Hai con số đầu không bao giờ được cộng lại.
`projectedTotalVnd` là con số duy nhất trộn chúng, và nó bỏ qua mọi activity đã có
khoản chi, nên 310.000₫ đã trả cho một kế hoạch 250.000₫ sẽ dự phóng 310.000₫
thay vì 560.000₫. Một số tiền `per_person` được nhân với số người đúng một lần,
trên đường đi vào tổng.

Clone đọc một template đã phê duyệt qua
[`PlannerCatalog`](../../src/server/planner/catalog.ts) — một interface chỉ-đọc với
ba phép tra cứu và không có hàm ghi — rồi ghi ra những dòng hoàn toàn mới. Template
không thể bị sửa, bởi phụ thuộc đó không có cách nào để sửa nó.

Tương tranh: response của trip mang `ETag: "<version>"`. Các lệnh sửa trạng thái
đang có yêu cầu gửi lại nó qua `If-Match`, và trả **428** nếu thiếu, **412** nếu
lạc hậu. Lệnh thêm coi nó là tuỳ chọn nhưng vẫn kiểm tra khi được gửi.

Đường lỗi và đường rỗng: một trip, ngày, activity hay khoản chi không tồn tại là
404; một tham chiếu không giải được là 422 kèm đường dẫn field; một trip đã lưu
trữ thì đọc được và khôi phục được nhưng trả 409 cho lệnh sửa; `DELETE` không bao
giờ phá huỷ ngay ở yêu cầu đầu tiên.

[`money.ts`](../../src/server/planner/money.ts) là ranh giới cho ngày một SQL
driver xuất hiện: `normalizeVnd` nhận `number | bigint | string` và từ chối mọi
giá trị mà một double không giữ chính xác được, còn `jsonSafe` chạy trên mọi
response nên một `bigint` thuần không thể ném lỗi và cũng không thể âm thầm biến
thành chuỗi.

## File

| Đường dẫn | Vai trò |
|---|---|
| [`src/server/persistence/json-store.ts`](../../src/server/persistence/json-store.ts) | Document store generic — ghi nguyên tử, hàng đợi ghi trong process. Dùng chung với content store |
| [`src/server/planner/schemas.ts`](../../src/server/planner/schemas.ts) | Validator và các type suy ra từ chúng |
| [`src/server/planner/store.ts`](../../src/server/planner/store.ts) | `PlannerData` và store bộ nhớ / file JSON của nó |
| [`src/server/planner/auth.ts`](../../src/server/planner/auth.ts) | Cấp token và session, băm, đọc cookie, và phân giải chủ sở hữu theo thời gian hằng |
| [`src/server/planner/catalog.ts`](../../src/server/planner/catalog.ts) | Cửa sổ chỉ-đọc nhìn vào destination, place và template đã phê duyệt |
| [`src/server/planner/budget.ts`](../../src/server/planner/budget.ts) | Tính ngân sách — hàm thuần trên các dòng dữ liệu |
| [`src/server/planner/money.ts`](../../src/server/planner/money.ts) | Quy tắc số nguyên đồng và ranh giới BigInt/JSON |
| [`src/server/planner/repository.ts`](../../src/server/planner/repository.ts) | Toàn bộ logic miền và mọi invariant |
| [`src/server/planner/http.ts`](../../src/server/planner/http.ts) | Lớp bọc route, `ETag`/`If-Match`, envelope response |
| [`src/server/planner/instance.ts`](../../src/server/planner/instance.ts) | Repository dùng chung cho cả process |
| [`src/app/api/planner/**`](../../src/app/api/planner) | Route handler cho người đi chơi |
| [`src/app/api/planner/session/route.ts`](../../src/app/api/planner/session/route.ts) | Đăng nhập và đăng xuất |
| [`src/app/api/admin/planner/users/**`](../../src/app/api/admin/planner/users) | Route handler cho người vận hành — cấp tài khoản |
| [`src/app/api/admin/planner/integrity/route.ts`](../../src/app/api/admin/planner/integrity/route.ts) | Route handler cho người vận hành — hàm quét toàn vẹn |

`src/server/content/errors.ts` được thêm hai mã chung của HTTP
(`precondition_required`, `version_conflict`), và `src/server/content/store.ts`
trở thành một lớp bọc mỏng trên document store dùng chung, giữ nguyên các
signature đã export.

## Test

115 test trong bảy file, tất cả đều xanh.

| File | Thực sự khẳng định điều gì |
|---|---|
| [`planner-repository.test.ts`](../../tests/planner-repository.test.ts) | Sinh ngày và gán ngày tháng; activity từ catalog so với activity tự tạo cùng tiêu đề/phân loại được suy ra; vị trí chèn; quy tắc hoán vị khi đổi thứ tự; di chuyển giữa các ngày kéo theo khoản chi liên kết; lưu trữ/khôi phục/xoá hẳn; kéo dài một trip và việc từ chối rút ngắn qua một ngày không rỗng; quy tắc tham chiếu giữa khoản chi, ngày và activity; xoay vòng token làm token cũ vô hiệu; và truy cập chéo chủ sở hữu trả `not_found` ở mọi verb trong khi trip của chủ vẫn nguyên vẹn |
| [`planner-budget.test.ts`](../../tests/planner-budget.test.ts) | `per_person` được nhân đúng một lần và nhân lại khi số người đổi; dự toán và thực tế không bao giờ bị cộng lại; một activity đã quyết toán bị loại khỏi số dự phóng; một khoản chi 0₫ vẫn quyết toán; tách theo phân loại, theo ngày và ở mức cả trip; và ranh giới tiền — đầu vào `bigint`, chuỗi chữ số và số, từ chối giá trị mà một double không giữ chính xác được, `jsonSafe` trên `bigint` lồng nhau, và phép tính có kiểm tra tràn |
| [`planner-acceptance.test.ts`](../../tests/planner-acceptance.test.ts) | Kịch bản demo từ đầu đến cuối (Đà Lạt, 3 ngày 2 đêm, 2 người, 5.000.000₫, lãng mạn); clone template `da-lat-3-ngay-lang-man` **seed thật**; bằng chứng template giống nguyên vẹn từng byte sau khi bản clone bị di chuyển, xoá bớt và đổi giá; và một lần reload qua file JSON thật, nơi một repository mới thấy đủ mọi dòng |
| [`planner-api.test.ts`](../../tests/planner-api.test.ts) | Chính các route handler thật: các đường 401, admin token rõ ràng không đọc được trip nào, 422 kèm đường dẫn field, toàn bộ luồng activity→đổi thứ tự→khoản chi→ngân sách, 428 khi thiếu `If-Match`, 412 khi version lạc hậu, 400 khi nó sai dạng, 404 cô lập theo từng verb, trình tự lưu trữ/khôi phục/xoá hẳn, và hàm quét chỉ dành cho người vận hành |
| [`planner-session.test.ts`](../../tests/planner-session.test.ts) | Tầng session ở mức miền: đăng nhập và danh tính nó tạo ra, chỉ lưu digest còn giá trị cookie không có trong store, mỗi lần đăng nhập là một session riêng nên thiết bị thứ hai độc lập, hạn tuyệt đối không bị việc dùng session kéo dài, hết hạn do không hoạt động nằm trong hạn tuyệt đối, việc ghi `lastSeenAt` có tiết chế, đăng xuất idempotent, xoay vòng token và xoá user xoá sạch session của người đó mà không chạm người khác, cookie cũ lùi về bearer token, cookie hết hạn tự báo, các cookie khác trên request bị bỏ qua, và bốn phép kiểm toàn vẹn cho session |
| [`planner-session-api.test.ts`](../../tests/planner-session-api.test.ts) | Nửa HTTP: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` và `Max-Age` trên cookie, token không có trong response, đăng xuất xoá cookie bằng `Max-Age=0`, 401 không đặt cookie nào, và luật cùng origin — request cookie không nêu origin bị từ chối, `Origin` và `Sec-Fetch-Site` khác origin bị từ chối mà không áp dụng gì, cả hai dạng cùng origin được cho qua, đường bearer vẫn chạy khi không có origin nhưng vẫn bị từ chối nếu khác origin, và một lần đăng nhập từ site khác bị từ chối |
| [`planner-integrity.test.ts`](../../tests/planner-integrity.test.ts) | Mỗi test phá một invariant, bằng cách ghi trực tiếp vào store để đi vòng qua repository đúng như một lần sửa tay sẽ làm: chủ sở hữu và destination không tồn tại, `endDate` sai, trạng thái lưu trữ lệch với `archivedAt`, thiếu một ngày và lỗ trong cách đánh số, một ngày lệch khỏi lịch của trip, lỗ và trùng trong `order`, một place đã bị rút, các dòng thuộc về trip khác, dòng mồ côi ở cả ba collection con, một khoản chi có ngày trái với activity của nó, trùng id và trùng handle, digest token sai dạng — cộng một test khẳng định hàm quét không để lộ tiêu đề, nhãn, ghi chú hay số tiền, và một test khẳng định template bị sửa hay bị rút được báo là lạc hậu chứ không phải hỏng |

Cố ý không test: giới hạn tần suất (hiện chưa có), và tranh chấp ghi giữa nhiều
process — JSON store không chịu được điều đó và test sẽ chỉ khẳng định một hạn
chế đã biết chứ không phải một hành vi.

## Giới hạn và câu hỏi còn mở

- **Persistence chỉ an toàn trong một process**, thừa hưởng từ
  [ADR 0001](../adr/0001-travel-content-system.vi.md) §1. Hàng đợi ghi tuần tự hoá
  trong một process Node và không làm được giữa hai process, nên tương tranh lạc
  quan ở đây bảo vệ trước hai *người dùng* tranh nhau, không phải hai *instance*.
  Triển khai nhiều instance là mốc phải chọn SQL — hình dạng đã được ghi sẵn trong
  [ADR 0002](../adr/0002-planner-core.vi.md#hình-dạng-sql-mà-cấu-trúc-này-sẽ-thành),
  kèm cả các index.
- **Danh tính là tạm thời, và cố ý không phải một hệ danh tính.** Session đã có
  ([ADR 0004](../adr/0004-planner-identity.vi.md)) nhưng không có đăng ký công
  khai, không đặt lại mật khẩu, không OAuth, không MFA. Người vận hành cấp tài
  khoản cho từng người bằng tay, và một access token bị mất thì chỉ xoay vòng
  được chứ không lấy lại được. Thêm bất kỳ thứ nào trong đó là ADR tiếp theo;
  `resolveIdentity` là đường ráp duy nhất nó phải thay.
- **Không giới hạn tần suất với lần thử đăng nhập.**
  `POST /api/planner/session` gọi bao nhiêu lần cũng được. Access token là 48 byte
  ngẫu nhiên nên đoán nó không phải nguy cơ thực tế, nhưng một đợt dò cũng không
  tốn gì của chúng ta để hấp thụ — việc này đáng sửa trước khi Planner mở ra công
  khai.
- **Không có mục "các session đang hoạt động".** Người đi chơi không xem hay thu
  hồi được một thiết bị cụ thể; cách thu hồi duy nhất là `rotate-token`, và nó
  đăng xuất mọi nơi.
- **`Secure` đi theo scheme của request** để dev server chạy http vẫn được. Trên
  production site là https nên cờ này được đặt — nhưng một hệ triển khai cắt TLS
  rồi chuyển tiếp http mà không báo cho Next sẽ âm thầm làm mất nó.
- **Hàm quét toàn vẹn phát hiện, chứ không tự sửa.** `GET
  /api/admin/planner/integrity` nêu tên mọi invariant bị phá mà nó tìm được, còn
  việc sửa vẫn là một lần chỉnh tay hoặc một thay đổi tiếp theo. Cũng không có gì
  chạy nó theo lịch — nó chạy khi được gọi, nên một lần hỏng do sửa tay sẽ nằm im
  cho tới khi có người hỏi tới.
- **Chưa có giao diện.** Trang Planner ở `/thiet-ke-chuyen-di` vẫn là trang nội
  dung chỉ có liên hệ, như mô tả trong
  [plan-your-trip.vi.md](plan-your-trip.vi.md). Nối nó vào API là việc của
  frontend và chưa bắt đầu.
- **Cố ý ngoài phạm vi đợt này**, theo đề bài: tích hợp map và gợi ý AI.
- **`destinationSlug` là bất biến** sau khi trip đã tồn tại. Activity gắn vào các
  place thuộc destination đó, nên chuyển một trip sang nơi khác là một trip mới,
  không phải một lần sửa. Nếu người đi chơi yêu cầu "chuyển" một trip, đó là một
  quyết định sản phẩm, không phải bug.
- **Câu hỏi còn mở: lưu trữ dữ liệu.** Trip đã lưu trữ được giữ vô thời hạn. Chưa
  ai nói dữ liệu người đi chơi nên được giữ bao lâu, nên không có gì làm nó hết
  hạn.
- **Câu hỏi còn mở: chia sẻ.** Một trip chỉ hiện với đúng một người đi chơi. Trip
  chia sẻ hay cộng tác sẽ cần một bảng thành viên và một lần soát lại mọi phép
  kiểm phân quyền trong repository.
