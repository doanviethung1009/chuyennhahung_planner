# ADR 0021 — Trang chủ cá nhân hóa: một tài liệu công khai, nội dung cá nhân được điền ở trình duyệt từ một phép chiếu riêng

🇬🇧 English version: [0021-personalized-home.md](0021-personalized-home.md)

- **Trạng thái:** Đề xuất — được [ADR 0022](0022-home-mvp-server-session.vi.md) thay thế cho MVP; giữ làm thiết kế tính năng đầy đủ
- **Ngày:** 2026-11-16
- **Chủ trì:** system-architect
- **Ảnh hưởng:** `src/app/[locale]/page.tsx`, `src/app/api/planner/home/route.ts` (mới), `src/components/home/**` (mới), `src/components/layout/` (provider tài khoản dùng chung), `src/lib/home/**` (mới), `messages/*.json`; không migration, không đổi `src/content/types.ts`
- **Chi tiết:** [specs-home-personalization.vi.md](../specs-home-personalization.vi.md)

## Bối cảnh

Chủ dự án muốn một trang chủ thay đổi cho khách, thành viên mới và thành viên quay lại.
Sự thật từ repository:

1. `/` là trang công khai, `force-dynamic`, giống nhau cho mọi người, không đọc cookie.
   Trang công khai không được import repository hay store (`tests/client-boundary.test.ts`).
2. Ai đang đăng nhập vốn đã được biết trong trình duyệt bằng `GET /api/planner/session`,
   có chủ đích: đọc cookie ở layout sẽ khiến mọi trang thành theo từng người
   (`useAccount()` trong `src/components/layout/account-menu.tsx`).
3. Route Planner riêng trả `no-store` và lấy chủ từ phiên (`src/server/planner/http.ts`).
   Dữ liệu trang chủ cá nhân cần đã có theo từng chủ, nhưng `GET /api/planner` trả nguyên
   dòng `Trip` (share token, ghi chú, ngân sách).
4. Chưa có sở thích lưu, mục đã lưu, hồ sơ hay thông báo (Phase 11–15).

Chưa biết: tỷ lệ lưu lượng thật giữa khách và thành viên, và phần lượt truy cập đi qua cache
dùng chung hay CDN khi có production (Phase 09).

## Quyết định

1. **Giữ một route và một tài liệu render ở server cho mọi người.** `page.tsx` không đọc
   `cookies()` hay `headers()`, không import Planner repository, và render cùng từng byte
   cho khách và thành viên. Nó nhúng thêm một **pool công khai** nhỏ (tóm tắt chuyện, lịch
   trình và chuyến cộng đồng đã duyệt).
2. **Điền slot cá nhân ở trình duyệt.** Một provider client gọi `GET /api/planner/home` mới
   (sau khi lần dò phiên dùng chung báo đã đăng nhập), thay hero bằng dải thành viên và thêm
   các module thành viên. Lỗi hoặc 401 thì giữ trang khách.
3. **Thêm một endpoint đọc trả về phép chiếu allow-list**, `HomeSnapshot` (số đếm, một chuyến
   tiếp tục, tối đa ba chuyến khác, slug điểm đến của mình, phong cách và nhịp phổ biến,
   trạng thái bài của mình). zod schema strict, `no-store`, limiter theo phiên (30/phút),
   chủ chỉ lấy từ phiên. Không bao giờ trả dòng `Trip`, share token, ghi chú, ngân sách, văn
   bản kiểm duyệt hay bất kỳ thông tin xác thực nào.
4. **Xếp hạng ở trình duyệt, bằng hàm thuần.** `rankForYou` và `pickNudge` chạy trên pool
   công khai và snapshot của thành viên; tín hiệu của thành viên không gửi tới dịch vụ nào.
   Luật và lý do nằm ở spec, mục 5.
5. **Tối đa một gợi ý được lưu:** giá trị `localStorage` là `member` (không id, tên hay số
   đếm), chỉ chọn khung chờ đầu tiên. Không lưu gì cá nhân khác ở phía client.
