# ADR 0005 — Chia sẻ chuyến đi và nhân bản từ câu chuyện: link năng lực trên Planner hiện có

🇬🇧 English version: [0005-trip-sharing-and-story-cloning.md](0005-trip-sharing-and-story-cloning.md)

- **Trạng thái:** Đã chấp nhận — chủ sản phẩm yêu cầu tính năng "Đi theo dấu chân nhà Hưng" ngày 09/11/2026
- **Ngày:** 09/11/2026
- **Chủ sở hữu:** system-architect
- **Người quyết định:** chủ sản phẩm (luồng sản phẩm), system-architect (hợp đồng)
- **Ảnh hưởng:** `src/content/types.ts`, `src/i18n/routing.ts`, `src/server/planner/**`, `src/server/rate-limit.ts` (mới), `src/app/api/planner/**`, `src/app/api/shared/**` (mới), trang câu chuyện và năm trang mới

## Bối cảnh

Luồng của chủ sản phẩm: người đọc đọc một Travel Story, thấy lịch trình thật, bấm
"Tạo chuyến đi giống nhà Hưng", chỉnh ngày, số người, ngân sách ở bước Trip Setup,
nhân bản template thành chuyến đi cá nhân độc lập, thấy nó trong My Trips và chia sẻ
qua link chỉ-đọc. Khách ẩn danh được đọc câu chuyện và chỉnh bản nháp; khi lưu thì
được yêu cầu đăng nhập.

Phần lớn cơ chế đã có. `POST /api/planner` với `source: 'template'` đã sao chép
template công khai thành các dòng mới và ghi snapshot `sourceTemplate`
([ADR 0002](0002-planner-core.md)); đăng nhập trên trình duyệt đã có
([ADR 0004](0004-planner-identity.md)). Phần **mới và liên quan bảo mật** là lần đầu
đọc dữ liệu của người đi mà không cần xác thực (link chia sẻ), một token năng lực, và
các endpoint công khai đầu tiên cần chống lạm dụng — hiện chưa có rate limiter nào
trong `src/`.

Hai sự thật định hình thiết kế. Trang câu chuyện của site đọc seed tĩnh
`src/content/stories.ts`, còn template nằm trong Travel Content System, nên liên kết
story–template là một trường mới trên `Story` của site. Và `trip.status` là
`active | archived` — vòng đời, không phải tiến độ lên kế hoạch mà chủ sản phẩm cần.

## Quyết định

1. **Liên kết story–template.** `Story.plannerTemplateSlug` tùy chọn. Trang câu chuyện
   chỉ hiển thị lịch trình thật và CTA khi template còn công khai.
   `di-da-lat-lan-thu-sau` → `da-lat-3-ngay-lang-man`.
2. **Attribution do server suy ra.** `tripTemplateSnapshotSchema` thêm
   `story: { slug, title } | null`, điền bởi `PlannerCatalog.getLinkedStory(templateSlug)`
   mới, chỉ đọc. Không bao giờ nhận từ client. Nullable và tùy chọn nên các chuyến đi
   đã lưu vẫn hợp lệ.
3. **Trạng thái kế hoạch tách khỏi vòng đời.** `planningStatus:
   'draft' | 'planned' | 'completed'` mới, mặc định `draft`, đặt qua
   `PATCH /api/planner/[id]` hiện có. Dòng thiếu trường đọc như `draft` — không cần
   migration. "Xóa" trong My Trips giữ hai bước hiện có: lưu trữ, rồi purge rõ ràng.
4. **Nhân đôi.** `POST /api/planner/[id]/duplicate`: id mới cho mọi ngày, hoạt động,
   chi phí; `planningStatus: 'draft'`, `visibility: 'private'`, không token;
   giữ `sourceTemplate` để attribution còn nguyên; ghi `duplicatedFromTripId`. Bản gốc
   không bị đụng tới.
