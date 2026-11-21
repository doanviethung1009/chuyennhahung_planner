# Task Contract: MEMBER-HOME-TABS — My Trips dạng tab + giải thích bản đồ chia sẻ
- Class: **L** (đổi IA của trang chủ thành viên, amend ADR 0031 → ADR 0032; không API, không schema, không migration). Không phải XL: không chạm auth/dữ liệu/token.
- Trạng thái: **REVIEW — chủ đã duyệt khuyến nghị (2026-11-21); đã triển khai, chưa commit/push/PR**. `qc`/`security`: NOT RUN.
- Nhánh dự kiến khi được duyệt: `feat/member-home-tabs`, từ `origin/main` mới nhất.

## 1. Kết quả mong muốn / tác động
Chủ dự án: "Nên làm tab đi, kéo xuống mất tập trung quá" và "bản đồ chia sẻ không có data / chuyến đi?".
- `/my-trips` hiện là một trang dài: bản đồ → chú giải → danh sách điểm → khối chia sẻ (+ bản xem trước, một bản đồ thứ hai) → danh sách chuyến → footer (HTML ~160 KB, 4 h2 trước khi tới chuyến đi). Chuyển sang **một khung nhìn mỗi lần**, giữ một h1.
- Bản đồ chia sẻ **không lỗi** (xem mục 2). Điều thiếu là **lời giải thích**: chủ sở hữu có chuyến "đã lên kế hoạch" thấy chấm rỗng trên bản đồ riêng nhưng bản chia sẻ rỗng/ít, mà không biết vì sao và làm gì để chuyến đó hiện.

## 2. Chẩn đoán bản đồ chia sẻ (bằng chứng — dev server cục bộ cổng 3217, JSON store trong scratchpad, tài khoản thử tự sinh, không dùng VM/DB thật)
Dữ liệu thử (1 tài khoản): Hà Giang `completed`; Sa Pa `completed` rồi **lưu trữ**; Huế `planned`; Đà Lạt `draft`; Ninh Bình `draft` rồi **lưu trữ**; Hội An ×2 `completed`. Bật chia sẻ (ẩn danh).
| Quan sát | Kết quả |
|---|---|
| `GET /ban-do-chia-se/<token>` khi chưa đăng nhập | 200; `X-Robots-Tag: noindex, nofollow`; h1 "Bản đồ của một người đã đi"; danh sách đúng 3 điểm: **Hà Giang (1 lần), Hội An (2–3 lần), Sa Pa (1 lần)**. Đà Lạt/Huế (kế hoạch) và Ninh Bình (nháp lưu trữ) **không có** |
| Bản xem trước trên `/chuyen-di-cua-toi` (có cookie) | **Giống hệt** trang công khai (cùng 3 điểm, cùng nhóm) |
| Bản đồ riêng trên cùng trang | 5 điểm: Hà Giang/Hội An/Sa Pa "Đã đi", Đà Lạt/Huế "Đã lên kế hoạch" (Ninh Bình bị bỏ) |
| Chuyển Hà Giang + 2 Hội An về `planned` (còn Sa Pa lưu trữ `completed`) | công khai còn 1 điểm (Sa Pa); xem trước hiện **cảnh báo "dưới 2 nơi đã đi"** |
| Chuyển Sa Pa về `planned` (0 chuyến hoàn thành) | công khai vẫn 200, **bản đồ trống + "Bản đồ này chưa có điểm nào."**; xem trước: "Chưa có nơi nào để hiển thị. Chỉ chuyến đã hoàn thành mới lên bản đồ chia sẻ." |
| Token sai (43 ký tự) | 404 (đúng thiết kế, một câu trả lời cho mọi lỗi) |
| Nút đổi trạng thái | Ở My Trips, ô "Tình trạng" có `Bản nháp / Đã lên kế hoạch / Đã đi xong`; chỉ "Đã đi xong" (`completed`) làm một chuyến lên bản đồ chia sẻ |

