# Phase hiện tại — Phase 07: Admin Portal, CMS & RBAC

Roadmap đầy đủ: [`PHASES.md`](PHASES.md) · Tồn đọng: [`backlog.md`](backlog.md) ·
Deploy: [`DEPLOY-STATUS.md`](DEPLOY-STATUS.md)

- **Trạng thái:** **Blocked — chờ quyết định của chủ nhà** (P07-D1). Chưa code gì.
- **Cập nhật:** 2026-11-10, branch `test/clone-independence-guarantees` (PR #29).
- **Phase trước:** Phase 05 — **Done** 2026-11-10 (xem bên dưới).
- **Phase sau:** Phase 06 (P2). Theo quy tắc "07 trước 06" trong `PHASES.md`: khi 07 bị
  chặn, đội làm phần 04/06 không phụ thuộc 07 (P04-1 editor, P06-5 Optimization).
- **Deploy:** chưa có môi trường nào — xem `DEPLOY-STATUS.md` (D1–D6).

## Điều kiện mở Phase 07

- [x] Phase 05 đóng.
- [x] P07-R0 — ADR 0006 đã commit (PR #25), nhãn phase đã đổi (PR #28).
- [ ] **P07-D1 — chủ nhà trả lời:**
  1. Nhà cung cấp danh tính: giữ token do operator cấp + session (ADR 0004), hay
     Auth.js / dịch vụ hosted?
  2. Ai là admin: chỉ chủ nhà, hay một nhóm?
  3. Có bắt buộc MFA cho `admin` không?
- [ ] P07-D2 — ADR 0006 → Accepted (sau D1), rồi Task Contract cho backend (module
  identity, `can`, audit store) trước mọi UI portal.
- [ ] D1 trong `DEPLOY-STATUS.md` — chủ nhà chọn nơi chạy (quyết định khi nào cần SQL,
  P09-1; admin portal tạo người ghi thứ hai vào store JSON).

Thứ tự làm sau khi mở: `backlog.md` → Phase 07 (P07-1 … P07-9).

## Việc làm được trong lúc chờ (không phụ thuộc 07)

- P04-1 — editor ngày/hoạt động/chi phí trong `/my-trips/[id]` (frontend-engineer).
- P06-5 — Optimization: hiệu năng, SEO, ngân sách bundle (frontend-engineer).
- P05-W1 — sửa khóa rate limiter (cảnh báo security, xem dưới) — nên làm trước deploy.

## Phase 05 đã đóng — bằng chứng

| Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|
| 1. Kiểm tay trên trình duyệt | ✅ | 2026-11-10, dev local: luồng story → setup → lưu ẩn danh → đăng nhập (`returnTo`) → khôi phục nháp → lưu → chi tiết → share → mở link không cookie (200, `noindex`, `no-referrer`; token sai 404); 375/768/1280px. Tìm và sửa lỗi `step` ô ngân sách. Chưa kiểm: bản EN. |
| 2. `/sec-check` | ✅ **PASS_WITH_WARNINGS** | 2026-11-10, agent `security`, phạm vi PR #23 + #27 + #29. Không có blocker. |
| 3. `/qc-check` | ✅ **PASS** | 2026-11-10, agent `qc`: typecheck, lint, test 26 file / 403 test pass; VI/EN khớp khóa; không có `href="#"`. |
| 4. Test độc lập clone | ✅ | `tests/planner-clone-independence.test.ts` (PR #29) |
| 5. Đồng bộ tài liệu | ✅ | PR #24, #28; contract `State: DONE` |
| Contract tiêu chí 17 (`build`) | ✅ | `npm run build` 2026-11-10: compiled, 61 trang |

### Cảnh báo còn mở từ `/sec-check` (không chặn đóng phase, chặn deploy)

- **P05-W1 (LOW):** khóa rate limiter lấy hop đầu của `x-forwarded-for`, rồi
  `x-real-ip`, rồi `'unknown'` (`src/server/rate-limit.ts:93-102`). Client có thể đổi
  header để né giới hạn 10/phút đăng nhập và 60/phút đọc share; không có proxy tin cậy
  thì mọi người chung một bucket `'unknown'` → một client ồn có thể khóa người khác.
  Đoán token vẫn bất khả thi (token truy cập 48 byte, share token 32 byte). Sửa trước
  deploy — gắn với D3 trong `DEPLOY-STATUS.md`.
- **INFO:** share token lưu dạng rõ trong store (owner cần xem lại link) — giữ `.data/`
  ngoài các bản sao lưu rời khỏi máy chủ (D4).
