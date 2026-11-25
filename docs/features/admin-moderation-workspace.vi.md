# Tính năng — Không gian kiểm duyệt (admin)

🇬🇧 English version: [admin-moderation-workspace.md](admin-moderation-workspace.md)

## Summary

`/admin/community` trở thành một không gian phân loại thay vì bốn danh sách xếp chồng. Đầu trang có thanh liên kết nhảy với số đếm theo từng mục; các mục theo thứ tự cố định (chuyến chờ duyệt → đánh giá đang giữ → báo cáo → tác giả bị tắt; mục "đánh giá chờ duyệt" chỉ được thêm khi còn đánh giá chờ duyệt cũ); mỗi danh sách có trạng thái rỗng; mọi thẻ có cùng bố cục; chuyến và đánh giá có lịch sử chỉ-đọc (P07-14). Chỉ thay đổi cách trình bày: không đổi quy tắc kiểm duyệt, state machine, API, route hay request.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/community` | không đổi | không đổi |

Không có route hay API mới. Lịch sử đọc `GET /api/admin/community/events?targetId=` đã có (action `community:moderate`).

## Data

Không lưu gì. Mỗi danh sách vẫn gọi đúng một GET như trước; số đếm là độ dài các danh sách đó, báo lên thanh liên kết qua một React context nhỏ (`workspace.tsx`).

## How it works

- **Thứ tự và số đếm** là các hàm thuần trong `src/components/admin/community/workspace-model.ts`: `SECTION_ORDER`, `visibleSections(canRestrict)`, `splitTrips`, `splitReviews`, `reportCount`.
- **Số đếm** là số việc cần làm: chuyến chờ duyệt, đánh giá đang giữ (và đánh giá chờ duyệt khi còn dữ liệu cũ: đánh giá được đăng ngay khi gửi, ADR 0014 sửa đổi 2026-11-15, nên mục này và liên kết nhảy của nó bị ẩn khi không có), báo cáo **đang mở** (số biến mất khi bộ lọc báo cáo xem trạng thái khác), và mọi dòng của danh sách tác giả bị tắt. Chuyến và đánh giá đã xử lý vẫn nằm bên dưới danh sách chờ (`Đã xử lý`, `Các đánh giá khác`); không tính vào số đếm.
- **Bố cục** dùng chung qua `queue-parts.tsx`: `QueueSection`, `EmptyState`, `StatusBadge`, `ItemActions`. Tiêu đề thẻ là `h3` dưới `h2` của mục; trang chỉ có một `h1`.
- **Thứ tự bàn phím** = thứ tự DOM = thứ tự đọc: liên kết nhảy, rồi từng mục từ trên xuống; trong thẻ là nội dung, các nút hành động, cuối cùng là Lịch sử.
- **`canRestrict`** vẫn quyết định mục tác giả bị tắt và liên kết nav (cùng nút tắt tác giả sẵn có), đúng như trước.
- **Lịch sử** (`HistoryLink`) tải sự kiện của một chuyến hoặc đánh giá khi mở lần đầu: hành động, đổi trạng thái, người thực hiện, ngày, lý do của nhân viên (văn bản thuần). Báo cáo và hạn chế không có liên kết lịch sử: sự kiện không ghi theo id báo cáo, và hạn chế trên tài khoản được ghi theo id người dùng mà danh sách không lộ ra.

## Files

| Path | Role |
|---|---|
| `src/app/(admin)/[locale]/admin/community/page.tsx` | trang: header, nav, thứ tự mục cố định |
| `src/components/admin/community/workspace-model.ts` | hàm thuần: thứ tự, nhóm, số đếm |
| `src/components/admin/community/workspace.tsx` | context số đếm và thanh liên kết nhảy |
| `src/components/admin/community/queue-parts.tsx` | mục, trạng thái rỗng, nhãn, hàng hành động, lịch sử dùng chung |
| `listing-queue.tsx`, `review-queue.tsx`, `report-queue.tsx`, `restriction-list.tsx` | các danh sách (chỉ bố cục) |
| `messages/*.json` | `adminCommunity.workspace.*`, hai tiêu đề đổi tên |

## Tests

`tests/admin-moderation-workspace.test.ts` kiểm các hàm thuần (thứ tự, hiển thị gồm quy tắc đánh giá chờ duyệt cũ, nhóm, số đếm cộng đúng độ dài danh sách, quy tắc đếm báo cáo). Các suite `community-*` và `review-restrictions-routes` giữ nguyên. Chưa kiểm: render component (chưa có hạ tầng test component) và thử trên trình duyệt.

## Limits and open questions

Danh sách đánh giá vẫn giới hạn 200 dòng của API nên số đếm là của phần đang liệt kê. Số đếm tải sau danh sách nên thanh hiện chậm một chút. Không cần `/sec-check` (không lộ dữ liệu mới); nên chạy `/qc-check`.
