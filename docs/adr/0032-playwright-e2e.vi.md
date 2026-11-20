# ADR 0032 — Smoke test end-to-end bằng Playwright

🇬🇧 English version: [0032-playwright-e2e.md](0032-playwright-e2e.md)

- **Status:** Accepted
- **Date:** 2026-11-21
- **Owner:** system-architect
- **Affects:** `playwright.config.ts`, `e2e/**`, `tests/e2e-guard.test.ts`, `package.json` (`@playwright/test`, script `e2e`), `.github/workflows/e2e.yml`, `.gitignore`, `eslint.config.mjs`, `docs/usage.*`, `docs/architecture.*`. Task Contract `web-3-playwright-e2e`. Dựa trên [ADR 0027](0027-component-test-stack.vi.md) ("Playwright dành cho end-to-end").

## Context

Các luồng lõi (chuyến đi từ template, chia sẻ, review, kiểm duyệt cộng đồng, admin, đăng nhập, bản đồ thành viên) đã được kiểm bằng tay ở CORE-8 (`.claude/reports/core-8-smoke-2026-11-19.md`). Một lỗi hồi quy ở bất kỳ luồng nào phải chờ lần smoke tay sau mới thấy. Test đơn vị và component (Vitest, jsdom — ADR 0027) không nhìn được routing, cookie, kiểm tra same-origin, header phản hồi hay hai trình duyệt cùng sửa một bản ghi.

Chủ dự án chốt (quyết định 9, 2026-11-18): Playwright là PR riêng; E2E không bao giờ dùng database production hay dev VM; chạy trên kho dữ liệu dùng một lần do chính lần chạy seed.

## Decision

1. **`@playwright/test` 1.64.1** (ghim đúng phiên bản, phát hành 2026-10-14) làm dev dependency; cấu hình ở `playwright.config.ts`; spec ở `e2e/` (không để trong `tests/`, nên Vitest giữ `include: tests/**`); lệnh `npm run e2e`.
2. **Bản build production là server được kiểm**, chạy giống Dockerfile: vì `output: standalone`, `e2e/support/serve.mjs` chép `.next/static` và `public` vào `.next/standalone` rồi chạy `server.js`. Server nghe `HOSTNAME=localhost` trên cổng trống; base URL là `http://localhost:<port>`. (`next start` không được hỗ trợ với `standalone`, và bind `127.0.0.1` khiến Next coi rewrite của next-intl cho `/` là bên ngoài rồi redirect lặp mọi URL tiếng Việt không tiền tố.)
3. **Kho dữ liệu dùng một lần mỗi lần chạy:** `PLANNER_STORE` và `TRAVEL_CONTENT_STORE` trỏ vào `.data/e2e/<run-id>/` (git bỏ qua, `global-teardown.ts` xóa). Kho nội dung tự seed story, place, template mẫu ở lần dùng đầu; không seed gì thêm. `PLANNER_DATABASE_URL`, `CONTENT_DATABASE_URL` và biến Google được để trống cho server, nên `.env.local` của dev không thể đưa server tới database thật.
4. **Bí mật sinh mới mỗi lần chạy** bằng `crypto.randomBytes` (`ADMIN_API_TOKEN`, `GUEST_KEY_SECRET`, mọi mật khẩu tài khoản), giữ trong `process.env` và `.data/e2e/<run-id>/`, không in, không commit.
5. **Rào chắn an toàn không tắt được** (`e2e/support/guard.ts`, chạy ở config và lại ở `global-setup.ts`, có test ở `tests/e2e-guard.test.ts`): base URL phải là `localhost`, `127.0.0.1` hoặc `[::1]`; mọi URL database trong môi trường (`PLANNER_DATABASE_URL`, `CONTENT_DATABASE_URL`, `E2E_DATABASE_URL`) phải là host cục bộ và tên database chứa `e2e` hoặc `test`; biến `E2E_*` nêu dev VM bị từ chối. Không có cờ bỏ qua. PostgreSQL là tùy chọn (`E2E_DB=postgres` kèm `E2E_DATABASE_URL`) và v1 không chạy ở CI.
6. **Tài khoản đi qua đường của chính ứng dụng:** `global-setup.ts` tạo member, member thứ hai, editor, admin, super admin và một tài khoản staff `gate` bằng service token (`POST /api/admin/planner/users`), đổi mật khẩu tạm lấy mật khẩu ngẫu nhiên qua `POST /api/planner/password`, và lưu một `storageState` cho mỗi vai trò. Tài khoản `gate` giữ mật khẩu tạm để một spec đi hết bước ép đổi mật khẩu như thật.
7. **Spec** gắn thẻ `@smoke`, chọn phần tử theo role và label (không `data-testid`, không sửa mã sản phẩm), không sleep cố định, `workers: 1`, `fullyParallel: false`, `trace: 'retain-on-failure'`. Mỗi test gửi `x-forwarded-for` riêng, nên bộ giới hạn đăng nhập theo IP (10 lần mỗi phút) không bóp suite.
8. **Trình duyệt:** trên máy dev dùng Google Chrome cài sẵn (`channel: 'chrome'`, không tải); ở CI chỉ Chromium, cài bằng `npx playwright install --with-deps chromium`. Không Firefox hay WebKit.
9. **CI:** workflow riêng `e2e.yml` (bộ lọc `paths` riêng, `pull_request` và `push` vào `main`, `workflow_dispatch`), chỉ mang tính tham khảo như `CI`. Báo cáo và trace chỉ được tải lên khi lỗi, giữ 7 ngày.

## Options considered

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn): Playwright trên bản build production và JSON store mỗi lần chạy | Kiểm đúng sản phẩm thật, cô lập, không cần dựng database, local và CI chạy giống nhau | Thêm dev dependency và binary trình duyệt ở CI; thêm một runner bên cạnh Vitest |
| B: mở rộng test component bằng jsdom | Không thêm dependency | Không thấy routing, cookie, header, redirect hay hai phiên |
| C: PostgreSQL ở CI ngay từ đầu | Gần production hơn | Chậm hơn, phải quản vòng đời database; JSON store đủ cho v1 (Q2) |
| D: puppeteer-core (`verify:ui` đã dùng) | Không thêm dependency | Không có test runner, assertion chờ web-first hay trace |

Phương án sát nút: B, thua vì những luồng hay hồi quy lại đúng là thứ mô phỏng DOM không chạm tới.

## Consequences

- Dễ hơn: lỗi hồi quy ở luồng lõi làm hỏng một check. Suite ghi lại các hợp đồng nó khẳng định (noindex ở trang chia sẻ, redirect 308 của tour, xung đột `If-Match`, ai được DELETE).
- Khó hơn: thêm dev dependency (xem xét qua diff lockfile và `npm audit`), job CI tải Chromium từ CDN của Playwright, và suite phải bảo trì khi đổi nhãn (selector dùng nhãn tiếng Việt hiển thị, nên đổi câu chữ là đổi test). Chạy local cần Google Chrome.
- Suite chỉ chạy trên JSON store, nên lỗi riêng của PostgreSQL không được phủ ở đây (các suite PostgreSQL của Vitest phủ repository).
- Hoàn tác bằng cách revert PR: cấu hình, `e2e/`, workflow và dependency.

## Follow-up

- `docs/usage.*` ("End-to-end tests") và `docs/architecture.*` ("Kiểm chứng") cập nhật trong cùng thay đổi.
- Job thứ hai trên dịch vụ PostgreSQL của CI khi các luồng đã ổn định (Q2).
- Chạy `/sec-check` (dependency mới, đổi CI, xử lý credential ở setup).
