# Tính năng — Trình sửa chuyến đi

🇻🇳 English version: [trip-editor.md](trip-editor.md)

## Summary

Du khách có thể điền nội dung chuyến đi sau khi tạo — trống hay sao chép từ một câu
chuyện — ngay trên `/my-trips/[id]`: đổi thông tin chung, thêm và bớt ngày, viết tiêu đề
và ghi chú cho từng ngày, thêm, sửa, xoá, sắp xếp và chuyển hoạt động, rồi ghi lại số tiền
thực chi. Trước đây trang này chỉ đổi được trạng thái, nhân bản, lưu trữ và chia sẻ. Xây
trên [travel-planner-core.vi.md](travel-planner-core.vi.md) và
[create-blank-trip.vi.md](create-blank-trip.vi.md).

## Routes

Không có. Trình sửa nằm trên `/my-trips/[id]` sẵn có (`/chuyen-di-cua-toi/[id]`,
`/en/my-trips/[id]`). Chuyến đã lưu trữ vẫn chỉ đọc ở đó.

## Data

- Không đổi API hay schema. Mọi đọc và ghi đi qua API Planner sẵn có, giới hạn theo chủ sở hữu: `PATCH /api/planner/[id]`, `PATCH …/days/[dayNumber]`, `POST …/activities`, `PATCH` và `DELETE …/activities/[activityId]`, `PATCH …/reorder`, `POST …/expenses`, `PATCH` và `DELETE …/expenses/[expenseId]`.
- Đọc danh mục công khai `GET /api/travel/places?destinationSlug=…` để gợi ý địa điểm. Danh mục seed hiện chỉ có địa điểm của Đà Lạt; với điểm đến khác thì ô chọn địa điểm đơn giản là không xuất hiện và mọi hoạt động đều tự thêm.
- Thông điệp: namespace mới `tripEditor` (gồm `tripEditor.category.*`) và khoá `tripDetail.budgetActual`, ở cả `messages/vi.json` và `messages/en.json`.

## How it works

1. `TripDetail` hiển thị `TripEditor` cho chuyến đang hoạt động và giữ danh sách chỉ đọc cũ cho chuyến đã lưu trữ.
2. Mọi thao tác ghi đi qua một hàm `mutate`: gửi phiên bản trang đã đọc lần cuối trong `If-Match`, rồi thay toàn bộ state của trang bằng `TripView` mà API trả về — nên bảng ngân sách và `If-Match` kế tiếp luôn mới, không cần tải lại.
3. Số ngày đổi qua `durationDays` của trip (API không có route thêm ngày). Tăng thì thêm các ngày trống; giảm bị từ chối bằng `409 invalid_state` khi ngày bị bỏ còn hoạt động hay khoản chi, trang báo rõ và không đổi gì.
4. Hoạt động chọn từ danh mục sẽ điền sẵn tên, thời lượng và chi phí, vẫn sửa được; địa điểm thì không đổi được về sau (schema cập nhật không có `placeSlug`). Đưa lên/xuống và "chuyển sang ngày" dùng `PATCH /reorder`; không có kéo thả.
5. Mọi thao tác xoá đều hỏi lại ngay tại chỗ ("Xoá hoạt động này?" với Xoá / Giữ lại).
6. Lỗi: `401` chuyển sang đăng nhập; `412` báo chuyến đi vừa được sửa ở nơi khác, tải lại và dựng lại form thông tin theo bản mới; `409` hiện thông báo riêng cho từng thao tác (ngày bị bỏ còn nội dung khi giảm số ngày, ngày đã đủ 40 hoạt động, hoặc câu trung tính); `422` và các lỗi khác hiện thông báo dễ hiểu. Thông báo nằm trong vùng `role="status"`.
   - Form thông tin chỉ gửi những trường người dùng đã đổi, nên form cũ không thể ghi đè điều người khác vừa lưu.
   - Ngày đã đủ 40 hoạt động thì nút "Thêm hoạt động" bị khoá và ngày đó không còn trong danh sách "chuyển sang ngày".
   - Khoản chi gắn với một hoạt động bị khoá ô ngày (ngày đi theo hoạt động; API từ chối ngày khác).
   - Sau khi xoá, thêm, lưu hoặc đóng form, focus chuyển tới dòng thông báo thay vì rơi về trang.
   - Sau khi chuyển lên, chuyển xuống hoặc "chuyển sang ngày", focus quay lại đúng control đó trên dòng vừa chuyển (hoặc control gần nhất còn bật, ví dụ "chuyển lên" khi dòng đã xuống cuối), để người dùng bàn phím không mất vị trí; dòng thông báo vẫn đọc "Đã di chuyển hoạt động."
   - Một thao tác ghi trong trình sửa cũng khoá các nút trạng thái, nhân bản và lưu trữ của trang (và ngược lại), vì cả hai dùng chung phiên bản trip.
