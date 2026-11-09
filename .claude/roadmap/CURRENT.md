# Phase hiện tại — Phase 05: Story → Planner, My Trips & Sharing

Roadmap đầy đủ: [`PHASES.md`](PHASES.md) · Tồn đọng: [`backlog.md`](backlog.md) ·
Deploy: [`DEPLOY-STATUS.md`](DEPLOY-STATUS.md)

- **Trạng thái:** In progress.
- **Cập nhật:** 2026-11-09, kiểm trên `main` @ `124868e` (sau PR #27).
- **Deploy:** chưa có môi trường nào — xem `DEPLOY-STATUS.md` (D1–D6).
- **Phase kế tiếp:** **Phase 07 — Admin Portal, CMS & RBAC** (P1), rồi Phase 06 (P2).
  Lý do: quyết định của chủ dự án ngày 2026-11-09; xem quy tắc "07 trước 06" trong
  `PHASES.md`.

## Đã ship (có bằng chứng)

| Hạng mục | Bằng chứng |
|---|---|
| ADR 0005 Accepted | `docs/adr/0005-trip-sharing-and-story-cloning.md` |
| Story → template link + section "Lịch trình thực tế" | `src/content/stories.ts`, `src/app/[locale]/stories/[slug]/page.tsx` |
| `/trip-setup`, `/sign-in`, `/my-trips`, `/my-trips/[id]`, `/shared/[token]` | `src/app/[locale]/**`, `src/components/planner/*` |
| Duplicate, planningStatus, share/rotate/revoke, public read | `src/app/api/planner/[id]/**`, `src/app/api/shared/[token]` |
| Rate limiter, `rate_limited` 429 | `src/server/rate-limit.ts`, `tests/rate-limit.test.ts` |
| Open-redirect guard | `src/lib/return-to.ts`, `tests/return-to.test.ts` |
| Feature doc song ngữ | `docs/features/follow-hung-footsteps.md` + `.vi.md` |
| PR | #23, merge 2026-11-09 |
| Thu hồi share link khi archive; restore về private | PR #27 (`fix/revoke-share-on-archive`) |

Kiểm tra: xem PR của branch này (typecheck, lint, test chạy lại khi cập nhật).
CI trên `main` @ `124868e`: **success** (typecheck, lint, test, build).

## Tiêu chí đóng Phase 05 (còn 2, 3)

1. **Kiểm thủ công trên trình duyệt** — luồng ẩn danh → tùy chỉnh → lưu → đăng nhập →
   khôi phục nháp → lưu trip → share → mở link ở cửa sổ riêng tư; 375/768/1280px.
   Contract tiêu chí 16. Trạng thái: ✅ **đạt** — 2026-11-10, dev server local, tài khoản
   test. Story → `/tao-chuyen-di` → lưu ẩn danh → `/dang-nhap?returnTo=…` → đăng nhập →
   nháp được khôi phục → lưu → `/chuyen-di-cua-toi/[id]` (có ghi nguồn story) → bật
   "unlisted" → `/chia-se/[token]` mở không cookie: 200, `noindex`, `no-referrer`; token
   sai → 404. 375/768/1280px: một `<h1>`, không tràn ngang. **Tìm và sửa một lỗi:** ô
   ngân sách có `step={100000}` nên trình duyệt chặn gửi với giá trị mặc định 750000 —
   đổi thành `step={1}` (`src/components/planner/trip-setup-form.tsx`). Chưa kiểm: bản EN,
   cửa sổ riêng tư thật (dùng curl không cookie thay thế).
2. **`/sec-check`** — public read không xác thực, xử lý token, rate limiter, open
   redirect. Contract khuyến nghị "strongly". Trạng thái: **NOT RUN** (theo bằng chứng có).
3. **`/qc-check`** — phase XL. Trạng thái: **NOT RUN** (theo bằng chứng có).
4. **Test cho các bảo đảm độc lập của clone:** ✅ `tests/planner-clone-independence.test.ts`
   — trip không đổi khi template bị sửa/rút/xóa; không chia sẻ object (template đóng
   băng sâu, sửa tại chỗ hai chiều); purge trip không đụng template và vẫn clone lại được.
5. **Đồng bộ tài liệu đã cũ:** ✅ xong. `CLAUDE.md` quy tắc 6 sửa ở PR #24; contract đã
   ghi `State: IMPLEMENTED (merged PR #23)`; `.claude/rules/03` §6 sửa ở branch này.
   Còn lại: contract → `DONE` khi 2–3 xong hoặc được chủ nhà chấp nhận rủi ro (P05-5).

Khi 1–5 xong (hoặc chủ nhà chấp nhận rủi ro bằng văn bản cho mục 2–3), chuyển Phase 05
sang `Done` trong `PHASES.md` và mở Phase 07 ở file này.

## Ngoài phạm vi Phase 05 (không làm ở đây)

Gallery trip public; identity provider thật/đăng ký; Planner map; AI; SQL; nháp ẩn danh
phía server; editor lịch trình đầy đủ (thuộc Phase 04); `/plan-your-trip`; tour redirect.

## Việc đang song song ở nơi khác

- ADR 0006 và `tests/client-boundary.test.ts` đã merge (PR #25). Nhãn "Phase 06" cho
  Admin Portal đã đổi thành **Phase 07** ở ADR 0006, `docs/architecture.*` và addendum
  contract (branch này) — P07-R0 xong khi branch này merge.
- `chore/upgrade-vitest-5` đã merge (PR #22).

## Chuẩn bị mở Phase 07 (song song, không chờ 05 đóng)

- [x] P07-R0 — ADR 0006 đã commit, nhãn phase đã đổi.
- [ ] P07-D1 — **chủ nhà trả lời:** nhà cung cấp danh tính, ai là admin, MFA cho `admin`.
- [ ] P07-D2 — ADR 0006 → Accepted (sau 05 đóng + D1).
- [ ] D1 trong `DEPLOY-STATUS.md` — chủ nhà chọn nơi chạy (ảnh hưởng thời điểm cần SQL).
