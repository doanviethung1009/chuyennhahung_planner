# Community Platform — Roadmap Reconciliation, Gap Assessment & Spec Proposal

- **State:** PROPOSAL (chưa được chủ dự án duyệt). Không sửa code, không migration, không commit.
- **Vai:** system-architect (main session, Single-Agent First). FE/BE/QC/Security chỉ là góc nhìn thiết kế; `qc` và `security` **NOT RUN**.
- **Mốc kiểm:** `main` @ `e362aea` (2026-11-16), worktree `claude/roadmap-community-platform-audit-59c8f3`.
- **Đã chạy trong lượt này:** `typecheck` ✅ · `lint` ✅ · `test` ✅ (62 file pass, 2 skipped; 871 pass, 30 skipped). `build` **NOT RUN**. Test PostgreSQL integration bị skip (không có DB) — **NOT RUN**.
- **Đã đọc:** CLAUDE.md, `.claude/roadmap/*`, `docs/adr/README.md`, ADR 0014, 0015 (đủ), 0016–0018 + 0006 (dòng Status), `docs/features/README.md`, `community-trips.md`, `community-reviews.md` (đầu), `docs/specs-roadmap.md`, `docs/specs-product.md`, `.claude/reports/deploy-test-2026-11-15.md`, `site.ts`, `permissions.ts`, `rate-limit.ts`, danh sách `src/`, `db/migrations/`, `tests/`.
- **Không đọc kỹ (nêu rõ):** ADR 0016–0018 phần thân; code repository.ts/handler từng route; nội dung từng test ngoài tên file.

---

## 1. Actual State Matrix

Ký hiệu: ✅ có bằng chứng · ⚠️ một phần/chưa xác minh · ❌ không có · NR = NOT RUN.
"Deploy" chỉ tính **dev VM 192.168.100.140**; không có bằng chứng production (G8).