7. Chi phí hiện đủ số đồng (`300.000 ₫`), không làm tròn triệu như phần tóm tắt, và ghi rõ là mỗi người hay cả nhóm.

## Files

| Path | Role |
|---|---|
| `src/components/planner/trip-editor/trip-editor.tsx` | Điều phối: `mutate`, thông báo trạng thái, tải danh mục |
| `src/components/planner/trip-editor/trip-fields-form.tsx` | Form thông tin chuyến đi (cũng đổi số ngày) |
| `src/components/planner/trip-editor/day-card.tsx` | Một ngày: tiêu đề/ghi chú, danh sách hoạt động, sắp xếp, chuyển, xoá |
| `src/components/planner/trip-editor/activity-form.tsx` | Thêm / sửa một hoạt động |
| `src/components/planner/trip-editor/expenses-panel.tsx` | Danh sách và form khoản chi |
| `src/components/planner/trip-editor/shared.ts` | Kiểu `Mutate`, danh sách loại chi phí, `formatDong`, `wholeNumber` |
| `src/components/planner/trip-detail.tsx` | Gắn trình sửa; phần tóm tắt thêm "đã chi thực tế" |
| `messages/vi.json`, `messages/en.json` | Chuỗi hiển thị |
| `.claude/contracts/trip-editor.md` | Task Contract |

## Tests

Không có file test mới: repo chưa có hạ tầng test component, còn hợp đồng API mà trình sửa gọi đã được các test Planner sẵn có phủ. `tests/i18n.test.ts` kiểm độ đồng đều VI/EN của các khoá mới và `tests/docs.test.ts` kiểm tài liệu. Các luồng được thử tay trên trình duyệt với server local và kho tạm: thêm, sửa, sắp xếp, chuyển giữa các ngày, xoá có xác nhận, tiêu đề/ghi chú ngày, thông tin chuyến đi, tăng và giảm số ngày (gồm cả ca giảm bị chặn), thêm/sửa/xoá khoản chi, lỗi `412` do phiên bản cũ, và địa điểm từ danh mục trên chuyến Đà Lạt. Ở bề rộng 375px không bị tràn ngang. Chưa thử khi chỉ dùng bàn phím và với trình đọc màn hình. Đợt review `qc` cho bản đầu đã tìm ra các vấn đề mà những điểm ở trên đây xử lý.

## Limits and open questions

- Chưa cho gắn khoản chi vào một hoạt động cụ thể; liên kết sẵn có được giữ nguyên khi sửa khoản chi. Không có chức năng nhân đôi ngày hay sắp xếp lại cả ngày.
- Sau xung đột phiên bản, form thông tin được dựng lại theo bản trên máy chủ nên những gì đã gõ trong đó sẽ mất; lưu bị từ chối vì lý do khác thì vẫn giữ nguyên.
- Không có kéo thả, không có hoàn tác; xoá đã xác nhận là xoá hẳn.
- Danh mục địa điểm phụ thuộc vào seed nội dung; khi có nhiều địa điểm, ô chọn sẽ là một `<select>` dài.
- `qc` và `security` chưa được chạy cho thay đổi này.
