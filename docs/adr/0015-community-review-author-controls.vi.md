# ADR 0015 — Quyền của staff với tác giả đánh giá: hỏi tác giả, tắt đánh giá của một tác giả

🇬🇧 English version: [0015-community-review-author-controls.md](0015-community-review-author-controls.md)

- **Trạng thái:** Đã chấp nhận theo khuyến nghị (chủ nhà duyệt 2026-11-15); PR 1 (hold / hỏi tác giả, migration `0007_review_hold.sql`) đã hiện thực, PR 2 (restriction) chưa làm. Câu hỏi 1–7 ở mục Việc tiếp theo giữ theo đáp án khuyến nghị cho tới khi chủ nhà nói khác
- **Ngày:** 2026-11-15
- **Người sở hữu:** system-architect
- **Người quyết định:** chờ chủ nhà (yêu cầu 2026-11-15: staff được hỏi tác giả, và được tắt đánh giá của một tác giả hoặc khách với một địa điểm hay với cả tài khoản Planner đó)
- **Ảnh hưởng:** `src/server/planner/{schemas,repository}.ts`, `src/server/persistence/planner-rows.ts` + `planner-transfer.ts`, migration `0007`, `src/server/identity/permissions.ts`, `src/app/api/admin/community/**`, `src/components/admin/community/review-queue.tsx`, `src/components/reviews/place-reviews-panel.tsx`, `messages/*.json`. Mở rộng [ADR 0014](0014-community-trips-and-reviews.vi.md); không đổi projection công khai nào của nó.

## Bối cảnh

[ADR 0014](0014-community-trips-and-reviews.vi.md) đã ra mắt đánh giá địa điểm **không
duyệt trước** (quyết định của chủ nhà). Staff (`community:moderate`: editor, admin,
service) chỉ có một công cụ: `decideReview(…, 'remove')` trên từng đánh giá, sau khi đã
đăng. Tác giả không được ghi đè hay xoá một đánh giá đã bị staff gỡ (security review,
PASS_WITH_WARNINGS).

Chủ nhà nay muốn hai việc: staff có thể **hỏi tác giả** về một đánh giá, và có thể **tắt**
đánh giá của một tác giả hoặc khách "với địa điểm hay planner đó".

Code cho biết gì, và chưa biết gì:

- **Tác giả Planner** có dòng `plannerUsers`: tên hiển thị, email *tuỳ chọn* (tài khoản
  do operator tạo có thể không có; đăng ký Google thì có), vai trò. Đánh giá giữ
  `authorId`; hàng đợi chỉ hiện tên hiển thị của tài khoản.
- **Khách** không có danh tính. Dấu vết duy nhất là `guestKey`, 32 ký tự hex đầu của
  SHA-256 của client key — giá trị đầu của `x-forwarded-for`, hoặc `x-real-ip`, hoặc
  `'unknown'` (`clientKey` trong `src/server/rate-limit.ts`). Header đó giả được; không có
  proxy tin cậy thì mọi client dùng chung `'unknown'`; sau NAT nhiều người chung một
  địa chỉ; và hash của địa chỉ IPv4 đảo ngược được bằng cách liệt kê, nên `guestKey` là
  *dữ liệu cá nhân giả danh*, không phải ẩn danh. Khách **không liên lạc được**, và chặn
  theo key yếu cả hai chiều (né được bằng cách đổi header, hại người vô can chung địa chỉ).
- Dự án **chưa có gửi mail**, không có nhà cung cấp mail hay địa chỉ gửi; email nhận yêu
  cầu gỡ nội dung trong `src/content/site.ts` (`contribution`) vẫn là `null`. Không bịa
  gì ở đây.
- "địa điểm hay planner đó" mơ hồ. Các cách hiểu:
  **A** theo địa điểm — tắt tác giả chỉ với *địa điểm đó*;
  **B** theo tài khoản Planner — mọi địa điểm;
  **C** (chỉ khách) theo địa điểm — đóng hẳn đánh giá của khách tại địa điểm đó.
  Thiết kế dưới đây hỗ trợ A và B bằng một trường (`placeSlug` null hay không) và nêu C
  như phần tuỳ chọn.

## Quyết định

Đề xuất — chủ nhà xác nhận.

