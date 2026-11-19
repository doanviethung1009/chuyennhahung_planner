# Handoff CORE-12 — giao diện & a11y (S-5, P-1, P-2, P-5)
- Làm trong cùng worktree/nhánh `claude/stoic-cray-c659d3` với CORE-11 (chủ dự án yêu cầu làm tiếp ở đây). **Chưa commit/push/PR.** Khi commit nên tách hai PR: CORE-11 (server/docs/tests bảo mật) và CORE-12 (danh sách file dưới).
## Đã làm
- P-5: `locale-switcher.tsx` dùng `getPathname` + `next/link` → VI không còn `/vi/...` (đo thực tế: href `/` và `/en`). Lý do: `Link locale=` của next-intl luôn viết tiền tố.
- S-5: logo `min-h-11` (`site-header.tsx`); nút ngôn ngữ `min-h-11 min-w-11`; liên kết chân trang `min-h-11` (`site-footer.tsx`); `rowButton` ở `day-card.tsx` (↑↓) và `expenses-panel.tsx` `min-h-11 min-w-11`.
- P-1: `admin/page.tsx` chọn `bodyEditor` / `bodyAdmin` / `bodySuperAdmin` (theo `canRunbook`, `canUsers`); thay khóa `body` ở `messages/vi.json` + `en.json`.
- P-2: **chọn C** (không đổi code): nhiều thành phần (`place-review-section`, `place-add-to-trip`, `change-password-form`) dùng 401 làm tín hiệu "khách", cookie là HttpOnly nên không đoán trước được → không thể bỏ 401 (phương án B phá hợp đồng). Ghi chú trong `docs/architecture.md` + `.vi.md`.
- Test mới `tests/dom/locale-switcher.test.tsx` (3 ca).
## Kiểm tra (đã chạy)
- typecheck PASS; lint PASS; `npm run test` PASS: 111 file pass, 4 skipped; 1369 pass, 95 skipped (gộp cả CORE-11).
- Đo trình duyệt ở 375 (trang chủ, VI): header/chân trang/nút ngôn ngữ ≥44px. Còn dưới 44px: nhãn các điểm trên bản đồ (SVG), liên kết email nằm trong câu (inline, được miễn), skip-link ẩn. 768/1280, EN, editor (↑↓) và dashboard admin: NOT RUN trong trình duyệt (có test/typecheck).
- `/qc-check`, `/sec-check`: NOT RUN.
## Follow-up
- Nhãn bản đồ <44px (`src/lib/map.ts`) nếu muốn đạt quy tắc 5 đầy đủ.
