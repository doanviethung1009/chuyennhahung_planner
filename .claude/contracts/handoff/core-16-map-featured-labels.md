# Handoff CORE-16 — nhãn bản đồ chỉ cho điểm featured

- Trạng thái: mã xong, push lên PR #195, CHƯA merge. Nhánh `claude/competent-driscoll-4449cf` (trên origin/main sau #191/#194).
- Danh sách featured CUỐI (chủ dự án thu hẹp so với đề xuất 7 điểm vì nhãn quá dày ở 375px): chỉ `ha-noi` và `tp-ho-chi-minh`.
- Đã làm:
  - `Destination.featured?: boolean` và `Destination.labelSide?: 'left' | 'right' | 'top'` (`src/content/types.ts`); seed: Hà Nội `labelSide: 'top'`, TP.HCM `labelSide: 'right'` (`src/content/destinations.ts`).
  - `VietnamMap` (`full`): chỉ pin featured có nhãn cố định; còn lại `sr-only` + tooltip hover/focus (tên vẫn trong `<a>`). Phía nhãn = `labelSide` ghi đè, nếu không có thì `labelSide(x)` của #194. Hộp 44px giữ nguyên.
  - `src/lib/map.ts`: thêm 2 điểm bờ biển vịnh Bắc Bộ để chấm Quảng Ninh/Hạ Long không nằm ngoài biển.
  - `tests/map.test.ts`: tập featured đúng danh sách, chỉ featured có nhãn cố định (đúng phía), tooltip + tên trong anchor cho pin còn lại, `preview` không có nhãn cố định.
  - Docs: `docs/features/travel-map.md` + `.vi.md` (cùng cấu trúc tiêu đề).
- Không cần migration/validator/API: Destination là dữ liệu tĩnh, server chỉ đọc slug.
- Kiểm tra: typecheck PASS; lint PASS; test PASS (112 file, 1392 test, 95 skipped).
- Trình duyệt `/ban-do`: 375px và 768px — chỉ 2 nhãn cố định, 0 chồng, 0 pin <44px, không bị cắt; Tab lên pin không featured thì tooltip hiện. Chưa bấm thử chấm Quảng Ninh gần nhãn.
- Lưu ý: trên cảm ứng không có hover nên tên 14 điểm còn lại chỉ thấy ở trang điểm đến; nếu cần thì thêm danh sách bên dưới bản đồ (việc riêng).
- Chưa chạy: /qc-check, /sec-check (NOT RUN). Server preview đã dừng.