1. **Hỏi tác giả = ghi chú trong ứng dụng, chỉ cho tác giả Planner.** Thêm trạng thái
   đánh giá `held` ("ẩn trong lúc staff hỏi tác giả"). Staff gọi
   `PATCH /api/admin/community/reviews/[id]` với `{ decision: 'hold', reason }`; `reason`
   (3–500 ký tự) là câu hỏi. Dùng lại các trường `decidedBy`, `decidedAt`, `rejectReason`
   sẵn có — không thêm cột, chỉ nới check `status` trong PostgreSQL. Đánh giá `held`
   **không công khai** (bị lọc như `removed`, không tính vào điểm trung bình). Tác giả
   thấy nó ở panel đánh giá Planner trong trang chi tiết chuyến đi (`OwnReview` đã có
   `status` và `rejectReason`) kèm thông báo rõ ràng, và **trả lời bằng cách sửa đánh
   giá**: `upsertPlannerReview` trên dòng `held` đăng lại ngay (`approved`, xoá ghi chú)
   — khớp với "không duyệt trước"; staff vẫn `remove` được. `held` chỉ áp dụng cho
   `source: 'planner'`; đánh giá của khách chỉ gỡ được. Ghi chú mà không ẩn: v1 không
   cung cấp (xem các phương án).
2. **Không email, không liên lạc ngoài ứng dụng ở v1.** Staff không thấy email tác giả;
   hàng đợi vẫn chỉ hiện tên hiển thị. Gửi email cần kênh mail và cơ sở đồng ý/pháp lý
   mà dự án chưa có. Không thiết kế ở đây.
3. **Tắt = một `ReviewRestriction`, không phải cờ trên user.** Entity mới trong store
   Planner (bảng `review_restrictions`, khoá JSON `reviewRestrictions`, không khoá
   ngoại): `id`, `subject: 'user' | 'guest'`, `authorId | null`, `guestKey | null`,
   `placeSlug | null` (null = mọi địa điểm), `reason` (3–500), `createdAt`, `createdBy`,
   `expiresAt | null`, `liftedAt | null`, `liftedBy | null`. Không bao giờ xoá dòng, nên
   bảng chính là nhật ký kiểm toán; gỡ chặn là đặt `liftedAt`.
4. **Staff không bao giờ nhập hay thấy id hoặc key.** `POST /api/admin/community/restrictions`
   nhận `{ reviewId, scope: 'place' | 'all', reason, expiresAt? }`; server suy ra đối
   tượng từ đánh giá đó (id tác giả, hoặc guest key). `GET /api/admin/community/restrictions`
   liệt kê; `DELETE …/restrictions/[id]` gỡ chặn (idempotent).
5. **Một restriction đang hiệu lực làm hai việc, cả hai đảo ngược được.**
   (a) **Chặn ghi mới** trong phạm vi: `upsertPlannerReview` và `createGuestReview` từ chối
   bằng `forbidden` (403) với thông điệp ổn định. (b) **Ẩn đánh giá hiện có trong phạm vi
   lúc đọc** — `listApprovedReviews`, điểm trung bình và dải ở trang chủ lọc theo các
   restriction đang hiệu lực; đánh giá lưu trữ và trạng thái `approved` giữ nguyên, nên
   gỡ chặn là khôi phục, không cần cập nhật hàng loạt. Ẩn không phải "gỡ": quyết định
   `removed` theo từng đánh giá vẫn vĩnh viễn và không bị gỡ chặn hoàn tác.
6. **Tác giả vẫn xoá được đánh giá đang hiển thị của mình** khi bị hạn chế (dữ liệu của
   họ), nhưng không xoá được đánh giá `removed` (quy tắc ADR 0014 giữ nguyên). Xoá tài
   khoản xoá luôn restriction cùng với các đánh giá.
