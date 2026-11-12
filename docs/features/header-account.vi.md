# Tính năng — Tài khoản trên header

🇬🇧 English version: [header-account.md](header-account.md)

## Mục đích

Header của mọi trang giờ có lối vào đăng nhập và cho biết ai đang đăng nhập. Khách
thấy một biểu tượng người ("Đăng nhập") dẫn tới trang đăng nhập, rồi quay lại đúng
trang đang đọc. Người đã đăng nhập thấy chữ cái đầu tên trong một avatar tròn; bấm
vào mở một menu ngắn: Chuyến đi của tôi, đổi mật khẩu, trang quản trị (chỉ admin) và
đăng xuất. Trên điện thoại, các mục này nằm trong menu kéo ra, với nhãn viết đầy đủ.

## Route

Không thêm route. Control dẫn tới các route sẵn có:

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/sign-in` | `/dang-nhap?returnTo=…` | `/en/sign-in?returnTo=…` |
| `/my-trips` | `/chuyen-di-cua-toi` | `/en/my-trips` |
| `/account/password` | `/doi-mat-khau` | `/en/account/password` |
| `/admin` | `/quan-tri` | `/en/admin` |

## Dữ liệu

- `GET /api/planner/session` → `{ user, expiresAt, passwordChangeRequired }`
  ([ADR 0004](../adr/0004-planner-identity.vi.md)). Header đọc `user.displayName`,
  `user.role` và `user.hasPassword`; `401` nghĩa là khách.
- `DELETE /api/planner/session` để đăng xuất (`204`, gọi lại vẫn an toàn).
- Chuỗi trong `nav`: `signIn`, `accountMenu`, `signedInAs`, `changePassword`,
  `admin`, `signOut`, `signingOut`, `signOutFailed` (và `myTrips` có sẵn).

## Cách hoạt động

- **Đọc ở trình duyệt, không đọc ở server.** `useAccount()` trong
  `account-menu.tsx` gọi `GET /api/planner/session` sau khi trang đã tải. Nếu đọc
  cookie `HttpOnly` trong layout thì mọi trang của site sẽ thành động, không cache
  được, chỉ vì một control mà lần vẽ đầu không cần. Khi chưa có câu trả lời,
  control không hiển thị gì, nên thành viên không thấy chữ "Đăng nhập" loé lên.
  Dùng `fetch` thường, không dùng helper `api()` của Planner, để lỗi chỉ được hiểu
  là khách và không bao giờ chuyển hướng.
- **Khách.** Một link biểu tượng 44px tới trang đăng nhập đã bản địa hoá, kèm
  `returnTo` = đường dẫn và query hiện tại. Tên cho trình đọc màn hình và tooltip
  là "Đăng nhập" / "Sign in". Trên máy tính chỉ có biểu tượng vì hàng header bị giới
  hạn ở `max-w-7xl` và sáu mục điều hướng đã chiếm hết; thêm chữ sẽ đẩy chúng xuống
  hai dòng.
- **Đã đăng nhập.** Một nút avatar 44px (`aria-expanded`, `aria-controls`, tên
  "Tài khoản của {name}") mở một khung: "Đang đăng nhập: {name}", Chuyến đi của
  tôi, Đổi mật khẩu (chỉ khi tài khoản có mật khẩu — tài khoản chỉ dùng Google thì
  không có), Trang quản trị (chỉ khi `role === 'admin'`; trang vẫn kiểm tra vai trò
  ở server) và Đăng xuất. Đây là disclosure, không phải ARIA `menu`: các mục vẫn là
  link thường, Tab hoạt động như bình thường, ↓/↑ di chuyển giữa các mục, Escape
  đóng và trả focus về nút, bấm hoặc focus ra ngoài cũng đóng.
- **Điện thoại.** Menu kéo ra trong `main-nav.tsx` hiện nút "Đăng nhập" rộng hết
  hàng cho khách, hoặc tên và các mục như trên cho thành viên.
- **Đăng xuất** gửi `DELETE /api/planner/session` (cùng origin, nên qua được kiểm
  tra same-origin của route) rồi điều hướng hẳn về trang chủ để mọi phần client
  đọc lại phiên. Nếu lỗi, một thông báo hiện ngay tại chỗ.
- **`returnTo`.** `safeReturnTo` (`src/lib/return-to.ts`) trước chỉ nhận các route
  riêng tư; giờ nhận mọi trang đã bản địa hoá trong bảng route, trừ `/sign-in` và
  `/shared/[token]`, để người đọc quay lại đúng bài đang xem. Trang công khai chỉ
  giữ lại đường dẫn — query và fragment bị bỏ, vì `returnTo` bị chép vào URL đăng
  nhập, log, `Referer` và lượt đăng nhập Google được lưu; trang riêng tư giữ
  nguyên. Các kiểm tra chống
  open redirect (một dấu `/` ở đầu, không `//`, dấu gạch ngược, ký tự điều khiển hay
  scheme, chỉ route đã biết) giữ nguyên. Route bắt đầu Google dùng cùng bộ kiểm tra
  này, nên Google cũng đưa người dùng về đúng trang đó.
