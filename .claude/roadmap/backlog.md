# Backlog theo phase

Roadmap: [`PHASES.md`](PHASES.md) · Phase hiện tại: [`CURRENT.md`](CURRENT.md) ·
Deploy: [`DEPLOY-STATUS.md`](DEPLOY-STATUS.md)

Mỗi mục: ID ổn định `P<phase>-<n>`, chủ sở hữu (agent), phụ thuộc. ID mục không đánh số
lại; mục bỏ đi được gạch và ghi lý do, không xóa. Sắp theo thứ tự triển khai
(05 → 07 → 06 → 08 → 09), không theo Phase ID.

## Phase 05 — Story → Planner, My Trips & Sharing (Done 2026-11-16, còn P05-7..11)

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| ~~P05-1~~ | ~~Kiểm thủ công luồng đầy đủ trên trình duyệt, 3 khổ màn hình~~ — xong 2026-11-10, sửa lỗi `step` ô ngân sách | main session | — |
| ~~P05-2~~ | ~~`/sec-check`~~ — xong 2026-11-16: PASS_WITH_WARNINGS, 0 finding chặn, `npm audit --omit=dev` 0 lỗ hổng | security | — |
| ~~P05-3~~ | ~~`/qc-check`~~ — xong 2026-11-16: PASS với gaps; typecheck/lint PASS, test 871 passed/30 skipped; build NOT RUN | qc | — |
| ~~P05-4~~ | ~~Test độc lập clone~~ — xong: `tests/planner-clone-independence.test.ts` | backend-engineer | — |
| ~~P05-5~~ | ~~Contract → `State: DONE`~~ — xong 2026-11-16 | system-architect | — |
| P05-7 | **W1 (thấp-trung bình):** `clientKey` (`src/server/rate-limit.ts`) tin hop `x-forwarded-for` đầu tiên vô điều kiện → đổi header = bucket mới. Dùng hop tin cậy cuối hoặc gate bằng `TRUST_PROXY_HEADERS` (như `request-scheme.ts`); xác minh nginx ghi đè hay nối XFF. Gắn với Q12/P07-8 | backend-engineer | — |
| P05-8 | **W2 (thấp):** khi `hits.size >= maxKeys`, mỗi `check()` chạy `prune()` toàn bộ → khuếch đại CPU. Giới hạn tần suất prune hoặc evict theo lô; chưa đo | backend-engineer | P05-7 |
| P05-9 | **W3 (thấp):** `shareToken` lưu plaintext (`schemas.ts`), chỉ chỉ mục dùng digest. Ghi rõ vào ADR 0005 (bản sao/backup lộ link sống) hoặc chỉ lưu digest | system-architect | — |
| P05-10 | Test render thiếu: section "Lịch trình thực tế" + CTA trên story (gồm template bị rút), trạng thái rate-limit của `/shared/[token]`, route private ngoài sitemap/noindex | frontend-engineer | — |
| P05-11 | Chưa xác minh: từng nút ≥44px, parity Postgres store của share, bản EN và cửa sổ riêng tư thật của luồng thủ công | main session | — |
| ~~P05-6~~ | ~~Sửa đoạn đã cũ: CLAUDE.md quy tắc 6 và rules/03 §6~~ — xong: CLAUDE.md ở PR #24, rules/03 §6 ở branch deploy-checklist | system-architect | — |

## Phase 07 — Admin Portal, CMS & RBAC (P1, ngay sau 05)

