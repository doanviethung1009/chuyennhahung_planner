# Checklist trạng thái deploy theo phase

Roadmap: [`PHASES.md`](PHASES.md) · Phase hiện tại: [`CURRENT.md`](CURRENT.md) ·
Tồn đọng: [`backlog.md`](backlog.md)

Cập nhật: 2026-11-16, kiểm trên `main` @ `e362aea`; bằng chứng deploy lấy từ `.claude/reports/deploy-test-2026-11-15.md` (dev VM, commit `0216f46`, **trước** PR #93–#105).

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

## Dev VM (2026-11-15) — không phải production

`.github/workflows/deploy-dev.yml`, `Dockerfile`, `deploy/**` có; 5 run Deploy dev `success`; rollback và deploy lại chạy thật; `/api/health` 200; smoke 11 route 200; Planner qua API và dữ liệu Postgres bền qua deploy. **FAIL:** chưa có cron sao lưu. **NR:** đăng nhập admin trên trình duyệt, `backup.sh`/khôi phục, smoke `/community-trips` và `/reviews`, kiểm migration 0005–0009 từng cái. Cảnh báo: `metadataBase` chưa đặt; HSTS trên HTTP. G7 = một phần (dev, không phải staging chính thức); G8 vẫn ❌.

**DEV Risk Accepted (chủ dự án, 2026-11-18, P10-7 → P09-6):** trên dev VM chấp nhận mất dữ liệu thử nghiệm, không bắt buộc sao lưu tự động, không cần `metadataBase` production, không cần HSTS trên HTTP/IP nội bộ. Đây là chấp nhận rủi ro, **không phải PASS**: D4 và các cảnh báo trên vẫn **bắt buộc trước G8 production**.

## Chặn deploy production

Dòng cũ ("chưa có môi trường deploy, không Dockerfile/workflow") đã **lỗi thời** từ 2026-11-11; môi trường dev tồn tại, production thì chưa. CI chỉ kiểm; deploy dev tự động theo ADR 0016. Trước khi bất kỳ phase nào lên G7/G8:

- [ ] **D1 — Chủ nhà chọn nơi chạy.** Planner và content store ghi file JSON
  (`src/server/persistence/json-store.ts`) và rate limiter nằm trong bộ nhớ một process:
  cần **một instance với ổ đĩa bền**. Serverless không có ổ bền (ví dụ Vercel) sẽ mất dữ
  liệu trip — chỉ dùng được sau SQL (P09-1).
- [ ] **D2 — Biến môi trường.** `NEXT_PUBLIC_SITE_URL`, `ADMIN_API_TOKEN` (secret, không
  commit), `PLANNER_STORE`, `TRAVEL_CONTENT_STORE`, `TRAVEL_CONTENT_AUTOSEED`. Đường dẫn
  store phải trỏ vào volume bền.
- [ ] **D3 — Proxy tin cậy.** Rate limiter đọc `x-forwarded-for`; proxy phía trước phải
  ghi đè header này (`docs/architecture.md` → rủi ro rate limiter).
  Cấu hình mẫu: `deploy/nginx-app.conf` (ghi đè `X-Forwarded-For`, đặt
  `X-Forwarded-Proto`); chủ nhà còn phải gộp vào nginx trên VM.
- [ ] **D4 — Sao lưu và rollback** (bắt buộc cho production; dev: Risk Accepted 2026-11-18, P09-6). Lịch sao lưu file store; rollback = deploy lại commit
  trước + khôi phục bản sao lưu store.
- [ ] **D5 — Dữ liệu thật của chủ nhà** (P09-3) trước production: handle, số điện thoại,
  email đặt tour.
- [ ] **D6 — Workflow deploy** qua PR riêng; không deploy tay ngoài quy trình
  (CLAUDE.md: không deploy khi chưa được chủ nhà cho phép).
  Đang làm (PR `feat/self-hosted-docker-deploy`): `Dockerfile` (target `runner` +
  `tools`), `deploy/compose.app.yml` (một replica, volume `.data/`, mạng `edge` +
  `backend`), `GET /api/health`. Chưa build image (máy dev không có Docker — NOT RUN),
  chưa deploy lên VM.
  Bổ sung (PR `claude/docker-deploy-docs-149845`): `deploy/compose.yml` (nginx + postgres tuỳ chọn), `compose.app.bind.yml` (bind mount), `.env.example`, `scripts/setup-host.sh`, `scripts/backup.sh`; runbook ở `docs/features/docker-deploy.vi.md`. Vẫn NOT RUN: `docker compose config`, build, deploy thật.

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