7. **Khách: có thời hạn và có chốt chặn.** Restriction cho khách bắt buộc có `expiresAt`
   (mặc định 30 ngày, tối đa 90) và bị từ chối khi key của đánh giá là hash của
   `'unknown'` (chặn nó là im tiếng mọi khách). Màn admin cảnh báo địa chỉ có thể dùng
   chung. Lời từ chối với khách bị chặn trung thực ("đánh giá từ kết nối này đang tạm
   dừng", kèm liên hệ gỡ nội dung khi đã cấu hình) vì họ có thể là người vô can. Đây là
   rào cản với kẻ tái phạm, không phải cưỡng chế danh tính.
8. **Phân quyền.** Hold và gỡ từng đánh giá giữ ở `community:moderate` (editor, admin,
   service). Restriction là quyền nặng hơn đối với một con người: action mới
   **`community:restrict`**, chỉ admin và service, thêm vào `ROLE_ACTIONS` và test ma
   trận `can`. Không được hạn chế tài khoản đang có `community:moderate`. Mọi thao tác ghi
   của staff đi qua `adminPlannerRoute` (same-origin cho phiên cookie, ADR 0010) và một
   limiter mới theo principal (60 lần ghi/giờ); `decidedBy` / `createdBy` ghi người làm.
9. **Tác giả thấy gì.** `OwnReview` thêm `restriction` tuỳ chọn
   (`{ scope, reason, since, expiresAt }`) để panel nói *vì sao* không viết được, và
   `status: 'held'` hiện câu hỏi. **Khiếu nại:** không có trả lời trong ứng dụng (trả lời
   vẫn ngoài phạm vi, ADR 0014). Cho tới khi chủ nhà cung cấp `takedownContact`, thông
   báo không có liên hệ; khi có thì hiển thị và khiếu nại gửi tới đó.
10. **Projection công khai không đổi.** `PublicCommunityReview` và `CommunityTripCard`
    giữ allow-list từng trường; các test liệt kê hiện có phải qua mà không sửa.
    `ReviewQueueItem` (chỉ staff) chỉ thêm các trường không chứa id tác giả: cờ
    `restricted` và id restriction đang hiệu lực.
11. **Lưu trữ và phân phối.** Migration `db/migrations/0007_review_hold.sql` (PR 1)
    nới check `community_reviews.status` thêm `held`; PR 2 tạo
    `review_restrictions` trong `0008`; rollback trong `db/rollback/`. Phản chiếu trong `planner-rows.ts`, `planner-transfer.ts` và
    tài liệu JSON. Giao trong **hai PR**: PR 1 hold/hỏi (quyết định 1, migration status),
    PR 2 restriction (3–10).

## Các phương án đã xét

### Hỏi tác giả

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn) Ghi chú trong ứng dụng + `held`, trả lời bằng cách sửa | Không cần gì mới: không mail, không dữ liệu liên hệ, không vướng đồng ý; dùng lại trường cũ; lần sửa của tác giả chính là câu trả lời | Thụ động: tác giả chỉ thấy khi mở trang chuyến đi; khách không thể hỏi |
| B Chỉ ghi chú, đánh giá vẫn công khai | Nhẹ nhàng hơn | Trong lúc chờ trả lời, đánh giá có hại vẫn hiện — đúng lý do staff muốn hỏi |
| C Gửi email cho tác giả | Tiếp cận được | Chưa có nhà cung cấp mail hay địa chỉ gửi; thiếu dữ liệu liên hệ của chủ nhà; email có thể `null` hoặc do Google cấp; cần cơ sở đồng ý |
| D Cho staff xem email tài khoản để tự liên hệ | Không phải xây | Phát tán dữ liệu cá nhân tới mọi editor; không kiểm toán; không dùng được với khách/email `null` |

Phương án về nhì là B; thua vì hỏi mà không tạm ẩn thì vấn đề vẫn còn đó. "Ghi chú không
ẩn" có thể thêm sau như một cờ, không đổi schema.

### Tắt đánh giá

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn) Dòng `ReviewRestriction`, phạm vi địa điểm hoặc tài khoản, ẩn lúc đọc | Cả hai cách hiểu (A, B) bằng một trường; đảo ngược được; kiểm toán sẵn; không ghi đè hàng loạt | Thêm một bảng và một bộ lọc lúc đọc cho mọi lần đọc đánh giá công khai |
| B Cờ `reviewsDisabled` trên `plannerUsers` | Một cột | Chỉ theo tài khoản; không lý do, người làm hay lịch sử; không phủ được khách |
| C `remove` hàng loạt đánh giá của tác giả | Dùng lại `decideReview` | Không đảo ngược; mất ranh giới "đánh giá này" và "người này"; tắt nhầm phải sửa tay |
| D Chặn khách theo key vĩnh viễn | Đơn giản | Giả được, đụng địa chỉ dùng chung và `'unknown'`, lưu hash địa chỉ đảo ngược được vô thời hạn |
| E (tuỳ chọn, cách hiểu C) Công tắc theo địa điểm đóng đánh giá của **khách** tại địa điểm đó | Header không giả được; không dữ liệu cá nhân | Phạt mọi khách; chỉ ở mức địa điểm; là quyết định riêng |

Phương án về nhì là B; thua vì không diễn đạt được "với địa điểm đó" và không để lại dấu vết.

### Các cách hiểu phạm vi

