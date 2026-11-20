# Handoff — PLACES-UI-S6 (WEB-1) `/places` list with search and filter
- Nhánh: `claude/places-list-8f03f7` (đích `feat/places-list` khi có phép commit) · PR: chưa mở (chưa được phép commit/push).
- Xong: BE — `q` tùy chọn cho `GET /api/travel/places` (`listQuerySchema`, `parseListQuery`, `listPlaces`), helper dùng chung `src/lib/fold.ts` (`slugify` tái dùng), `searchPublicPlaces`. FE — `/places` (`/dia-diem`) trong routing + sitemap, form GET, lọc điểm đến/danh mục, phân trang `<a>` giữ `q`, trạng thái rỗng, noindex+canonical, i18n VI/EN. Docs: places(+vi), travel-content-api(+vi), architecture(+vi), ADR 0026 bổ sung (+vi).
- Liên kết vào: link "Xem tất cả địa điểm" ở trang `/destinations` và `nav.places` trong cột "Khám phá" của footer (site-footer có sẵn); không tạo component điều hướng mới.
- Ngoài kế hoạch: `.claude/contracts/handoff/` file này; `npm ci` trong worktree (thiếu @testing-library).
- Lưu ý: `q` cũng có hiệu lực ở `GET /api/admin/travel/places` (dùng chung `listPlaces`); stories/reviews/... bỏ qua `q`. Hình dạng JSON không đổi.
- Kiểm tra: typecheck PASS · lint PASS · test PASS (105 file, 1318 test) · build PASS · trình duyệt 375/768/1280, VI+EN: "da lat" và "Đà Lạt" cùng 3 kết quả, lọc giữ q, trạng thái rỗng, `<b>` bị escape, một h1, đích bấm ≥44px, không tràn ngang — PASS. Phân trang chưa thấy trên UI (catalogue 6 địa điểm < 24), chỉ có test thuần: NOT RUN trên trình duyệt. Thứ tự bàn phím: kiểm theo thứ tự DOM (q → điểm đến → loại → Tìm → Xóa → thẻ), chưa bấm Tab thực.
- Catalogue hiện 6 địa điểm seed; quét chuỗi con trong bộ nhớ ổn đến vài nghìn, quá đó nên tìm phía store.
- `/qc-check`: NOT RUN (khuyến nghị) · `/sec-check`: NOT RUN (khuyến nghị — input trên endpoint công khai).
- Rủi ro: thấp; rollback = revert PR. Mở: chờ chủ dự án cho phép commit (2 commit theo vai: backend, frontend+docs), push, mở PR.