Trả lời:
- **(a) Bản chia sẻ hiện:** chỉ địa danh (tên) đã đi, 3 cỡ chấm (1 / 2–3 / 4+ chuyến), sắp theo slug. **Không có** tên/tiêu đề chuyến, ngày, danh sách chuyến, kế hoạch, đánh giá — đúng ADR 0030 §2.
- **(b) Khi nào rỗng — đúng thiết kế:** không có chuyến `completed` (lưu trữ hay không đều tính) tới điểm đến có trong catalogue (`destinations.ts`, có tọa độ); chuyến `draft`/`planned` và chuyến lưu trữ chưa hoàn thành không bao giờ hiện. <2 điểm → chỉ **cảnh báo** ở phía chủ sở hữu, không chặn.
- **(c) Không phải lỗi dữ liệu.** Không có trường hợp "dữ liệu hợp lệ mà không hiện" (nguồn: `buildPublicMemberMapPoints`, `member-map-share.ts`; trang: `shared-map/[token]/page.tsx`). Nhận xét của chủ khớp một **thiếu sót giải thích/hiển thị**: (1) chủ thể thấy chấm rỗng "kế hoạch" ở bản đồ riêng nhưng không thấy nơi nào nói "chuyến chưa hoàn thành không lên bản chia sẻ — hãy chuyển sang 'Đã đi xong'"; (2) cảnh báo "<2 điểm" chỉ nằm trong khối xem trước (chôn dưới cùng một trang dài), nút bật chia sẻ không nhắc; (3) trang công khai chỉ có "Bản đồ này chưa có điểm nào" — khách không biết đó là bản đồ mới/chưa có chuyến hoàn thành; (4) "thiếu hiển thị chuyến đi" là **chủ ý** (riêng tư).
- **(d) Chuyến chưa hoàn thành có nên hiện không — khuyến nghị: KHÔNG.** Kế hoạch tiết lộ nơi/thời điểm người đó sẽ ở (rủi ro an toàn, đã được `/sec-check` ADR 0030 chấp nhận loại trừ); đổi lại thì cần ADR mới + loại bỏ ràng buộc "separate type, enumerating test". Thay vào đó sửa **giải thích** (mục 5.D). Nếu chủ vẫn muốn "thấy chuyến": phương án an toàn là số chuyến hoàn thành (ví dụ "3 chuyến") — vẫn không tiêu đề/ngày; cần quyết định của chủ (CÂU HỎI 5).
- Chưa kiểm: nhìn thị giác 375/768/1280 (chẩn đoán dùng HTML/headers); PostgreSQL (chỉ JSON store; logic projection dùng chung cho hai store).

## 3. Phạm vi
**IN**
- `/my-trips` chia 3 tab: **Chuyến đi** · **Bản đồ** · **Chia sẻ** (khách: không tab, chỉ khối bản đồ trống + đăng nhập như hiện tại).
- Điều hướng tab theo `?tab=` render phía server (xem 4.2).
- Sửa giải thích chia sẻ (5.D): copy VI/EN + một dòng/khối chỉ dẫn; **không** đổi dự báo dữ liệu công khai.
- ADR 0032 (amend ADR 0031 §1 "không toggle"), feature doc, architecture, test.
**OUT**
- Route riêng cho từng tab, hash, `e2e/**` (của WEB-3), `src/content/destinations.ts`, `/map`, `/shared-map/[token]` (dữ liệu/headers/404), API `/api/planner/**`, schema, migration, `/my-trips/new`, `/my-trips/[id]`, bản đồ tuyến trong chuyến, "tab Đã lưu trữ" thành URL riêng (giữ bộ lọc hiện có trong tab Chuyến đi).
- Không tạo ID backlog/Phase mới; không sửa `.claude/roadmap/*`.

## 4. Thiết kế
### 4.1 Bố cục tab (lựa chọn + lý do)
| Tab | Nội dung | Ghi chú |
|---|---|---|
| **Chuyến đi** | nút "Tạo chuyến đi mới", bộ lọc Đang dùng/Đã lưu trữ, danh sách (`MyTrips` client như cũ) | tác vụ hằng ngày; `MyTrips` chỉ được mount khi tab này mở → tải lười, giảm request |
| **Bản đồ** | bản đồ riêng + chú giải + danh sách điểm + ghi chú riêng tư | chỉ đọc |
| **Chia sẻ** | `MemberMapSharePanel` + bản xem trước công khai | lý do tách: panel là cấu hình hiếm dùng, kèm bản đồ thứ hai gây "kéo dài"; tab giúp preview đứng cạnh nút bật/tắt |
Đã cân nhắc 2 tab (gộp Bản đồ+Chia sẻ): ít nhấp hơn nhưng giữ lại chính khối dài gây mất tập trung; 4 tab (tách Lưu trữ): trùng bộ lọc sẵn có. Chọn 3.
**Tên tab (VI / EN):** Chuyến đi / Trips · Bản đồ / Map · Chia sẻ / Sharing. Bộ lọc con "Đang dùng/Đã lưu trữ" giữ `aria-pressed` và **không** gọi là tab (tránh hai tablist lồng nhau) — đổi `myTrips.tabsLabel` thành nhãn "bộ lọc" (đã là "Lọc chuyến đi").
**Tab mặc định:** xem CÂU HỎI 1 (khuyến nghị **Bản đồ** = giữ ý ADR 0031 "bản đồ là trang chủ"; `?tab=trips` cho phần còn lại).

