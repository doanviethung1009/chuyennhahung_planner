# Tính năng — Thẻ chuyến đi trong Chuyến đi của tôi

🇬🇧 English version: [my-trips-card.md](my-trips-card.md)

## Summary

Danh sách chuyến đi ở trang chủ thành viên (`/chuyen-di-cua-toi?tab=trips`) được sắp lại
thành thẻ gồm đầu, thân và chân, để người dùng nhận ra chuyến đi, mở nó và tìm thao tác
phụ mà không phải đối mặt với một hàng nút. Đổi tình trạng lập kế hoạch vẫn nằm ngay trên thẻ. Task: UI-MYTRIPS-1. Nghiệp vụ không đổi.

## Routes

Không có. Danh sách vẫn ở `/chuyen-di-cua-toi` (`/en/my-trips`), `?tab=trips`.

## Data

Chỉ dùng các trường đã có trên `Trip`: `title`, `destinationSlug`, `startDate`,
`durationDays`, `partySize`, `visibility`, `planningStatus`, `version`. Thông điệp:
`myTrips` (khoá mới `open`, `menuLabel`, `retry`) và `planning`, ở cả `vi.json` và
`en.json`.

## How it works

- **Đầu thẻ:** tên chuyến đi (liên kết tới `/chuyen-di-cua-toi/[id]`), huy hiệu tình
  trạng lập kế hoạch và huy hiệu hiển thị (đều có chữ, không chỉ màu), nút menu `…`.
- **Thân thẻ:** điểm đến · ngày bắt đầu hoặc "chưa chọn ngày" · số ngày · số người, tự
  xuống dòng trên màn hẹp.
- **Chân thẻ:** liên kết chính "Xem / chỉnh sửa chuyến đi" (toàn chiều rộng trên điện
  thoại). Thẻ đang dùng giữ `StatusSelect` có nhãn ở đây (quyết định của Owner: không đưa
  vào menu). Thẻ đã lưu trữ có "Khôi phục" và "Xoá vĩnh viễn" là nút hiển thị sẵn, với
  bước xác nhận trước khi gửi yêu cầu xoá.
- **Menu thao tác** (`action-menu.tsx`, mẫu ARIA menu button): chỉ ở thẻ đang dùng:
  Nhân bản và Lưu trữ. Thẻ đã lưu trữ không có menu. Phím mũi tên, Home, End
  di chuyển; Escape đóng và trả focus; Tab hoặc bấm ra ngoài thì đóng. Nút mở bị vô hiệu
  khi có yêu cầu đang chạy.
- **Trạng thái:** khung chờ khi tải (`aria-busy`), trạng thái rỗng với CTA cũ, lỗi tải là
  alert có nút Thử lại, lỗi thao tác là alert; thông báo thành công nằm ở vùng status.
- Các yêu cầu không đổi: PATCH (tình trạng), POST `/duplicate`, DELETE (lưu trữ), POST
  `/restore`, DELETE `?purge=true`, mỗi yêu cầu gửi `If-Match` bằng `version` đã tải; 401
  về đăng nhập, 412 báo dữ liệu cũ và tải lại.

## Files

| Path | Role |
|---|---|
| `src/components/planner/my-trips.tsx` | Danh sách, thẻ, thao tác |
| `src/components/planner/action-menu.tsx` | Menu mở rộng truy cập được |
| `messages/vi.json`, `messages/en.json` | `myTrips.open`, `menuLabel`, `retry` |
| `tests/dom/my-trips.test.tsx` | Kiểm thử thành phần |

## Tests

`tests/dom/my-trips.test.tsx` (jsdom): metadata, route của CTA, ô chọn tình trạng và nội dung menu theo bộ lọc,
menu bằng bàn phím/Escape/bấm ngoài, PATCH ô chọn tình trạng kèm version, nhân bản và chuyển
trang, yêu cầu lưu trữ và khôi phục, xác nhận xoá, 401/412/500, vô hiệu khi đang chạy,
tải/rỗng/lỗi tải kèm thử lại, nhãn tiếng Anh. Kiểm tra hình ảnh ở 375/768/1280 cần phiên
đăng nhập nên chưa tự động hoá.

## Limits and open questions

Tìm kiếm, lọc và sắp xếp (phía client) có từ UXS-3, xem [my-trips-list.vi.md](my-trips-list.vi.md); chưa có phân trang. Tab mặc định (`map`) giữ nguyên (ADR 0032).
Thẻ đã lưu trữ không có menu `…` vì Khôi phục và Xoá vĩnh viễn luôn hiển thị.
