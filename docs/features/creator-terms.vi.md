# Tính năng — Chấp nhận Điều khoản Người tạo

🇻🇳 English version: [creator-terms.md](creator-terms.md)

## Summary

Thành viên đã đăng nhập phải chấp nhận **phiên bản hiện hành** của Điều khoản Người tạo trước khi máy chủ nhận yêu cầu đăng chuyến lên trang chủ hoặc đánh giá Planner của họ. Việc chấp nhận được ghi theo người dùng và phiên bản, và ghi thành sự kiện kiểm toán. Đọc, rút listing và xoá đánh giá của chính mình không bao giờ bị chặn; đánh giá của khách không bị ảnh hưởng (không có tài khoản). ADR [0019](../adr/0019-community-foundation.vi.md) §4, batch 10.4.

**Việc còn mở của chủ dự án (D5, Q8):** nội dung `contribution.terms` **chưa** được sửa. Văn bản vẫn nhắc ảnh và video dù chưa có chức năng tải lên, và chủ dự án chưa cung cấp lời văn thay thế. Chỉ thêm mã phiên bản. Điều 3 giữ nguyên.

## Routes

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `GET /api/planner/terms` | như nhau | như nhau |
| `POST /api/planner/terms` | như nhau | như nhau |

Phiên trình duyệt hoặc access token; phiên cookie phải gửi `Origin` / `Sec-Fetch-Site` và cùng origin (ADR 0010) như mọi thao tác ghi. `GET` → `{ version, accepted, acceptedAt }`. `POST { version, lang? }` → `200 { version, accepted: true, acceptedAt }`; `version` phải bằng bản hiện hành (nếu không `400`), khoá lạ trong body (như `userId`) là `422`; người dùng luôn là chủ phiên. Idempotent.

Cổng chặn: `PUT /api/planner/[id]/listing` và `PUT /api/planner/reviews/[placeSlug]` trả `403 { error: { code: 'forbidden', reason: 'terms_not_accepted' } }` cho tới khi chấp nhận phiên bản hiện hành. Không thêm mã lỗi mới.

## Data

`TermsAcceptance` — `id` (`trm_…`), `userId`, `version`, `acceptedAt`, `lang` (`vi` | `en`). Bảng `terms_acceptances` (migration `0012_terms_acceptances.sql`, rollback thủ công `db/rollback/0012_terms_acceptances.sql`), khoá JSON `termsAcceptances`; `UNIQUE (user_id, version)` (engine của store khoá hàng theo `id` nên khoá tự nhiên là ràng buộc duy nhất, không phải khoá chính); không khoá ngoại (ADR 0013). Dữ liệu cá nhân: id người dùng và thời điểm; không lưu IP, không lưu user agent. Xoá vĩnh viễn tài khoản xoá luôn các hàng của thành viên. Phiên bản là `termsVersion` trong `src/content/site.ts` (một ngày `YYYY-MM-DD`, ban đầu `2026-11-16`).

Sự kiện: `terms_accepted`, `targetKind: 'user'`, `targetId` và `actorId` = thành viên, `toStatus` = phiên bản; chỉ ghi ở lần chấp nhận đầu (lặp lại không ghi gì).

## How it works

Chủ dự án nâng `termsVersion` mỗi khi đổi văn bản. `tests/terms-version.test.ts` ghim SHA-256 của hai văn bản vào một phiên bản và thất bại nếu văn bản đổi mà không nâng (hoặc nâng mà không ghim lại), kèm hash mới. Sau khi nâng, mọi thành viên bị chặn ghi lại cho tới khi chấp nhận.

`PlannerRepository.requireTermsAccepted(userId)` là helper cổng; hai route ghi gọi nó ngay sau khi đọc body và **trước** bộ giới hạn tần suất, nên một lần bị từ chối không tốn hạn mức. Batch 10.5/10.6 dùng lại cho mọi thao tác ghi cộng đồng mới. Hai phương thức `requestListing` và `upsertPlannerReview` của repository không tự chặn; cổng nằm ở route. `acceptTerms` chạy trong một transaction của store cùng sự kiện.

Giao diện: `src/components/planner/terms-accept.tsx` (ô chọn, nhãn gắn với input, hàng 44px, dòng trạng thái) trong share panel (xin đăng) và trong form đánh giá Planner; nút gửi bị tắt cho tới khi chấp nhận, và `403 terms_not_accepted` hiện thông báo theo ngôn ngữ. Chuỗi: `creatorTerms` trong `messages/vi.json` và `messages/en.json`.

## Files

| Đường dẫn | Vai trò |
|---|---|
| `src/content/site.ts` | `termsVersion` |
| `src/server/planner/{schemas,store,repository}.ts` | `termsAcceptanceSchema`, collection, `termsStatus`, `acceptTerms`, `requireTermsAccepted` |
| `src/server/persistence/{planner-rows,planner-transfer}.ts` | ánh xạ bảng, schema import/export nghiêm ngặt |
| `src/app/api/planner/terms/route.ts` | GET / POST |
| `src/app/api/planner/[id]/listing/route.ts`, `src/app/api/planner/reviews/[placeSlug]/route.ts` | cổng chặn |
| `src/components/planner/{terms-accept,share-panel}.tsx`, `src/components/reviews/review-form.tsx` | giao diện |
| `db/migrations/0012_terms_acceptances.sql`, `db/rollback/0012_terms_acceptances.sql` | bảng và rollback |

## Tests

`tests/terms-acceptance-cases.ts` (dùng chung) chạy trên memory store ở `tests/terms-acceptance.test.ts` và trên PostgreSQL ở `tests/planner-postgres.integration.test.ts`: đóng rồi mở, idempotent (một hàng, một sự kiện), theo từng người dùng, nâng phiên bản thì đóng lại, phiên bản cũ bị từ chối và không có sự kiện, rút/đọc không bị chặn, xoá tài khoản xoá hàng. `tests/terms-acceptance-routes.test.ts`: trạng thái, chấp nhận, ẩn danh 401, khác origin 403, phiên bản cũ 400, `userId` trong body 422, hai cổng 403 kèm reason rồi 200. `tests/terms-version.test.ts`: đổi văn bản không nâng phiên bản. Các test hiện có ghi đánh giá Planner qua route đã chấp nhận Điều khoản trước (một dòng helper); không sửa assertion nào. Ca PostgreSQL bỏ qua khi không có `TEST_DATABASE_URL`; CI chạy.

## Limits and open questions

- Chủ dự án: cung cấp văn bản đã sửa (ảnh và video, Q8) rồi nâng `termsVersion` và hash ghim trong test (D5).
- Chỉ route bị chặn, repository thì không; route ghi mới phải gọi `requireTermsAccepted`.
- Không có email hay thông báo yêu cầu chấp nhận lại; thành viên biết ở lần ghi kế tiếp.
- Code cũ từ chối file JSON export có `termsAcceptances` (`.strict()`).
- Rollback: bỏ hai lời gọi cổng và route (việc ghi chạy như trước), chạy SQL rollback bằng tay; hàng đã lưu vô hại.
- Khuyến nghị `/sec-check` (quyền riêng tư của bảng, CSRF của route chấp nhận), chưa chạy.
