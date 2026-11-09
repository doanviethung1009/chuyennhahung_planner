# Tính năng — Đi theo dấu chân nhà Hưng

🇬🇧 English version: [follow-hung-footsteps.md](follow-hung-footsteps.md)

## Tóm tắt

Người đọc câu chuyện Đà Lạt thấy lịch trình nhà Hưng đã đi thật và có thể biến nó
thành chuyến đi của riêng mình: chọn ngày, số người và ngân sách khi còn là khách
ẩn danh, chỉ đăng nhập đúng lúc lưu, rồi có một bản sao độc lập trong Chuyến đi của
tôi. Từ đó họ đặt tình trạng kế hoạch, nhân bản, lưu trữ và chia sẻ chuyến đi bằng
một đường dẫn chỉ đọc. Template gốc, blog, tour và đăng nhập hiện có không bị ảnh
hưởng. Bản ghi quyết định:
[ADR 0005](../adr/0005-trip-sharing-and-story-cloning.vi.md).

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh | Được lập chỉ mục |
|---|---|---|---|
| `/trip-setup/[template]` | `/tao-chuyen-di/[template]` | `/en/trip-setup/[template]` | không |
| `/sign-in` | `/dang-nhap` | `/en/sign-in` | không |
| `/my-trips` | `/chuyen-di-cua-toi` | `/en/my-trips` | không |
| `/my-trips/[id]` | `/chuyen-di-cua-toi/[id]` | `/en/my-trips/[id]` | không |
| `/shared/[token]` | `/chia-se/[token]` | `/en/shared/[token]` | chỉ khi `public` |

Trang `/stories/di-da-lat-lan-thu-sau` có thêm mục "Lịch trình thực tế" và một lời
kêu gọi hành động. Các trang riêng tư là `noindex` và không nằm trong
`src/app/sitemap.ts`. `/shared/[token]` không có `hreflang` alternates, để token
không bao giờ bị quảng bá chéo giữa các locale.

## Dữ liệu

- `Story.plannerTemplateSlug` (`src/content/types.ts`) nối một story với một
  template Planner công khai; `di-da-lat-lan-thu-sau` trỏ tới `da-lat-3-ngay-lang-man`.
- Template được đọc phía server bằng `getRepository().getPublicTemplate(slug)`.
  Template thiếu hoặc đã bị gỡ thì không hiện mục lịch trình lẫn CTA.
- `Trip` có thêm `planningStatus`, `visibility`, `shareToken`, `shareTokenCreatedAt`,
  `duplicatedFromTripId`; `sourceTemplate.story` do server điền. `SharedTripView` là
  bản chiếu công khai theo allow-list (không có chủ sở hữu, id, version, ghi chú
  chuyến đi hay chi phí). Kiểu nằm ở `src/server/planner/schemas.ts`.
- Namespace thông điệp: `journey`, `tripSetup`, `signIn`, `myTrips`, `tripDetail`,
  `share`, `shared`, `planning`, `visibility`, `travelStyle`, `itineraryDays` và
  `nav.myTrips`.
- Trạng thái trong trình duyệt: bản nháp thiết lập nằm trong `sessionStorage` với
  khoá `cnh:trip-setup:<template>` (chỉ các trường của form, không bao giờ có
  thông tin xác thực). Phiên đăng nhập là cookie `HttpOnly`.

## Cách hoạt động

API được dùng (đều cùng origin, xác thực bằng cookie; body là `.strict()`):
`POST /api/planner` (`source: 'template'`), `GET /api/planner?status=`,
`PATCH /api/planner/[id]` (`If-Match`, `planningStatus`),
`DELETE /api/planner/[id]` (lưu trữ; `?purge=true` trên trip đã lưu trữ),
`POST .../restore`, `POST .../duplicate`, `PUT|DELETE .../share`,
`POST .../share/rotate`, `GET|POST|DELETE /api/planner/session`,
`GET /api/shared/[token]` (công khai, có giới hạn tốc độ).

1. **Trang story** (server, ISR 60 giây) hiển thị các ngày của template và một liên
   kết tới `/trip-setup/[template]`.
2. **Thiết lập chuyến đi** (trang server, form client `TripSetupForm`) sửa tên, ngày,
   số người, ngân sách, phong cách, nhịp độ và ghi chú. Mỗi thay đổi được ghi vào
   bản nháp `sessionStorage`. Lưu sẽ gửi đúng các trường theo hợp đồng. Gặp `401`
   thì giữ nguyên bản nháp và chuyển tới `/sign-in?returnTo=<đường dẫn này>`; gặp
   `201` thì xoá bản nháp và đưa người dùng tới `/my-trips/<id>`.
3. **Đăng nhập** (`SignInForm`) gửi mã truy cập do người vận hành cấp. `returnTo`
   được server kiểm tra bằng `safeReturnTo` (`src/lib/return-to.ts`): chỉ một dấu
   `/` ở đầu, không `//`, không dấu gạch ngược hay ký tự điều khiển, không có
   scheme, và phải khớp một route riêng tư đã bản địa hoá đã biết; nếu không sẽ về
   `/my-trips`. `429` hiển thị thời gian chờ.
