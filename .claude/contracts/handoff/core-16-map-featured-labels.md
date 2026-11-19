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
- Cần chủ dự án quyết (dữ liệu của chủ, quy tắc 8): (a) bỏ Hà Giang và Phú Quốc khỏi featured; hoặc (b) cho phép ghi đè phía nhãn theo pin (Sa Pa → trái, Phú Quốc → trái, TP.HCM → phải), đổi hợp đồng `labelSide` của #194.
- Chưa chạy: /qc-check, /sec-check (NOT RUN). Server preview đã dừng.