- **Google.** Trên trang đăng nhập, nút "Đăng nhập bằng Google" chỉ tồn tại khi đặt
  `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`
  ([ADR 0007](../adr/0007-password-and-google-sign-in.vi.md)); thiếu chúng thì nút
  không được vẽ ra, nên không có nút chết. Khi bật Google: khách bấm biểu tượng trên
  header → trang đăng nhập → "Đăng nhập bằng Google" → trang chọn tài khoản của
  Google → quay về trang ban đầu, lúc này header đã có avatar. Lần đăng nhập Google
  đầu tiên tạo một tài khoản thành viên.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| `src/components/layout/account-menu.tsx` | `useAccount`, `AccountMenu` (máy tính), `AccountDrawerSection` (điện thoại), đăng xuất |
| `src/components/layout/main-nav.tsx` | Gắn cả hai, dùng chung một lần đọc phiên |
| `src/lib/return-to.ts` | Danh sách `returnTo` hợp lệ, giờ là mọi trang trừ đăng nhập và link chia sẻ |
| `messages/vi.json`, `messages/en.json` | Nhãn `nav.*` |

## Test

- [`header-account.test.ts`](../../tests/header-account.test.ts) — layout, header,
  nav và menu tài khoản không đọc dữ liệu request (`next/headers`, `cookies()`,
  `@/server/**`), nên các trang vẫn tĩnh; menu đọc endpoint phiên và đăng xuất bằng
  `DELETE` cùng origin; mục quản trị chỉ hiện với vai trò admin; control được gắn ở
  máy tính và trong menu kéo ra; không có `href="#"`.
- [`return-to.test.ts`](../../tests/return-to.test.ts) — các trang công khai (trang
  chủ ở cả hai ngôn ngữ, chuyện đi chơi, khám phá, góc review, về nhà Hưng) được
  chấp nhận nhưng bỏ query và fragment; trang riêng tư giữ nguyên; trang đăng nhập
  và link chia sẻ vẫn về mặc định.
- `i18n.test.ts` giữ các khoá `nav` mới ở cả hai bộ chuỗi; `client-boundary.test.ts`
  kiểm tra module client mới không import code server.
- Hành vi hiển thị (menu máy tính bằng bàn phím, menu điện thoại ở 375px, đăng
  xuất) được kiểm tra bằng tay trên trình duyệt; dự án chưa có bộ test DOM.

## Giới hạn và câu hỏi còn mở

- Mỗi lượt xem trang của khách gọi một `GET /api/planner/session` và nhận `401`;
  trình duyệt ghi đó là lỗi trong console. Một biến thể `200 { user: null }`, hoặc
  một cookie gợi ý "đã đăng nhập" không chứa bí mật, sẽ bỏ được cả hai — đó là thay
  đổi phía backend.
- Mỗi request đọc store của Planner; khi lưu lượng lớn, đó là một lần đọc store cho
  mỗi lượt xem trang.
- Trên máy tính chỉ có biểu tượng, không có chữ "Đăng nhập", vì thiếu chỗ. Rút gọn
  một nhãn điều hướng hoặc chuyển một mục xuống footer sẽ đủ chỗ cho chữ.
- Control hiện ra sau khi có câu trả lời phiên, nên xuất hiện chậm hơn phần còn lại
  của header một chút.