6. **Không thêm route.** Không `/home`, không trang chỉ dành cho thành viên; redirect tour
   và `pathnames` không đổi.

## Các phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| **A (chọn)** Tài liệu công khai + đảo client + endpoint phép chiếu riêng | An toàn trong mọi cache dùng chung; khớp mẫu header hiện có; trang khách vừa là dự phòng vừa là trang SEO; xếp hạng không rời trình duyệt | Thành viên thấy nội dung khách hoặc khung chờ trong chốc lát; hai request tuần tự (phiên, rồi home); logic chia giữa server và client |
| B Đọc cookie phiên trong `page.tsx` và render theo người | Không nháy; một lần render | `/` thành theo từng người, không cache được; thiếu một `Vary` là lộ chuyến của người này cho người khác; mỗi request tốn một lần đọc store; đảo ngược quyết định header của ADR 0004; phá quy tắc "trang công khai không đụng repository" |
| C Một route thành viên riêng (`/home`) | Dễ suy luận | Hai trang chủ, brief đã loại; logic chuyển hướng sau đăng nhập; trùng nội dung |
| D Render biến thể ở server chọn theo cờ cookie không bí mật | Ít nháy hơn | Vẫn là HTML theo từng người; cờ giả mạo được và có thể cũ; khóa cache phải thay đổi theo nó |
| E Tái dùng `GET /api/planner` và `/reviews` mà không thêm route | Không thêm bề mặt | Trả share token, ghi chú, ngân sách mà trang không cần; hai lời gọi; gắn UI với hình dạng dòng đầy đủ |

Phương án về nhì: **B**. Nó thua vì một lý do — biến trang được xem nhiều nhất thành tài
liệu theo từng người, khi đó đảm bảo riêng tư phụ thuộc vào việc mọi tầng cache được cấu
hình đúng mãi mãi.

## Hệ quả

Dễ hơn: trải nghiệm của khách và crawler không thể bị dữ liệu thành viên ảnh hưởng; không
cần cấu hình cache nào để giữ dữ liệu thành viên riêng tư; luật là hàm thuần và được unit
test; mỗi trạng thái xây và giao thành một slice riêng; sau này một mô hình có thể thay luật
qua cùng kiểu đầu vào và đầu ra.

Khó hơn: thành viên thấy nội dung khách hoặc khung chờ trong thời gian hai request, nên slot
cần chiều cao dành sẵn và ngân sách xô lệch bố cục (CLS ≤ 0,1) phải được đo; lần dò phiên
phải dùng chung giữa header và trang chủ; pool và các luật được gửi xuống client; một route
handler mới phải được liệt kê trong `docs/runbook.md` và có test; phương án lùi về khi tên
hiển thị có `@` và test cách ly giữa hai thành viên là nghĩa vụ, không phải tùy chọn. Đảo
ngược quyết định này nghĩa là chuyển sang phương án B, đòi hỏi nghĩ lại việc cache `/` và
làm lại rà soát riêng tư.

Chưa quyết ở đây: sở thích lưu lại (Phase 11), mục đã lưu (Phase 14), khám phá và thông báo
(Phase 15), gợi ý AI (Phase 06).

## Việc tiếp theo

- Chấp nhận ADR này và trả lời các câu hỏi mở trong spec trước slice H1.
- Slice H1: endpoint, schema, test, `AccountProvider`, slot (backend, rồi frontend).
- Feature document `docs/features/personalized-home.md` + `.vi.md`, đăng ký ở cả hai index
  tính năng; cập nhật `docs/architecture.md` + `.vi.md`, `docs/runbook.md` + `.vi.md`,
  `docs/runbook-api.md`, `.claude/context/project-context.md`.
- Roadmap: chủ dự án quyết định Phase 16 hay gộp vào Phase 04; ADR này không sửa `PHASES.md`.
- `/sec-check` và `/qc-check` trước khi merge slice endpoint, khi chủ dự án yêu cầu.
