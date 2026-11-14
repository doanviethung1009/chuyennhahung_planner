# Tính năng — Tạo chuyến đi trống

🇻🇳 English version: [create-blank-trip.md](create-blank-trip.md)

## Summary

Nút "Tạo chuyến đi mới" trên trang Chuyến đi của tôi và biểu mẫu phía sau, để người
dùng đã đăng nhập bắt đầu một chuyến đi từ đầu. Trước đây chỉ tạo được chuyến đi từ
lịch trình của một câu chuyện, nên người chưa có chuyến nào không thấy cách bắt đầu.
Dựa trên [travel-planner-core.vi.md](travel-planner-core.vi.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/my-trips/new` | `/chuyen-di-cua-toi/moi` | `/en/my-trips/new` |

## Data

- Gọi `POST /api/planner` có sẵn với `source: "blank"` (`tripBlankCreateSchema`): `title`, `destinationSlug`, `durationDays`, `startDate`, `partySize`, `travelStyle`, `pace`, `budget.targetTotalVnd`, `note`. Không đổi API hay schema.
- Điểm đến lấy từ `src/content/destinations.ts`.
- Thông điệp: namespace `newTrip` mới và `myTrips.createCta`, trong cả `messages/vi.json` và `messages/en.json`.

## How it works

1. `MyTrips` hiện nút liên kết tới `/my-trips/new` phía trên các tab, ở mọi trạng thái (kể cả khi danh sách trống).
2. `NewTripForm` (client) kiểm tra tên (3–120), điểm đến, số ngày (1–30), số người (1–50) và ngân sách (số nguyên, ≥ 0) rồi mới gửi body chặt.
3. Thành công thì mở chuyến đi mới tại `/my-trips/[id]`, nơi các ngày đã được tạo sẵn. Lỗi 401 chuyển sang đăng nhập; lỗi 422 hoặc khác hiện thông báo và giữ nguyên dữ liệu đã nhập.
4. Trang `noindex`, như các trang Planner riêng tư khác.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/my-trips/new/page.tsx` | Route, metadata, tiêu đề |
| `src/components/planner/new-trip-form.tsx` | Biểu mẫu |
| `src/components/planner/my-trips.tsx` | Nút tạo |
| `src/i18n/routing.ts` | Đường dẫn `/my-trips/new` |
| `messages/vi.json`, `messages/en.json` | `newTrip`, `myTrips.createCta` |

## Tests

Không thêm test tự động: biểu mẫu là client component và chưa có công cụ test DOM. `tests/i18n.test.ts` kiểm tra khớp khoá, `tests/routing.test.ts` kiểm tra bản đồ route. Chưa kiểm thử: luồng gửi biểu mẫu trong trình duyệt.

## Limits and open questions

- Trang chi tiết chuyến đi hiện chỉ đọc, nên sau khi tạo chưa thêm được hoạt động trong trình duyệt; trình soạn thảo đó vẫn chưa có (quy tắc 6).
- Bản nháp không lưu trong `sessionStorage` (khác trang chuẩn bị chuyến đi), nên bị chuyển sang đăng nhập thì mất dữ liệu đã nhập.
