# Phase hiện tại — Phase 05: Story → Planner, My Trips & Sharing

Roadmap đầy đủ: [`PHASES.md`](PHASES.md) · Tồn đọng: [`backlog.md`](backlog.md)

- **Trạng thái:** In progress.
- **Cập nhật:** 2026-11-09, kiểm trên `main` @ `3d42707`.
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

Kiểm tra chạy lúc cập nhật: `npm run test` → 24 file, 386 test **pass**.
`typecheck`, `lint`, `build`: **NOT RUN** trong lần cập nhật roadmap này (chỉ đổi tài liệu).

## Tiêu chí đóng Phase 05 (chưa đạt)

1. **Kiểm thủ công trên trình duyệt** — luồng ẩn danh → tùy chỉnh → lưu → đăng nhập →
   khôi phục nháp → lưu trip → share → mở link ở cửa sổ riêng tư; 375/768/1280px.
   Contract tiêu chí 16. Trạng thái: **NOT RUN** (không có bằng chứng trong repo).
2. **`/sec-check`** — public read không xác thực, xử lý token, rate limiter, open
   redirect. Contract khuyến nghị "strongly". Trạng thái: **NOT RUN** (theo bằng chứng có).
3. **`/qc-check`** — phase XL. Trạng thái: **NOT RUN** (theo bằng chứng có).
4. **Test cho các bảo đảm độc lập của clone** (nêu trong addendum chưa commit của
   contract): trip đã clone không đổi khi template bị sửa/rút; không chia sẻ object
   giữa template và clone; purge trip không đụng template.
5. **Đồng bộ tài liệu đã cũ:** `.claude/contracts/follow-hung-footsteps.md` vẫn ghi
   `State: DESIGNED`; `CLAUDE.md` quy tắc 6 và `.claude/rules/03-project-chuyen-nha-hung.md`
   §6 vẫn ghi Planner UI "has not started" trong khi `docs/architecture.md` ghi "partly
   opened by ADR 0005".

Khi 1–5 xong (hoặc chủ nhà chấp nhận rủi ro bằng văn bản cho mục 2–3), chuyển Phase 05
sang `Done` trong `PHASES.md` và mở Phase 07 ở file này.

## Ngoài phạm vi Phase 05 (không làm ở đây)

Gallery trip public; identity provider thật/đăng ký; Planner map; AI; SQL; nháp ẩn danh
phía server; editor lịch trình đầy đủ (thuộc Phase 04); `/plan-your-trip`; tour redirect.

## Việc đang song song ở nơi khác

- Worktree `prompt-05-planner-trips-sharing-7d932b`, branch
  `docs/adr-unified-identity-roles`: **chưa commit** — ADR 0006 (Proposed),
  `tests/client-boundary.test.ts`, mục Phases trong `docs/architecture.*`, addendum của
  contract. Dùng nhãn cũ "Phase 06" cho Admin Portal → cần đổi thành Phase 07.
- Branch `chore/upgrade-vitest-5`: chưa merge (nâng Vitest 3 → 5, gỡ 2 advisory critical).
