# Task Contract: CORE-15 CTA template cho story gốc `ba-ngay-lang-man-o-da-lat`
- Class: S (một giá trị seed + 1–2 test); thêm bước vận hành nếu chọn phương án B
- Desired outcome / user impact: trang `/stories/ba-ngay-lang-man-o-da-lat` hiện khối template + CTA vào `da-lat-3-ngay-lang-man`, nhất quán với `di-da-lat-lan-thu-sau`.
- Scope IN: quyết định phương án; (nếu duyệt) đổi seed + test + docs liên quan. OUT: đổi nghĩa `sourceStorySlug`/`plannerTemplateSlug` (ADR 0012 giữ nguyên), migration dữ liệu, code route.
- State: DONE (merged PR #192, 2026-11-19; seed only: the dev VM and any Postgres already seeded do NOT gain the CTA; option B (PATCH on real data) needs the owner)

## Evidence (file:line)
- Story gốc: `src/content/travel/seed.ts:264-266` (`daLatRomanticStory`, `plannerTemplateSlug: null`). Template: `seed.ts:451-453` (`sourceStorySlug: 'ba-ngay-lang-man-o-da-lat'`, `visibility: 'public'` ~463).
- Nạp seed: `seed.ts:567-593` — story được `createStory` rồi `publish` (583-584), template tạo sau (587), cuối cùng `seedStaticStories`. Story **published, noindex=false** → hiện trên site công khai (`/stories` lấy `getPublicContent().listStories()`; slug SEO `/chuyen-di-choi/ba-ngay-lang-man-o-da-lat`).
- CTA lấy ở đâu: `src/app/[locale]/stories/[slug]/page.tsx:33-39,73` (`loadLinkedTemplate(story.plannerTemplateSlug)`); `src/server/content/public.ts:132-150` chỉ giữ slug nếu template tồn tại và public, ngược lại null → không có CTA chết.
- `createStory` không kiểm tra `plannerTemplateSlug` tồn tại (không có tham chiếu trong `src/server/content/repository.ts`), nên đặt slug ở seed dù template tạo sau vẫn hợp lệ (đã có guard ở `public.ts`).
- Story `di-da-lat-lan-thu-sau` (`src/content/stories.ts:161`) có CTA; story gốc thuộc seed acceptance-test khác nguồn (`seed.ts`, không phải `stories.ts`).
- Dữ liệu đã nạp KHÔNG tự cập nhật: `seed.ts:570` thoát sớm khi store đã có place; `static-stories.ts:63-` là create-only theo slug, bỏ qua slug đã có (không bao giờ update). `src/server/content/instance.ts:85-87` chỉ autoseed khi store rỗng.
- Trường `plannerTemplateSlug` chỉ nằm ở schema/API (`src/server/content/schemas.ts:303`); **không có ô nhập trong admin UI** (grep `src/app`, `src/components` chỉ ra trang public). Nên "sửa qua admin" thực chất là gọi API admin PATCH story, không phải form.
- Test đụng tới: `tests/static-story-seed.test.ts:42` (chỉ kiểm 7 story tĩnh, không đụng story gốc); `tests/travel-content-acceptance.test.ts:37-72` (không assert `plannerTemplateSlug`); `tests/public-content.test.ts:215` (kiểm story kia); `tests/planner-sharing.test.ts:265` tự gán `plannerTemplateSlug` cho `linkedStory` qua spread — **cần kiểm khi triển khai** xem có giả định story gốc là null không.

## Phương án
- **A. Đổi seed + test** (`plannerTemplateSlug: 'da-lat-3-ngay-lang-man'` ở `seed.ts:265`, thêm assert vào `public-content.test.ts`/acceptance, 1 dòng ghi docs nếu có chỗ mô tả). Ưu: fresh store/CI/dev đúng ngay, có test giữ. Rủi ro: **không đổi môi trường đã nạp (dev VM, prod Postgres)** vì seed chỉ chạy khi rỗng; hai môi trường lệch nhau; test acceptance dùng chung nhiều nơi nên phải chạy lại toàn bộ.
- **B. Sửa trên môi trường thật** qua API admin PATCH story (không đổi mã). Ưu: có hiệu lực ngay trên dữ liệu thật, không cần deploy. Rủi ro: thủ công, không lặp lại được, fresh store vẫn không có CTA; thao tác ghi dữ liệu thật cần quyền admin và sự cho phép của chủ dự án.
- **C. Không làm.** Rủi ro thấp; chấp nhận story gốc không có CTA (CORE-13 đã xác nhận không phải lỗi). Hạn chế: bỏ lỡ đường dẫn người đọc → planner.
- **Khuyến nghị: A + B** (A để seed/CI nhất quán, B để áp cho dữ liệu đã nạp) — hoặc chỉ A nếu môi trường thật chưa quan trọng. Nếu chọn A, **chưa** cần ADR (không đổi hợp đồng, chỉ đổi dữ liệu seed).

## Nếu duyệt A (kế hoạch tối thiểu)
- File: `src/content/travel/seed.ts` (1 dòng), test: bổ sung assert vào `tests/public-content.test.ts` hoặc `tests/travel-content-acceptance.test.ts`; rà `tests/planner-sharing.test.ts:265`.
- Docs: kiểm `docs/features/*` có mô tả CTA/seed, nếu có sửa cả `.md` và `.vi.md` cùng cấu trúc tiêu đề.
- Tests: `npm run typecheck`, `lint`, `test` — nêu output. `/qc-check`, `/sec-check`: NOT RUN (chỉ khi chủ dự án gọi).
- Rollback: revert 1 dòng seed; không có migration.
- Budget: 0 subagent. Không commit/push/PR khi chưa được phép.
- Feature doc: không cần mới (thay đổi dữ liệu seed, không phải tính năng).