| Tính năng | Roadmap Status | Code Evidence | Test Evidence | Deployment Evidence | **Actual Status** |
|---|---|---|---|---|---|
| Phase 02 Travel Content | Done | `src/server/content/**`, `src/app/api/travel/**` | `tests/travel-content-*.test.ts` ✅ | dev VM: `/chuyen-di-choi`, `/kham-pha` 200 (có dữ liệu hay trống: chưa xác nhận) | **Done (code), dev: smoke only** |
| Phase 03 Planner Core | Done (backend) | `src/server/planner/**`, `src/app/api/planner/**` | `tests/planner-*.test.ts` ✅ | dev VM: tạo user→login→tạo trip→đọc lại, dữ liệu sống sót qua deploy (báo cáo 2026-11-15 #16–17) | **Done, đã chạy trên dev VM** |
| Phase 04 Planner UI | Partial; "chưa có editor" | `src/components/planner/trip-editor/`, `docs/features/trip-editor.md`, `new-trip-form.tsx` | Không có test component (feature doc tự nhận); API test gián tiếp ✅; kiểm tay trình duyệt | Không có bằng chứng | **Editor Done (code, kiểm tay); Planner map ❌; `/plan-your-trip` vẫn contact-only** → PHASES lỗi thời |
| Phase 05 Story→Planner/Sharing | In progress | PR #23, #27; `/shared/[token]` | `planner-sharing`, `planner-clone-independence`, `rate-limit`, `return-to` ✅ | Chưa có smoke riêng `/shared` trên dev VM | **Code Done; còn mở: `/sec-check` NR, `/qc-check` NR (chưa có bằng chứng chạy riêng cho Phase 05)** |
| Phase 06 AI/Affiliate/Optim | Not started | `affiliateLinks` rỗng; không code AI | — | — | **Not started** ✅ khớp |
| Phase 07 Admin/CMS/RBAC | Designed; ADR 0006 "Proposed" | ADR 0006 **Accepted 2026-11-11**; 0010, 0011, 0012, 0017; `src/app/[locale]/admin/**`, `src/app/api/admin/**`, `permissions.ts` (4 role: member/editor/admin/super_admin) | `admin-portal`, `admin-content-session`, `planner-admin-session`, `super-admin`, `admin-bootstrap`, `admin-user-filter` ✅ | Admin trên trình duyệt: **NR** (báo cáo ghi rõ) | **Phần lớn Done (code): portal user, CMS story/place/review, super_admin, ban/delete.** Còn thiếu: audit log ❌ (grep `auditEvents` = 0), MFA ❌, create/delete/template CMS token-only, store rate-limit dùng chung ⚠️ (ADR 0008 nói Postgres rate limit; specs-roadmap nói per-process — **chưa xác minh**) |
| PostgreSQL (backlog P09-1) | Not started (Phase 09) | ADR 0008, 0009, 0013; `db/migrations/0001–0009`; `planner-rows.ts` | `*-rows`, `*-transfer` ✅; integration test **skipped/NR** | Dev VM chạy Postgres; dữ liệu bền qua deploy ✅ (#10, #15, #17) | **Done cho dev; backlog P09-1 lỗi thời.** Migration 0005–0009 trên VM: ⚠️ chưa xác nhận từng cái |
| Phase 08 Media Library | Not started | Không upload/storage; chỉ SVG cover | — | — | **Not started** ✅ khớp |
| Phase 09 Launch | Not started | Docker, compose, `deploy-dev.yml`, `deploy/*`, runbook | `deploy-config.test.ts` ✅ | Dev: 5 run `success`, rollback + redeploy chạy thật; **sao lưu: FAIL (không có cron, thư mục trống)**; admin browser NR; `metadataBase` chưa đặt; HSTS trên HTTP | **Dev deploy Done một phần; production Not started** |
| ADR 0014 PR1 Community Trips | (không có trong roadmap) | migration `0005`, `/api/planner/[id]/listing`, `/api/community/trips`, `/api/admin/community/trips/[id]`, `community-trips/page.tsx`, sitemap | `tests/community-trips.test.ts` ✅ | Không có smoke `/community-trips` trong báo cáo (11 route kiểm không gồm nó) | **Done (code+test); dev: chưa xác minh** |
| ADR 0014 PR2 Community Reviews | (không có) | migration `0006`, `/api/community/reviews`, `/api/planner/reviews`, `src/components/reviews/**`, `reviews/page.tsx` | `tests/community-reviews.test.ts` ✅; ADR ghi sec review PASS_WITH_WARNINGS (không có file bằng chứng trong repo) | Chưa xác minh | **Done (code+test); sec/qc: ADR 0015 ghi "chưa chạy"** |
| ADR 0015 Hold + Restrictions | (không có) | migration `0007`, `0008`; `/api/admin/community/restrictions`; action `community:restrict` | `tests/review-restrictions-routes.test.ts` ✅; hold: test trong `community-reviews` (⚠️ chưa mở xác nhận) | Chưa xác minh | **Done (code+test).** ADR README ghi "Accepted (PR 1 and PR 2 implemented)"; 7 câu hỏi owner vẫn "đứng trên đáp án khuyến nghị" |
| Contribution Terms / takedown | blocking gate ADR 0014 | `site.ts` `contribution.terms` + `takedownContact` đã điền, `contributionOpen` | feature doc xác nhận mở | — | **Mở (dữ liệu chủ nhà đã cấp).** Xem Q8 |
| ADR 0017 Super admin | (Phase 07) | `permissions.ts`, migration `0009`, Runbook tab | `super-admin.test.ts` ✅ | NR | **Done (code)** |
| ADR 0018 Handle sign-in | (không có) | `identifier` sign-in | `planner-password`/sign-in tests ✅ (⚠️ tên file chưa mở) | NR | **Done (code)** |
| ADR 0016 Auto deploy dev | Phase 09 (một phần) | `.github/workflows/deploy-dev.yml` | `deploy-config.test.ts` | ADR vẫn ghi "not yet run end to end" **nhưng báo cáo 2026-11-15 cho thấy đã chạy (5 run xanh, rollback)** | **Đã chạy end-to-end trên dev; ADR/specs-roadmap lỗi thời** |

Ghi chú: "Accepted" của ADR ≠ production. Không có bản ghi G8 nào. G5/G6 chưa có verdict cho bất kỳ phase nào trong `DEPLOY-STATUS.md`.

---

## 2. Roadmap Drift Report

| # | File | Nội dung hiện tại | Sự thật (bằng chứng) | Đề xuất sửa |
|---|---|---|---|---|
| D1 | `PHASES.md` header | "Cập nhật 2026-11-09 … `main` @ `124868e`" | HEAD = `e362aea`; ~80 commit sau | Cập nhật mốc, kèm ngày |
| D2 | `PHASES.md` Phase 04 | "Chưa có editor … không component nào gọi API activities/reorder/expenses" | `trip-editor/` + `docs/features/trip-editor.md` | Phase 04: editor **Done**, còn map + `/plan-your-trip` |
| D3 | `PHASES.md` Phase 07 | "Designed (ADR 0006 Proposed)"; điều kiện mở chờ P07-D1 | ADR 0006 Accepted 2026-11-11; 0010/0011/0012/0017 đã có; portal + CMS chạy | Đổi sang `In progress (phần lớn Done)`; liệt kê còn thiếu: audit log, MFA, create/delete/template CMS, store rate-limit |
| D4 | `PHASES.md` Phase 09 + `backlog` P09-1 | SQL "Not started" | ADR 0008/0009/0013, migration 0001–0009, dev VM chạy Postgres | Đánh dấu P09-1 xong cho dev (gạch, không xóa); giữ phần "nhiều instance" ⚠️ |
| D5 | `PHASES.md` | Không có community | ADR 0014/0015 đã triển khai | Thêm Phase 10 (mục 5); **không** nhét vào ID 05–09 |
| D6 | `CURRENT.md` | Phase hiện tại = 05, "Phase kế tiếp = 07" | 07 đã chạy sâu hơn nhiều; 05 chỉ còn gate sec/qc | Chủ dự án quyết: đóng 05 với rủi ro chấp nhận hay chạy `/sec-check` + `/qc-check`; xác định "phase hiện tại" mới |
| D7 | `CURRENT.md` | "Deploy: chưa có môi trường nào" | Dev VM chạy, 5 run xanh | Sửa |
| D8 | `DEPLOY-STATUS.md` | "chưa có môi trường deploy; không có workflow deploy; 0 Deployments" | `deploy-dev.yml`, `Dockerfile`, `deploy/**`, báo cáo 2026-11-15 | Thêm cột/hàng "dev VM" (G7 một phần, kèm commit `0216f46`, ngày); G8 vẫn ❌ |
| D9 | `DEPLOY-STATUS.md` D1–D6 | Tất cả chưa tích | D1 (VM), D2, D3 (nginx conf), D6 có bằng chứng; D4 (sao lưu) **FAIL thật** | Tích có bằng chứng; ghi D4 = FAIL |
| D10 | `backlog.md` | P07-D1 chờ chủ nhà; P07-1..3, P07-6, P07-7 mở | Role model, `can()`, session admin, CMS, portal đã có (ADR 0006/0010/0011) | Gạch các mục đã xong + PR/ADR; giữ P07-4 (audit log), thêm MFA, thêm mục mới |
| D11 | `backlog.md` P07-D1 | Hỏi "hosted IdP hay giữ token+session" | ADR 0007: self-managed (scrypt + Google OIDC). CLAUDE.md quy tắc 6 vẫn cấm hosted IdP nếu không ADR | Ghi quyết định đã thành; MFA còn mở |
| D12 | `ADR README` / `docs/specs-roadmap.md` | Stage 8 = Community, Stage 9 = Deploy | Trùng số với **Phase 08 (Media)** và **Phase 09 (Launch)** — dễ nhầm, phá quy tắc định danh | Đổi nhãn Stage thành chữ/chữ cái ("S-community"), không dùng số 08/09; hoặc ghi rõ "Stage ≠ Phase" |
| D13 | `docs/specs-roadmap.md` | ADR 0016 "Written, not yet run end to end"; "Shared rate-limit store … per process" | Báo cáo deploy: đã chạy; ADR 0008 có "Postgres rate limits" | Xác minh rồi sửa |
| D14 | ADR 0016 Status | "has not run end to end" | Có 5 run `success` + rollback thật | Cập nhật Status (architect) |
| D15 | `PHASES.md` Phase 08 | "Hiện trạng: cover SVG, không analytics" | Vẫn đúng ✅ | Giữ |
| D16 | `CLAUDE.md` quy tắc 6 | Nói `/plan-your-trip` contact-only, Planner map/AI/hosted IdP/MFA cấm scaffold | Vẫn đúng ✅ | Giữ; mọi mục Phase 10+ phải qua ADR |
| D17 | `.claude/context/project-context.md` | Không kiểm tra trong lượt này | ADR 0014/0015 yêu cầu cập nhật khi Accepted | **NOT VERIFIED** — kiểm khi cập nhật |

Không xóa lịch sử backlog: dùng gạch ngang + lý do + PR/ADR theo quy tắc hiện hành.

---

## 3. Community Gap Analysis

| Năng lực | Có | Chưa có | Ghi chú |
|---|---|---|---|
| **Planner Gallery** | `/community-trips`, listing opt-in, pre-moderation, allow-list `CommunityTripCard`, sitemap, top-nav | Tìm kiếm/lọc/phân trang (giới hạn 48 mới nhất), sắp xếp, tag, thông báo cho chủ trip/staff | Gallery trỏ tới `/shared/[token]` (token trong URL, chấp nhận vì trip đã public) |
| **Moderation** | Queue (`/quan-tri/cong-dong`), approve/reject/remove, hold, restrictions, `community:moderate`/`community:restrict`, `decidedBy` | **Audit log chung** ❌, thông báo, role `moderator` riêng, SLA/hàng đợi báo cáo của người đọc | Restriction rows đóng vai trò audit cục bộ |
| **Reviews** | Planner + guest review, tự khai ("self-reported"), rate-limit, honeypot, rating ẩn <3 | Pre-moderation (**xung đột, xem Q1**), report, reply, ảnh, verified-visit | Guest review dùng `guestKey` = hash IP (dữ liệu cá nhân giả danh) |
| **User profiles** | `displayName`, `handle` (ADR 0018), `authorDisplay: name\|anonymous` | Trang hồ sơ công khai, avatar, bio, danh sách bài của tác giả | Không có route profile |
| **Travel Journal** | Trip + `notes` + share + trip editor | Bài viết/nhật ký dài hạn gắn trip, trạng thái draft/publish, moderation bài viết | Trip ≠ journal; không có entity |
| **Blog** | Story do admin/editor (Travel Content) | Bài của thành viên; quy trình curated | Story = tiếng nói thương hiệu (ADR 0001/0014) |
| **Vlog** | `/goc-review` thẻ video **không link** (typed seed) | Embed, URL từng video, entity video | Chặn vì chưa có URL (feature doc) |
| **Media Hybrid** | — | Upload, thư viện, embed allow-list, alt song ngữ, quét, quota | Phase 08 chưa bắt đầu; ADR 0014 loại trừ upload ảnh |
| **Save/Follow/Like/Comment** | — | Cả bốn | Không bảng, route, UI. `like`/`follow` không có trong code (grep) |
| **Report** | — | Nút báo cáo của người đọc | ADR 0014: "No reporting button … out of scope" |
| **Creator Terms** | `contribution.terms` VI/EN + `takedownContact` đã điền; cổng `contributionOpen` | **Ghi nhận đồng ý theo người dùng + phiên bản** ❌; điều khoản vẫn nói "hình ảnh, video" trong khi chưa có upload | Terms hiện là text cấu hình, không có `acceptedAt` |

**Xung đột cần chủ dự án quyết:** ADR 0014 (đã Accepted, cập nhật 2026-11-15) cho review **hiện công khai ngay, không duyệt trước**, kể cả khách ẩn danh; định hướng Community "curated" (trip: duyệt trước) mâu thuẫn với review. Báo cáo này **không đổi** quyết định; spec dưới đây giữ đúng ADR 0014 và để chế độ moderation của nội dung mới (journal/blog/vlog/comment) là tham số theo loại nội dung.

---

## 4. Community Platform Technical Specification (Proposal)

> Nguyên tắc: **tái dùng**, không tạo lại. User = `planner_users` (+ role). Trip = `trips`. Review = `community_reviews`. Mọi bảng mới theo ADR 0013: không FK, kiểu cột + JSONB, `db/migrations/NNNN_*.sql` + `db/rollback/`, phản chiếu `planner-rows.ts`, `planner-transfer.ts` và khóa JSON cho store file. Mọi chuỗi VI+EN. Cần **ADR riêng cho từng phase** trước khi code (CLAUDE.md quy tắc 6, ADR README).

### 4.1 Data model (thêm mới, không trùng)

| Entity | Bảng | Khóa/ghi chú | Tái dùng |
|---|---|---|---|
| `MemberProfile` | `member_profiles` (1:1 theo `userId`, **không** thay `planner_users`) | `userId`, `bio`(≤500), `avatarMediaId?`, `public: bool` (mặc định **false**), `updatedAt` | `handle`, `displayName` đọc từ `planner_users` |
| `TermsAcceptance` | `terms_acceptances` | `userId`, `termsVersion`, `scope: 'contribution'\|'creator'`, `acceptedAt`, `locale` | version đọc từ `site.ts` |
| `JournalPost` (Journal/Blog/Vlog dùng chung) | `journal_posts` | `id`, `authorId`, `kind: 'journal'\|'blog'\|'vlog'`, `tripId?` (không FK), `title`, `lang`, `body` (text thuần/Markdown hạn chế, sanitize), `mediaRefs[]`, `status: draft\|pending\|approved\|rejected\|held\|removed`, trường moderation giống `listing`, `authorDisplay`, `slug` | State machine bắt chước `listing` + `held` (ADR 0014/0015) |
| `MediaAsset` | `media_assets` | `id`, `ownerId`, `kind: 'embed'\|'hosted'`, `provider?`, `externalId?`, `storageKey?`, `mime`, `bytes`, `alt{vi,en}`, `status`, `hash` | Phase 08 |
| `Save` | `saves` | `userId`, `targetType`, `targetId`, `createdAt`; unique(user,target) | riêng tư theo mặc định |
| `Follow` | `follows` | `followerId`, `followeeId`; unique; không tự follow | chỉ tới profile `public` |
| `Like` | `likes` | `userId`, `targetType`, `targetId`; unique | đếm gộp công khai, danh sách người like **không** công khai |
| `Comment` | `comments` | `id`, `authorId`, `targetType`, `targetId`, `body`(≤1000, text thuần), `parentId?` (tối đa 1 cấp), `status`, trường moderation | tái dùng `held`/restriction |
| `Report` | `reports` | `id`, `reporterKey` (userId hoặc guestKey băm), `targetType`, `targetId`, `reason` enum, `note`(≤500), `status: open\|actioned\|dismissed`, `handledBy`, `handledAt` | **không** lộ người báo cho người bị báo |
| `AuditEvent` | `audit_events` | `actor`, `action`, `targetType`, `targetId`, `at`, `meta` | chính là P07-4 chưa làm; nên làm trước mọi thứ mới |

`targetType` ∈ `trip | review | journal | comment | profile`. Mở rộng `ReviewRestriction` (hiện chỉ review) thành tổng quát qua cột `scope` (ADR mới), không tạo bảng thứ hai.

### 4.2 API contracts (đề xuất; lỗi dùng envelope hiện có, 401/403/404/412/422/429)

| Method + path | Auth | Mô tả |
|---|---|---|
| `GET /api/community/profiles/[handle]` | public (rate-limited như `shareReadLimiter`) | Chỉ khi `public=true`; allow-list: `handle, displayName, bio, avatar, counts` |
| `PUT /api/planner/profile` | session + same-origin | Sửa profile của chính mình; strict schema |
| `POST /api/planner/terms` | session | Ghi `TermsAcceptance` (`termsVersion` phải khớp bản hiện hành) |
| `POST/PATCH/DELETE /api/planner/journal[/id]` | session; cần terms đã chấp nhận | Draft/sửa/xóa; sửa bài `approved` → `pending` (giống ADR 0014 #4) |
| `POST /api/planner/journal/[id]/submit` | owner | draft → pending |
| `GET /api/community/journal[?kind&cursor]` | public | Chỉ `approved`, allow-list, cursor pagination |
| `PATCH /api/admin/community/journal/[id]` | `community:moderate` | approve/reject/hold/remove (+ reason) |
| `POST /api/community/reports` | session hoặc khách (rate-limit, honeypot) | Tạo report |
| `GET/PATCH /api/admin/community/reports[/id]` | `community:moderate` | Xử lý |
| `PUT/DELETE /api/planner/saves/[type]/[id]` · `GET /api/planner/saves` | session | Lưu riêng tư |
| `PUT/DELETE /api/planner/follows/[handle]` | session | Follow profile public |
| `PUT/DELETE /api/planner/likes/[type]/[id]` | session | Like |
| `GET/POST /api/community/comments?target=` · `DELETE /api/planner/comments/[id]` | public đọc / session viết | Comment text thuần |
| `POST /api/planner/media/embed` (Phase 08+) | session | Đăng ký embed theo allow-list |
| `POST /api/planner/media/upload` (Phase 08+) | session + quota | Upload hosted |

Mọi ghi: `requireSameOrigin`, schema `.strict()`, limiter theo principal, `If-Match` khi sửa tài liệu đã duyệt.

### 4.3 UX flow (tóm tắt)

1. Thành viên bật "Hồ sơ công khai" → **bắt buộc đọc + chấp nhận Creator Terms (ghi version)** → điền bio.
2. Viết Journal/Blog/Vlog: draft → gửi duyệt → (pending) → staff duyệt → hiện ở `/community/...`. Sửa bài đã duyệt trả về pending.
3. Người đọc: Save (riêng tư), Like, Comment (cần đăng nhập), Report (mọi người), Follow (đăng nhập).
4. Bị từ chối/hold: tác giả thấy lý do trong khu "Bài của tôi"; hold trả lời bằng cách sửa (ADR 0015).
5. Rỗng thì ẩn mục, không dữ liệu giả (CLAUDE.md quy tắc 8); mọi nút thật (quy tắc 4); landmark, một `<h1>`, ≥44px.

### 4.4 RBAC matrix (mở rộng `ROLE_ACTIONS`; `can()` thuần giữ nguyên)

| Action | visitor | member | editor | admin | super_admin | service |
|---|---|---|---|---|---|---|
| đọc nội dung `approved` / profile public | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| report | ✅ (rate-limit) | ✅ | ✅ | ✅ | ✅ | — |
| viết journal / comment / like / save / follow | ❌ | ✅ (sau terms) | ✅ | ✅ | ✅ | ❌ |
| `community:moderate` (duyệt journal/comment/report) | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `community:restrict` (mute người) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `media:moderate` (mới, Phase 08+) | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| đọc `audit_events` (mới) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `runbook:read` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

Bất biến giữ: admin không đọc/ghi trip của người khác qua phương thức trip thường (ADR 0006); không restrict tài khoản có `community:moderate`; service principal không tới trình duyệt. Một test ma trận `can` phải ghim mọi action mới.

### 4.5 Media policy (Media Hybrid — Phase 08 mở rộng, cần ADR)

- **Embed trước, upload sau.** Giai đoạn 1: chỉ nhúng từ allow-list nhà cung cấp (đề xuất YouTube nocookie, và nhà cung cấp khác khi chủ dự án chọn). Lưu `provider + externalId`, **không** lưu URL tự do; dựng URL phía server; CSP `frame-src` nới đúng host; không script bên thứ ba trên `/shared/[token]` (ADR 0005).
- **Upload (hosted):** allow-list MIME (jpeg/png/webp; video: chưa cho trong v1), tối đa kích thước/ảnh và quota/người; kiểm magic bytes không tin `Content-Type`; xóa EXIF/GPS; đổi tên theo hash; phục vụ từ origin/bucket tách biệt, `nosniff`, không thực thi; `alt` VI/EN bắt buộc; quét mã độc là **chưa chọn** (flag cho chủ dự án).
- Chủ sở hữu giữ quyền (đúng Creator Terms Điều 1); xóa tài khoản → xóa asset sau thời gian ân hạn.
- Mọi asset mặc định `pending` cho tới khi nội dung chứa nó được duyệt.
- Giữ riêng "ảnh thật của chủ nhà" (P08-3) khỏi media người dùng.

### 4.6 Privacy

- Profile **mặc định riêng tư**; `authorDisplay: anonymous` phải ẩn thật; allow-list từng projection có test liệt kê field, như `CommunityTripCard`.
- Không lộ email, `ownerId`, user id nội bộ, `guestKey`. Danh sách người like/follow không công khai.
- `guestKey` (hash IP) là dữ liệu cá nhân giả danh: giữ thời hạn ngắn, không dùng để định danh; ghi vào chính sách.
- Xóa tài khoản: xóa profile, save, like, follow, comment; journal/review theo quy tắc ADR 0014 (gỡ khỏi trang công khai); `reports` và restriction giữ làm hồ sơ audit tối thiểu, ghi "account deleted".
- Không analytics/bên thứ ba trên `/shared/[token]`; analytics cộng đồng cần ADR P08-4.
- Quyền xuất dữ liệu cá nhân: **chưa thiết kế** → câu hỏi cho chủ dự án (Q9). Cơ sở pháp lý và chính sách riêng tư: owner cung cấp, không tự soạn.

### 4.7 QC cases (tối thiểu, mỗi phase)

1. Allow-list field của từng projection công khai; anonymous không lộ tên/id.
2. State machine: draft→pending→approved; sửa bài approved→pending; reject/hold/remove không tác giả nào tự mở lại (trừ hold→sửa).
3. RBAC: ma trận `can` cho mọi action mới; member không gọi route admin (404); admin không đọc trip người khác.
4. Terms: không viết được nếu thiếu/sai `termsVersion`; đổi version bắt chấp nhận lại.
5. Rate limit 429 cho viết/report/comment/like; honeypot; unique save/like/follow (idempotent).
6. Restriction/ban: chặn ghi + ẩn nội dung đọc; gỡ restriction khôi phục; xóa tài khoản dọn dữ liệu.
7. XSS: body/title/comment hiển thị dạng text; Markdown (nếu có) qua sanitizer allow-list; không HTML thô.
8. Media: MIME giả, polyglot, file quá lớn, EXIF GPS bị xóa, URL embed ngoài allow-list bị từ chối, CSP chặn host lạ.
9. VI/EN parity (`tests/i18n.test.ts`), docs song ngữ (`tests/docs.test.ts`), a11y (một `<h1>`, ≥44px, focus).
10. Cả hai store (JSON + Postgres): test migration + `planner-transfer` import/export; integration Postgres hiện bị skip → phải chạy được ở CI hoặc ghi NR.
11. Báo cáo: người bị báo không thấy ai báo; report trùng gộp; spam report bị rate-limit.

### 4.8 Security threats (STRIDE gọn)

| Mối đe dọa | Vector | Giảm thiểu đề xuất |
|---|---|---|
| Stored XSS | body/comment/tiêu đề/tên | render text, sanitizer, CSP, `nosniff` |
| Spam / brigading | guest review, comment, like, report | limiter theo user + toàn cục, honeypot, restriction, giới hạn tài khoản mới |
| Lộ danh tính ẩn danh | join `ownerId`, token trong URL | allow-list + test; gallery dùng token (đã ghi nhận) |
| IDOR | sửa/xóa bài, comment, save người khác | kiểm `ownerId` ở repository, trả `not_found` |
| CSRF | ghi bằng cookie | `requireSameOrigin` (ADR 0004/0010) |
| Upload độc hại / SSRF (embed, thumbnail fetch) | URL embed, file | allow-list, không fetch URL người dùng phía server, quét/giới hạn |
| Leo quyền | role/restrict | `can()` thuần, test ma trận, guard last-admin |
| Mute bị né | tài khoản mới | chấp nhận (ADR 0015); giới hạn tài khoản mới, cần danh tính mạnh hơn (ngoài phạm vi) |
| Deanonymize guestKey | hash IPv4 đảo ngược | TTL ngắn, không xuất, ghi chính sách |
| Mất/leak audit | không có audit log | làm `audit_events` trước (P07-4) |
| Phụ thuộc rate-limit per-process | nhiều instance | store chung (ADR 0008) — **cần xác minh** trước khi tăng bề mặt ghi |
| Bản quyền/phỉ báng | bài người dùng | Terms + takedown (đã có contact); `Report` + SLA nội bộ |

---

## 5. Phase 10+ Proposal (Phase 05–09 và định danh giữ nguyên)

Thứ tự theo phụ thuộc, không theo ID. Mỗi phase mở bằng ADR riêng. Trạng thái = **Designed (đề xuất)**, chưa duyệt.

| ID | Tên | Phạm vi | Phụ thuộc cứng | Ưu tiên |
|---|---|---|---|---|
| **10** | Community Foundations (reconcile + nền) | **10-S0 (đã code):** ADR 0014 + 0015 (trips, reviews, hold, restrictions) ghi nhận là *Done (code), deploy chưa xác minh*. Mới: `audit_events` (P07-4), `terms_acceptances`, `reports` + queue, quyết định review moderation (Q1), smoke `/community-trips` + `/reviews` trên dev, `/sec-check` + `/qc-check` cho community | 07 (RBAC/portal), ADR 0014/0015 | P1 |
| **11** | Member Profiles & Creator Terms | `member_profiles`, profile public opt-in, avatar (chỉ embed/placeholder), danh sách bài tác giả, đồng ý Terms theo version, cập nhật Terms (bỏ/khớp mục ảnh-video) | 10 | P1 |
| **12** | Travel Journal & Blog (curated) | `journal_posts` kind `journal`/`blog`, gắn trip, pre-moderation (theo Q2), trang công khai VI/EN, sitemap | 10, 11 | P2 |
| **13** | Media Hybrid & Vlog | Embed allow-list trước, upload sau; `media_assets`; vlog = `journal_posts.kind=vlog`; **thực thi Phase 08** (thư viện, alt, storage ADR) — không đổi ID Phase 08, chỉ phụ thuộc vào nó | **08**, 12 | P2 |
| **14** | Engagement: Save · Follow · Like · Comment | 4 bảng, UI, moderation comment, restrict mở rộng, rate-limit | 10, 11, 12; store rate-limit chung (09-1 phần nhiều instance) | P3 |
| **15** | Curated Gallery & Discovery | Tìm kiếm/lọc/phân trang gallery, collection do editor tuyển, thông báo, (tùy chọn) role `moderator` | 12, 14 | P4 |

Điều chỉnh tài liệu roadmap (đề xuất, chưa làm): `PHASES.md` thêm Phase 10–15 + sửa D1–D5; `CURRENT.md` theo D6–D7; `backlog.md` gạch mục xong (D10–D11) và thêm `P10-*…P15-*`; `DEPLOY-STATUS.md` theo D8–D9. Đối chiếu số: giữ Quy tắc định danh #1 — không đánh số lại 00–09.

**Tài liệu song ngữ cần khi làm (theo `tests/docs.test.ts`):** mỗi `.md` dưới `docs/` có `.vi.md`, cùng khung heading, link chéo, đăng ký trong index. Gồm: ADR mới (`docs/adr/00NN-*.md` + `.vi.md` + dòng trong `adr/README.*`); mỗi feature `docs/features/<slug>.md` + `.vi.md` (đủ 7 mục: Summary · Routes · Data · How it works · Files · Tests · Limits and open questions) + dòng trong `features/README.*`; cập nhật `docs/architecture.*`, `docs/specs-roadmap.*`, `docs/specs-product.*`. File làm việc (contract, báo cáo audit này) ở `.claude/`, **không** vào `docs/`.

Cỡ & agent: Phase 10 = L; 11, 12 = L; 13 = XL (upload, trust boundary); 14 = L/XL; 15 = M/L. Không spawn agent nếu chưa xin phép; `/sec-check` bắt buộc khuyến nghị cho 10, 13, 14.

---

## 6. Quyết định cần chủ dự án phê duyệt

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| Q1 | **Review công khai ngay (ADR 0014) vs định hướng curated.** Giữ nguyên, hay chuyển một phần (ví dụ guest review → pre-moderation / hold-first)? | Giữ nguyên đến khi có dữ liệu spam; thêm Report + audit log trước; chỉ siết khi cần. Quyết định thuộc chủ dự án — chưa đổi |
| Q2 | Journal/Blog/Vlog/Comment của thành viên: duyệt trước, hay hiện ngay như review? | Journal/Blog/Vlog duyệt trước (nội dung dài, rủi ro cao); comment hiện ngay + report + hold |
| Q3 | Chấp nhận thứ tự Phase 10–15 và việc ghi ADR 0014/0015 là "10-S0 đã code" thay vì chèn vào Phase 07? | Có |
| Q4 | Đóng Phase 05 bằng `/sec-check` + `/qc-check`, hay chấp nhận rủi ro bằng văn bản (CURRENT.md mục 2–3)? Và "phase hiện tại" nay là gì? | Chạy hai review; chốt Phase 10 là hiện tại sau đó |
| Q5 | Trả lời 7 câu hỏi cuối ADR 0015 (hiện chạy theo đáp án khuyến nghị) | Xác nhận khuyến nghị, đóng câu hỏi |
| Q6 | Làm `audit_events` (P07-4) trước mọi thứ mới? MFA cho `admin/super_admin` có vào Phase 10 hay hoãn? | Audit log trước; MFA hoãn nhưng ghi rõ rủi ro |
| Q7 | Nhà cung cấp embed cho vlog (YouTube? Facebook? khác) và chính sách upload ảnh (cho/không, giới hạn) | Embed YouTube trước; chưa upload |
| Q8 | Creator Terms hiện nhắc ảnh/video nhưng chưa có upload; có sửa text hay giữ? `takedownContact` là Gmail cá nhân-giống — xác nhận đúng ý, có hộp thư riêng cho site không? Ai xử lý SLA? | Chủ nhà xác nhận; sửa Terms cùng Phase 11 |
| Q9 | Chính sách riêng tư, thời hạn lưu `guestKey`, quyền xuất/xóa dữ liệu: chủ nhà cung cấp cơ sở pháp lý | Cần trước khi mở profile public |
| Q10 | Khắc phục dev VM: sao lưu (hiện **FAIL**), `metadataBase`, HSTS trên HTTP — có đưa vào Phase 09 trước khi mở thêm bề mặt UGC không? | Có; sao lưu trước khi có thêm UGC |
| Q11 | Đổi nhãn "Stage 8/9" trong `specs-roadmap.md` để khỏi trùng Phase 08/09 | Có |
| Q12 | Xác minh rate-limit store dùng chung (Postgres hay per-process) trước khi chạy nhiều instance | Có — hiện **chưa xác minh** |

## Giới hạn của audit này
- Không mở thân repository/handler; kết luận "Done (code)" dựa trên file tồn tại, ADR/feature doc, tên test và `typecheck/lint/test` xanh — **không phải** QC độc lập.
- Không có bằng chứng production; bằng chứng deploy chỉ là báo cáo 2026-11-15 (dev VM, đến commit `0216f46`, trước các PR #93–#105 sau đó).
- Không chạy `build`, integration Postgres, `/qc-check`, `/sec-check`, `/release-check`.