4. **Chuyến đi của tôi** (`MyTrips`) liệt kê trip đang dùng hoặc đã lưu trữ; đổi
   tình trạng, nhân bản, lưu trữ, khôi phục và xoá vĩnh viễn hai bước. `401` chuyển
   tới đăng nhập kèm `returnTo`; `412` làm mới danh sách.
5. **Chi tiết chuyến đi** (`TripDetail`) hiển thị chuyến đi chỉ đọc cùng tình trạng,
   nhân bản, lưu trữ và `SharePanel`: chọn chế độ hiển thị, đường dẫn (dựng phía
   client từ token trả về và locale hiện tại), sao chép, tạo mới, ngừng chia sẻ.
   Token chỉ nằm trong state của component.
6. **Trang chia sẻ** là server component, `force-dynamic`. Một hàm tải được cache
   áp dụng giới hạn tốc độ đọc chia sẻ rồi gọi `getSharedTrip`, dùng chung cho
   `generateMetadata` và trang. Token không tồn tại: `notFound()`. Bị giới hạn: trạng
   thái noindex "thử lại sau" không có dữ liệu chuyến đi. Metadata: `referrer:
   no-referrer`; chỉ cho lập chỉ mục khi `public`. Không script, không embed, không
   analytics, không nút sửa, và có liên kết ghi công về story.

## File

| Đường dẫn | Vai trò |
|---|---|
| `src/app/[locale]/stories/[slug]/page.tsx` | Mục lịch trình thực tế và CTA |
| `src/app/[locale]/trip-setup/[template]/page.tsx` | Trang thiết lập, đọc template công khai |
| `src/app/[locale]/sign-in/page.tsx` | Trang đăng nhập, kiểm tra `returnTo` |
| `src/app/[locale]/my-trips/page.tsx`, `my-trips/[id]/page.tsx` | Khung trang riêng tư |
| `src/app/[locale]/shared/[token]/page.tsx` | Trang chia sẻ chỉ đọc công khai |
| `src/components/planner/*` | `api`, `field`, `itinerary-days`, `trip-setup-form`, `sign-in-form`, `my-trips`, `trip-detail`, `share-panel`, `status-select` |
| `src/lib/return-to.ts` | Chặn open redirect |
| `src/content/stories.ts` | `plannerTemplateSlug` trên story Đà Lạt |
| `src/components/layout/site-footer.tsx` | Liên kết "Chuyến đi của tôi" ở footer |
| `messages/vi.json`, `messages/en.json` | Toàn bộ chuỗi giao diện |

## Test

- `tests/return-to.test.ts`: chấp nhận route đã biết ở cả hai locale; từ chối
  `//evil.com`, `https://…`, `/\evil.com`, `javascript:`, ký tự điều khiển, đường dẫn
  lạ hoặc không được quay lại, và null.
- Hành vi backend (vòng đời chia sẻ, 404 không lộ thông tin, rò rỉ qua projection,
  phân quyền, body strict, nhân bản, rate limiter, session probe) được phủ bởi
  `tests/planner-sharing.test.ts`, `tests/rate-limit.test.ts` và các bộ test planner.
- `tests/i18n.test.ts`, `tests/routing.test.ts`, `tests/docs.test.ts`,
  `tests/design-tokens.test.ts` phủ việc đồng bộ catalogue, năm route, tài liệu này
  và việc dùng token.
- Chưa có test tự động cho các form client và trang đã render. Cần kiểm tra bằng
  trình duyệt (vào ẩn danh, tuỳ chỉnh, lưu, đăng nhập, bản nháp được khôi phục,
  chia sẻ, mở đường dẫn trong cửa sổ riêng tư).

## Giới hạn và câu hỏi còn mở

- Đăng nhập vẫn là mã truy cập do người vận hành cấp ([ADR 0004](../adr/0004-planner-identity.vi.md));
  chưa có đăng ký công khai.
- Chi tiết Chuyến đi của tôi chỉ có xem, tình trạng, nhân bản, lưu trữ và chia sẻ.
  Chưa có sửa ngày, activity và chi phí trong trình duyệt.
- Chưa có thư viện công khai các chuyến đi; `public` chỉ cho phép lập chỉ mục đúng
  một trang đó.
- Rate limiter nằm trong từng process và tin `x-forwarded-for` (xem ADR 0005).
- Trang story là ISR (60 giây), nên template bị gỡ có thể còn hiện tới một phút.
- Tên địa điểm trên trang chia sẻ lấy từ tiêu đề activity; `placeSlug` chưa được
  chuyển thành tên.
- Gợi ý mã truy cập và liên kết ở footer là các lối vào duy nhất tới Chuyến đi của
  tôi; chưa thêm mục nào vào thanh điều hướng đầu trang.
