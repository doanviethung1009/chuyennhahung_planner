# ADR 0003 — Danh tính Planner: session cookie dựng trên access token hiện có

🇬🇧 English version: [0003-planner-identity.md](0003-planner-identity.md)

- **Trạng thái:** Đề xuất — cần chủ sản phẩm chấp nhận trước khi viết bất kỳ dòng code nào
- **Ngày:** 09/11/2026
- **Chủ sở hữu:** system-architect
- **Người quyết định:** chủ sản phẩm (phạm vi sản phẩm), system-architect (hợp đồng)
- **Ảnh hưởng:** `src/server/planner/auth.ts`, `src/server/planner/http.ts`, `src/server/planner/store.ts`, `src/app/api/planner/**`, và giao diện Planner phụ thuộc vào nó

## Bối cảnh

[ADR 0002](0002-planner-core.md) §3 đã cho Planner một chủ sở hữu tạm thời: một
dòng `plannerUsers` và một access token 48 byte, do người vận hành cấp và gửi lên
dưới dạng `Authorization: Bearer`. Nó được chọn để giữ quy ước bearer token hiện
có, và chính nó đã ghi rằng việc thay thế cần một ADR riêng. Quy tắc 6 trong
`CLAUDE.md` giờ cũng nói vậy: không được dựng một nhà cung cấp danh tính thật mà
chưa có ADR.

**Giao diện Planner đang bị chặn bởi đúng việc này, nên nó phải đi trước.** Giao
diện là phase đang mở, và trình duyệt không dùng được mô hình hiện tại. Hoặc
người đi chơi phải dán một token 64 ký tự mỗi lần vào, hoặc token được giữ trong
`localStorage` — và khi đó bất kỳ lỗ XSS nào trên site cũng thành chiếm tài khoản
vĩnh viễn, vì token sống lâu, không hết hạn được và chính nó là toàn bộ thông tin
xác thực. Cả hai đều không chấp nhận được với một thứ mà nhân viên của chủ sản
phẩm dùng hằng ngày.

**Điều chủ sản phẩm đã quyết về phạm vi:** Planner trước hết dành cho **nhân viên
Nhà Hưng** — lập lịch trình cho khách — và khách có thể tự dùng về sau. Câu trả
lời đó bỏ đi rất nhiều thứ khỏi đợt này: không đăng ký công khai, không đặt lại
mật khẩu, không gửi email. Nó cũng loại phương án cam kết trả tiền cho một nhà
cung cấp danh tính, cho một công cụ nội bộ mà chỉ vài người dùng.

**Điều chúng ta chưa biết.** Khách có bao giờ tự dùng không, và vào lúc nào. Chưa
có bộ gửi email và chưa có ứng dụng OAuth nào; `site.ts` vẫn đang được đánh dấu
là cần dữ liệu liên hệ thật của chủ nhà. Nên mọi phương án phụ thuộc vào một kênh
xác thực mà ta không có đều không thể ship trong đợt này.

**Một điều nên nói thẳng:** mô hình hiện tại không hỏng với script và curl. Nó
hỏng với trình duyệt. Vì vậy ADR này *thêm* một session cho trình duyệt chứ không
thay thế token.

## Quyết định

