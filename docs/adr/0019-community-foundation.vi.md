# ADR 0019 — Nền tảng cộng đồng (Phase 10): một máy trạng thái kiểm duyệt, một audit log và bộ giới hạn ghi dùng chung

🇻🇳 English version: [0019-community-foundation.md](0019-community-foundation.md)

- **Trạng thái:** Đã chấp nhận (quyết định D1 của chủ dự án, 2026-11-16)
- **Ngày:** 2026-11-16
- **Chủ trì:** system-architect
- **Ảnh hưởng:** `src/server/community/**` (mới `submission.ts`, `events.ts`), `src/server/planner/repository.ts` (chỉ các method kiểm duyệt), `src/server/rate-limit.ts` và một module limiter dùng chung mới, `src/server/persistence/planner-rows.ts`, `planner-transfer.ts`, `db/migrations/0010_*.sql`, `src/server/identity/permissions.ts` (dự kiến không đổi)
- **Thuộc:** Phase 10 (Community Foundations) trong `.claude/roadmap/PHASES.md`: giao P10-1 (audit log) và P10-6 (limiter dùng chung); xem [specs-community-roadmap.vi.md](../specs-community-roadmap.vi.md)

## Bối cảnh

Các [spec Community Platform](../specs-community-overview.vi.md) gom công việc thành các nhóm spec C1–C7, ánh xạ lên Phase 10–15. Phase 10 (nhóm spec C1) là nền tảng cho mọi phase sau. Ba sự thật từ repository định hình nó:

