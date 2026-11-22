# Tính năng — Danh sách Chuyến đi của tôi: chế độ xem trên URL, tìm và sắp xếp

🇬🇧 English version: [my-trips-list.md](my-trips-list.md)

## Summary

Danh sách chuyến đi ở trang chủ thành viên (`/chuyen-di-cua-toi?tab=trips`) có chế độ
"Hiện có / Đã lưu trữ" chia sẻ được qua URL, dùng chung một mẫu chuyển mục với các mục
của trang chủ thành viên, từ ngữ nhất quán, cùng tìm kiếm, lọc theo tình trạng và sắp
xếp. Task: UXS-3 (hoàn tất UI-MYTRIPS-1, phần thẻ đã giao ở
[my-trips-card.vi.md](my-trips-card.vi.md)); finding UXA-13, 14, 20.

## Routes

Không thêm route. Chế độ lưu trữ là `/chuyen-di-cua-toi?tab=trips&view=archived`
(`/en/my-trips?tab=trips&view=archived`). Giá trị `view` khác là mặc định (hiện có);
tham số lặp lấy giá trị đầu.

## Data

Không có dữ liệu mới, không đổi API. `view` được đọc ở server (`src/lib/trips-view.ts`,
cùng ý với `parseMemberHomeTab`, ADR 0032) rồi truyền vào `MyTrips`, vẫn tải
`GET /api/planner?status=…`. Thông điệp: `myTrips` thêm `findLabel`, `searchLabel`,
`filterStatus`, `filterAll`, `sortLabel`, `sortUpdated`, `sortStart`, `sortTitle`,
`resultCount`, `noMatch`, `clearFilters`; `tabActive` và `description` đổi chữ, ở cả
`vi.json` và `en.json`.

## How it works

- **Chuyển chế độ:** hai liên kết thật trong `<nav>`, mục đang mở có
  `aria-current="page"` (cùng mẫu `member-home-tabs.tsx`), thay cho nút `aria-pressed`.
  Back, Forward và F5 giữ chế độ; trang gắn lại danh sách theo chế độ (`key`) nên tìm
  kiếm và bộ lọc được đặt lại khi chuyển.
- **Từ ngữ:** "Đang dùng" thành "Hiện có" / "Current"; mô tả trang dùng "lưu trữ" thay
  "cất đi" để khớp với nút.
- **Tìm và sắp xếp (phía client, trên danh sách đã tải):** ô tìm (tên chuyến và tên điểm
  đến, không phân biệt hoa thường), bộ lọc tình trạng, và sắp xếp (mới cập nhật = thứ tự
  server, ngày khởi hành với chuyến chưa có ngày xếp cuối, tên A–Z). Khi có bộ lọc, dòng
  trạng thái báo "Hiển thị x/y"; không khớp thì có thông báo và nút "Xóa bộ lọc". Bộ lọc
  không nằm trên URL.
- Lỗi tải kèm Thử lại, thao tác trên thẻ và các yêu cầu không đổi.

## Files

| Path | Role |
|---|---|
| `src/lib/trips-view.ts` | `TRIPS_VIEWS`, `parseTripsView` |
| `src/app/[locale]/my-trips/page.tsx` | đọc `?view=`, truyền vào `MyTrips` |
| `src/components/planner/my-trips.tsx` | liên kết chế độ, tìm, lọc, sắp xếp |
| `messages/vi.json`, `messages/en.json` | khoá `myTrips` mới và đổi chữ |
| `tests/dom/my-trips.test.tsx`, `tests/trips-view.test.ts` | kiểm thử |

## Tests

`tests/dom/my-trips.test.tsx`: liên kết chế độ và `aria-current`, href `?view=archived`,
sắp xếp, tìm không khớp rồi xóa, lọc tình trạng không gọi thêm yêu cầu; các test thẻ cũ
nay gắn theo chế độ. `tests/trips-view.test.ts`: phân tích tham số. Chưa bao phủ:
VoiceOver với dòng trạng thái (B9 của audit) và ảnh chụp ở 375/768/1280.

## Limits and open questions

Không tìm kiếm phía server và không phân trang (danh sách nhỏ, tải đủ). Bộ lọc không
nằm trên URL. Thông báo trạng thái vẫn ở đầu danh sách chứ chưa ở thẻ vừa thao tác
(UXA-13, để mở). Màn quản trị tài khoản vẫn dùng "Đang dùng" (`viewActive`), khái niệm
khác.