> Core-first (2026-11-18): thứ tự và contract các session ở [`core-completion-index.md`](../contracts/core-completion-index.md). P07-10, 11, 12 (PR #165), 13 (#157), 14 (#166), 15 (#168), 16, 17 (#162), 19, 22 (#171) Done; template CMS P07-6 Done (#169, W4: không lưu lịch sử, chỉ `If-Match`; W11 đã chuyển handler sang session; DELETE/POST template và DELETE collection vẫn token-only theo quyết định của owner); P07-18 hoãn cùng media (Phase 08). Smoke trình duyệt các màn hình admin mới: NOT RUN.

Nguồn: ADR 0006 (PR #25) và mục Phases trong `docs/architecture.md`. Chép lại ở đây,
không sửa ý.

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| ~~P07-R0~~ | ~~Commit ADR 0006 + `tests/client-boundary.test.ts`; đổi nhãn "Phase 06" thành "Phase 07"~~ — xong: commit ở PR #25, đổi nhãn ở branch deploy-checklist | system-architect | — |
| ~~P07-D1~~ | ~~**Chủ nhà quyết:** nhà cung cấp danh tính (giữ token + session hay Auth.js/hosted), ai là admin, MFA cho `admin`~~ — nhà cung cấp danh tính: tự quản (ADR 0007); admin: ADR 0017; **MFA còn mở, hoãn (Q6)** | owner | — |
| ~~P07-D2~~ | ~~ADR 0006 → Accepted~~ — xong 2026-11-11 | system-architect | P05 đóng, P07-R0, P07-D1 |
| ~~P07-1~~ | ~~Role model: `role` trên user (thiếu = `member`), `can()` thuần, map quyền tĩnh~~ — xong (`permissions.ts`, ADR 0006/0017) | backend-engineer | P07-D2 |
| ~~P07-2~~ | ~~`ADMIN_API_TOKEN` → service principal, bị từ chối `trip:*`~~ — xong (ADR 0006 bước 1–2) | backend-engineer | P07-1 |
| ~~P07-3~~ | ~~Session admin: thời hạn ngắn theo role; `requireSameOrigin` bắt buộc cho mutation admin~~ — xong (ADR 0010) | backend-engineer | P07-1 |
| ~~P07-4~~ | ~~Audit log (`auditEvents`)~~ — **trùng P10-1, xong ở batch 10.2 (PR #115)**; còn mở: sự kiện đổi template/role/support read → xem P07-13 | backend-engineer | P07-1 |
| P07-5 | Test còn thiếu: ma trận `can`; service principal bị từ chối `trip:*`; admin nhận `not_found` trên trip người khác; thiếu role = `member`; member không vào route admin | backend-engineer | P07-1..3 |
| ~~P07-6~~ | ~~CMS sửa template/story qua content store; quyết định có lưu lịch sử bản template hay không ~~ — story/place/review xong (ADR 0011); create/delete story/place xong ở P07-16; **template CMS xong ở PR #169 (2026-11-19; W4: không lưu lịch sử, chỉ `If-Match`); tạo mới/xóa template và xóa collection vẫn token-only theo quyết định của owner** | system-architect → BE/FE | P07-1 |
| ~~P07-7~~ | ~~UI Admin Portal (chỉ qua session + role, token không tới client)~~ — xong (ADR 0010/0011) | frontend-engineer | P07-3, P07-5 |
| P07-8 | Rate-limit store chung cho đăng nhập admin khi > 1 process | backend-engineer | liên quan P09-1 |
| P07-9 | Gỡ dùng token trong trình duyệt; token chỉ còn cho CI | backend-engineer | P07-7 |
| P07-19 | Admin UX refinement: root layout riêng cho admin (route group `(admin)`), thanh trên, `AdminPageHeader`, sidebar sticky/active state — contract `.claude/contracts/admin-ws-p07-19-ux-refinement.md`, ADR 0023 (Đề xuất); **làm trước P07-11**; state DONE (PR #124 merged 2026-11-17) | system-architect → frontend | P07-10 |
| _(ID do owner gán)_ | Mô hình xoá dài hạn cho nội dung CMS: Lưu trữ → Khôi phục → Xoá vĩnh viễn, xoá vĩnh viễn chỉ `super_admin` (quyết định bảo vệ dữ liệu 2026-11-19, từ P07-15: `DELETE collections/[slug]` giữ chỉ token). Chưa có contract; không thêm Phase mới | system-architect | P07-15 |
| ~~P07-20~~ | Template: bắt buộc `If-Match` (428 khi thiếu header) cho `PATCH`, `reorder`, `move-activity`; hiện tùy chọn nên token hoặc client khác vẫn ghi đè được (cảnh báo W1 `/sec-check` P07-6, 2026-11-19). Chưa có contract | backend-engineer | P07-6 | — **xong ở PR #189 (CORE-11, 2026-11-19)**: `If-Match` bắt buộc cho cả token (428); `/sec-check` NOT RUN sau thay đổi |
| P07-21 | Template công khai còn nguyên khi story nguồn bị unpublish/archive: hiện chỉ kiểm story nguồn `published` lúc đặt `public` (cảnh báo W2 `/sec-check` P07-6, 2026-11-19); cần quy tắc (chặn hoặc hạ về private) và test. Chưa có contract | system-architect → backend-engineer | P07-6 |
| P07-22 | Slug UX cho form tạo story/place: tự sinh slug từ tiêu đề VI (`slugify`, hỗ trợ `đ`), preview URL VI/EN, báo trùng debounce; contract `.claude/contracts/admin-content-slug-ux.md` (owner duyệt 2026-11-19) | frontend-engineer | — |

Rủi ro: admin portal tạo người ghi thứ hai vào store JSON một-process — SQL (P09-1) phải
có trước khi chạy nhiều instance.

## Phase 06 — AI Planner, Affiliate & Optimization (P2)

> **DEFERRED (2026-11-18, chủ dự án: core-first).** Phạm vi và ID giữ nguyên; không phải Done.

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
| ~~P04-1~~ | ~~Editor ngày/hoạt động/chi phí trong `/my-trips/[id]` dùng API sẵn có~~ — xong (`docs/features/trip-editor.md`; còn thiếu test component) | frontend-engineer | — |
| ~~P04-2~~ | ~~Nối `/plan-your-trip` vào Planner~~ — xong (PR #172, #173; hai lối vào `/stories` và `/my-trips/new`, giữ đường liên hệ) | system-architect → FE | P04-1 |
| P04-4 | **(owner duyệt ID 2026-11-18)** Danh sách template phía người dùng (chỉ template public, chưa bị rút), dẫn vào `/trip-setup/[template]`; không trùng P07-6 (CMS admin) | frontend-engineer | P04-1 |
| P04-3 | Planner map — cần ADR riêng | system-architect | P04-1 |

## Phase 08 — Media Library & Analytics (P3)

> **DEFERRED (2026-11-18, chủ dự án: core-first).** P08-4 Analytics DEFERRED; P08-1..3 hoãn tới khi có ảnh thật (P09-3).

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P08-1 | ADR lưu trữ media (nơi lưu, kích thước, `next/image`) | system-architect | P07-D2 |
| P08-2 | Upload/quản lý media sau RBAC + audit; `alt` song ngữ | BE + FE | P08-1, P07-4 |
| P08-3 | Thay cover SVG bằng ảnh thật của chủ nhà | frontend-engineer | P08-2, dữ liệu chủ nhà |
| P08-4 | ADR analytics tôn trọng quyền riêng tư; giữ cấm analytics trên `/shared/[token]` (ADR 0005) | system-architect | — |

## Phase 09 — Production Readiness & Launch (P4)

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P09-1 | SQL + nhiều instance (schema đích ở ADR 0002) — **SQL xong cho dev (ADR 0008/0009/0013, migration 0001–0009); phần "nhiều instance" + rate-limit store chung chưa xác minh (Q12)** | system-architect → BE | P07-1 |
| P09-2 | ~~Merge `chore/upgrade-vitest-5`~~ (PR #22); rà advisory còn lại | main session | — |
| P09-3 | Dữ liệu thật của chủ nhà: handle, số điện thoại, email đặt tour | owner | — |
| P09-4 | `/release-check`, `/qc-check`, `/sec-check` toàn hệ thống | user | P07, P08 hoặc loại trừ có ghi |
| P09-6 | **D5 — Hoàn thiện Terms trước Production — DEFERRED (2026-11-18), KHÔNG phải Done.** Trước go-live: rà Terms theo chức năng thực tế; hoàn thiện VI/EN; kiểm Chính sách riêng tư (P11-D1); xác nhận quyền sử dụng và sao chép nội dung (ADR 0025); luật sư đọc lại; tăng `termsVersion` + ghim hash (+ bảng changelog ở `docs/features/creator-terms.*`; tag `terms-2026-11-16`); chạy `/qc-check` + `/sec-check`. PR #148 (bản nháp Terms v2, `2026-11-18`) **không merge** theo quyết định này; giữ làm nền, rà lại theo chức năng thực tế | owner → main session | P11, P09-4 |
| P09-7 | **RỦI RO — tuyên bố lưu giữ khóa khách 30 ngày chưa đúng hoàn toàn với code (không được coi là chấp nhận bằng việc hoãn D5).** Code: `sweepGuestKeysIn` (`src/server/planner/repository.ts:3377-3400`) chỉ chạy trong giao dịch ghi review khách, xóa tối đa 500 dòng/bảng/lần; site vắng thì khóa có thể quá 30 ngày; khóa của restriction chỉ xóa sau khi restriction kết thúc. Tuyên bố nằm ở ADR 0024 §4 và `docs/features/community-reviews.*`; bản nháp Terms v2 Điều 7.2 (PR #148) lặp lại. Hiện Terms `2026-11-16` đang chạy **không** hứa điều này — rủi ro nằm ở ADR/doc và ở Điều 7.2 nếu merge. **Xử lý tối thiểu, chọn một trước Production:** (a) sửa lời: "xóa trong khoảng 30 ngày" ở ADR 0024/doc và Điều 7.2; hoặc (b) thêm quét định kỳ độc lập với ghi (cron hoặc job) — khuyến nghị (b) nếu giữ lời hứa 30 ngày; (a) nhanh hơn. Không đưa Điều 7.2 lên production khi chưa làm một trong hai | main session / system-architect | P09-6 |
| P09-5 | **Dev VM đã chạy (ADR 0016);** còn sao lưu (FAIL), `metadataBase`, HSTS, production. Chọn nơi chạy + workflow deploy + sao lưu store (D1–D6 trong `DEPLOY-STATUS.md`) | owner → system-architect | D1 trước SQL nếu chọn serverless |

## Phase 10 — Community Foundations (P1, đề xuất 2026-11-16)

Nguồn: `.claude/contracts/community-platform-audit.md`. Mỗi mục cần ADR riêng trước khi code.

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P10-S0 | Ghi nhận ADR 0014/0015 là đã code (trips, reviews, hold, restrictions; migration 0005–0008) — chỉ tài liệu | system-architect | — |
| ~~P10-1~~ | ~~`audit_events` (= P07-4) + test~~ — xong ở batch 10.2 (PR #115, migration `0010`, [ADR 0019](../../docs/adr/0019-community-foundation.md) Accepted); `/sec-check` về quyền riêng tư của log: NOT RUN | BE | — |
| ~~P10-2~~ | ~~`terms_acceptances` + chặn ghi khi thiếu version~~ — xong ở batch 10.4 (PR #122, migration `0012`). **D5 — DEFERRED (chủ dự án chốt 2026-11-18, chuyển sang P09-6):** sửa text Terms khớp ảnh/video (Q8), tăng `termsVersion`, ghim lại hash — hoãn tới khi chức năng chính xong; DEV dùng Terms hiện tại (`2026-11-16`) để thử, chưa phải bản pháp lý cuối; UI 375/768/1280 của điều khiển đồng ý Terms cần phiên đăng nhập: NOT RUN | BE + FE; owner xác nhận text | — |
| ~~P10-3~~ | ~~`reports` + nút Report + hàng đợi staff~~ — xong ở batch 10.5 (PR #126, migration `0013`); smoke dev 2026-11-17: nút Report 375/768/1280 PASS, hàng đợi admin NOT RUN (cần đăng nhập) | BE + FE | — |
| P10-4 | Smoke trên dev VM — chạy 2026-11-17 ở batch 10.7: trang công khai, API, limiter dùng chung 429, nút Report PASS; luồng cần đăng nhập/admin và khởi động lại app NOT RUN — xem `.claude/contracts/handoff/phase10-10.7.md`. **Còn mở:** phần NOT RUN do owner hoặc phiên có tài khoản dev | main session | deploy dev |
| ~~P10-5~~ | ~~`/sec-check` + `/qc-check` cho community (ADR 0014/0015)~~ — chạy 2026-11-16: sec PASS_WITH_WARNINGS, qc PASS_WITH_NOTES, không BLOCKED; xem P10-10..16 | user gọi | — |
| ~~P10-6~~ | ~~Limiter ghi dùng chung trên PostgreSQL~~ — xong ở batch 10.3 (PR #117, migration `0011`; retention 48 h ở 10.5); Q12 đóng | BE | — |
| P10-7 | **Còn mở (owner):** sửa sao lưu dev VM, `metadataBase`, HSTS (Q10) trước UGC mới. Quan sát 2026-11-17: dev trả `Strict-Transport-Security` trên HTTP/IP (chưa xác minh trên HTTPS thật); sao lưu và `metadataBase` chưa kiểm được từ ngoài VM | owner → architect | — |
| ~~P10-8~~ | ~~Đổi nhãn "Stage 8/9" trong `docs/specs-roadmap.*` (cả hai ngôn ngữ) (Q11)~~ — xong ở PR #107 | system-architect | — |
| ~~P10-9~~ | ~~Cập nhật ADR 0016 Status và ADR 0015 (đóng 7 câu hỏi theo khuyến nghị, Q5) — cả hai ngôn ngữ~~ — xong ở PR #107 | system-architect | — |
| ~~P10-10~~ | ~~Sửa comment cũ "luôn `pending`" ở `src/app/api/planner/reviews/[placeSlug]/route.ts`~~ — xong ở PR #107 (từ `/sec-check` #4, `/qc-check` #1) | main session | — |
| ~~P10-11~~ | ~~`guestKey` HMAC-SHA256 (secret `GUEST_KEY_SECRET`), xóa khóa khách sau 30 ngày, restriction khách tối đa 30 ngày, migration `0014`~~ — xong ở batch 10.6b ([ADR 0024](../../docs/adr/0024-guest-identity-privacy.md)); **chủ dự án phải cấp `GUEST_KEY_SECRET` trên VM trước khi deploy**; xóa review khách theo yêu cầu đã làm ở PR #139 (staff ẩn danh hóa); trang Chính sách riêng tư vẫn là việc của chủ dự án (P11-D1) | backend-engineer | — |
| P10-12 | (10.6a: test + quyết định không thêm trần toàn cục xong; còn mở: kiểm cấu hình thật trên VM, owner D10) Chống giả `x-forwarded-for` cho limiter khách: nginx ghi đè (đã có `deploy-config.test.ts`), xác nhận cấu hình thật trên VM; cân nhắc trần theo giờ toàn cục (`/sec-check` #2, #3; liên quan P10-6) | BE + owner | P10-6 |
| ~~P10-13~~ | ~~Test HTTP 429 cho limiter review Planner (5/giờ) và khách (10/giờ); test hạn 30 ngày~~ — xong ở batch 10.3 (`tests/review-limiter-routes.test.ts`) | BE | — |
| ~~P10-14~~ | ~~Ca integration Postgres cho `community_reviews` và `review_restrictions`~~ — xong ở batch 10.2 | BE | DB test |
| ~~P10-15~~ | (xong ở 10.6a, bắt buộc ở server) **Quyết định chủ dự án:** có bắt buộc `contributionOpen` ở server (API từ chối ghi khi cổng đóng) hay chỉ ở UI (`/qc-check` #2) | owner → BE | — |
| ~~P10-16~~ | (xong ở 10.6a) `authorName` của khách: lọc/chặn giả danh nhân viên (`/sec-check` #5) | BE | — |

> **Batch 10.8 bị bỏ (chủ dự án chốt 2026-11-18):** không có contract 10.8. Các mục "việc còn mở" dưới đây chuyển sang Phase 11 và backlog; chủ dự án/architect gán ID `P11-*` khi lập contract Phase 11. Mục P07-4 trùng P10-1 (xong).

**Phase 10 chưa đóng (cập nhật 2026-11-17).** Review độc lập toàn phase: `/sec-check` PASS_WITH_WARNINGS, `/qc-check` PASS_WITH_WARNINGS, không BLOCKED (typecheck/lint PASS; test 1156 pass với PostgreSQL cục bộ, 1084 pass + 73 skip khi không có DB; build NOT RUN). Việc ngoài contract đã merge: #137 (giới hạn review khách 10/giờ + sự kiện `guest_limit`), #138 (tên địa điểm + nhãn `guest_limit` trong admin), #139 (staff ẩn danh hóa review khách; self-review PASS_WITH_WARNINGS). Điều kiện đóng: `CURRENT.md`.

Việc còn mở — chưa có ID backlog riêng, chờ chủ dự án xếp:
- **Sec W1/W2 [Medium] — đã sửa và merge ở PR #143 (`2f08057`):** W1 đường 429 review khách không còn mở transaction toàn store cho mỗi request (đọc không khóa + bộ nhớ có giới hạn); W2 `clientKey` gom IPv6 về /64 và IPv4-mapped về IPv4. Test mới ở `tests/rate-limit.test.ts`, `tests/community-reviews.test.ts`; chưa đo tải thật, chưa chạy lại `/sec-check` — NOT RUN.
- Sec W3–W7 [Low]: lọc tên giả danh dễ lách (Cyrillic/fullwidth/leet); dọn khóa 30 ngày chỉ chạy khi có ghi; `createReport` quét mọi chuyến dưới khóa toàn cục; audit log chỉ append-only ở tầng ứng dụng; độ mạnh `GUEST_KEY_SECRET` chỉ kiểm độ dài.
- QC F2–F4 [Low]: rollback theo hành động chỉ có test cho `decideListing`; chưa có test UI cho `report-button`/`terms-accept`/`report-queue`; tên test limiter còn ghi "2 h" (thực tế 48 h). Khoảng trống: chưa có test `guest_limit` ở tầng route.
- Về #139 — **chủ dự án quyết định 2026-11-17: đã xóa thì xóa hết.** ~~Task code xóa `reports.note` + số sao gốc~~ — **xong ở PR #150** (xóa `note` + `handlerReason` của báo cáo, `reason` của event cũ và của restriction khách; số sao gốc ghi đè bằng 1, review `removed` ngoài điểm trung bình) và PR #149 (hai test bổ sung). Nguyên tắc giữ nguyên: **xóa là xóa hết, ẩn là chỉ ẩn**. Ca Postgres dùng chung bộ test nhưng NOT RUN khi không có DB cục bộ.
- Smoke dev VM 2026-11-17 (phiên đăng nhập `admin1` do chủ dự án tự đăng nhập trong pane; không nhập mật khẩu): **PASS** `/quan-tri` mở được; `/quan-tri/cong-dong` tải hàng đợi chuyến đi (2), đánh giá (1) và báo cáo (0 mở); UI ở 375/768/1280: một `<h1>`, không tràn ngang, không nút/liên kết <44px (kiểm bằng script). **PASS thêm (chủ dự án đồng ý dùng `admin1`, mục tiêu là review khách thử có sẵn):** lập 1 báo cáo qua nút Report (POST 201, người đọc đã đăng nhập) → hiện ở hàng đợi → resolve (200, `report_actioned`) → gỡ review (`remove`); `GET /api/admin/community/events?targetId=<review>` trả đủ hai sự kiện theo thứ tự. Không gửi báo cáo hàng loạt. **PASS thêm (2026-11-18, chủ dự án đồng ý):** cổng Terms — `admin1` chưa đồng ý thì `PUT /api/planner/reviews/…` trả 403 `terms_not_accepted`, nút gửi chuyến disabled; tick đồng ý → `GET /api/planner/terms` `accepted:true`, nút enabled; điều khiển Terms ở 375/768/1280: một `<h1>`, không tràn ngang, nhãn và nút ≥44px. Chuỗi chuyến request→approve→remove (chuyến thử `trip_13a30fd5`): audit trả đủ `request`, `approve`, `remove`. **NOT RUN:** view restrictions chi tiết, bộ đếm limiter qua restart (cần restart app trên VM). Dữ liệu dev đổi: review thử `Chợ đêm Đà Lạt` đã `removed`, 1 báo cáo đã xử lý; `admin1` đã đồng ý Terms 2026-11-16; chuyến thử `trip_13a30fd5` (công khai, listing đã gỡ) còn trong tài khoản `admin1` — xóa/lưu trữ nếu muốn.
- Owner: P10-7 (sao lưu dev, `metadataBase`, HSTS), D10 (cấu hình proxy thật, log nginx còn IP thô), D5 (text Terms — **DEFERRED → P09-6**, không chặn đóng Phase 10; rủi ro lời hứa 30 ngày: **P09-7**), trang Chính sách riêng tư (P11-D1), dòng `GUEST_KEY_SECRET=` trong `deploy/.env.example` (kiểm trên `main` 2026-11-17: **chưa có**; session closeout bị quy tắc quyền chặn sửa `deploy/` nên không thêm được; VM dev đã có secret, xác minh 2026-11-17).
- Trạng thái đăng chuyến `changes_requested`/`unpublished` và bộ lọc thư viện (ADR 0019): chưa hiển thị ra API/UI.

## Phase 11 — Member Profiles & Creator Terms (P1, đề xuất)

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P11-1 | ADR profile: `member_profiles` 1:1, mặc định riêng tư, allow-list — **viết xong, Proposed: [ADR 0025](../../docs/adr/0025-member-profiles-and-use-this-trip.md)** (gồm cả P11-3); chờ chủ dự án chốt câu hỏi mở | system-architect | P10-2, P11-D1 |
| P11-D1 | **Chủ nhà cấp** chính sách riêng tư, thời hạn lưu `guestKey`, quyền xuất/xóa dữ liệu (Q9) | owner | — |
| P11-2 | API + UI hồ sơ, danh sách bài của tác giả | BE + FE | P11-1 |
| P11-D2 | **Chủ nhà quyết định** (theo [ADR 0025](../../docs/adr/0025-member-profiles-and-use-this-trip.md), câu hỏi mở 2–4): Điều 3 Creator Terms **đã có** và cho phép sao chép khi người tạo bật tính năng; còn thiếu **cờ bật sao chép theo từng chuyến** (`listing.allowCopy`, thuộc Phase 11). Chọn mặc định (khuyến nghị: tắt) và phạm vi đăng lại bản sao (chỉ dùng cá nhân, hay cho đăng lại); người am hiểu pháp lý đọc Điều 3 so với tính năng | owner | P10-2 |
| P11-3 | ~~ADR "Dùng chuyến này"~~ — viết xong cùng P11-1 ([ADR 0025](../../docs/adr/0025-member-profiles-and-use-this-trip.md), Proposed): công tắc sao chép theo chuyến (Điều 3 Terms), danh sách trường được sao chép (không ghi chú tự do, chi phí riêng, share token), `Trip.origin`, ghi công, nguồn bị rút/ẩn danh | system-architect | P10-3, P11-D2 |
| P11-4 | API `POST /api/community/trips/[token]/use` + UI nút; hạn mức sao chép; test nguồn không đổi và ẩn danh | BE + FE | P11-3 |

## Phase 12 — Travel Journal & Blog (P2, đề xuất)

> **DEFERRED (2026-11-18, chủ dự án: core-first).** Phạm vi và ID giữ nguyên; không phải Done.

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P12-1 | ADR `journal_posts` (state machine như `listing` + `held`; duyệt trước) | system-architect | P10, P11 |
| P12-2 | API + moderation + trang công khai VI/EN + sitemap | BE + FE | P12-1 |

## Phase 13 — Media Hybrid & Vlog (P2, đề xuất)

> **DEFERRED (2026-11-18, chủ dự án: core-first).** Phạm vi và ID giữ nguyên; không phải Done.

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P13-0 | Ranh giới với Phase 08: P08-1 xây `MediaStore` và thư viện chung; Phase 13 chỉ dùng cho upload của thành viên, avatar và vlog | system-architect | P08-1 |
| P13-1 | ADR media: embed allow-list (YouTube nocookie), CSP `frame-src`, upload ảnh sau | system-architect | P08-1, P12 |
| P13-2 | `media_assets` + vlog (`journal_posts.kind=vlog`) | BE + FE | P13-1 |
| P13-3 | `/sec-check` bắt buộc (XL, trust boundary) | user gọi | P13-2 |

## Phase 14 — Engagement (P3, đề xuất)

> **DEFERRED (2026-11-18, chủ dự án: core-first).** Phạm vi và ID giữ nguyên; không phải Done.

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P14-1 | ADR Save/Follow/Like/Comment; mở rộng restriction ra mọi `targetType` | system-architect | P10–P12, P10-6 |
| P14-2 | Bốn bảng + API + UI; comment hiện ngay + report + hold | BE + FE | P14-1 |

## Phase 15 — Curated Gallery & Discovery (P4, đề xuất)

> **DEFERRED (2026-11-18, chủ dự án: core-first).** Phạm vi và ID giữ nguyên; không phải Done.

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| P15-1 | Tìm kiếm/lọc/phân trang gallery, collection editor, thông báo; quyết định role `moderator` | system-architect → BE/FE | P12, P14 |

## Places UI (đề xuất 2026-11-18, ngoài số Phase)

| ID | Việc | Chủ | Phụ thuộc |
|---|---|---|---|
| PLACES-UI-S1 | Public Places UI: mục "Địa điểm" trên `/destinations/[slug]`, trang `/dia-diem/[slug]` (EN `/places/[slug]`), review chỉ đọc, ADR 0026. Contract: `.claude/contracts/places-ui-s1-public-places.md` — **DONE (PR #152)** | main session (FE+BE) | — |
| PLACES-UI-S2 | Place reviews UI: khối review và form viết review (khách/thành viên) trên trang địa điểm, 20 review mới nhất, không đổi API. Contract: `.claude/contracts/places-ui-s2-place-reviews.md` — **DONE (PR #153)** | main session (FE) | S1 |
| PLACES-UI-S3 | Thêm địa điểm vào chuyến từ trang địa điểm: chọn chuyến cùng điểm đến và ngày, khách dẫn tới đăng nhập, không đổi API. Contract: `.claude/contracts/places-ui-s3-add-to-trip.md` — **DONE (PR #155)** | main session (FE) | S1, S2 |
| PLACES-UI-S4 | Audit log UI trong admin = **P07-13** (đã Done, PR #157); không phải dòng riêng | main session (FE) | — |
| PLACES-UI-S5 | Admin Places polish: liên kết "Xem trên site" (tab mới) trong danh sách và trang sửa địa điểm; bỏ liên kết review theo địa điểm và số review vì cần đổi API. Contract: `.claude/contracts/places-ui-s5-admin-places-polish.md` | main session (FE) | S1, S4 (= P07-13) |
| ~~PLACES-UI-S6~~ | Danh sách `/places` (VI `/dia-diem`): tìm theo `q` phía server (tùy chọn, tương thích ngược, tìm trước phân trang), lọc điểm đến và danh mục. **Owner duyệt 2026-11-18**; contract chưa viết; không sửa contract S1 | main session (FE+BE) | S1, CORE-5 (chung `routing.ts`, `messages`) | — **xong ở PR #176 (2026-11-19)** |
