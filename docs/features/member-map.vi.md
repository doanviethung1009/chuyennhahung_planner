# Feature — Bản đồ thành viên

🇻🇳 English version: [member-map.md](member-map.md)

## Summary

Thành viên đã đăng nhập thấy bản đồ Việt Nam của riêng mình: chấm đặc ở nơi đã đi, chấm rỗng ở nơi đã lên kế hoạch. Bản đồ này riêng tư, tách khỏi [bản đồ du lịch](travel-map.vi.md) của chủ site, và chỉ dựng từ chuyến đi và review thành viên đã có. Quyết định: [ADR 0029](../adr/0029-member-map.vi.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/my-map` | `/ban-do-cua-toi` | `/en/my-map` |

`noindex`, không có trong sitemap, luôn trả `Cache-Control: private, no-store`. Có link từ menu tài khoản và từ Chuyến đi của tôi.

## Data

- Đọc chuyến đi của thành viên (`listTrips`: `destinationSlug`, `status`, `planningStatus`, `startDate`, `endDate`) và review của chính họ (`listOwnReviews`: `placeSlug`, `visitedOn`, `status`), đều theo `userId` của phiên, cùng catalogue địa điểm công khai để quy địa điểm của review về điểm đến.
- Tọa độ, tên, `featured` và phía nhãn lấy từ seed `destinations`, chỉ đọc. Không thêm trường, bảng hay API. Namespace thông điệp `memberMap`; `nav.myMap`; `myTrips.mapLink`.
- Không cần dữ liệu thật nào từ chủ, và không tạo dữ liệu thành viên giả.

## How it works

- `getMemberMap()` đọc cookie trên server (lọc hình dạng, `identify`; bearer token, phiên hết hạn hay đang bắt đổi mật khẩu đều là khách; mọi lỗi là khách) và trả `guest`, `empty` hoặc `ready` kèm các điểm `{ slug, visits? }`.
- `buildMemberMapPoints` là quy tắc thuần: chuyến `completed` (đã lưu trữ hay chưa) hoặc review có `visitedOn` cho chấm đặc, với `visits` = số chuyến completed + số ngày đã đi khác nhau chưa nằm trong ngày của một chuyến completed; chuyến `active` ở `draft`/`planned` cho chấm rỗng; chuyến lưu trữ mà chưa completed bị bỏ; điểm đến không có trong seed bị bỏ.
- `MemberMapView` ghép các điểm với seed theo `slug` rồi vẽ `VietnamMap`. Khách thấy khung trống, một câu mời và nút đăng nhập; thành viên chưa có điểm nào thấy câu đó và link tạo chuyến. Nhãn cố định chỉ ở pin `featured`; pin giữ vùng bấm 44 px; chú giải và danh sách ghi "đã đi" / "đã lên kế hoạch" bằng chữ, không chỉ bằng màu.

## Files

| Path | Role |
|---|---|
| `src/server/planner/member-map.ts` | Quy tắc thuần, đọc phiên và allow-list |
| `src/app/[locale]/my-map/page.tsx` | Trang: `noindex`, động, một `<h1>` |
| `src/components/map/member-map-view.tsx` | Giao diện khách / trống / có điểm |
| `src/components/map/vietnam-map.tsx` | Kiểu prop thu hẹp thành `MapPin` (đầu ra không đổi) |
| `next.config.ts` | `private, no-store` cho `/ban-do-cua-toi` và `/en/my-map` |
| `tests/member-map.test.ts`, `tests/member-map-view.test.ts` | Test |

## Tests

`member-map.test.ts`: mọi trường hợp của quy tắc thuần; khách khi cookie thiếu, rác, không tồn tại hay là bearer, và khi đang bắt đổi mật khẩu; không đọc store với cookie sai hình dạng; hai thành viên không bao giờ thấy dữ liệu của nhau; khóa gửi xuống component chỉ là `slug` và `visits`, không có chủ sở hữu, id hay tiêu đề chuyến. `member-map-view.test.ts`: giao diện khách và trống không vẽ pin; pin đặc và rỗng kèm trạng thái bằng chữ; vùng bấm 44 px; đúng một nhãn cố định (chỉ featured); `VietnamMap` vẽ y hệt với destination đầy đủ và với bản chiếu của chúng. Chưa test: header `Cache-Control` lúc chạy (chỉ kiểm qua kết quả build) và chạy trên trình duyệt.

## Limits and open questions

- Mỗi request đọc tới 1.000 chuyến mỗi trạng thái; tài khoản rất lớn sẽ cần chỉ mục.
- `visitedOn` do người dùng tự khai; chỉ dùng để vẽ bản đồ của chính họ.
- Chưa chia sẻ: bản đồ chia sẻ qua token là lát 2 (ADR 0029, mục 7), cần kiểm tra bảo mật.
- Chưa có bản đồ tuyến theo chuyến: phần đó vẫn hoãn.
- Bản đồ của chủ và quy tắc pin, nhãn nằm ở [travel-map.vi.md](travel-map.vi.md); trang này dùng lại và không sửa tài liệu đó.