5. **Visibility và token chia sẻ.** Trường `visibility:
   'private' | 'unlisted' | 'public'` (mặc định `private`), `shareToken: string | null`,
   `shareTokenCreatedAt`. Token là 32 byte `crypto.randomBytes` dạng base64url (43 ký
   tự). Chuyển sang `unlisted` hoặc `public` thì tạo token nếu chưa có;
   `POST .../share/rotate` thay token và token cũ chết ngay;
   `DELETE .../share` và `PUT {visibility:'private'}` là cùng một thao tác — token về
   null, visibility về private. Token không bao giờ "ngủ", nên link đã thu hồi không
   thể âm thầm sống lại.
6. **Quy tắc phân giải.** Link chỉ mở được khi token khớp **và** visibility là
   `unlisted` hoặc `public` **và** chuyến đi `active`. Mọi trường hợp khác — không
   tồn tại, sai định dạng, đã thu hồi, private, đã lưu trữ — trả về **cùng một** 404.
   Public được index, unlisted là `noindex`; **không có thư viện công khai** ở giai
   đoạn này.
7. **Đọc công khai** `GET /api/shared/[token]` trả về bản chiếu đã lọc (hợp đồng liệt
   kê từng trường). Loại trừ danh tính chủ sở hữu, mọi id nội bộ, `version`, token,
   `note` cấp chuyến đi và toàn bộ chi phí. Bao gồm ghi chú hoạt động và tóm tắt ngân
   sách (chỉ mục tiêu và tổng ước tính).
8. **Chia sẻ không tăng `trip.version` và không cần `If-Match`.** `version` bảo vệ
   lịch trình mà người sửa đang xem; đổi chia sẻ không thay đổi gì ở đó, tăng version
   sẽ khiến trình sửa đang mở của chủ sở hữu bị 412 vô lý. Các endpoint chia sẻ có
   tính idempotent và được hàng đợi của store tuần tự hóa. `planningStatus` đi qua
   `PATCH` nên giữ nguyên quy tắc `If-Match` hiện có.
9. **Giới hạn tần suất.** `src/server/rate-limit.ts`: cửa sổ trượt trong bộ nhớ theo
   khóa client, đồng hồ có thể tiêm; mã lỗi mới `rate_limited` (429, `Retry-After`)
   trong envelope chung. Áp dụng cho `GET /api/shared/[token]`, lúc render trang chia
   sẻ và `POST /api/planner/session`. Ngưỡng (hằng số cấu hình, chỉnh được): đọc chia
   sẻ 60/phút/IP, đăng nhập 10/phút/IP.
10. **Dò phiên.** `GET /api/planner/session` → 200 `{ user, expiresAt }` hoặc 401.
11. **Bản nháp của khách.** Trip Setup xem được khi ẩn danh và giữ bản nháp trong
    `sessionStorage` (theo tab, không chứa credential). Lưu là `POST /api/planner`; nếu
    401 thì giữ bản nháp và chuyển tới `/sign-in?returnTo=…`, sau đó khôi phục.
    `returnTo` phải là đường dẫn tương đối cùng site. Không có bản nháp ẩn danh phía
    server.

## Các phương án đã xem xét

| Phương án | Ưu điểm | Nhược điểm |
|---|---|---|
| A (chọn) Token dạng thô trong tài liệu trip, so sánh bằng SHA-256 + `timingSafeEqual` | Chủ sở hữu hiển thị lại được link; một trường; thu hồi và xoay đơn giản | Store bị lộ thì lộ link còn hiệu lực |
| B Chỉ lưu SHA-256 của token | Store bị lộ không lộ link còn hiệu lực | Chủ sở hữu không xem lại được link, chỉ xoay được; và cùng tài liệu đã chứa chính chuyến đi nên rò rỉ vốn đã toàn bộ |
| C Chỉ `unlisted`, không có `public` | Bề mặt nhỏ hơn, không có câu hỏi index | Chủ sản phẩm cần ba mức; `public` chỉ tốn một cờ robots |
| D Chia sẻ theo id chuyến đi | Không thêm trường | Id có thể liệt kê và đã xuất hiện trong URL; năng lực phải độc lập với danh tính |
| E Tăng `version` khi đổi chia sẻ | Một quy tắc nhất quán | 412 giả cho trình sửa không đổi gì |