1. **Session là một cookie `HttpOnly`, không phải token trong header.** Cookie chỉ
   mang một id ngẫu nhiên không mang nghĩa và không gì khác; server giữ một dòng
   `plannerSessions` chứa digest của id đó, `userId`, `createdAt`, `expiresAt` và
   `lastSeenAt`. Thuộc tính: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`,
   không `Domain`. Vì cookie không mang nghĩa và thứ được lưu là digest, một lần
   rò store không để lộ session nào dùng được — đúng như `tokenHash` hiện nay.

2. **Đăng nhập là đổi access token hiện có lấy một session.**
   `POST /api/planner/session` nhận token mà người vận hành đã cấp, xác minh đúng
   cách `authorizePlannerUser` đang làm, rồi đặt cookie.
   `DELETE /api/planner/session` đăng xuất. Không có loại thông tin xác thực mới,
   không có kho mật khẩu, và không chờ hạ tầng nào của chủ sản phẩm — việc cấp và
   xoay vòng token giữ nguyên.

3. **Toàn bộ việc phân giải danh tính dồn về một đường ráp.** Một hàm duy nhất
   `resolveIdentity(request)` thử cookie trước, rồi lùi về
   `Authorization: Bearer` cho script, curl và test. `PlannerIdentity` và mọi thứ
   bên dưới nó — `requireOwnedTrip` và mọi phương thức repository — không bị
   chạm. Đây chính là mục đích của thiết kế: khi khách cần tự dùng, Auth.js hay
   một nhà cung cấp hosted sẽ thay *hàm đó và các dòng session*, không phải thay
   mọi phép kiểm phân quyền trong repository.

4. **CSRF trở thành một nghĩa vụ thật mà mô hình bearer không có.** Token trong
   header chỉ được gửi khi ta chủ động gửi; còn cookie thì trình duyệt tự gửi
   theo mọi request tới origin của ta, kể cả request do một site khác kích hoạt.
   Nên mọi route Planner có thay đổi dữ liệu phải thêm điều kiện `Origin` (hoặc
   `Sec-Fetch-Site`) là cùng origin, và từ chối 403 với mọi thứ khác.
   `SameSite=Lax` là lớp phòng thủ bổ sung, không phải lớp phòng thủ chính — nó là
   hành vi của trình duyệt, và server không được phụ thuộc vào client để thực thi
   nó. Đây là code mới có thể làm sai, và là chi phí chính của quyết định này.

5. **Thời hạn và việc thu hồi phải tường minh.** 14 ngày tuyệt đối, 7 ngày không
   hoạt động. Mỗi lần đăng nhập luôn cấp session mới chứ không gia hạn session
   cũ. Xoay vòng token của một người sẽ xoá sạch session của người đó, nên
   endpoint `rotate-token` hiện có trở thành nút "đăng xuất khỏi mọi nơi".
   Session nằm trong document của Planner, nên hàm quét toàn vẹn có thêm hai phép
   kiểm: session có `userId` không còn tồn tại, và session đã qua `expiresAt` mà
   chưa bị dọn.

6. **Cố ý ngoài phạm vi**, để quyết khi và nếu khách tự dùng: đăng ký công khai,
   đặt lại mật khẩu, gửi email, OAuth, MFA, và giới hạn tần suất ngoài giới hạn
   kích thước request đã có. Mỗi thứ trong đó là một cam kết sản phẩm, không phải
   một chi tiết kỹ thuật, và đường ráp ở mục (3) là thứ khiến việc thêm chúng
   không thành một lần viết lại.

## Các phương án đã xét

| Phương án | Điểm cộng | Điểm trừ |
|---|---|---|
| **B (được chọn)** — session cookie tự quản, dựng trên token hiện có | Không thêm dependency; không cần gì từ chủ sản phẩm; việc cấp và xoay vòng token giữ nguyên; cookie không bao giờ đọc được bằng JavaScript; chỉ một đường ráp mỏng để thay sau; mở đường cho giao diện ngay đợt này | Ta tự gánh việc lưu session, hết hạn, thu hồi **và CSRF** — tất cả đều là code phải làm đúng; khách vẫn chưa tự dùng được, nên đây rõ ràng không phải câu trả lời cuối |
| A — giữ nguyên bearer, dựng giao diện quanh nó | Không phải làm gì | Buộc token vào `localStorage` (mọi lỗ XSS thành chiếm tài khoản vĩnh viễn) hoặc vào một ô dán mỗi lần vào. Để phase đang mở vẫn bị chặn, đúng thứ ta đang muốn tháo |
| C — dùng Auth.js (NextAuth) ngay | Chuẩn mực và được soát nhiều; provider, xoay vòng session và phục hồi tài khoản đã có sẵn; là đích đến hiển nhiên nếu khách tự dùng | Cần một kênh xác thực chưa tồn tại — bộ gửi email hoặc ứng dụng OAuth mà chủ sản phẩm chưa cung cấp; thêm một framework, mà việc đó cũng cần ADR; dựng luồng đăng ký chưa ai yêu cầu; mô hình session của nó vẫn phải ánh xạ về `ownerId` |
| D — nhà cung cấp hosted (Clerk, Auth0, Supabase Auth) | Đường nhanh nhất tới một trang đăng nhập thật; có MFA và phục hồi tài khoản miễn phí; không phải tự viết code session | Một nhà cung cấp có phí và một bên thứ ba giữ danh tính người đi chơi, chọn cho một công cụ nội bộ chỉ vài người dùng; khoá chân đúng vào cái đường ráp mà ta đang cố giữ cho mỏng |

Á quân là **C**, và lý do duy nhất nó thua: nó không ship được trong đợt này. Nó
phụ thuộc vào một bộ gửi email hoặc một ứng dụng OAuth còn chưa tồn tại, nên chọn
nó bây giờ nghĩa là giao diện vẫn bị chặn cho tới khi chủ sản phẩm cung cấp hạ
tầng thật — cho một công cụ mà chính nhân viên của họ đang chờ dùng. Nếu khách có
ngày tự dùng, C là nơi hướng này được kỳ vọng đi tới, và quyết định (3) tồn tại
để bước đó rẻ.

## Hệ quả

**Dễ hơn.** Giao diện Planner trở nên dựng được: trình duyệt không giữ thông tin
xác thực nào mà nó đọc được, một lần ghé lại tiếp tục được mà không phải xác thực
lại, và đăng xuất hoạt động. Đường token hiện có vẫn nguyên, nên mọi test,
script và ví dụ curl trong feature document đều chạy tiếp. Không chờ chủ sản phẩm
điều gì.

**Khó hơn — và đây không phải một quyết định miễn phí.** Ta tự gánh tính đúng đắn
của session: hết hạn theo cả hai trục, không tái dùng giữa các lần đăng nhập, thu
hồi phải thu hồi thật, và một hàm dọn các dòng đã hết hạn. Ta gánh thêm **CSRF**,
một lớp lỗi mà Planner hiện nay không thể có, và gánh cho mọi route có thay đổi
dữ liệu cùng lúc; một route duy nhất quên kiểm origin là một lỗ bảo mật thật chứ
không phải một thiếu sót hình thức — đó là lý do nên thực thi phép kiểm đó trong
`plannerRoute` thay vì trong từng handler. `.data/planner.json` bắt đầu chứa cả
vật liệu session bên cạnh digest token, đây là thêm một lý do nó là document riêng
khỏi nội dung biên tập, và là lý do nó không bao giờ được commit hay sao chép vào
một bản backup bất cẩn. Việc xử lý cookie làm các test API nặng hơn một chút, vì
một request giờ có trạng thái.

**Để quay lại** thì xoá collection session, hai endpoint và phép kiểm CSRF, rồi
trỏ `resolveIdentity` về lại chỉ đường bearer — một ngày làm việc, và không phải
migrate dữ liệu nào, vì access token vẫn là thông tin xác thực gốc suốt quá trình.
Sự rẻ đó là có chủ đích: đây là một quyết định tạm thời, chọn sao cho quyết định
tiếp theo không đắt.

**Điều nó không thay đổi.** Phân quyền theo đối tượng không bị chạm: một trip vẫn
trả 404 cho bất cứ ai không sở hữu nó, và token của người vận hành vẫn không đọc
được trip nào. Chuyển thông tin xác thực từ header sang cookie thay đổi *cách ta
biết ai đang hỏi*, và không thay đổi gì về *thứ họ được phép thấy*.

## Việc tiếp theo

Code, sau khi ADR này được chấp nhận (không viết code trước đó):

- `plannerSessions` trong `PlannerData`, kèm schema và hàm băm digest.
- `resolveIdentity(request)` trong `auth.ts`; chuyển `plannerRoute` sang dùng nó,
  và đặt phép kiểm cùng origin ở đó để không route nào bỏ sót được.
- `POST` / `DELETE /api/planner/session`, cùng việc dọn session hết hạn khi đọc.
- Hai phép kiểm toàn vẹn mới (session mồ côi, session hết hạn).
- Test: đăng nhập và đăng xuất, thuộc tính cookie, hết hạn theo cả hai trục,
  không tái dùng session, xoay vòng token xoá session, một request thay đổi dữ
  liệu từ origin khác bị từ chối 403, và đường bearer dự phòng vẫn chạy.

Tài liệu phải cập nhật trong cùng thay đổi đó: feature document
[travel-planner-core.vi.md](../features/travel-planner-core.vi.md) và bản song
sinh (route, dữ liệu, giới hạn), bảng store trong
[architecture.vi.md](../architecture.vi.md) và bản song sinh, và một mục đăng
nhập trong [usage.vi.md](../usage.vi.md) và bản song sinh.

Cần chủ sản phẩm cho ý kiến:

1. **Chấp nhận hay từ chối ADR này.** Chưa viết code tới khi đó.
2. **Thời hạn cookie** — 14 ngày tuyệt đối / 7 ngày không hoạt động là một phỏng
   đoán cho cách nhân viên dùng. Hãy nói nếu cần ngắn hơn.
3. **Khách có tự dùng không, và khoảng khi nào.** Nếu câu trả lời là "sắp rồi",
   phương án C trở thành quyết định tốt hơn ngay bây giờ, và ADR này nên bị từ
   chối để viết ADR đó thay thế.
