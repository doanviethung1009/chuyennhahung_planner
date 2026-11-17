# Bảng điều khiển — Chuyện Nhà Hưng

Roadmap: [`PHASES.md`](PHASES.md) · Tồn đọng: [`backlog.md`](backlog.md) · Deploy: [`DEPLOY-STATUS.md`](DEPLOY-STATUS.md)

Cập nhật: 2026-11-17, kiểm trên `main` @ `104278b` (CI `success`, Deploy dev `success`).

## Nguồn chính cho từng loại trạng thái
| Cần biết | Xem |
|---|---|
| Phase nào, tiến độ | `PHASES.md` (bảng Tổng quan, một dòng mỗi phase) |
| Đang làm gì, kế tiếp | file này |
| Việc tồn đọng theo ID | `backlog.md` |
| Đã deploy chưa | `DEPLOY-STATUS.md` |
| Một batch/task xong chưa | dòng `State:` đầu contract trong `.claude/contracts/` |
| Bằng chứng | PR, `.claude/contracts/handoff/`, `.claude/reports/` |

## Hiện tại
- **Phase đang làm:** Phase 10 — Community Foundations (gần đóng) + phần còn lại của Phase 07 (Admin workspace).
- **Batch hiện tại (Phase 10):** không có batch code nào đang chạy. 10.1–10.7 đã DONE (xem `.claude/contracts/phase10-index.md`).
- **Batch kế tiếp:** chưa có. **Batch 10.8 chưa được định nghĩa** (không có contract). Việc còn mở nằm ở `backlog.md` P10-17..21; chủ dự án quyết định gom thành 10.8 hay chuyển sang Phase 11.
- **Merge ngoài batch sau 10.7:** #137 (giới hạn review khách 10/giờ), #138 (tên place + badge `guest_limit` ở hàng đợi review).

## Đang chờ chủ dự án
- D5: text Terms (ảnh/video) + tăng `termsVersion`.
- D10: cấu hình proxy thật, log nginx còn IP thô.
- P10-7: sao lưu dev VM, `metadataBase`, HSTS.
- P11-D1: chính sách riêng tư (chặn Phase 11).
- Quyết định: có mở batch 10.8 hay không.

## Chưa chạy (NOT RUN)
- `/sec-check` đường ghi ẩn danh (report, limiter, guest key); `/qc-check` toàn Phase 10.
- Smoke cần đăng nhập: Terms gate, hàng đợi admin, audit events; khởi động lại app.

## Việc kế tiếp (ưu tiên)
1. Chủ dự án chốt 10.8 và các mục chờ ở trên.
2. Phase 07 còn lại: P07-12 users/roles, P07-13 audit viewer (chờ chặn), P07-14/15/17.
3. Phase 11 sau khi có chính sách riêng tư.

---

# Lịch sử — Phase 05 (đóng 2026-11-16)

> Giữ nguyên để tham chiếu; không còn là trạng thái hiện tại.

Roadmap đầy đủ: [`PHASES.md`](PHASES.md) · Tồn đọng: [`backlog.md`](backlog.md) ·
Deploy: [`DEPLOY-STATUS.md`](DEPLOY-STATUS.md)

- **Trạng thái:** **Done** — đóng 2026-11-16 (sec PASS_WITH_WARNINGS, qc PASS với gaps; không BLOCKED). Cảnh báo ở backlog P05-7..P05-11. Việc kế tiếp: mở Phase 07 (phần còn lại) / Phase 10 — cần ADR trước khi code.
- **Cập nhật:** 2026-11-16, kiểm trên `main` @ `e362aea`; chủ dự án chốt khuyến nghị Q1–Q12 của `.claude/contracts/community-platform-audit.md`.
- **Deploy:** chỉ dev VM (192.168.100.140, đến commit `0216f46` theo báo cáo 2026-11-15); chưa có production — xem `DEPLOY-STATUS.md`.
- **Phase kế tiếp:** **Phase 10 — Community Foundations** (P1), cùng phần còn thiếu của Phase 07
  (audit log). Điều kiện: Phase 05 đóng — chạy `/sec-check` + `/qc-check` (khuyến nghị Q4),
  hoặc chủ nhà chấp nhận rủi ro bằng văn bản. Phase 07 phần lớn đã có code (xem `PHASES.md`).
  Phase 10 cần ADR riêng trước khi code.