Phương án về sau của token là B; thua vì băm không bảo vệ được gì ở đây — dữ liệu đích
nằm cùng tệp — mà lại bỏ mất tính năng chủ sản phẩm cần. Phương án về sau của
visibility là C; thua vì yêu cầu rõ ràng của chủ sản phẩm.

## Hệ quả

Dễ hơn: toàn bộ luồng dùng lại nhân bản của ADR 0002 và đăng nhập của ADR 0004; tính
bất biến của template vẫn mang tính cấu trúc (`PlannerCatalog` không có writer); chia
sẻ không bao giờ cấp quyền sửa vì đường chia sẻ là bản chiếu chỉ-đọc riêng, không có
mã thay đổi dữ liệu.

Khó hơn, và không miễn phí:

- **Link là một bí mật bearer.** Ai giữ link đều đọc được chuyến đi cho đến khi xoay
  hoặc thu hồi. Giảm nhẹ: `Referrer-Policy: no-referrer`, `Cache-Control: private,
  no-store`, không liệt kê, không analytics trên đường dẫn. Trang nhúng script bên thứ
  ba sẽ làm lộ nó — không được thêm vào `/shared/[token]`.
- **Tra cứu token là quét tuyến tính** các chuyến đi, mỗi lần so sánh thời gian không
  đổi. Ổn với một tiến trình; thành chỉ mục khi chuyển SQL.
- **Limiter nằm trong bộ nhớ, theo từng tiến trình.** Reset khi khởi động lại và không
  chia sẻ giữa các instance — cùng điều kiện kích hoạt với SQL. Khóa client là hop đầu
  của `x-forwarded-for`, nếu không có thì `x-real-ip`, nếu không thì `unknown`; header
  này giả mạo được trừ khi một proxy tin cậy ghi đè. Không có proxy thì kẻ tấn công
  xoay header để né giới hạn; `unknown` khiến mọi caller như vậy dùng chung một
  bucket. Limiter chỉ là gờ giảm tốc chống dò, lớp phòng thủ thật là 256 bit của token.
- **Trang chia sẻ trả 200 khi bị giới hạn**, vì trang không đặt được status sau khi đã
  stream; nó render trạng thái "thử lại sau" không có dữ liệu chuyến đi.
- **Đăng nhập vẫn ưu tiên nhân sự.** "Được yêu cầu đăng nhập khi lưu" nghĩa là nhập
  access token do vận hành cấp. Tự đăng ký thật cần ADR riêng
  ([ADR 0004](0004-planner-identity.md)).
- **Hai bề mặt tin cậy cho chuyến đi**: API của chủ sở hữu và bản chiếu công khai phải
  khớp nhau. Một test liệt kê trường được phép để trường `Trip` mới không rò rỉ theo
  mặc định.
- Hoàn tác nghĩa là bỏ các trường và route chia sẻ; dòng đã lưu có trường thừa vẫn đọc
  được.

## Việc tiếp theo

- Hợp đồng và phân chia chủ sở hữu: `.claude/contracts/follow-hung-footsteps.md`.
- [architecture.vi.md](../architecture.vi.md) đã cập nhật (route, dữ liệu, ranh giới,
  giai đoạn).
- Tài liệu tính năng `docs/features/follow-hung-footsteps.*` — do `frontend-engineer`
  viết.
- Còn mở: thư viện công khai các chuyến `public`, chủ sở hữu tự chọn ẩn ngân sách, và
  nhà cung cấp danh tính thật — mỗi mục cần ADR riêng. Chủ sản phẩm xác nhận ngưỡng
  đăng nhập.
