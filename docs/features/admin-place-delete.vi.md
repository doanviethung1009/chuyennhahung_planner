# Tính năng — Xóa địa điểm trong quản trị

🇻🇳 English version: [admin-place-delete.md](admin-place-delete.md)

## Summary

Admin và super admin xóa vĩnh viễn được một địa điểm từ trang sửa của nó trong cổng quản trị. Editor và member không bao giờ thấy nút, và API từ chối họ. Địa điểm mà nội dung hoặc dữ liệu người dùng còn tham chiếu sẽ không bị xóa: trang báo còn thứ gì đang dùng nó, kèm số đếm. Quyết định: [ADR 0028](../adr/0028-content-delete-action.vi.md); contract `CORE-10`.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/admin/content/places/[slug]` (trang có sẵn, thêm "Vùng nguy hiểm") | `/quan-tri/noi-dung/dia-diem/[slug]` | `/en/admin/content/places/[slug]` |
| `DELETE /api/admin/travel/places/[slug]` (API có sẵn, nay nhận cả session) | như nhau | như nhau |

## Data

Đọc các khóa message `adminContent.places.delete.*` và `adminContent.errors.{place_in_use_counts,usage_*}`, và `adminRoles.actions.content_delete` cho ma trận vai trò. Body 409 mang `error.details.counts` (stories, collections, templates, contentReviews, tripActivities, communityReviews), chỉ là số.

## How it works

Trang server gọi `can(principal, 'content:delete')` và truyền `canDelete` xuống `PlaceEditor` → `RecordShell`, chỉ render `DeletePlace` khi true. Nút mở `<dialog>` modal gốc (khóa focus, Esc đóng, trả focus); "Xóa vĩnh viễn" gửi `DELETE` tới URL địa điểm cùng cookie session. 204 → về danh sách địa điểm. Khi bị từ chối, hộp thoại đóng và một alert hiện cạnh nút: 409 liệt kê loại còn dùng địa điểm (chỉ số đếm lớn hơn 0), 403 và 503 dùng thông báo lỗi có sẵn. Route API mới là chốt chặn thật: `adminContentRoute(..., { action: 'content:delete', session: true })`, nên session cần chứng minh same-origin, bị giới hạn tốc độ và phải có action; token dịch vụ vẫn dùng được.

## Files

| Path | Role |
|---|---|
| `src/server/identity/permissions.ts` | Action `content:delete`: admin, super admin, service |
| `src/app/api/admin/travel/places/[slug]/route.ts` | `DELETE` bật chế độ session |
| `src/components/admin/content/delete-place.tsx` | Vùng nguy hiểm, hộp xác nhận, alert lỗi |
| `src/components/admin/content/record-shell.tsx`, `place-editor.tsx` | Prop `canDelete`, vị trí đặt |
| `src/components/admin/content/use-record.ts`, `src/components/planner/api.ts` | `ApiError.details` và thông báo `place_in_use` kèm số đếm |
| `src/app/(admin)/[locale]/admin/content/places/[slug]/page.tsx` | `canDelete` tính ở server |
| `messages/vi.json`, `messages/en.json` | Chuỗi hai ngôn ngữ |

## Tests

- `tests/place-delete-session.test.ts`: ma trận quyền; session admin và super admin → 204; editor và member → 403; không cookie → 401; khác origin → 403; token → 204; 409 kèm số đếm với session admin.
- `tests/dom/delete-place.test.tsx`: không có nút khi thiếu `canDelete`; nút thật có nhãn, cao từ 44px; Hủy không gọi request; Xác nhận gửi `DELETE` và về danh sách; 409 chỉ hiện số đếm khác 0 trong alert; thông báo 403.
- `tests/place-delete-postgres.integration.test.ts` (cần `TEST_DATABASE_URL`, không có thì bỏ qua = NOT RUN): route trên kho PostgreSQL cho 204, 404, 409 (content, hoạt động chuyến đi, review cộng đồng) và 503 fail-closed.
- `tests/admin-roles-matrix.test.ts` (có sẵn): action mới có nhãn ở cả hai ngôn ngữ.

## Limits and open questions

- Xóa vĩnh viễn: không có soft delete hay hoàn tác. Hai kho không cùng một transaction khi tách riêng, nên có thể một chuyến đi thêm địa điểm vào giữa chừng; `GET /api/admin/planner/integrity` là chốt dự phòng.
- Chỉ địa điểm; story, review, collection và template vẫn chỉ `DELETE` bằng token.
- Sau khi xóa thành công, trang danh sách không có biểu ngữ "đã xóa"; địa điểm chỉ đơn giản biến khỏi danh sách.
