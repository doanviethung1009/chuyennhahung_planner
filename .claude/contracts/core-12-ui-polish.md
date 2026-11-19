# Task Contract: CORE-12 Trải nghiệm & a11y còn lại của CORE-8 (S-5, P-1, P-2, P-5)
- Class: **M/L** (chạm header/chân trang dùng chung, `messages/*.json`). Branch đề xuất: `fix/core-ui-polish` cắt từ `origin/main` @ `d154d96`. Single agent (vai frontend). **State: IMPLEMENTED, chờ review/PR (P-2 chọn C: giữ 401, ghi tài liệu)** Không chạy song song với CORE-11 nếu cả hai sửa `messages/*.json` (khác khóa, nhưng gộp theo thứ tự).
- Nguồn: báo cáo CORE-8 mục 7.

## Bằng chứng
- **S-5** CLAUDE.md quy tắc 5 (≥44px): logo 149×28, nút ngôn ngữ 38×36, ~15 phần tử chân trang < 44px ở 375; nút ↑↓ của editor 42×44 (`src/components/planner/trip-editor`). Vị trí: `src/components/layout/main-nav.tsx`, `locale-switcher.tsx`, footer.
- **P-1** `src/app/(admin)/[locale]/admin/page.tsx:59-60` dùng `tc('body')` (`messages/vi.json:702`) nói "Với vai trò biên tập viên…" cho mọi vai trò.
- **P-2** `src/components/layout/account-menu.tsx:34` `GET /api/planner/session` → 401 ghi lỗi console ở mọi trang công khai khi khách.
- **P-5** `locale-switcher.tsx` sinh liên kết `/vi/...` rồi 307 về URL không tiền tố.

## Thiết kế đề xuất
1. **S-5:** vùng bấm ≥44×44 (padding/`min-h-11 min-w-11`, không đổi kích thước hình logo); nút ↑↓ 44×44; chân trang tăng khoảng cách/`min-h-11` cho liên kết. Dùng token sẵn có, không thêm token mới.
2. **P-1:** lời chào theo vai trò (khóa i18n `body` tách theo `editor` / `admin` / `super_admin`), VI + EN đủ.
3. **P-2:** giữ 401 là "khách" nhưng tránh lỗi console: lựa chọn A — cờ cookie không-HttpOnly báo "có phiên" (đổi ADR 0004: **không khuyến nghị**); B — endpoint nhẹ trả `200 {user:null}` cho khách (đổi hợp đồng `/api/planner/session`: cần xem client khác dùng 401); C — chấp nhận và ghi chú tài liệu. Khuyến nghị **B nếu không client nào dựa vào 401**, nếu không C. Xin duyệt.
4. **P-5:** dùng `Link` của next-intl với `locale` (không chèn `/vi`) để VI giữ URL không tiền tố, bỏ một lần 307.
5. Test: jsdom/Testing Library (CORE-6) cho locale-switcher, lời chào theo vai trò; kiểm tra kích thước đo trong trình duyệt ở 375/768/1280 (ghi kết quả). Docs: `docs/usage.*`/`architecture.*` nếu P-2 đổi hợp đồng; VI+EN cùng cấu trúc tiêu đề.

## Scope OUT
Redesign, token mới, trang mới, Playwright (WEB-3).

## Câu hỏi mở
P-2: chọn B hay C? (Tôi sẽ `grep` client dùng 401 trước khi code.)

## Kiểm tra / Done
typecheck, lint, test PASS kèm output; đo kích thước ở 375 bằng trình duyệt (NOT RUN nếu không khởi động được). Handoff ≤25 dòng `.claude/contracts/handoff/core-12-ui-polish.md`.
