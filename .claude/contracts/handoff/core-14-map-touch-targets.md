# Handoff CORE-14 — vùng bấm ≥44px cho pin bản đồ
Nhánh: `claude/fix-map-touch-targets-87ddce` (từ origin/main 855e5d3). Chưa commit/push/PR.

## Đã làm
- `src/components/map/vietnam-map.tsx`: thẻ `<a>` của mỗi pin là hộp cố định `size-11` (44×44), chấm nằm đúng tọa độ chiếu; nhãn là phần tử con tuyệt đối (vẫn bấm được, không làm rộng hộp). Pin ở nửa phải lật nhãn sang trái để không tràn khung.
- `src/lib/map.ts`: thêm `MAP_TARGET_PX = 44`.
- `tests/map.test.ts`: 2 test mới (hằng số ≥44; anchor là `size-11`, không có `href="#"`).
- Thực tế SVG không có thẻ `<a>`: pin là `<Link>` HTML phủ lên SVG; không sửa SVG.

## Kiểm chứng
- typecheck PASS; lint PASS (không cảnh báo); test PASS: 111 file, 1379 test (4 file/95 test skip có sẵn).
- Trình duyệt: `/ban-do` ở 375 và 768, trang chủ ở 375 và 768: 16 pin, cạnh nhỏ nhất đúng 44px, không tràn ngang (scrollWidth = viewport; 768 ở mức 753 vì thanh cuộn).
- 1280: CHƯA ĐO (viewport desktop của pane vẫn báo 375). Hộp cố định 44px nên không phụ thuộc viewport, nhưng chưa xác nhận bằng số đo.
- Server preview đã dừng. qc / sec-check: NOT RUN.

## Còn lại / cần chủ dự án quyết
- 12 cặp hộp 44px chồng nhau ở 375 (cụm Hà Nội–Ninh Bình–Hạ Long, Huế–Hội An–Đà Nẵng…); nhãn cũng chồng nhau như trước đây. Giải pháp (gom pin / danh sách thay thế) cần quyết riêng.
- Chấm nhích về tọa độ thật (trước đó lệch khoảng nửa chiều rộng nhãn).
- Không chạm docs; chưa kiểm tra docs có nhắc vùng bấm cũ (grep nếu muốn chắc).
