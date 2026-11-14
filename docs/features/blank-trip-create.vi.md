# Tính năng — Tạo chuyến đi trống

🇻🇳 English version: [blank-trip-create.md](blank-trip-create.md)

## Summary

Du khách có thể bắt đầu một chuyến đi từ đầu: chọn điểm đến và số ngày, Planner dựng
sẵn từng ấy ngày trống được đánh số. Trước đây chuyến đi chỉ tạo được bằng cách sao
chép lịch trình của một câu chuyện. Xây trên [travel-planner-core.vi.md](travel-planner-core.vi.md).

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/new-trip` | `/chuyen-di-moi` | `/en/new-trip` |

Trang là `noindex` và không có trong sitemap, giống các trang Planner riêng tư khác.

## Data

- Ghi qua `POST /api/planner` sẵn có với `source: "blank"` (`tripBlankCreateSchema`); không đổi API hay schema.
- Đọc `destinations` từ `src/content/destinations.ts` làm danh sách điểm đến — cùng nguồn mà máy chủ dùng để kiểm `destinationSlug`.
- Thông điệp: namespace mới `newTrip` và khoá `myTrips.newTrip`, ở cả `messages/vi.json` và `messages/en.json`.

## How it works

1. Trang phía máy chủ hiển thị `BlankTripForm` cùng tên điểm đến theo ngôn ngữ.
2. Form kiểm những gì API kiểm (tên 3–120 ký tự, đã chọn điểm đến, 1–30 ngày, 1–50 người, ngân sách nguyên không âm) và chỉ gửi đúng các trường trong hợp đồng, vì body là strict.
3. Bản nháp nằm trong `sessionStorage` với khoá `cnh:new-trip` (chỉ các trường của form, không có thông tin xác thực), được khôi phục sau khi đăng nhập xong và bị xoá khi lưu thành công.
4. Lỗi `401` chuyển sang đăng nhập (`goToSignIn`) rồi quay lại; lỗi `422` và các lỗi khác hiện thông báo và giữ bản nháp. Thành công thì chuyển tới `/my-trips/[id]`.
5. `/my-trips` có liên kết tới đây ở đầu trang và ở trạng thái trống.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/new-trip/page.tsx` | Trang máy chủ, metadata, danh sách điểm đến |
| `src/components/planner/blank-trip-form.tsx` | Form phía client |
| `src/components/planner/my-trips.tsx` | Các lối vào "Tạo chuyến đi mới" |
| `src/i18n/routing.ts`, `src/lib/return-to.ts` | Route và danh sách cho phép quay lại sau đăng nhập |
| `messages/vi.json`, `messages/en.json` | Chuỗi hiển thị |

## Tests

Không có file test mới. `tests/routing.test.ts`, `tests/return-to.test.ts` và `tests/i18n.test.ts` phủ bảng route, danh sách return-to và độ đồng đều VI/EN. Bản thân form chưa có test component (repo chưa có hạ tầng test component); hợp đồng tạo trip đã được các test API Planner sẵn có phủ.

## Limits and open questions

- Chuyến đi mới còn trống: thêm hoạt động từng ngày, chi phí và sắp xếp lại vẫn chưa có giao diện sửa (chỉ có API).
- Danh sách điểm đến là seed tĩnh, không phải kho nội dung.
- Trang chưa được thử trên trình duyệt trong thay đổi này.
