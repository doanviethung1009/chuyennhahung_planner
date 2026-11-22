# UI/UX Master Audit — Chuyện Nhà Hưng (2026-11-22)

> **Trạng thái: DỰ THẢO ĐỂ OWNER REVIEW.** Báo cáo chỉ đọc code và tài liệu. Không sửa frontend, API, database hay business logic; không tạo Task Contract triển khai; không spawn sub-agent; không merge.

## 0. Phương pháp và giới hạn

| Mục | Nội dung |
|---|---|
| Commit đã đọc | `a84ba11` (worktree `claude/ui-ux-master-audit-9b1524`, sạch). `origin/main` đang ở `177e466`, **hơn 4 commit** (PR #224 đổi nhãn mục đổi mật khẩu trong menu tài khoản, PR #225 lọc `/places` theo tỉnh; 18 file, chỉ `places/*`, `provinces`, `messages`, docs). Các finding bên dưới **không bị ảnh hưởng**, trừ chỗ ghi rõ ở UXA-12 (nhãn menu) và UXA-24 (form lọc places). |
| Đã đọc | `CLAUDE.md`, `.claude/rules/03`, `roadmap/CURRENT.md` + `backlog.md`, `contracts/core-completion-index.md`, `contracts/handoff/verify-my-trips-ui.md`, ADR 0029–0033, `src/components/layout/*`, `src/components/planner/*` (my-trips, trip-detail, member-home-tabs, trip-editor), `src/components/map/*`, `home/home-member-band.tsx`, `src/app/[locale]/{page,my-trips,stories,trip-templates,community-trips,plan-your-trip}`, `src/i18n/routing.ts`, `messages/{vi,en}.json` (nhóm `nav`, `myTrips`), token màu trong `globals.css`, `e2e/public-pages.spec.ts` + `e2e/support/page-checks.ts`. |
| **Chưa đọc sâu** | Chi tiết `places/[slug]`, `destinations/[slug]`, `itineraries/*`, `reviews` (chỉ kiểm cấu trúc), `share-panel.tsx` và `member-map-share-panel.tsx` (chỉ heading), mọi trang Admin (ngoài phạm vi yêu cầu). |
| **NOT RUN** | Không mở trình duyệt, không chạy dev server, `typecheck`/`lint`/`test`/`build`, `/qc-check`, `/sec-check`. Mọi nhận định về hiển thị là suy ra từ class Tailwind và cấu trúc JSX. |
| Contrast | Tính từ token trong `globals.css`: chữ phụ `ink-500` trên `cream-50` 6,13:1; `primary` `clay-600` trên nền 5,36:1; chữ trắng trên `clay-600` 5,54:1; viền điều khiển `border-strong` 3,37:1 (đạt 3:1 cho thành phần UI). **Không có finding về contrast màu.** |

**Nhãn bằng chứng** dùng xuyên suốt:

- **[C] Đã xác nhận qua code** — trích được `file:dòng` hoặc hành vi rõ ràng từ source.
- **[B] Cần kiểm tra trình duyệt** — code gợi ý có vấn đề nhưng kết luận phụ thuộc render thật (xem §5).
- **[P] Đề xuất cải thiện** — không phải lỗi; là hướng tốt hơn, cần Owner quyết.

**Mức độ**: **P1** = chặn hoặc làm khó một luồng chính, hoặc vi phạm quy tắc dự án. **P2** = làm giảm rõ rệt trải nghiệm, có cách vòng. **P3** = tinh chỉnh.

**ID**: finding `UXA-nn`, session đề xuất `UXS-n`, quyết định `UXD-n`. Đã grep `.claude/` và `docs/`: ba tiền tố này chưa dùng. `UX-1…UX-10` **đã tồn tại** (tiêu chí nghiệm thu trong `docs/specs-home-personalization*`) và `UI-S1…S6`, `WEB-1…3` cũng có sẵn nên không dùng lại.

## 1. UI-MYTRIPS-1 (ghi nhận theo yêu cầu của Owner)

| Thuộc tính | Giá trị |
|---|---|
| ID | **UI-MYTRIPS-1** (do Owner đặt; grep toàn repo không có trước báo cáo này) |
| Loại | Task con trong hạng mục Member Workspace → My Trips |
| Trạng thái | **Thiết kế đã được Owner duyệt. CHƯA implement.** Không có contract, không có code, không có PR. |
| Worktree liên quan | `claude/my-trips-card-ux-d5d88e` đang trỏ `a84ba11`, **0 commit** so với base: chưa có gì để merge. |
| Lưu ý | **Nội dung thiết kế đã duyệt không có trong repository** nên báo cáo không mô tả lại và không suy diễn phạm vi. Các quan sát ở UXA-13, UXA-14, UXA-20 là *đầu vào để đối chiếu* với thiết kế đó, không phải phạm vi chốt. |
| Hành động | Không tạo contract. Khi tới lượt (UXS-3), Owner đính kèm thiết kế đã duyệt vào contract; việc đầu tiên của session đó là đối chiếu với UXA-13/14/20 để tránh trùng hoặc mâu thuẫn. |

## 2. Hiện trạng cấu trúc (từ code)

**Public** — `primaryNav` (`nav-items.ts:14`) có 7 mục: Trang chủ, Chuyện đi chơi, Khám phá, Lên lịch trình, Chuyến đi cộng đồng, Góc review, Về nhà Hưng; Trang chủ chỉ có trong drawer. Menu inline từ `xl` (1280px) trở lên, dưới đó là drawer. Cạnh nav: chuyển ngôn ngữ, tài khoản (icon), nút CTA "Thiết kế chuyến đi". Footer có `places`, `map`, `tripTemplates`, `planTrip`, `myTrips` mà header không có.

**Member** — `/my-trips` là *member home* ba section theo `?tab=map|trips|share`, mặc định `map` (ADR 0031/0032, đều Accepted). Chi tiết chuyến `/my-trips/[id]` là một trang client dài: tóm tắt → quản lý → editor (ngày, hoạt động, chi phí) → review địa điểm → chia sẻ. Tạo chuyến: `/my-trips/new`, `/trip-templates` → `/trip-setup/[template]`.

**Điểm tốt cần giữ nguyên** (không phải finding, nhưng thay đổi sau này không được làm mất):
- Landmark đủ (`header`/`nav`/`main`/`footer`), skip link, một `<h1>` qua `PageHeader`; e2e kiểm một `<h1>`, không tràn ngang, không `href="#"` ở 375/768/1280.
- Drawer mobile: portal, `inert` phần nền, bẫy Tab, Escape trả focus (`main-nav.tsx:60-117`).
- Editor chuyến đi sắp xếp bằng nút **Lên/Xuống/Chuyển ngày** có `aria-label` theo tên hoạt động, không kéo-thả; xóa luôn có bước xác nhận (`day-card.tsx`, `expenses-panel.tsx`).
- Locale switcher là link thật; nút ≥44px được bảo đảm ở `buttonClass`; `prefers-reduced-motion` được xử lý (`globals.css:156`).
- `/trip-templates` xử lý tách bạch trạng thái rỗng và lỗi (`template-states.tsx`); `/places` là form GET có thể chia sẻ URL, không cần JS.
- Mọi chuỗi đi qua next-intl; có test parity VI/EN.

## 3. Bảng tổng hợp P1 / P2 / P3

| ID | Sev | Khu vực | Tóm tắt | Loại | Dependencies |
|---|---|---|---|---|---|
| UXA-01 | **P1** | Public · Header | Nav chính không có Địa điểm, Lịch trình mẫu, Bản đồ — đường vào lập chuyến chỉ nằm ở footer | [C] | UXD-1 |
| UXA-02 | **P1** | Public · Header | Nút CTA header đưa tới trang giới thiệu/liên hệ, không phải nơi tạo chuyến; người đã đăng nhập vẫn thấy cùng CTA | [C]+[B] | UXD-2 |
| UXA-03 | **P1** | Cross-cutting | Không có `loading.tsx`, `error.tsx`, `global-error.tsx` ở bất kỳ route nào; nhiều trang `force-dynamic` | [C] | UXD-6 |
| UXA-04 | P2 | Public · Header | Đăng nhập chỉ là icon ở desktop; nhãn chỉ nằm trong `aria-label`/`title` | [C]+[B] | UXD-4 |
| UXA-05 | P2 | Public · Header | Đổi ngôn ngữ làm mất query string (`?tab=`, `?q=`, `?page=`) | [C] | — |
| UXA-06 | P2 | Public · Header | Drawer cho mọi viewport < 1280px, gồm cả tablet ngang và laptop nhỏ | [C]+[B] | UXA-01 |
| UXA-07 | P2 | Public · Home | `if (!featured) return null` — trang chủ trống hoàn toàn khi chưa có story; nhiều read tuần tự, không Suspense | [C] | UXA-03 |
| UXA-08 | P2 | Public · Stories/Community/Reviews | Danh sách thiếu nhất quán: stories không phân trang/lọc/lỗi; community-trips và reviews rỗng chỉ là một dòng chữ, không CTA | [C] | UXD-7 |
| UXA-09 | P2 | Member · Home | Mục "Chuyến đi của tôi" mở tab **Bản đồ**, danh sách chuyến là tab thứ hai | [C]+[P] | UXD-3 |
| UXA-10 | P2 | Member · Home | `?tab=trips|share` của khách (hoặc khi không có overview) âm thầm hiển thị tab Bản đồ, thanh tab bị ẩn, URL ≠ nội dung | [C]+[B] | UXA-09 |
| UXA-11 | P2 | Member · Trip detail | Một trang rất dài, không điều hướng trong trang; header lớn chiếm màn hình đầu ở 375px | [C]+[B] | UXS-3 |
| UXA-12 | P2 | Member · Trip detail | Trạng thái chờ hiển thị một `<h1>` rồi thay bằng `<h1>` khác; lỗi tải dùng tiêu đề "không tìm thấy" và không có nút thử lại | [C] | UXA-03 |
| UXA-13 | P2 | Member · My Trips | Thẻ chuyến gánh quá nhiều tác vụ, không tóm tắt; không sắp xếp/lọc/tìm; tải ở client với "Đang tải…"; lỗi không có thử lại | [C] | **UI-MYTRIPS-1** |
| UXA-14 | P2 | Member · My Trips | Hai mẫu tab khác nhau trên cùng trang (link `aria-current` vs nút `aria-pressed`); Đang dùng/Lưu trữ chỉ ở state client | [C] | **UI-MYTRIPS-1** |
| UXA-15 | P2 | Cross-cutting · A11y | Chưa có kiểm tra tự động cho axe, thứ tự focus, bàn phím; e2e chỉ đo 3 viewport và 3 điều kiện | [C] | UXD-9 |
| UXA-16 | P3 | Public · Header | Tagline header 11px (`text-[0.6875rem]`), chỉ từ `md` | [C] | — |
| UXA-17 | P3 | Public · Header | Trạng thái đăng nhập lấy bằng fetch sau khi paint; avatar xuất hiện muộn, khác cơ chế dải thành viên trên trang chủ (server) | [C]+[B] | — |
| UXA-18 | P3 | Public · Footer | Cột "Về nhà Hưng" trộn Giới thiệu, Review, Thiết kế chuyến đi, Chuyến đi của tôi; khách bấm "Chuyến đi của tôi" nhận lời mời đăng nhập | [C] | UXA-01 |
| UXA-19 | P3 | Member · Sharing | Hai thứ cùng tên "Chia sẻ": tab chia sẻ bản đồ và panel chia sẻ trong từng chuyến | [C]+[B] | UXA-09 |
| UXA-20 | P3 | Member · My Trips | Nhãn "Đang dùng" (Active) mơ hồ; mô tả trang nói "cất đi" còn nút nói "Lưu trữ" | [C] | **UI-MYTRIPS-1** |
| UXA-21 | P3 | Cross-cutting · i18n | Hai khái niệm "bản đồ" cùng tên gần giống: `/map` ("Bản đồ hành trình" — của nhà Hưng) và tab "Bản đồ" (của thành viên) | [C]+[P] | UXD-1 |
| UXA-22 | P3 | Cross-cutting · i18n | Parity khóa VI/EN được test, nhưng không có kiểm tra độ dài chuỗi/ngắt dòng ở 375px | [P] | UXA-15 |
| UXA-23 | P3 | Cross-cutting · Responsive | e2e chỉ 375/768/1280; breakpoint đổi bố cục thật ở 1280 (`xl`) và 1024 (`lg`) không được kiểm | [C] | UXA-15 |
| UXA-24 | P3 | Public · Places | Form lọc 4 cột ở `lg`; sau PR #225 thêm lọc tỉnh nên bố cục cần xem lại | [B] | — |

Tổng: **3 P1, 12 P2, 9 P3**. Không finding nào là lỗi chức năng hay bảo mật; đều là cấu trúc điều hướng, trạng thái và kiểm chứng.

## 4. Chi tiết từng finding

### P1

#### UXA-01 — Nav chính thiếu các cửa vào lập chuyến [C]
- **Evidence:** `src/components/layout/nav-items.ts:14-22` (`primaryNav` 7 mục; chú thích `footerExtraNav` "surfaced in the footer only"); `site-footer.tsx:15-35` đặt `places`, `map`, `itineraries`, `tripTemplates` ở footer. Header không có `/places`, `/trip-templates`, `/map`; "Chuyến đi của tôi" chỉ có trong menu tài khoản.
- **Tác động:** Hai tính năng lõi vừa xong (WEB-1 `/places`, WEB-2 `/trip-templates`) khó khám phá ở nơi người ta tìm trước (header). Khách mới phải cuộn tới footer.
- **Recommendation:** Quyết định cấu trúc IA (UXD-1) rồi áp dụng: gom nhóm ("Khám phá" gồm Điểm đến/Địa điểm/Bản đồ; "Lên lịch trình" gồm Lịch trình mẫu) hoặc thêm mục lẻ. Cần thử ở 1280px vì hàng inline đã được ghi chú là "fills" (`account-menu.tsx` chú thích về việc nhãn làm nav xuống hai dòng).
- **Dependencies:** UXD-1; ảnh hưởng UXA-06, UXA-18, UXA-21. Sửa `nav-items.ts`, `main-nav.tsx`, `site-footer.tsx`, `messages/*`.
- **Acceptance:** (1) `/places` và `/trip-templates` đạt được trong ≤1 click từ header ở cả desktop và drawer. (2) Không xuống hàng ở 1280/1440 cả VI lẫn EN. (3) `aria-current` đúng cho trang con. (4) Test parity i18n và e2e `public-pages` vẫn qua. (5) Footer và header không mâu thuẫn tên gọi.

#### UXA-02 — CTA header không đưa tới nơi tạo chuyến [C]+[B]
- **Evidence:** `site-header.tsx:34` truyền `planHref="/plan-your-trip"`; `plan-your-trip/page.tsx:34-37` ghi trang này "No form here": liên kết tới `/trip-templates`, chuyến trống và kênh liên hệ. Nơi tạo thật là `/my-trips/new` và `/trip-templates`.
- **Tác động:** Nút nổi bật nhất header dẫn qua một trang trung gian thay vì tới hành động; với thành viên đã đăng nhập cũng không đổi (`MainNav` không đọc `account` để đổi CTA).
- **Recommendation:** UXD-2: giữ trang trung gian cho khách (giải thích) nhưng đổi đích/nhãn cho thành viên (ví dụ tới `/my-trips/new`), hoặc đổi nhãn nút cho đúng bản chất ("Bắt đầu lên kế hoạch"). Cần xác nhận với người dùng thật [B] xem họ kỳ vọng gì.
- **Dependencies:** UXD-2; `useAccount` đã có sẵn trong `MainNav`. Không cần API mới.
- **Acceptance:** (1) Nhãn và đích CTA khớp nhau với hai trạng thái khách/thành viên. (2) Không có trạng thái "nhấp nháy" đổi nhãn sau hydrate (dùng `loading` giữ nhãn mặc định). (3) Cả hai locale. (4) Test `header-account` cập nhật.

#### UXA-03 — Không có `loading`/`error` boundary [C]
- **Evidence:** `find src -name loading.tsx -o -name error.tsx -o -name global-error.tsx` → rỗng. Chỉ có `not-found.tsx`. `dynamic = 'force-dynamic'` ở trang chủ, `stories`, `trip-templates`, `my-trips`. Chỉ `/trip-templates` tự bắt lỗi (`page.tsx:20-27`); `stories/page.tsx` và `community-trips/page.tsx` không `try/catch` quanh `getPublicContent()`/`getCommunityTrips()`.
- **Tác động:** Khi DB (VM riêng) chậm, trang trắng đến khi server xong; khi lỗi, người dùng gặp trang lỗi mặc định không thương hiệu, không đường quay về. Hiện chỉ có dev VM nên chưa là sự cố; **nâng lên chặn khi có production**.
- **Recommendation:** Baseline chung: `error.tsx` có thương hiệu (nhãn VI/EN, nút thử lại, link về trang chủ), `global-error.tsx`, và skeleton/`loading.tsx` cho các route `force-dynamic`. Tái sử dụng mẫu `TemplatesError`. Không cần ADR nếu không đổi route.
- **Dependencies:** UXD-6. UXA-07, UXA-12 dùng chung mẫu.
- **Acceptance:** (1) Mô phỏng lỗi ở ít nhất stories, community-trips, my-trips: thấy trang lỗi trong layout, có `role="alert"`, thử lại hoạt động. (2) Route chậm hiện skeleton `aria-hidden` kèm một dòng `role="status"` (đúng tiêu chí UX-5 đã có trong specs). (3) Không có thêm `<h1>`. (4) Chuỗi trong cả hai catalogue. (5) Không rò chi tiết lỗi ra UI.

### P2

#### UXA-04 — Đăng nhập chỉ là icon ở desktop [C]+[B]
`account-menu.tsx:165-181` (dòng 174): link `size-11` chỉ có icon, nhãn nằm ở `aria-label`/`title`; chú thích code nói lý do là hàng nav đã đầy. **[B]** Kiểm xem người dùng không biết icon người = đăng nhập; trên mobile drawer có chữ đầy đủ. **Rec:** UXD-4, thử hiện chữ ở ≥1536px (`2xl`) hoặc sau khi UXA-01 sắp xếp lại hàng nav. **AC:** nhãn thấy được ở desktop hoặc có lý do ghi lại; tooltip không là cách duy nhất; không xuống dòng.

#### UXA-05 — Đổi ngôn ngữ mất query [C]
`locale-switcher.tsx:35` tạo href từ `{ pathname, params }`, không có `searchParams`. Ví dụ: ở `/chuyen-di-cua-toi?tab=trips` bấm EN → `/en/my-trips` (tab Bản đồ); ở `/dia-diem?q=da+lat&page=2` mất bộ lọc. **Rec:** nối `useSearchParams()` vào href (vẫn là link thật, hoạt động trước hydrate nên cần xử lý bằng cách đọc ở client sau hydrate hoặc để server truyền). **AC:** bộ lọc/tab được giữ; không có `?` lẻ; test mở rộng `header-account`/locale; vẫn là `<a>` thật.

#### UXA-06 — Drawer cho cả tablet và laptop nhỏ [C]+[B]
`main-nav.tsx:131,152,161`: hàng inline chỉ từ `xl:`; 768–1279px dùng hamburger. **[B]** Xem ở 1024 và 1180: có nên inline khi đã sắp lại nav? **AC:** quyết định breakpoint ghi lại; không tràn, không xuống dòng ở 1024, 1180, 1280, 1440.

#### UXA-07 — Trang chủ trống khi chưa có story [C]
`page.tsx:46`: `const featured = storiesNewestFirst[0]; if (!featured) return null;` → `main` rỗng, chỉ còn header/footer; dải thành viên cũng không hiện. Trang cũng đọc story, community trips và member tuần tự. **Rec:** trạng thái rỗng có nội dung (link tới lịch trình mẫu/liên hệ) và cân nhắc `Suspense` theo section. **AC:** môi trường trống vẫn có một `<h1>` và lối đi; không đổi hành vi khi có dữ liệu.

#### UXA-08 — Danh sách công khai thiếu nhất quán [C]
- `stories/page.tsx`: không phân trang, tìm, lọc, hay trạng thái lỗi (trong khi `/places` có đủ).
- `community-trips/page.tsx:43`, `reviews/page.tsx:80`: rỗng chỉ là `<p>`; `TemplatesEmpty` có tiêu đề + hai CTA.
**Rec:** dùng một bộ trạng thái rỗng/lỗi chung; UXD-7 quyết ngưỡng cần phân trang cho stories. **AC:** mọi danh sách công khai có rỗng có lối đi và lỗi có thử lại; mẫu dùng chung, không sao chép.

#### UXA-09 — "Chuyến đi của tôi" mở tab Bản đồ [C]+[P]
`member-home-tab.ts:9-10`: `DEFAULT_MEMBER_HOME_TAB = 'map'`; menu tài khoản, dải thành viên "Tất cả chuyến đi" và footer đều tới `/my-trips`. ADR 0032 đã **Accepted** với "Map (default)", nên đây **không phải lỗi mà là quyết định cần xem lại có dữ liệu**: nhãn nói "chuyến đi" nhưng nội dung đầu tiên là bản đồ. **Rec:** UXD-3. Nếu đổi mặc định cần sửa ADR 0032 (amendment) và các test `member-home-tab`/`my-trips-page`. **AC:** nhãn menu và nội dung đầu tiên khớp nhau; deep link cũ `?tab=` vẫn hoạt động.

#### UXA-10 — Tab không khớp URL với khách [C]+[B]
`my-trips/page.tsx:50-60`: nếu khách (hoặc `tab=share` mà `overview` null) thì render nhánh `map` kèm `MemberHomeTabs active="map"` hoặc ẩn thanh tab; URL vẫn `?tab=trips`. Tiêu đề h1 vẫn "Chuyến đi của tôi" với mô tả nói về "chuyến đã lưu". **Rec:** khách → chuyển hướng/hiển thị lời mời đăng nhập cho chính tab đã yêu cầu; xác định khi nào `overview` là null. **AC:** URL và nội dung nhất quán cho khách và thành viên ở ba tab; không lộ dữ liệu người khác (giữ ADR 0029).

#### UXA-11 — Trang chi tiết chuyến quá dài [C]+[B]
`trip-detail.tsx:134-248`: tóm tắt, quản lý, editor, review, chia sẻ xếp dọc; `PageHeader` dùng `py-12 md:py-16 lg:py-20`; không có mục lục/anchor, nút quay lại nằm **dưới** header. **[B]** đo độ dài cuộn ở 375px và vị trí panel chia sẻ. **Rec:** điều hướng trong trang (anchor hoặc tab), header gọn cho trang làm việc; ưu tiên sau UI-MYTRIPS-1 để cùng một ngôn ngữ thiết kế. **AC:** mỗi phần đạt được bằng 1 thao tác; focus và heading không đổi thứ tự; không đổi hợp đồng API.

#### UXA-12 — Trạng thái chờ/lỗi của chi tiết chuyến [C]
`trip-detail.tsx:53-68` (dòng 55): khi `loading` render `PageHeader` với `loadingTitle` (một `<h1>`), sau đó `<h1>` đổi sang tên chuyến; khi `error` dùng `missingTitle` dù là lỗi mạng, và chỉ có nút "Quay lại". **Rec:** tách tiêu đề lỗi/không tìm thấy, thêm "Thử lại", skeleton không dùng `<h1>`. **AC:** `error` và `missing` khác nhau; có thử lại gọi `fetchTrip`; tách `role="alert"`.

#### UXA-13 — Thẻ chuyến ở My Trips [C] — *đối chiếu với UI-MYTRIPS-1*
`my-trips.tsx:99-229`: mỗi thẻ có tiêu đề, một dòng meta, badge hiển thị, `select` trạng thái, "Nhân bản", "Lưu trữ" (và ở tab lưu trữ: "Khôi phục", "Xóa hẳn" có xác nhận). Không có ảnh/tiến độ/ngân sách/ngày kế tiếp; không sắp xếp, lọc theo trạng thái, hay tìm; danh sách tải ở client với "Đang tải…" (`:108`), `errorLoad` không có nút thử lại (`:105-106`); `role="status"` thông báo chung ở đầu danh sách, xa thẻ vừa thao tác. **Quan hệ:** đây là các quan sát mà thiết kế đã duyệt của UI-MYTRIPS-1 có thể đã giải quyết một phần; **không đề xuất contract riêng**. **AC (khi đối chiếu):** mọi quan sát được ghi "đã bao phủ/bỏ/chuyển UXS-x".

#### UXA-14 — Hai mẫu tab, state không vào URL [C] — *đối chiếu với UI-MYTRIPS-1*
`member-home-tabs.tsx` dùng link `aria-current="page"` (ADR 0032 có lý do rõ); `my-trips.tsx:24,112-127` dùng `button aria-pressed` cho Đang dùng/Lưu trữ, state `useState('active')` nên mất khi tải lại hoặc Back. **Rec:** thống nhất mẫu (hoặc ghi lý do chấp nhận) trong UI-MYTRIPS-1. **AC:** Back/Forward/F5 giữ nguyên chế độ xem; một mẫu cho cùng một loại điều khiển.

#### UXA-15 — Khoảng trống kiểm chứng a11y [C]
`grep axe` trong `package.json` và `e2e/` không có kết quả. `e2e/support/page-checks.ts` chỉ kiểm: một `<h1>`, không tràn ngang, không `href="#"`. Các thuộc tính a11y hiện được bảo đảm bằng đọc code. **Rec:** UXD-9 (cần Owner duyệt thêm devDependency `@axe-core/playwright`) cộng bước kiểm bàn phím cho drawer, menu tài khoản, editor. **AC:** axe không có vi phạm mức serious/critical ở các route chính, 2 locale, 375/768/1280; bước bàn phím cho drawer và menu tài khoản; chạy trong smoke hiện có.

### P3

| ID | Evidence | Gợi ý | Acceptance |
|---|---|---|---|
| UXA-16 | `site-header.tsx:30` `text-[0.6875rem]` (11px) | Dùng cỡ token ≥12px hoặc bỏ tagline ở header | Không giá trị cỡ chữ cứng ngoài token (test `design-tokens`) |
| UXA-17 | `account-menu.tsx:34-56` fetch sau mount, giữ ô 44px; trang chủ đọc session ở server (`home-page.ts`) | Giữ nguyên nếu [B] không thấy nhấp nháy; ghi lý do vào feature doc | Không dịch bố cục khi avatar xuất hiện (CLS ≈ 0) |
| UXA-18 | `site-footer.tsx:24-33` | Gom lại theo tác vụ (Khám phá / Lập chuyến / Về nhà Hưng) sau UXA-01 | Mỗi cột một chủ đề; khách không nhận trang đăng nhập bất ngờ |
| UXA-19 | `myTrips.sectionShare` "Chia sẻ" vs `share` panel trong chuyến | Đổi nhãn tab thành "Chia sẻ bản đồ" hoặc mô tả ngắn | Người dùng phân biệt hai loại chia sẻ [B] |
| UXA-20 | `messages/vi.json`: `tabActive` "Đang dùng", `description` "cất đi", nút "Lưu trữ" | Thống nhất thuật ngữ | VI và EN cùng ý; dùng một từ cho một khái niệm |
| UXA-21 | `nav.map` "Bản đồ hành trình" vs `myTrips.sectionMap` "Bản đồ" | Đặt tên phân biệt (của nhà Hưng / của bạn) | Hai tên không thể nhầm ở menu và tab |
| UXA-22 | `tests/i18n.test.ts` chỉ kiểm khóa | Thêm kiểm tra tràn dòng ở 375px cho nav, tab, nút thẻ | Không cắt chữ/tràn ngang ở VI dài nhất |
| UXA-23 | `VIEWPORTS` chỉ 375/768/1280 | Thêm 1024 và 1440 vào smoke | Không tràn ở 5 viewport |
| UXA-24 | `places-filter-form.tsx` (4 cột `lg:grid-cols-[2fr_1fr_1fr_auto]`; PR #225 thêm tỉnh) | [B] xem lại sau khi PR #225 vào | Form gọn ở 375/768/1024/1280 |

## 5. Danh sách cần kiểm tra trình duyệt (chưa làm — gom thành UXS-0)

| # | Cần xem | Liên quan |
|---|---|---|
| B1 | Hàng nav ở 1024, 1180, 1280, 1440 (VI và EN): có xuống dòng/chèn ép không? Thêm 2–3 mục thì sao? | UXA-01, 04, 06 |
| B2 | Người dùng thực có hiểu icon đăng nhập? Avatar xuất hiện có làm dịch bố cục? | UXA-04, 17 |
| B3 | Bấm EN từ `?tab=trips` và từ `/dia-diem?q=…` → đích có đúng không | UXA-05 |
| B4 | Khách mở `/chuyen-di-cua-toi?tab=trips` và `?tab=share` | UXA-10 |
| B5 | Chiều dài cuộn và vị trí panel chia sẻ ở trang chi tiết 375px | UXA-11 |
| B6 | Tải chậm (throttle) tại my-trips, trang chủ, stories: màn hình trắng bao lâu | UXA-03, 07 |
| B7 | Ngắt máy chủ/DB rồi tải stories, community-trips | UXA-03, 08 |
| B8 | Tab lần lượt bằng bàn phím: drawer, menu tài khoản, editor chuyến, tab member home | UXA-15 |
| B9 | Trình đọc màn hình (VoiceOver) với thông báo `role="status"` ở thẻ chuyến | UXA-13 |
| B10 | Form lọc Places sau PR #225 | UXA-24 |

## 6. Mapping finding → session đề xuất (không phải Task Contract)

> Mỗi dòng là **đề xuất phạm vi một session**. Chưa tạo file contract nào. Khi Owner duyệt từng cái, một session mới sẽ viết contract từ `.claude/contracts/TEMPLATE.md`. "Class" là phân loại AIEOS dự kiến.

| Session | Class | Finding | Phạm vi IN | Phạm vi OUT | File chính (không giao nhau với session khác trong cùng lúc) |
|---|---|---|---|---|---|
| **UXS-0** Kiểm chứng trình duyệt | S | B1–B10 → xác nhận/hủy UXA | Chỉ quan sát, cập nhật báo cáo này | Không sửa code | `.claude/reports/` |
| **UXS-1** Baseline lỗi/chờ | M | UXA-03, 07, 12 (phần lỗi), 08 (phần lỗi) | `error.tsx`, `global-error.tsx`, skeleton cho route động, home rỗng | Không đổi data/API, không đổi route | `src/app/[locale]/**` (file mới), `messages/*`, `components/ui/*` |
| **UXS-2** Header & điều hướng | M | UXA-01, 02, 04, 05, 06, 16, 18, 21 | Nav, CTA, nhãn đăng nhập, giữ query khi đổi ngôn ngữ, footer | Không đổi route (Rule 2), không thêm trang | `components/layout/*`, `messages/*`, test header |
| **UXS-3** = **UI-MYTRIPS-1** | M (Owner đã duyệt thiết kế) | UXA-13, 14, 20 (đối chiếu) | Theo thiết kế đã duyệt | Theo thiết kế đã duyệt | `components/planner/my-trips.tsx`, `member-home-tabs.tsx` |
| **UXS-4** Member home | M | UXA-09, 10, 19 | Mặc định tab, khớp URL/khách, tên "Chia sẻ" | Không đụng ADR 0029/0030 về dữ liệu | `app/[locale]/my-trips/page.tsx`, `lib/member-home-tab.ts`, ADR 0032 amendment |
| **UXS-5** Chi tiết chuyến | M | UXA-11, 12 (phần tiêu đề) | Điều hướng trong trang, header gọn, trạng thái | Không đổi API, không đổi editor logic | `components/planner/trip-detail.tsx`, `page-header` |
| **UXS-6** Danh sách công khai | S–M | UXA-08, 24 | Rỗng/lỗi dùng chung; ngưỡng phân trang stories | Không đổi schema/content | `app/[locale]/{stories,community-trips,reviews}/page.tsx`, `components/cards/*` |
| **UXS-7** A11y & responsive tự động | M | UXA-15, 22, 23 | Thêm axe vào Playwright, viewport 1024/1440, bước bàn phím | Không đổi UI | `e2e/**`, `package.json` (cần UXD-9) |

### Thứ tự và phụ thuộc

```
UXS-0 (xác nhận)
   ├─► UXS-1 (baseline lỗi/chờ)  ─────────────┐
   └─► UXS-2 (header/nav)  ──► UXS-4 (member home) ──► UXS-5 (chi tiết chuyến)
UXS-3 = UI-MYTRIPS-1 (Owner đã duyệt) ── chạy sau UXS-1; trước UXS-4/UXS-5
UXS-6 sau UXS-1 (dùng chung mẫu rỗng/lỗi)
UXS-7 sau cùng — hoặc ngay sau UXS-2 nếu Owner muốn có lưới an toàn sớm
```

**Lý do:** dùng chung `messages/vi.json` và `en.json` nên các session sửa UI chạy **tuần tự**, không song song (xung đột như đã gặp ở CORE-5/WEB-1). UXS-1 trước vì mọi session sau hưởng mẫu trạng thái chung. UXS-3 và UXS-4 cùng một vùng (`/my-trips`) nên không chạy đồng thời. Mỗi session = một branch = một PR, đúng quy tắc 9.

### Roadmap theo đợt

| Đợt | Nội dung | Điều kiện vào | Kết quả |
|---|---|---|---|
| **A — Xác nhận** | UXS-0 | Owner duyệt báo cáo này | Các mục [B] chuyển thành [C] hoặc bị hủy; P1/P2 chốt lại |
| **B — Nền** | UXS-1, UXS-2 | UXD-1, UXD-2, UXD-4, UXD-6 đã chốt | Header/CTA nhất quán; trang lỗi/chờ có thương hiệu |
| **C — Member** | UXS-3 (UI-MYTRIPS-1), UXS-4, UXS-5 | UXD-3, UXD-5 chốt; thiết kế đính kèm | Không gian thành viên nhất quán |
| **D — Hoàn thiện** | UXS-6, UXS-7 | UXD-7, UXD-9 | Danh sách thống nhất, có lưới kiểm tự động |

## 7. Quyết định cần Owner phê duyệt

| ID | Câu hỏi | Khuyến nghị | Chặn |
|---|---|---|---|
| **UXD-1** | Cấu trúc nav chính: thêm Địa điểm/Lịch trình mẫu/Bản đồ bằng cách nhóm hay thêm mục lẻ? | Nhóm thành hai mục: "Khám phá" (điểm đến, địa điểm, bản đồ) và "Lên lịch trình" (lịch trình, mẫu), thử ở 1280 trước | UXS-2 |
| **UXD-2** | CTA header cho thành viên đi đâu và gọi là gì? Giữ `/plan-your-trip` cho khách? | Khách → trang hiện tại; thành viên → `/my-trips/new` | UXS-2 |
| **UXD-3** | Đổi tab mặc định của `/my-trips` từ Bản đồ sang Chuyến đi (amendment ADR 0032)? | Đổi sang Chuyến đi nếu [B] cho thấy người dùng mong thấy danh sách; nếu giữ, đổi nhãn menu | UXS-4 |
| **UXD-4** | Đăng nhập ở desktop: icon hay có chữ? | Có chữ từ ≥1536px, icon dưới đó (sau khi nav sắp lại) | UXS-2 |
| **UXD-5** | **UI-MYTRIPS-1:** đính kèm thiết kế đã duyệt vào repo/contract; xác nhận UXA-13/14/20 là đầu vào chứ không phải phạm vi; chốt thứ tự so với UXS-1 | Thiết kế ghi vào contract UXS-3; chạy sau UXS-1 | UXS-3 |
| **UXD-6** | Chuẩn trạng thái chờ/lỗi toàn site: `error.tsx` + skeleton `aria-hidden` kèm `role="status"`; có cần ADR không? | Không cần ADR (không đổi route/dữ liệu); contract M | UXS-1 |
| **UXD-7** | Ngưỡng cần phân trang/tìm kiếm cho Stories và Chuyến đi cộng đồng? | Phân trang khi > 12 mục, chưa thêm tìm kiếm | UXS-6 |
| **UXD-8** | Giữ query khi đổi ngôn ngữ — chấp nhận là hành vi chuẩn? | Có; không cần ADR | UXS-2 |
| **UXD-9** | Thêm devDependency `@axe-core/playwright`? | Có, chỉ dev; kèm bước bàn phím | UXS-7 |
| **UXD-10** | Có đồng bộ audit với `origin/main` (`177e466`) trước khi UXS-0 không? | Có — rebase worktree trước khi duyệt trình duyệt | UXS-0 |

## 8. Việc cần Owner làm / không làm trong báo cáo này

- **Không đổi:** không file nào ngoài `.claude/reports/ui-ux-master-audit.md`. Chưa commit, chưa push, chưa tạo PR.
- Cập nhật `roadmap/CURRENT.md`, `backlog.md` hoặc `core-completion-index.md` **không** nằm trong phạm vi này; sẽ làm khi Owner chấp nhận các session ở §6.
- **`/qc-check` và `/sec-check`: NOT RUN** (báo cáo không có thay đổi code; `sec-check` không cần cho audit này).

## 9. Dừng để review

Báo cáo dừng ở đây theo yêu cầu. Không có session UXS nào được bắt đầu.

---

# Phụ lục A — Kết quả UXS-0: kiểm chứng trình duyệt (2026-11-22)

**Môi trường:** `origin/main` @ `e79fd5d` (đã gồm PR #224, #225, #229), `next dev` cục bộ cổng 3000, trình duyệt tích hợp, JSON store `.data/` (gitignore). Tài khoản test `member` tạo bằng `npm run admin:create` (chỉ cục bộ, đã đặt lại mật khẩu qua UI). Mật khẩu **không** ghi vào báo cáo. Một chuyến thử "UXS0 chuyến thử Đà Lạt" (3 ngày, trống) nằm trong `.data/planner.json`. Phát hiện phụ: server dev **cache store JSON trong bộ nhớ**; tài khoản tạo sau khi server chạy chỉ đăng nhập được sau khi khởi động lại server. Đây là hành vi của môi trường test, không phải lỗi giao diện.
**Giới hạn:** đây là bản dev, không phải build production; không có trình đọc màn hình, không throttle mạng, không ngắt DB; không kiểm viewport 1180 và 1536.

| # | Kết quả | Chi tiết | Tác động lên finding |
|---|---|---|---|
| B1 | **Xác nhận, nặng hơn dự đoán** | VI ở 1280px: hàng nav một dòng, nhưng **chỉ còn 17px** trống giữa nav và cụm bên phải; ở 1440px còn **25px** (EN: 82px ở 1280, 90px ở 1440). 1024px dùng hamburger, không tràn. Thêm bất kỳ mục VI nào vào hàng inline sẽ làm xuống dòng hoặc đè lên cụm phải. | UXA-01, UXA-06: **không thể chỉ thêm mục lẻ**; cần UXD-1 (nhóm) hoặc dời breakpoint/`2xl`. Giữ P1/P2. |
| B2 | **NOT RUN** | Cần người dùng thực; chỉ xác nhận icon đăng nhập hiện đúng cạnh bộ chuyển ngôn ngữ ở 1280px. | UXA-04 giữ nguyên, vẫn cần nghiên cứu người dùng. |
| B3 | **Xác nhận, rộng hơn dự đoán** | Link đổi ngôn ngữ trỏ `/en/places` (mất `?q=…&page=…`), `/en/my-trips` (mất `?tab=trips`), và ở `/dang-nhap?returnTo=…` hay `/doi-mat-khau?returnTo=…` thì mất cả `returnTo`. Giống nhau cho khách và thành viên. | UXA-05: nâng ghi chú — ảnh hưởng cả luồng đăng nhập. **Đề xuất nâng P2 → P1** (đổi ngôn ngữ giữa luồng đăng nhập làm mất đích quay lại); chờ Owner. |
| B4 | **Xác nhận** | Khách mở `?tab=trips` và `?tab=share`: URL giữ nguyên, nội dung là tab Bản đồ, **không có thanh tab**, tiêu đề "Chuyến đi của tôi" kèm mô tả về "chuyến đã lưu". Thành viên: tab `trips` đúng, `aria-current="page"` đúng. | UXA-10 xác nhận, giữ P2. |
| B5 | **Xác nhận** | Chuyến trống 3 ngày ở 375px: trang cao **5,7 màn hình** (4664px / 812px), panel Chia sẻ bắt đầu ở y=3095 (≈3,8 màn hình), khối header 250px; form "Sửa thông tin chuyến đi" một mình ≈1050px; **0 anchor** trong trang; không tràn ngang. Ở 1280px: 3,6 màn hình. Thứ tự heading đúng (h1 → h2 → h3). | UXA-11 xác nhận, giữ P2. Chuyến có hoạt động và chi tiêu sẽ dài hơn. |
| B6 | **NOT RUN** | Không có throttle mạng/DB trong phiên này. | UXA-03, UXA-07 vẫn chỉ [C]. |
| B7 | **NOT RUN** | Không ngắt được store. | UXA-03, UXA-08 vẫn chỉ [C]. |
| B8 | **Một phần** | Drawer 375px (thành viên): mở bằng Enter, focus vào panel, `main` được `inert`, 11 mục (7 nav + Chuyến đi của tôi + Tài khoản và bảo mật + Đăng xuất + CTA), Escape đóng và trả focus về nút "Mở menu", `inert` được gỡ. **Chưa kết luận về bẫy Tab:** sau 13 lần Tab focus rơi vào `nextjs-portal` (chỉ báo của Next dev), vì panel nằm cuối `body`. Cần lặp lại trên build production (UXS-7). Menu tài khoản desktop chưa kiểm. | UXA-15 giữ P2. Ghi nhận mục "Tab từ panel khi focus đang ở chính panel" để UXS-7 kiểm. |
| B9 | **NOT RUN** | Không có trình đọc màn hình. | UXA-13 giữ [C]. |
| B10 | **Xác nhận (nhẹ)** | `/dia-diem` ở 1280px: 4 điều khiển + nút trên một dòng, nhưng ba ô `select` (tỉnh, điểm đến, loại) chỉ rộng **129px** — nhãn dài như "Quảng Bình (Phong Nha)" sẽ bị cắt. Ở 375px form cao 388px (≈ nửa màn hình) trước khi tới kết quả; không tràn ngang. | UXA-24 xác nhận, giữ P3. |

## Điều chỉnh đề xuất sau kiểm chứng

| Finding | Trước | Đề xuất | Lý do |
|---|---|---|---|
| UXA-05 | P2 | **P1** (Owner quyết) | Mất `returnTo` khi đổi ngôn ngữ giữa luồng đăng nhập/đổi mật khẩu |
| UXA-01 | P1 | P1, **thêm ràng buộc** | Hàng nav inline VI chỉ còn 17px ở 1280px; UXD-1 phải là phương án nhóm hoặc đổi breakpoint |
| Các finding khác | — | Không đổi | Đã xác nhận hoặc vẫn chưa kiểm được |

## Còn lại chưa kiểm (đề xuất đưa vào UXS-7 và build production)
B2 (người dùng thực), B6 và B7 (độ trễ và lỗi), B9 (trình đọc màn hình), bẫy Tab của drawer và menu tài khoản desktop trên build production, viewport 1180 và 1536.

---

# Phụ lục B — Kết quả UXS-2: Header và điều hướng (2026-11-23)

Quyết định của Owner: UXD-1 nhóm hai mục; UXD-2 khách → `/plan-your-trip`, thành viên → `/my-trips/new` ("Tạo chuyến đi"); UXD-4 chữ "Đăng nhập" từ 1536px; UXD-8 giữ query khi đổi ngôn ngữ. Tài liệu: [header-navigation](../../docs/features/header-navigation.vi.md).

| Finding | Trạng thái | Cách xử lý |
|---|---|---|
| UXA-01 | **Đã xử lý** | Nhóm "Khám phá" (điểm đến, địa điểm, bản đồ nhà Hưng) và "Lên lịch trình" (lịch trình, lịch trình mẫu); mỗi trang một lần bấm (desktop và drawer). |
| UXA-02 | **Đã xử lý** | CTA theo phiên: khách `/plan-your-trip`, thành viên `/my-trips/new`; ô giữ chỗ vô hình khi đang tải nên không đổi nhãn sau hydrate. |
| UXA-04 | **Đã xử lý một phần** | Chữ "Đăng nhập" từ 1536px; dưới đó vẫn là icon (không còn chỗ ở 1280px). Cần nghiên cứu người dùng (B2) vẫn mở. |
| UXA-05 | **Đã xử lý** | Link đổi ngôn ngữ giữ `?query` (gồm `returnTo`), vẫn là `<a>` thật. `returnTo` vẫn mang đường dẫn ngôn ngữ cũ; trang đăng nhập nhận cả hai. |
| UXA-06 | **Giữ nguyên có chủ đích** | Drawer dưới 1280px; hàng VI ở 1280px chỉ dư 13px nên không hạ breakpoint. |
| UXA-16 | **Đã xử lý** | Tagline 12px. |
| UXA-18 | **Đã xử lý** | Footer ba cột Khám phá / Lập chuyến / Nhà Hưng; bỏ "Chuyến đi của tôi" khỏi footer. |
| UXA-21 | **Đã xử lý** | `/map` là "Bản đồ nhà Hưng" / "Hưng's map"; tab thành viên là "Bản đồ của bạn" / "Your map" (chỉ chuỗi). |

**Số đo (trình duyệt tích hợp, dev server, trang chủ, khách):** hàng nav một dòng, mục 44px, không đè, không cuộn ngang. VI dư 13px (1280), 21px (1440), 51px (1536, có chữ đăng nhập); EN dư 53, 133, 149px. 1024 và 1180: drawer cả hai ngôn ngữ. Chưa kiểm: thành viên đăng nhập trong trình duyệt (có test DOM), build production, bẫy Tab của drawer (UXS-7).

# Phụ lục C — Kết quả UXS-3: Chuyến đi của tôi (2026-11-23)

Owner xác nhận: phần thẻ đã merge (PR #224, #226) chính là UI-MYTRIPS-1; UXS-3 làm phần còn thiếu. Tài liệu: [my-trips-list](../../docs/features/my-trips-list.vi.md).

| Finding | Trạng thái | Cách xử lý |
|---|---|---|
| UXA-13 | **Đã xử lý một phần** | Có tìm, lọc tình trạng, sắp xếp (client). Nút Thử lại khi lỗi tải đã có từ trước. Còn mở: tóm tắt/ảnh/ngân sách trên thẻ, tải ở client, thông báo `role="status"` còn ở đầu danh sách (B9 chưa chạy). |
| UXA-14 | **Đã xử lý** | Đang dùng/Lưu trữ là link `aria-current` với `?view=archived`, cùng mẫu với các mục trang chủ; Back/F5 giữ chế độ. |
| UXA-20 | **Đã xử lý** | "Đang dùng" → "Hiện có" / "Current" ở danh sách chuyến; mô tả trang dùng "lưu trữ". `admin…viewActive` giữ nguyên (khái niệm khác). |
| UXA-09, 10, 11 | **Không chạm** | Ngoài phạm vi UXS-3. |