| Cách hiểu | Nghĩa | Ghi chú |
|---|---|---|
| A | Tắt tác giả với một địa điểm | Phản ứng đầu tiên cân xứng |
| B | Tắt tác giả ở mọi địa điểm ("planner đó") | Cần cho kẻ tái phạm; né được bằng tài khoản mới |
| C | Đóng đánh giá của khách tại một địa điểm | Xem E ở trên |

Khuyến nghị: làm A và B cùng lúc (chi phí chỉ là một trường nullable), mặc định màn admin
là *địa điểm*, *mọi địa điểm* là lựa chọn rõ ràng. Hiện chưa khuyến nghị C.

## Hệ quả

Dễ hơn: staff có phản ứng theo bậc — hỏi, tạm ẩn, tắt theo địa điểm, tắt toàn bộ — thay
vì chỉ xoá; mỗi bước đều có nhật ký; gỡ một quyết định nhầm chỉ một lệnh; đầu ra công
khai giữ nguyên.

Khó hơn, và không miễn phí:

- **Yếu với khách**: key giả được và đôi khi dùng chung. Chặn khách có thời hạn là chủ
  ý, và không thể mạnh hơn nếu không có danh tính mà chủ nhà chưa chọn.
- **Né được với tài khoản**: người bị tắt có thể mở tài khoản thứ hai (đăng ký Google mở
  khi bật). Chấp nhận; muốn mạnh hơn cần việc về danh tính (các việc tiếp theo của ADR 0007).
- **Kênh thụ động**: ghi chú chỉ được thấy khi tác giả mở trang chuyến đi. Không email,
  không huy hiệu; tác giả không phản hồi thì đánh giá vẫn bị ẩn. Hiện chủ ý như vậy.
- **Một quyền mới của người kiểm duyệt đối với con người**: dùng sai tự nó là một tác
  hại, nên có lý do bắt buộc, ghi người làm, hết hạn cho khách, tách `community:restrict`
  và chủ nhà quyết định ai được giữ. Dòng restriction chứa dữ liệu cá nhân (id tác giả,
  guest key) và bị xoá cùng tài khoản.
- **Chi phí đọc**: mỗi lần đọc đánh giá phải đối chiếu restriction đang hiệu lực trong bộ
  nhớ; ổn ở quy mô dự kiến (hàng trăm đánh giá), xem lại nếu lớn lên.
- **Tác giả và quy tắc gỡ**: `held` là trạng thái không công khai duy nhất tác giả có thể
  thoát bằng cách sửa; `removed` và `rejected` vẫn đóng (quyết định 1 không làm yếu quy
  tắc của security review).
- Hoàn nguyên: gỡ route và UI; bảng và giá trị status nằm yên; file rollback xoá chúng
  thủ công và phải chuyển các dòng `held` sang `approved` hoặc `removed` trước.

## Việc tiếp theo

- Hợp đồng và phân chia việc: `.claude/contracts/community-review-author-controls.md`.
- Khi được chấp nhận: cập nhật `docs/architecture.md` + `.vi.md`, `docs/usage.md` +
  `.vi.md` (staff hold và tắt thế nào), `.claude/context/project-context.md`, và mở rộng
  `docs/features/community-reviews.*` (hoặc tài liệu mới `review-author-controls.*` theo ý
  chủ nhà).
- **Chủ nhà xác nhận:**
  1. Cách hiểu "địa điểm hay planner đó": A+B (khuyến nghị), chỉ A, hay thêm C?
  2. "Tắt": chặn ghi mới **và** ẩn đánh giá hiện có trong phạm vi (khuyến nghị), hay chỉ
     chặn ghi mới?
  3. Hỏi tác giả: ghi chú trong ứng dụng và ẩn đánh giá trong lúc chờ (khuyến nghị), hay
     đánh giá vẫn công khai khi hỏi? Có chấp nhận thông báo thụ động, không email?
  4. Ai được tắt: chỉ admin và service với `community:restrict` mới (khuyến nghị), hay
     mọi editor có `community:moderate`?
  5. Khách: chặn theo key có thời hạn (khuyến nghị, 30/90 ngày), hay không chặn khách mà
     chỉ dùng `remove` và cách hiểu C?
  6. Tác giả có thấy nguyên văn lý do của staff không? Khiếu nại gửi tới
     `takedownContact` — chủ nhà phải cung cấp (vẫn là `null`); không bịa.
  7. Staff có bao giờ được thấy email tác giả không? Khuyến nghị: không.
- Khuyến nghị chạy `/sec-check` trước khi merge PR 2 và `/qc-check` cho cả hai. Chưa chạy cái nào.