### 4.2 Cơ chế URL: `?tab=map|trips|share` render server — khuyến nghị
- `my-trips/page.tsx` nhận `searchParams: Promise<{tab?: string}>` (mẫu đã có ở `places/page.tsx`, `sign-in/page.tsx`); giá trị lạ/thiếu → tab mặc định (không redirect, không 404). Đã là `force-dynamic` nên không mất cache.
- Lợi: **liên kết sâu được, nút Back hoạt động, chạy khi tắt JavaScript**, `returnTo` đã giữ query cho `/my-trips` (`return-to.ts` `KEEPS_QUERY`), không thêm route/redirect, không thêm state client.
- Loại: **đường dẫn riêng** `/my-trips/map`… — **va chạm** `/my-trips/[id]` (id có thể là "map") và cần thêm `pathnames` + redirect; **hash** — server không đọc, không chạy khi tắt JS, SSR đọc nhầm tab.
- Cost: mỗi lần đổi tab = điều hướng server (trang `force-dynamic`). Giảm bằng cách **mỗi tab chỉ đọc dữ liệu của nó**: Bản đồ → `getMemberMap`; Chia sẻ → `getMemberMap` không cần, chỉ `getMemberMapSharePreview`; Chuyến đi → chỉ kiểm tra phiên (cần helper nhẹ `getMemberSession()` dùng `identify`, không đọc chuyến/đánh giá). Khách ở mọi tab → bản đồ trống (bất biến ADR 0029/0031 giữ). Dùng `scroll={false}` cho link tab.
### 4.3 Mẫu a11y: **điều hướng bằng liên kết thật, không ARIA tablist** — khuyến nghị
- `<nav aria-label="Các mục của trang chuyến đi">` chứa 3 `<a>` (next-intl `Link` + `query`), tab đang mở có `aria-current="page"` + kiểu "chọn". Panel là `<section aria-labelledby>` có h2 tương ứng. Lý do: ARIA `tablist` (APG) đòi roving tabindex + phím mũi tên + `aria-selected` + client JS và **sai ngữ nghĩa** khi mỗi tab là một URL/điều hướng; liên kết thật tự có Tab/Enter, Back, mở tab mới, không JS. Đích bấm **≥44px** (`min-h-11`), focus thấy được, một h1, h2 theo thứ tự, cuộn ngang trên 375px bằng `overflow-x-auto` nếu chữ dài (không tràn trang).
- Nếu chủ muốn đúng "tab ARIA" (mũi tên trái/phải): phương án B, thêm client wrapper + `?tab=` đồng bộ; tốn thêm JS và test, không khuyến nghị (CÂU HỎI 2).
- Sau điều hướng, giữ focus trên liên kết vừa bấm (thanh tab ở cùng vị trí cây React) — kiểm bằng test trình duyệt; không cướp focus vào panel.
### 4.4 Trạng thái rỗng và lỗi
- Khách: không thanh tab; bản đồ trống + đăng nhập (như hiện tại).
- Thành viên chưa có chuyến: Bản đồ → `emptyPrompt` + CTA; Chuyến đi → trạng thái rỗng sẵn có của `MyTrips` (+ CTA); Chia sẻ → panel + preview rỗng (có lời giải thích mới, 5.D).
- Lỗi tải panel/chuyến: giữ thông điệp hiện có của từng component.
### 4.5 Responsive
- 375: thanh tab 1 hàng, 3 mục co giãn, chữ không xuống dòng làm cao <44px; không cuộn ngang trang. 768/1280: thanh tab trái-trên, panel `Container` giữ độ rộng hiện tại (Bản đồ/Chia sẻ `wide`, Chuyến đi `default`). Kiểm VI + EN ở 375/768/1280, cả sáng/tối nếu token hỗ trợ.