### Đã ship (có bằng chứng)

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

### Tiêu chí đóng Phase 05 (còn 2, 3)

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
   redirect. Trạng thái: ✅ **PASS_WITH_WARNINGS** (2026-11-16, đọc code tĩnh, chưa kiểm runtime). `npm audit --omit=dev`: 0 lỗ hổng. Cảnh báo: W1 `clientKey` tin hop XFF đầu (thấp-trung bình), W2 prune O(n) khi đầy key, W3 `shareToken` plaintext → backlog P05-7..P05-9.
3. **`/qc-check`** — phase XL. Trạng thái: ✅ **PASS với gaps** (2026-11-16). `typecheck` PASS, `lint` PASS, `test` PASS (62 file, 871 passed, 30 skipped — 2 suite Postgres); `build` NOT RUN. Gap: thiếu test render story/`/shared` limited/sitemap, nút 44px chưa kiểm từng cái → P05-10, P05-11.
4. **Test cho các bảo đảm độc lập của clone:** ✅ `tests/planner-clone-independence.test.ts`
   — trip không đổi khi template bị sửa/rút/xóa; không chia sẻ object (template đóng
   băng sâu, sửa tại chỗ hai chiều); purge trip không đụng template và vẫn clone lại được.
5. **Đồng bộ tài liệu đã cũ:** ✅ xong. `CLAUDE.md` quy tắc 6 sửa ở PR #24; contract đã
   ghi `State: IMPLEMENTED (merged PR #23)`; `.claude/rules/03` §6 sửa ở branch này.
   Còn lại: contract → `DONE` khi 2–3 xong hoặc được chủ nhà chấp nhận rủi ro (P05-5).

Khi 1–5 xong (hoặc chủ nhà chấp nhận rủi ro bằng văn bản cho mục 2–3), chuyển Phase 05
sang `Done` trong `PHASES.md` và mở Phase 07 ở file này.

### Ngoài phạm vi Phase 05 (không làm ở đây)

Gallery trip public; identity provider thật/đăng ký; Planner map; AI; SQL; nháp ẩn danh
phía server; editor lịch trình đầy đủ (thuộc Phase 04); `/plan-your-trip`; tour redirect.

### Việc đang song song ở nơi khác

- ADR 0006 và `tests/client-boundary.test.ts` đã merge (PR #25). Nhãn "Phase 06" cho
  Admin Portal đã đổi thành **Phase 07** ở ADR 0006, `docs/architecture.*` và addendum
  contract (branch này) — P07-R0 xong khi branch này merge.
- `chore/upgrade-vitest-5` đã merge (PR #22).

### Chuẩn bị mở Phase 07 (song song, không chờ 05 đóng)

- [x] P07-R0 — ADR 0006 đã commit, nhãn phase đã đổi.
- [ ] P07-D1 — **chủ nhà trả lời:** nhà cung cấp danh tính, ai là admin, MFA cho `admin`.
- [ ] P07-D2 — ADR 0006 → Accepted (sau 05 đóng + D1).
- [ ] D1 trong `DEPLOY-STATUS.md` — chủ nhà chọn nơi chạy (ảnh hưởng thời điểm cần SQL).

### Quyết định đã chốt 2026-11-16

Chủ dự án chốt khuyến nghị: Q1 giữ review hiện ngay (ADR 0014); Q2 Journal/Blog/Vlog duyệt trước, comment hiện ngay + report + hold; Q3 thứ tự Phase 10–15 và 10-S0; Q4 chạy sec/qc để đóng 05; Q5 xác nhận đáp án khuyến nghị ADR 0015; Q6 audit log trước, MFA hoãn; Q7 embed YouTube trước, chưa upload; Q8 chủ nhà xác nhận Terms/contact; Q9 chủ nhà cung cấp chính sách riêng tư; Q10 sửa sao lưu/`metadataBase`/HSTS trước UGC mới; Q11 đổi nhãn Stage 8/9; Q12 xác minh rate-limit store chung.

Các quyết định cần hành động bên ngoài (chủ nhà cấp dữ liệu, ADR, sửa `docs/`) chưa xong — xem backlog `P10-*`.
