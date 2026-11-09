# Checklist trạng thái deploy theo phase

Roadmap: [`PHASES.md`](PHASES.md) · Phase hiện tại: [`CURRENT.md`](CURRENT.md) ·
Tồn đọng: [`backlog.md`](backlog.md)

Cập nhật: 2026-11-09, kiểm trên `main` @ `124868e` (sau PR #27).

Một phase chỉ được ghi **Deployed** khi mọi cổng bắt buộc của nó có bằng chứng. Ô nào
không có bằng chứng trong repo, GitHub hoặc lời xác nhận của chủ nhà thì ghi
**NOT RUN** — không đoán, không ghi PASS thay (CLAUDE.md quy tắc 7).

## Các cổng

| Cổng | Ý nghĩa | Bằng chứng chấp nhận |
|---|---|---|
| G1 Merge | Mọi PR của phase đã merge vào `main` | PR ở trạng thái MERGED |
| G2 CI `main` | Workflow `CI` (typecheck, lint, test, build) xanh trên commit merge | `gh run list --branch main` |
| G3 Docs | Tài liệu song ngữ + feature doc + ADR; `tests/docs.test.ts` pass | file trong `docs/`, CI xanh |
| G4 Kiểm tay | Luồng chính chạy trên trình duyệt, 375/768/1280px | ảnh chụp / ghi chép trong PR |
| G5 `/qc-check` | Bắt buộc với phase L/XL | verdict PASS của agent `qc` |
| G6 `/sec-check` | Bắt buộc khi chạm ranh giới tin cậy (auth, token, public read) | verdict PASS / PASS_WITH_WARNINGS |
| G7 Staging | Chạy trên môi trường thử, env đủ, smoke test pass | URL + ngày + commit |
| G8 Production | Phát hành thật, có kế hoạch rollback | URL + ngày + commit |

Ký hiệu: ✅ có bằng chứng · ❌ chưa đạt · ⏳ NOT RUN · — không áp dụng.

## Bảng trạng thái

| Phase | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | Deploy |
|---|---|---|---|---|---|---|---|---|---|
| 00 Architecture Audit | ✅ #8, #24 | ✅ | ✅ | — | — | — | — | — | Không cần (quy trình) |
| 01 Branding & UX | ✅ #1, #3 | ✅ | ✅ | ⏳ | ⏳ | — | ⏳ | ⏳ | **Chưa deploy** |
| 02 Travel Content System | ✅ | ✅ | ✅ ADR 0001 | — | ⏳ | ⏳ | ⏳ | ⏳ | **Chưa deploy** |
| 03 Travel Planner Core | ✅ #11, #13, #20 | ✅ | ✅ ADR 0002, 0004 | — | ⏳ | ⏳ | ⏳ | ⏳ | **Chưa deploy** |
| 04 Interactive Planner UI | ❌ Partial | — | — | ⏳ | ⏳ | — | ⏳ | ⏳ | Chưa xong code |
| 05 Story → Planner (hiện tại) | ✅ #23, #27 | ✅ | ✅ ADR 0005 | ✅ 2026-11-10 (local) | ⏳ | ⏳ | ⏳ | ⏳ | **Chưa deploy** |
| 07 Admin Portal, CMS & RBAC | ❌ chỉ có ADR 0006 (#25) | — | ⏳ ADR Proposed | — | — | — | — | — | Chưa bắt đầu |
| 06 AI, Affiliate & Optimization | ❌ | — | — | — | — | — | — | — | Chưa bắt đầu |
| 08 Media & Analytics | ❌ | — | — | — | — | — | — | — | Chưa bắt đầu |
| 09 Production Readiness & Launch | ❌ | — | — | — | — | — | — | — | Chưa bắt đầu |

Ghi chú G2: lần chạy `CI` gần nhất trên `main` đều `success` (#27, #25, #26, #24, #23,
…); lần merge #12 và #13 bị `cancelled` vì #13 merge chồng lên, commit sau đó xanh.

## Chặn deploy (toàn hệ thống)

Hiện **chưa có môi trường deploy nào**: không có `vercel.json`, `Dockerfile` hay
workflow deploy; GitHub Deployments API của repo trả về 0 bản ghi. CI chỉ kiểm, không
phát hành. Trước khi bất kỳ phase nào lên G7/G8:

- [ ] **D1 — Chủ nhà chọn nơi chạy.** Planner và content store ghi file JSON
  (`src/server/persistence/json-store.ts`) và rate limiter nằm trong bộ nhớ một process:
  cần **một instance với ổ đĩa bền**. Serverless không có ổ bền (ví dụ Vercel) sẽ mất dữ
  liệu trip — chỉ dùng được sau SQL (P09-1).
- [ ] **D2 — Biến môi trường.** `NEXT_PUBLIC_SITE_URL`, `ADMIN_API_TOKEN` (secret, không
  commit), `PLANNER_STORE`, `TRAVEL_CONTENT_STORE`, `TRAVEL_CONTENT_AUTOSEED`. Đường dẫn
  store phải trỏ vào volume bền.
- [ ] **D3 — Proxy tin cậy.** Rate limiter đọc `x-forwarded-for`; proxy phía trước phải
  ghi đè header này (`docs/architecture.md` → rủi ro rate limiter).
- [ ] **D4 — Sao lưu và rollback.** Lịch sao lưu file store; rollback = deploy lại commit
  trước + khôi phục bản sao lưu store.
- [ ] **D5 — Dữ liệu thật của chủ nhà** (P09-3) trước production: handle, số điện thoại,
  email đặt tour.
- [ ] **D6 — Workflow deploy** qua PR riêng; không deploy tay ngoài quy trình
  (CLAUDE.md: không deploy khi chưa được chủ nhà cho phép).

## Checklist deploy cho một phase

Chép vào PR phát hành của phase:

- [ ] G1 — liệt kê PR đã merge
- [ ] G2 — link lần chạy `CI` xanh trên commit sẽ deploy
- [ ] G3 — docs/ADR/feature doc song ngữ đã cập nhật
- [ ] G4 — kiểm tay 375/768/1280px, đính kèm ảnh
- [ ] G5 — `/qc-check` (nếu L/XL) — verdict
- [ ] G6 — `/sec-check` (nếu chạm auth/token/public) — verdict
- [ ] D1–D4 đã thỏa cho môi trường đích
- [ ] G7 — staging: URL, commit, smoke test (trang chủ VI/EN, `/stories`, đăng nhập,
  tạo trip, share, mở link riêng tư)
- [ ] G8 — production: URL, commit, ngày, người duyệt; cập nhật bảng trên
