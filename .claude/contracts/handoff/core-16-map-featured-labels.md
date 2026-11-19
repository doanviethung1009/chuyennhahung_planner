# Handoff CORE-16 — nhãn bản đồ chỉ cho điểm featured

- Trạng thái: mã xong, CHƯA commit/push/PR. Nhánh `claude/competent-driscoll-4449cf` (rebase trên origin/main 09ee8c3, sau #191/#194).
- Đã làm:
  - `Destination.featured?: boolean` (`src/content/types.ts`); seed 7 điểm đã duyệt: ha-noi, da-nang, tp-ho-chi-minh, sa-pa, ha-giang, da-lat, phu-quoc (`src/content/destinations.ts`).
  - `VietnamMap` (`full`): chỉ pin featured có nhãn cố định; còn lại `sr-only` + tooltip hover/focus (tên vẫn nằm trong `<a>`). Hộp 44px và `labelSide` của #194 giữ nguyên.
  - `tests/map.test.ts`: tập featured đúng danh sách, chỉ featured có nhãn cố định, tooltip + tên trong anchor cho pin còn lại, `preview` không có nhãn cố định.
  - Docs: `docs/features/travel-map.md` + `.vi.md` (cùng cấu trúc tiêu đề).
- Không cần migration/validator/API: Destination là dữ liệu tĩnh, server chỉ đọc slug.
- Kiểm tra: typecheck PASS; lint PASS; test PASS (112 file, 1392 test, 95 skipped).
- Đo trình duyệt `/map`: 768px — 0 nhãn chồng, 0 pin <44px, không nhãn bị cắt. 375px — 0 pin <44px, không bị cắt, nhưng CÒN 2 cặp nhãn cố định chồng nhau:
  - Hà Giang / Sa Pa (cách ~44px, nhãn Sa Pa đè pin Hà Giang)
  - Phú Quốc / TP. Hồ Chí Minh
  Cụm Hà Nội/Ninh Bình/Hạ Long và Huế/Hội An/Đà Nẵng đã hết chồng.
- Focus bàn phím (Tab) lên pin Ninh Bình (không featured): `:focus-visible` đúng, tooltip opacity 1.
- ĐÃ XỬ LÝ 2 cặp chồng (chủ dự án chọn "sửa nhãn trước"): thêm `Destination.labelSide?: 'left' | 'right'` ghi đè phía nhãn; đặt Sa Pa → trái, Phú Quốc → trái, TP.HCM → phải (mặc định vẫn `labelSide(x)` của #194). Đo lại: 375px và 768px đều 0 nhãn chồng, 0 pin <44px, không bị cắt; typecheck/lint/test vẫn PASS (1392 test).
- Còn lại (nhỏ): ở 375px nhãn "Hà Nội" nằm trên chấm Quảng Ninh; hộp Quảng Ninh nằm sau trong DOM nên vẫn bấm được, chưa kiểm tra bằng thao tác bấm thật.
- Chưa chạy: /qc-check, /sec-check (NOT RUN). Server preview đã dừng.