## 5. Sửa bản đồ chia sẻ (giải thích, không đổi dữ liệu)
D1. Tab **Chia sẻ**: dưới trạng thái bật/tắt, một khối `role="note"` (không phải `alert`): "Chỉ chuyến 'Đã đi xong' lên bản chia sẻ. Bạn có N chuyến chưa hoàn thành (không hiện)." + liên kết "Xem chuyến đi" → `?tab=trips`. `N` tính phía server từ dữ liệu đã đọc (đếm, không lộ gì thêm cho khách).
D2. Cảnh báo "<2 điểm" hiện ngay trong panel trước nút bật (lấy từ `status.sparse` đã có trong `GET /api/planner/map/share`) **và** giữ trong preview.
D3. Tab **Bản đồ** (riêng): chú giải đã nói "chấm rỗng = kế hoạch"; thêm một dòng: "Chấm rỗng không lên bản đồ chia sẻ."
D4. Trang công khai khi trống: giữ 200 (không rò rỉ), chỉ đổi copy `sharedMap.empty` thành trung tính hơn ("Người này chưa có điểm nào để hiển thị.") — **không** tiết lộ lý do (kế hoạch/lưu trữ). Chỉ copy VI/EN, không đổi route/headers/404.
Không làm: hiện tiêu đề/ngày/danh sách chuyến, hiện chuyến `planned`, đổi bucket, đổi token.

## 6. Bằng chứng mã (đã đọc, nguồn cho contract)
`src/app/[locale]/my-trips/page.tsx` (server page, 74 dòng; guest không mount `MyTrips`), `src/components/planner/my-trips.tsx` (client, đã có bộ lọc `aria-pressed` + `/api/planner?status=`), `src/components/map/member-map-view.tsx`, `member-map-share-panel.tsx` (client, đọc `GET /api/planner/map/share` khi mount, token chỉ trong state), `member-map-share-preview.tsx`, `src/server/planner/member-map.ts`, `member-map-share-preview.ts`, `member-map-share.ts` (`buildPublicMemberMapPoints`), `shared-map-page.ts`, `src/lib/return-to.ts`, `next.config.ts` (`memberMapPaths`, 308 `/my-map`). ADR 0029/0030/0031, handoff `member-home-merge`, `verify-my-trips-ui`, `member-map-share-hardening`.

