# ADR 0021 — MVP trang chủ đọc phiên ở server, chỉ cho trang chủ

🇬🇧 English version: [0021-home-mvp-server-session.md](0021-home-mvp-server-session.md)

- **Trạng thái:** Đã chấp nhận (chủ dự án, 2026-11-17)
- **Ngày:** 2026-11-17
- **Chủ trì:** system-architect
- **Ảnh hưởng:** `src/app/[locale]/page.tsx`, `src/server/planner/home-page.ts` (mới), `src/lib/home/continue-trip.ts` (mới), `src/components/home/home-member-band.tsx` (mới), `messages/*.json`; không migration, không route hay endpoint mới
- **Thay thế:** quyết định trong [ADR 0020](0020-personalized-home.vi.md) (đảo client cộng endpoint mới), **chỉ cho MVP**
- **Chi tiết:** [specs-home-mvp.vi.md](../specs-home-mvp.vi.md)

## Bối cảnh

MVP nhỏ: một dải cho thành viên chưa có chuyến ("tạo chuyến đầu tiên") và một dải cho thành
viên có chuyến ("Continue Planning"); khách giữ nguyên trang hiện nay. Chủ dự án yêu cầu ưu
tiên Server Components, tái dùng phiên và My Trips, không thêm database, giữ SEO công khai và
bảo vệ chuyến riêng tư.

[ADR 0020](0020-personalized-home.vi.md) trả lời một câu hỏi lớn hơn và đã loại việc đọc phiên
ở server (phương án B của nó), chủ yếu vì nó biến `/` thành tài liệu theo từng người. Sự thật
tìm được từ đó, trong repository:

1. `/` vốn đã `force-dynamic`; không có render tĩnh hay cache nào để mất.
2. Server component đã đọc cookie phiên và gọi `identify` chỉ với cookie:
   `readAdminPageAccess` (ADR 0010 §7).
3. Test giữ dữ liệu request khỏi header bảo vệ layout và header, không phải `page.tsx`
   (`tests/header-account.test.ts`).
4. Deploy không có cache dùng chung: cấu hình nginx không đặt `proxy_cache`.
5. Khách không có cookie không tốn thêm gì: chỉ đọc `cookies()` rồi thôi.

Chưa biết: production có đặt CDN hay cache dùng chung trước `/` không (Phase 09), và Next có
gửi `private, no-store` cho render động này không — điều sau được kiểm bằng test trước khi merge.

## Quyết định

1. **`/` đọc cookie phiên ở server, và chỉ `/`.** Một module mới,
   `src/server/planner/home-page.ts`, giống `admin-page.ts`: cookie → `identify` (chỉ cookie) →
   `listTrips` → một giá trị `HomeMember` allow-list. Mọi lỗi, thiếu cookie, phiên không hợp lệ
   hay đang chờ đổi mật khẩu cho ra `guest`.
2. **Trang cho request không có cookie vẫn giống hệt từng byte** với hiện nay.
   `generateMetadata`, layout và header vẫn không đọc cookie.
3. **Một server component** render dải phía trên hero; không client component, không fetch
   từ client, không endpoint mới.
4. **Phản hồi cho request có cookie phải là `private, no-store`.** Được kiểm bằng test; nếu Next
   không phát ra, thêm một luật header có điều kiện (`has` cookie) trong `next.config.ts`.
5. **ADR 0020 vẫn là thiết kế đích cho tính năng đầy đủ** và là đường lui nếu có cache dùng chung.

## Các phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| **A (chọn)** Server Component đọc cookie trên `/` | Không JavaScript client, không nháy hay xô lệch bố cục, không endpoint mới, chỉ đọc store một lần cho thành viên đã đăng nhập; khớp brief của chủ và tiền lệ trang admin | `/` là tài liệu theo từng người với request có cookie; CDN tương lai phải bỏ qua cache cho chúng; đảm bảo riêng tư dựa vào header `private, no-store` và một test cách ly |
| B ADR 0020: khung công khai, đảo client, `GET /api/planner/home` mới | An toàn trong mọi cache dùng chung; trang khách vừa là dự phòng | Một endpoint, provider, khung chờ và ngân sách xô lệch bố cục cho tính năng chỉ một dải; hai request tuần tự; nhiều code hơn tính năng đáng có |
| C Đọc ở server trong `<Suspense>` với dải được stream | Khung hiện trước | Dải chèn phía trên hero sau lần vẽ đầu làm xô lệch bố cục cho thành viên; việc đọc dữ liệu chỉ vài mili giây nên stream không được gì |

Phương án về nhì: **B**. Nó thua vì một lý do — là thiết kế đúng cho trang chủ lớn hơn, có cache
phía trước, nhưng quá nhiều máy móc cho hai dải khi chưa có cache dùng chung. Quay lại B sau
này mang tính cộng thêm: các hàm thuần và kiểu `HomeMember` dùng lại được.

## Hệ quả

Dễ hơn: MVP là thay đổi nhỏ, chỉ ở server, xem xét được trong một PR; khách, crawler và SEO
không đụng tới; không bề mặt API hay code client mới để bảo vệ; thành viên có dải ngay trong
byte đầu.

Khó hơn: `/` không còn giống nhau cho mọi người, nên mọi CDN hay cache dùng chung tương lai
phải phân biệt hoặc bỏ qua theo cookie phiên — phải quyết trước Phase 09 (Q5 của spec); test
cách ly giữa hai thành viên và test khách giống hệt từng byte là nghĩa vụ; quy tắc hiện có
"trang công khai không chứa dữ liệu request" giờ có một ngoại lệ được gọi tên, được mã hóa
trong `tests/home-page-boundary.test.ts` để nó không lan sang layout, header, metadata hay
trang công khai khác. Đảo ngược là gỡ một dòng component và một module.

## Việc tiếp theo

- Chấp nhận ADR này và trả lời Q1–Q5 trong spec trước khi viết code.
- Đánh dấu ADR 0020 là bị thay thế cho MVP (đã làm trong thay đổi này) và giữ nó làm thiết
  kế tính năng đầy đủ.
- Feature document `docs/features/home-continue-planning.md` + `.vi.md`; cập nhật
  `docs/architecture.md` + `.vi.md` và `.claude/context/project-context.md` với ngoại lệ một
  dòng.
- `/sec-check` và `/qc-check` khi chủ dự án yêu cầu, trước khi merge.
