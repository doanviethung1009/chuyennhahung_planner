# Backlog theo phase

Roadmap: [`PHASES.md`](PHASES.md) · Phase hiện tại: [`CURRENT.md`](CURRENT.md) ·
Deploy: [`DEPLOY-STATUS.md`](DEPLOY-STATUS.md)

Mỗi mục: ID ổn định `P<phase>-<n>`, chủ sở hữu (agent), phụ thuộc. ID mục không đánh số
lại; mục bỏ đi được gạch và ghi lý do, không xóa. Sắp theo thứ tự triển khai
(05 → 07 → 06 → 08 → 09), không theo Phase ID.

## Phase 05 — Story → Planner, My Trips & Sharing (hiện tại, P0)

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| ~~P05-1~~ | ~~Kiểm thủ công luồng đầy đủ trên trình duyệt, 3 khổ màn hình~~ — xong 2026-11-10, sửa lỗi `step` ô ngân sách | main session | — |
| P05-2 | `/sec-check` cho share token, public read, rate limiter, `returnTo` | user gọi `security` | — |
| P05-3 | `/qc-check` theo tiêu chí contract | user gọi `qc` | — |
| ~~P05-4~~ | ~~Test độc lập clone~~ — xong: `tests/planner-clone-independence.test.ts` | backend-engineer | — |
| P05-5 | Contract `follow-hung-footsteps` → `State: DONE` sau P05-2, P05-3 | system-architect | P05-2, P05-3 |
| ~~P05-6~~ | ~~Sửa đoạn đã cũ: CLAUDE.md quy tắc 6 và rules/03 §6~~ — xong: CLAUDE.md ở PR #24, rules/03 §6 ở branch deploy-checklist | system-architect | — |

## Phase 07 — Admin Portal, CMS & RBAC (P1, ngay sau 05)

Nguồn: ADR 0006 (PR #25) và mục Phases trong `docs/architecture.md`. Chép lại ở đây,
không sửa ý.

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| ~~P07-R0~~ | ~~Commit ADR 0006 + `tests/client-boundary.test.ts`; đổi nhãn "Phase 06" thành "Phase 07"~~ — xong: commit ở PR #25, đổi nhãn ở branch deploy-checklist | system-architect | — |
| P07-D1 | **Chủ nhà quyết:** nhà cung cấp danh tính (giữ token + session hay Auth.js/hosted), ai là admin, MFA cho `admin` | owner | — |
| P07-D2 | ADR 0006 → Accepted | system-architect | P05 đóng, P07-R0, P07-D1 |
| P07-1 | Role model: `role` trên user (thiếu = `member`), `can()` thuần, map quyền tĩnh | backend-engineer | P07-D2 |
| P07-2 | `ADMIN_API_TOKEN` → service principal, bị từ chối `trip:*` | backend-engineer | P07-1 |
| P07-3 | Session admin: thời hạn ngắn theo role; `requireSameOrigin` bắt buộc cho mutation admin | backend-engineer | P07-1 |
| P07-4 | Audit log (`auditEvents`): đổi template/role, mọi support read | backend-engineer | P07-1 |
| P07-5 | Test còn thiếu: ma trận `can`; service principal bị từ chối `trip:*`; admin nhận `not_found` trên trip người khác; thiếu role = `member`; member không vào route admin | backend-engineer | P07-1..3 |
| P07-6 | CMS sửa template/story qua content store; quyết định có lưu lịch sử bản template hay không | system-architect → BE/FE | P07-1 |
| P07-7 | UI Admin Portal (chỉ qua session + role, token không tới client) | frontend-engineer | P07-3, P07-5 |
| P07-8 | Rate-limit store chung cho đăng nhập admin khi > 1 process | backend-engineer | liên quan P09-1 |
| P07-9 | Gỡ dùng token trong trình duyệt; token chỉ còn cho CI | backend-engineer | P07-7 |

Rủi ro: admin portal tạo người ghi thứ hai vào store JSON một-process — SQL (P09-1) phải
có trước khi chạy nhiều instance.

## Phase 06 — AI Planner, Affiliate & Optimization (P2)

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P06-1 | ADR AI Planner: nhà cung cấp mô hình, chi phí, lưu key chỉ phía server, gợi ý là đề xuất người dùng chấp nhận | system-architect | P05 đóng |
| P06-2 | AI suggestions vào trip (chấp nhận/sửa trong editor) | BE + FE | P06-1, P04-1 |
| P06-3 | ADR Affiliate: chương trình đối tác, công bố affiliate, `rel` link | system-architect | — |
| P06-4 | Điền/quản lý `affiliateLinks` (hiện rỗng) qua CMS có phân quyền | BE + FE | P06-3, P07-6 |
| P06-5 | Optimization: hiệu năng, SEO, ngân sách bundle — làm được khi 07 bị chặn | frontend-engineer | P05 đóng |

## Phase 04 — Interactive Planner UI (P2, xen kẽ)

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P04-1 | Editor ngày/hoạt động/chi phí trong `/my-trips/[id]` dùng API sẵn có | frontend-engineer | — |
| P04-2 | Nối `/plan-your-trip` vào Planner (thay hay giữ trang liên hệ — cần quyết định) | system-architect → FE | P04-1 |
| P04-3 | Planner map — cần ADR riêng | system-architect | P04-1 |

## Phase 08 — Media Library & Analytics (P3)

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P08-1 | ADR lưu trữ media (nơi lưu, kích thước, `next/image`) | system-architect | P07-D2 |
| P08-2 | Upload/quản lý media sau RBAC + audit; `alt` song ngữ | BE + FE | P08-1, P07-4 |
| P08-3 | Thay cover SVG bằng ảnh thật của chủ nhà | frontend-engineer | P08-2, dữ liệu chủ nhà |
| P08-4 | ADR analytics tôn trọng quyền riêng tư; giữ cấm analytics trên `/shared/[token]` (ADR 0005) | system-architect | — |

## Phase 09 — Production Readiness & Launch (P4)

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P09-1 | SQL + nhiều instance (schema đích ở ADR 0002) | system-architect → BE | P07-1 |
| P09-2 | ~~Merge `chore/upgrade-vitest-5`~~ (PR #22); rà advisory còn lại | main session | — |
| P09-3 | Dữ liệu thật của chủ nhà: handle, số điện thoại, email đặt tour | owner | — |
| P09-4 | `/release-check`, `/qc-check`, `/sec-check` toàn hệ thống | user | P07, P08 hoặc loại trừ có ghi |
| P09-5 | Chọn nơi chạy + workflow deploy + sao lưu store (D1–D6 trong `DEPLOY-STATUS.md`) | owner → system-architect | D1 trước SQL nếu chọn serverless |