## 7. Ràng buộc / phụ thuộc
- Tất cả đã merge vào `main` (PR #201, #204, #206, #208, #210, #212, #215); `gh pr list --state open` lúc viết: **không có PR mở**. `origin/main` = 47e9d33, nhánh phân tích đã là hậu duệ.
- WEB-3 (`test/playwright-e2e`, chưa push lúc viết) có thể viết spec `/my-trips`. Contract này **không sửa `e2e/**`**; xem selector ổn định ở mục 9.
- Quy tắc CLAUDE.md 1–12: VI/EN đủ, token trong `@theme`, không `href="#"`, a11y, feature doc + bản `.vi.md`, ADR/README song ngữ.
- `tests/dom/*` cần `@testing-library` + jsdom (ADR 0027); môi trường worktree phải `npm ci` (đã chạy khi chẩn đoán). Không migration, nên không có thao tác trên production.

## 8. ADR
**ADR 0032 — "Member home tabs"** (số kế tiếp trống: `docs/adr` hiện dừng ở 0031). Amend 0031 §1 ("không toggle vì ẩn một view và thêm state client") bằng: tab theo URL (`?tab=`), render server, không state client, nội dung vẫn đủ trên cùng một route → hai lý do bác bỏ của 0031 không còn đúng. Không sửa nội dung ADR 0029/0030 (chỉ thêm dòng "Amended by ADR 0032" ở 0031 + README song ngữ). Một phụ lục ngắn ở 0030 là không cần (không đổi quy tắc chiếu).

## 9. Selector ổn định cho E2E (đề nghị WEB-3 dùng vai/nhãn, không test-id)
- `getByRole('heading', { level: 1 })` = "Chuyến đi của tôi" / "My trips" (một h1).
- `getByRole('navigation', { name: 'Các mục của trang chuyến đi' | 'My trips sections' })` và trong đó `getByRole('link', { name: 'Chuyến đi' | 'Bản đồ' | 'Chia sẻ' | 'Trips' | 'Map' | 'Sharing' })`; tab đang mở `toHaveAttribute('aria-current','page')`. URL: `/chuyen-di-cua-toi?tab=share` / `/en/my-trips?tab=share`.
- Tab Chuyến đi: link "Tạo chuyến đi mới"; nhóm `group` tên "Lọc chuyến đi"; nút "Đang dùng"/"Đã lưu trữ" (`aria-pressed`); ô `combobox` tên "Tình trạng"; nút "Nhân bản", "Lưu trữ", "Khôi phục".
- Tab Chia sẻ: `section` có h2 "Chia sẻ bản đồ của bạn"; nút "Bật chia sẻ"/"Tạo liên kết mới"/"Tắt chia sẻ" (tên theo `messages`), `data-testid="share-state"` và `data-testid="share-preview"` (đã có, **giữ nguyên**); `getByRole('status')`/`alert` cho thông báo.
- Tên liên kết/nhãn VI/EN lấy từ `messages/*.json`; contract này **không đổi** các khóa `memberMapShare.*` hiện có (chỉ thêm khóa mới). Test E2E nên chọn bằng vai + tên từ messages, không bằng thứ tự DOM hay lớp CSS.
- Khi merge xong, nhắn WEB-3 qua session cha (không tự nhắn từ đây).

## 10. Tasks theo vai (một session, một nhánh, một PR, single agent)
- **Architect:** ADR 0032 + README (EN/VI); cập nhật dòng "Amended by" ở ADR 0031.
- **BE (nhỏ, không API):** helper `getMemberSession()` (identify nhẹ) cạnh `member-map.ts`; đếm chuyến chưa hoàn thành cho D1 (dùng dữ liệu `getMemberMap`/`allTrips` sẵn); không đổi `PublicMemberMap`.
- **FE:** `MemberHomeTabs` (server component, nav + `aria-current`), tách `my-trips/page.tsx` thành 3 panel; giữ `MyTrips` client nguyên (chỉ bỏ h2 lặp); `MemberMapView` bỏ khối "grid 12 cột" nếu cần; D1–D4; `messages/vi.json` + `en.json` (khóa mới `myTrips.sections`, `myTrips.sectionTrips/Map/Share`, `memberMapShare.unfinishedNote`…, không xóa khóa đang dùng).
- **QC (tự kiểm, không gọi agent):** `typecheck`, `lint`, `test`, `build`; trình duyệt 375/768/1280 VI+EN, tắt JS, Back/forward, deep link.
- **Docs:** `docs/features/member-map.{md,vi.md}` (thêm mục "Tabs"), `member-map-sharing.{md,vi.md}` (D1–D4), `docs/architecture.{md,vi.md}`, `docs/usage.{md,vi.md}` nếu nhắc điều hướng; `docs/features/README.*` không cần dòng mới (không feature mới) trừ khi chủ muốn tách tài liệu (CÂU HỎI 6).
- **Git:** nhánh `feat/member-home-tabs`, Conventional Commits; chỉ commit/push/PR khi chủ cho phép; không merge.

## 11. Quyền sở hữu file / rủi ro conflict
- **Sẽ sửa:** `src/app/[locale]/my-trips/page.tsx`, `src/components/planner/my-trips.tsx` (chỉ nếu cần), `src/components/map/member-map-view.tsx`, `member-map-share-panel.tsx`, `member-map-share-preview.tsx` (copy/note), **mới** `src/components/planner/member-home-tabs.tsx`, `src/server/planner/member-map.ts` (+helper), `messages/vi.json`, `messages/en.json`, `docs/**` liên quan, `tests/member-map*.test.ts`, `tests/dom/member-map-share-panel.test.tsx`, **mới** `tests/dom/member-home-tabs.test.tsx` (hoặc `tests/member-home-tabs.test.ts` nếu server-only).
- **Không đụng:** `e2e/**`, `playwright.config.*`, `package.json` (WEB-3 sở hữu), `src/content/destinations.ts`, `next.config.ts` (không cần đổi: `memberMapPaths` đã gồm `/chuyen-di-cua-toi`, `/en/my-trips`; `?tab=` không đổi header), `src/i18n/routing.ts`, `src/lib/return-to.ts` (đã giữ query cho `/my-trips`).
- **Va chạm với WEB-3:** chỉ qua selector (mục 9) và `messages/*.json` (nếu WEB-3 sửa — hiếm). Hai file JSON messages là điểm merge dễ conflict: thêm khóa mới ở cuối nhóm, không sắp lại.
- Không có PR mở nào chạm các file trên (kiểm lúc viết).

## 12. Acceptance / test
- Một h1, landmark, thứ tự heading (h1 → h2 theo panel → h3), focus thấy được, đích bấm ≥44px, không cuộn ngang ở 375/768/1280; VI/EN đủ khóa (test parity hiện có chạy).
- `?tab=` hợp lệ/lạ/thiếu → đúng tab/mặc định; khách → bản đồ trống ở mọi tab, **không mount** `MyTrips`/panel; thành viên không bao giờ nhận dữ liệu của người khác (allow-list `{slug, visits?}` giữ nguyên).
- Hoạt động khi tắt JS (điều hướng + nội dung tab Bản đồ/Chia sẻ-preview đã render server); Back/Forward đúng; deep link `/en/my-trips?tab=share`; `returnTo=/chuyen-di-cua-toi?tab=share` qua đăng nhập quay lại đúng tab.
- `robots noindex`, `private, no-store` trên `/chuyen-di-cua-toi` và `/en/my-trips` vẫn đúng (test `memberMapPaths`); `/ban-do-cua-toi`, `/en/my-map` vẫn 308.
- Test: `tests/member-map.test.ts` (đọc page/redirect — cập nhật chuỗi assertion), `tests/member-map-view.test.ts`, `tests/dom/member-map-share-panel.test.tsx` (D1/D2: ghi chú và cảnh báo hiện đúng; **token không rò** giữ nguyên), test mới cho `MemberHomeTabs` (aria-current, href theo locale, mặc định), test `getMemberSession`, test D4 copy. Mỗi test mới phải hỏng khi bỏ hành vi nó bảo vệ (ADR 0027 §5).
- Định nghĩa xong: `typecheck`, `lint`, `test`, `build` chạy và ghi output thật; `npm run test` các file dom chạy được (cần `npm ci`).

## 13. Rủi ro bảo mật / dữ liệu
- Không đổi biên tin cậy: cùng cookie, cùng allow-list, không API/DB mới. Rủi ro mới duy nhất: query `tab` do người dùng nhập → chỉ so với danh sách hằng, không phản chiếu vào HTML/URL/log.
- D1 hiện "số chuyến chưa hoàn thành" chỉ cho chủ sở hữu (đã đăng nhập, panel chỉ ở tab Chia sẻ của thành viên), không vào trang công khai/preview công khai.
- Không đưa token chia sẻ vào URL/`?tab=`; panel vẫn giữ token chỉ trong state (ADR 0030). `sec-check`: khuyến nghị nhưng chỉ khi chủ gọi.

## 14. Rollback
Revert PR (không migration, không đổi API/dữ liệu): trang trở về một cột như PR #210; liên kết `?tab=` cũ sẽ bị bỏ qua và hiện trang gộp. Không cần deploy đặc biệt.

## 15. Ngân sách
Single agent, 0 subagent. Ước lượng ~12–15 file, 1 session. Dừng nếu: `tests/dom/*` không chạy được vì môi trường (báo NOT RUN), hoặc chủ đổi quyết định ở CÂU HỎI 1–3.

## 16. CÂU HỎI MỞ cho chủ dự án (kèm khuyến nghị)
1. **Tab mặc định?** Khuyến nghị **Bản đồ** (giữ ý ADR 0031: bản đồ là trang chủ; `/my-trips` trần không đổi URL). Lựa chọn khác: **Chuyến đi** (mục đích dùng hằng ngày; sau khi tạo/ xóa chuyến quay về đúng danh sách).
2. **Kiểu tab:** liên kết thật + `aria-current` (khuyến nghị, hoạt động không JS) hay ARIA tablist có phím mũi tên (cần JS, phức tạp hơn)?
3. **Có đồng ý 3 tab "Chuyến đi / Bản đồ / Chia sẻ"** (khuyến nghị) hay 2 tab (gộp Bản đồ + Chia sẻ)?
4. **Giải thích chia sẻ (mục 5):** đồng ý D1–D4 (chỉ copy + ghi chú, không đổi dữ liệu công khai)? Khuyến nghị: có.
5. **Chuyến chưa hoàn thành có hiện ở bản chia sẻ không?** Khuyến nghị **không** (riêng tư/an toàn). Nếu muốn có "bao nhiêu chuyến": chỉ hiện số chuyến hoàn thành, không tiêu đề/ngày — cần ADR bổ sung 0030.
6. **Tài liệu:** gộp vào `member-map.*` (khuyến nghị, không tạo feature mới) hay tách `member-home.*` (cần dòng ở `docs/features/README.*`)?
7. **Cho phép tôi/ session thực thi** `npm ci` + chạy `build` trong worktree (làm nặng máy), và gọi `/sec-check` sau khi code xong (khuyến nghị: có, vì chạm trang có cookie phiên)?
