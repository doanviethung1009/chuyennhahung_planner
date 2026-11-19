# Handoff — DEST-1 Thêm điểm đến chưa đi (2026-11-19)
Nhánh `feat/more-destinations` (cắt từ main 77578df). CHƯA commit/push/PR — chờ chủ dự án cho phép.
## Đã làm
- `Destination.firstVisited`/`visits` tùy chọn + `isVisited()`; thẻ, trang chi tiết, `/ban-do` (chấm rỗng), `pinRadius(undefined)`.
- 8 điểm đến chưa đi: ha-noi, quang-ninh, quang-binh, da-nang, quy-nhon, nha-trang, tp-ho-chi-minh, can-tho (chỉ mô tả khách quan, câu cuối nói rõ chưa đi).
- 8 cover SVG (generate-covers), 24 địa điểm mới (`src/content/travel/seed-places.ts`, đã nối vào `demoPlaces`); rating/personalNote = null.
- `npm run content:seed-places` (create-only, `--dry-run`) cho store có sẵn — CHƯA chạy lên VM/DB thật.
- Docs: `docs/features/more-destinations.*`, README, architecture (16 điểm đến), usage.
## Kiểm tra
typecheck PASS · lint PASS · test PASS (104 file, 1308 test) · build PASS. qc/security: NOT RUN (khuyến nghị /qc-check).
Trình duyệt VI+EN 375/768/1280: /kham-pha, /kham-pha/da-nang, /en/destinations/quang-ninh, /dia-diem/vinh-ha-long, /en/places/sun-world-ha-long, /ban-do — 1 h1, không tràn ngang. `/dia-diem` (danh sách) 404 vì thuộc PR #176 chưa merge.
## Chủ dự án cần làm
- Xác nhận giá vé/thời lượng/tọa độ (ước tính); điền rating, ghi chú sau khi đi.
- Sau khi merge, chạy `content:seed-places` trên store thật (dừng app trước; xem docs/usage).
- Nhãn bản đồ vùng Đà Nẵng/Huế/Hội An hơi chồng nhau (chưa xử lý).
- Không đụng file PR #176; có thể conflict nhẹ ở `messages/*.json` (khác key) và `docs/features/README*`.