1. **Kiểm duyệt đang rời rạc và không có log.** Việc đăng chuyến đi qua `requestListing`,
   `withdrawListing`, `decideListing` và một lần xếp hàng lại ngầm trong `touch`
   (`src/server/planner/repository.ts`); gỡ và giữ đánh giá, hạn chế user là các method
   riêng. Không dòng nào ghi ai làm gì. Backlog Phase 07 liệt kê audit log là chưa thiết kế
   ([architecture.vi.md](../architecture.vi.md#phases)). Các lát sau của Phase 10 cần thêm trạng thái
   (`changes_requested`, `unpublished`) và Phase 12 thêm một loại nội dung, nên các quy tắc phải
   nằm một chỗ trước khi nhân lên.
2. **Bộ giới hạn ghi theo tiến trình và reset khi khởi động lại.** `createRateLimiter` giữ
   lượt trong một `Map` (`src/server/rate-limit.ts`); phần đầu file đã nói vậy, và ADR 0005
   và 0008 gọi kho dùng chung là điều kiện cho instance thứ hai. Auto deploy
   (ADR [0016](0016-auto-deploy-dev.vi.md)) khởi động lại tiến trình ở mỗi lần `main` xanh,
   làm rỗng mọi bucket. Cộng đồng thêm các đường ghi (sao chép, báo cáo, bình luận, upload)
   nơi điều đó quan trọng hơn so với đánh giá khách mà nó bảo vệ hiện nay.
3. **Không gì nhìn thấy được phải đổi.** Mọi thứ ở đây là việc chuẩn bị nền. Cổng đóng góp đang **mở** trên `main` (điều khoản và liên hệ gỡ bài đã điền), nên việc ghi chuyến và đánh giá hiện có đang lên sóng mà chưa có audit log hay điều khiển Báo cáo; vì vậy phase này đi trước.

Chưa biết: khối lượng ghi thực tế, và VM PostgreSQL có thêm độ trễ đáng kể cho mỗi lần
kiểm limiter không (giả định là một vòng LAN; chưa đo).

## Quyết định

ADR này giao **ba thứ, không thứ nào khách nhìn thấy**, trong ba PR; phần còn lại của Phase 10 (ghi nhận Terms, báo cáo, trạng thái đăng) là lát riêng. Cái gì chưa có nơi dùng cho
tới phase sau thì hoãn tới phase đó (tinh thần quy tắc 4 của CLAUDE.md: không bề mặt chết,
không schema nằm không).

### 1. Một máy trạng thái kiểm duyệt, `submission.ts`

- Một module thuần, không I/O, unit test như `budget.ts`. Xuất `SubmissionState`, các
  action và `transition(state, action) → state | null` (`null` nghĩa là không được phép).
- Trạng thái và cạnh đúng như sơ đồ trong
  [specs-community-moderation.vi.md](../specs-community-moderation.vi.md). Nó **không**
  kiểm vai trò; nơi gọi kiểm bằng `can()`.
- **Hành vi hiện có được giữ nguyên.** Việc đăng chuyến được diễn đạt lại qua nó bằng ánh
  xạ chỉ đọc: `none` ↔ không có bài gửi, `pending`, `approved` ↔ `published`, `rejected`.
  Hình dạng `listing` lưu trữ và ba trạng thái của nó không đổi trong ADR này; `changes_requested`
  và `unpublished` được thêm ở một lát sau của Phase 10 cùng migration của chúng. Repository gọi `transition` để
  kiểm tra, và giữ mã lỗi hiện nay (`invalid_state`).
- Gỡ/giữ đánh giá và hạn chế user vẫn nằm ngoài máy trạng thái (quyết định của chủ dự án:
  đánh giá ngắn được hậu kiểm theo ADR 0014/0015), nhưng được **ghi log** (điểm kế tiếp).

### 2. `AuditEvent`: log chỉ nối thêm trong cùng transaction

- Một ngoại lệ có tên (ADR 0024 §8, xóa review khách): `redactEventReasons` bỏ trống `reason` do staff gõ của các event về review đã xóa và hạn chế khách của nó, không bao giờ đụng action, người thực hiện, trạng thái hay thời gian.
- Trường: `id`, `targetKind` (`trip`, `review`, `user`), `targetId`, `actorId`, `actorKind`
  (`user` hoặc `service`), `action`, `fromStatus`, `toStatus`, `reason` (≤500), `createdAt`.
- Ghi **trong cùng transaction kho Planner** với thay đổi nó mô tả, nên một quyết định và
  bản ghi của nó không thể lệch nhau. Mọi hành động của nhân viên và chủ chuyến hiện có
  trong cộng đồng đều ghi một dòng: xin đăng, rút, duyệt, từ chối, gỡ, lần xếp hàng lại
  sau khi sửa, gỡ và giữ đánh giá, áp và gỡ hạn chế.
- Chỉ nối thêm: không có method sửa hay xóa, không có API để sửa. Nhân viên đọc qua
  `GET /api/admin/community/events?targetId=` (action `community:moderate`); tác giả thấy
  sự kiện trên chuyến của mình qua một projection không có danh tính người thực hiện.
- Lưu ở kho Planner (khối lượng thấp), dạng bảng `audit_events` phản chiếu trong
  `planner-rows.ts` và `planner-transfer.ts`, và dạng khóa tài liệu `auditEvents` ở
  kho JSON. Không khóa ngoại (ADR 0013). Lưu giữ: 1 năm rồi dọn; id người thực hiện của
  nhân viên đã xóa được giữ dưới dạng id ẩn danh.
- Đây **chính là** audit log dùng chung của PHASES.md P10-1 (= P07-4): một bảng, hành động cộng đồng trước. Thay đổi vai trò và template dùng cùng bảng ở một lát sau, không phải ở đây.

### 3. Bộ giới hạn dùng chung trên PostgreSQL cho các đường ghi

- Interface mới `AsyncRateLimiter { check(key): Promise<RateLimitResult> }`, cạnh interface
  đồng bộ hiện có, cái này **được giữ** cho các lượt đọc và kho JSON.
- Một **bộ đếm cửa sổ cố định** trong bảng `rate_limit_counters (key, window_start, count)`,
  tăng bằng một câu `INSERT … ON CONFLICT DO UPDATE … RETURNING count` nguyên tử. Nó cố ý
  đi vòng transaction toàn kho của kho Planner, để không xếp hàng trên khóa kho (ADR
  [0009](0009-postgres-persistence.vi.md)). Cửa sổ cũ được dọn khi có dịp. Cửa sổ cố định
  có thể cho qua tới gấp đôi giới hạn quanh ranh giới cửa sổ; chấp nhận được cho kiểm soát
  lạm dụng.
- Được chọn trong `planner/instance.ts` đúng như cách chọn kho: PostgreSQL khi có
  `PLANNER_DATABASE_URL`, nếu không thì limiter trong tiến trình được bọc về interface
  async. Không rơi về kho khác khi database đã cấu hình.
- **Chuyển bởi ADR này:** `plannerReviewLimiter` và `guestReviewLimiter`. **Các limiter ghi mới từ
  lát kế tiếp trở đi dùng nó ngay từ đầu.** Các limiter đăng nhập, đăng ký, đọc chia sẻ và Google
  không đổi trong ADR này.
- **Khóa.** Lệnh ghi đã đăng nhập khóa theo `userId`, client không giả được. Lệnh ghi ẩn
  danh vẫn khóa theo `clientKey(headers)`, vốn là một header chuyển tiếp và **vẫn giả mạo được**: kho dùng chung sửa tính bền vững và hành vi đa instance, không sửa giả mạo. Backlog P10-12 ghi rằng nginx ghi đè `x-forwarded-for` (có `tests/deploy-config.test.ts` phủ); phần còn mở là cấu hình thật trên VM và việc Cloudflare Tunnel có đứng trước không, vì nó đổi header đáng tin. P10-11 (HMAC cho `guestKey`) đổi khóa khách mà limiter này dùng; hai việc phải đi cùng nhau, nếu không khóa của limiter đổi hai lần.
- Nếu database không với tới được thì limiter ghi **từ chối** (`service_unavailable`): lệnh
  ghi cũng cần chính database đó.

### Hoãn, có chủ đích

| Mục | Chuyển tới | Lý do |
|---|---|---|
| `Trip.origin` | Phase 11 | Nơi dùng đầu tiên là Dùng chuyến này |
| Thực thể và điều khiển báo cáo | Phase 10, lát riêng (P10-3) | PR riêng sau log |
| `terms_acceptances` | Phase 10, lát riêng (P10-2) | PR riêng |
| `member_profiles` và slug công khai | Phase 11 | Nơi dùng đầu tiên là trang hồ sơ; upload avatar là Phase 13 |
| Trạng thái `changes_requested`, `unpublished` | Phase 10, lát sau | Chúng cần UI mới có nghĩa |
| Repository theo từng dòng cho thích và bình luận (DB5) | Phase 14, sau khi đo | Chưa có đường ghi như vậy |

Đánh số migration: `0010` sự kiện kiểm toán (batch 10.2, đã có), `0011` bộ đếm giới hạn (batch 10.3); các lát sau theo [specs-community-database.vi.md](../specs-community-database.vi.md). Hồ sơ nằm ở Phase 11 như PHASES.md đã ghi.

## Các phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn) Máy trạng thái và log sự kiện bọc các luồng hiện có, cộng limiter ghi trên Postgres; mọi thứ khác hoãn tới nơi dùng đầu tiên | Không đổi nhìn thấy được; từng phần test riêng được; không schema nằm không; dấu vết kiểm toán bắt đầu trước khối lượng | nền tảng mất ba mục sang các lát sau của Phase 10 và Phase 11; hai interface limiter cùng tồn tại một thời gian |
| B Phase 10 như vẽ ban đầu: thêm `Trip.origin`, báo cáo, hồ sơ | Ít migration hơn nhưng lớn hơn; khớp chữ "Foundation: User Profile…" của chủ dự án | Đưa ra cột và bảng chưa ai đọc; hồ sơ chưa có trang cho tới Phase 11; PR lớn khó review |
| C Redis cho limiter | Chuyên dụng, cửa sổ trượt, nhanh | Thêm một dịch vụ trên homelab 16 GB phải vá, sao lưu và bảo mật; ADR 0008 chọn PostgreSQL cho trạng thái dùng chung |
| D Giữ limiter trong bộ nhớ, khóa lệnh ghi đã đăng nhập theo `userId` | Không thêm bộ phận; khóa theo user vốn không giả được | Mỗi lần deploy reset mọi bucket; hỏng ở instance thứ hai; khóa ẩn danh vẫn giả được trong cả hai |

**Á quân: D.** Nó thua vì một lý do: auto deploy làm rỗng mọi bucket ở mỗi lần khởi động lại,
nên hạn mức theo giờ của một user thực ra là "theo lần deploy", và instance thứ hai mà ADR
0008 dự kiến sẽ nhân đôi nó. Nếu đo thấy chi phí một vòng database quá cao thì D kèm bộ đếm
được lưu chỉ cho vài đường ghi quan trọng là phương án dự phòng.

## Hệ quả

Dễ hơn:

- Các phase sau thêm trạng thái và loại nội dung bằng cách sửa một module thuần và bảng chuyển
  trạng thái của nó, không phải nhiều method repository.
- Mọi hành động của nhân viên trong cộng đồng đều truy được người làm, giúp cả khi tranh
  chấp việc gỡ bài.
- Instance app thứ hai trở nên an toàn cho các đường ghi quan trọng.

Khó hơn, và không miễn phí:

- **Hai interface limiter** (đồng bộ trong bộ nhớ, async dùng chung) cùng tồn tại; nơi gọi
  phải chọn, và một test phải giữ lựa chọn đó đúng. Gộp chúng là dọn dẹp về sau.
- **Một vòng database mỗi lệnh ghi bị giới hạn.** VM PostgreSQL tách riêng, nên mỗi lần
  kiểm là một chặng mạng; chưa đo, và là rủi ro nếu đường truyền chậm.
- **Cửa sổ cố định thô** (đến 2× đột biến ở ranh giới). Chấp nhận được cho kiểm soát lạm
  dụng, không cho thứ cần hạn mức chính xác (hạn mức byte upload sẽ đếm dòng, không dùng
  limiter này).
- **Log sự kiện là dữ liệu cá nhân về nhân viên và tác giả** (id người thực hiện, lý do có
  thể trích văn bản người dùng). Cần dọn 1 năm, không được log ở chỗ khác, và thuộc tuyên
  bố riêng tư của chủ dự án.
- **Tái cấu trúc các method kiểm duyệt có nguy cơ hồi quy.** Các test chuyến và đánh giá
  cộng đồng hiện có là lưới đỡ; chúng phải xanh và không đổi.
- **Giả mạo ẩn danh không được sửa.** Ai coi "limiter dùng chung" là chống giả mạo sẽ sai;
  nó không phải vậy.
- **Đảo ngược:** xóa hai bảng và module; repository quay về các kiểm tra nội tuyến hiện nay
  nếu gỡ các lời gọi. Các sự kiện đã lưu nằm yên.

## Theo dõi

- Nhánh và PR theo thứ tự: `feat/submission-state-machine`, `feat/moderation-events`,
  `feat/shared-write-limiter`. Mỗi cái kèm test và tài liệu tính năng
  (`docs/features/moderation-events.*`, `docs/features/shared-write-limiter.*`; máy trạng
  thái được ghi trong cái đầu).
- Test: mọi cạnh và mọi cạnh bị cấm của `transition`; ánh xạ `listing` cũ; một sự kiện được
  ghi trong cùng transaction với từng hành động, và không có khi hành động thất bại; limiter
  qua hai instance mô phỏng dùng chung một database; từ chối khi database không khả dụng;
  các test cộng đồng hiện có không đổi.
- Tài liệu cần cập nhật khi chấp nhận: `docs/architecture.md` + `.vi.md` (dữ liệu, ranh
  giới, phase), `.claude/context/project-context.md`, các dòng roadmap
  ([specs-community-roadmap.vi.md](../specs-community-roadmap.vi.md)) và số migration trong
  [specs-community-database.vi.md](../specs-community-database.vi.md).
- Một Task Contract ở `.claude/contracts/community-foundation.md` trước khi viết code (hạng L).
- Khuyến nghị, chưa chạy: `/sec-check` về limiter và quyền riêng tư của log sự kiện.
- **Câu hỏi mở cho chủ dự án:**
  1. Đã giải quyết: hồ sơ thuộc Phase 11 (PHASES.md), không thuộc ADR này.
  2. Lưu giữ `AuditEvent` 1 năm có chấp nhận được không?
  3. Đã trả lời một phần bởi P10-12 (nginx ghi đè `x-forwarded-for`, có test trong repository). Còn mở: cấu hình thật trên VM, và việc Cloudflare Tunnel có đứng trước không (khi đó header đáng tin khác đi). Cần xem triển khai thật, không phải repository.
