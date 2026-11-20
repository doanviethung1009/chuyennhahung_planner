# ADR 0029 — Bản đồ thành viên: bản đồ cấp quốc gia, riêng tư, dựng từ chuyến đi của chính thành viên

🇻🇳 English version: [0029-member-map.md](0029-member-map.md)

- **Trạng thái:** Accepted (lát 1: bản đồ riêng tư). Lát 2 (chia sẻ qua token) chỉ được phác ở đây; cần bổ sung ADR riêng và kiểm tra bảo mật trước khi viết mã.
- **Ngày:** 2026-11-20
- **Người chịu trách nhiệm:** system-architect
- **Ảnh hưởng:** `src/server/planner/member-map.ts`, `src/app/[locale]/my-map/page.tsx`, `src/components/map/member-map-view.tsx`, kiểu prop của `VietnamMap`, `src/i18n/routing.ts`, `messages/*.json`, menu tài khoản và `/my-trips`, `next.config.ts` (một luật header), chữ của quy tắc 6 trong `CLAUDE.md` và `.claude/rules/03-project-chuyen-nha-hung.md`. Không đổi database, migration hay API. Task Contract `member-map`; dựa trên [ADR 0004](0004-planner-identity.vi.md), [ADR 0022](0022-home-mvp-server-session.vi.md) và, cho lát 2, [ADR 0025](0025-member-profiles-and-use-this-trip.vi.md).

## Bối cảnh

`/map` là hành trình của hai vợ chồng chủ site: nó đọc seed `destinations`, và `visits` là của chủ. Thành viên đăng nhập chưa có bản đồ của mình, dù Planner đã biết họ đã đi đâu và định đi đâu. Chủ dự án đã quyết (2026-11-20): thành viên xem bản đồ của mình ở một trang riêng; `/map` không đổi; một chuyến tính là "đã đi" khi `completed`, kể cả sau đó bị lưu trữ.

Quy tắc 6 ghi "Planner map" là việc cố ý hoãn, nhưng chưa bao giờ định nghĩa nó. Hiểu hẹp là bản đồ *nằm trong* Planner (pin hoạt động, tuyến theo ngày, trong trình sửa chuyến); hiểu rộng là mọi bản đồ dùng dữ liệu Planner. Chủ chọn nghĩa hẹp: xem mình đã đi đâu là một phép chiếu chỉ-đọc, cấp quốc gia, từ chuyến đi và review đã có.

## Quyết định

1. **Tách đôi "Planner map".** *Bản đồ thành viên* — phép chiếu chỉ-đọc, cấp quốc gia, từ chuyến và review của chính thành viên — được làm theo ADR này. *Bản đồ tuyến theo chuyến* — pin hoạt động, tuyến theo ngày, mọi thứ trong trình sửa chuyến — vẫn hoãn và cần ADR riêng. Quy tắc 6 và `03-project-chuyen-nha-hung.md` được sửa chữ tương ứng.
2. **Một trang riêng.** `/my-map` (VI `/ban-do-cua-toi`), `noindex`, động (`force-dynamic`) và trả `Cache-Control: private, no-store` bằng một luật trong `next.config.ts`. `/map` không đổi và không bao giờ đọc phiên.
3. **Nguồn và quy tắc, theo từng điểm đến có trong seed `destinations`** (điểm khác bị bỏ):
   - *Đã đi* (chấm đặc, `visits` ≥ 1): chuyến có `planningStatus = completed` — **dù đã lưu trữ hay chưa** — hoặc review của chính thành viên có `visitedOn`.
   - *Đã lên kế hoạch* (chấm rỗng, không có `visits`): chuyến `active` ở `draft` hoặc `planned`, khi chưa có "đã đi" ở đó.
   - Chuyến `archived` mà chưa `completed` không xuất hiện.
   - `visits` = số chuyến completed + số ngày `visitedOn` khác nhau; ngày của review nằm trong khoảng ngày của một chuyến completed cùng điểm đến thì không đếm lại; review `rejected`/`removed` bị bỏ qua. `visitedOn` do người dùng tự khai nên chỉ dùng để vẽ bản đồ của chính họ.
4. **Đường dữ liệu.** Trang đọc phiên cookie trên server như `home-page.ts` (lọc hình dạng token, `identify`, mọi lỗi → `guest`), rồi `listTrips(userId)` (active và archived, có phân trang) và `listOwnReviews(userId)`; địa điểm của review quy về điểm đến qua catalogue địa điểm công khai. Không thêm API.
5. **Allow-list.** Chỉ `{ slug, visits? }` của mỗi điểm đến component. Tên, tọa độ, `featured`, phía nhãn lấy từ seed, chỉ đọc (không sửa `destinations.ts`). Không bao giờ có chủ sở hữu, id/tiêu đề chuyến, ghi chú, ngân sách, token chia sẻ hay nội dung review. Nhãn cố định chỉ ở điểm `featured`; pin giữ vùng bấm 44 px.
6. **Khách** thấy khung bản đồ trống, câu "hãy lên kế hoạch và thực hiện chuyến đi để lắp đầy bản đồ" và nút đăng nhập — không có dữ liệu của ai. Thành viên chưa có điểm nào thấy cùng câu đó và một link tạo chuyến.
7. **Lát 2 — chia sẻ qua token (chưa làm).** Bản đồ có token chia sẻ **riêng** (không bao giờ dùng token của chuyến), mặc định riêng tư, thu hồi và đổi được; trang công khai chỉ trả `{ slug, visits }` theo allow-list cùng tên hiển thị theo quy tắc ADR 0025 (`anonymous` luôn thắng; mặc định ẩn danh); `noindex`, `Referrer-Policy: no-referrer`. Cần cài đặt chia sẻ theo user (bảng/cột, migration, export/import), route `PUT`/`DELETE`, trang `/shared-map/[token]`, xóa theo user, rate limit và test chứng minh không lộ gì khác. Đây là XL và bắt buộc `/sec-check`.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn): `/my-map` riêng | `/map` vẫn là hành trình của chủ và cache tĩnh được; không lẫn dữ liệu của ai | Thêm một trang |
| B: `/map` đổi theo phiên | Không thêm route | Mất trang tĩnh, lẫn dữ liệu chủ và thành viên, người xem có thể tưởng là hành trình của chủ |
| C: nút "tôi đã đến đây" thủ công | Chính xác | Cần schema và API mới; ngoài phạm vi |
| D: bản đồ tuyến từng chuyến | Giàu hơn | Chính là bản đồ tuyến đang hoãn |

## Hệ quả

- Dễ hơn: thành viên thấy dấu chân của mình mà không cần lưu trữ mới; lát 2 đã có hình dạng rõ.
- Khó hơn: mỗi request trang đọc toàn bộ danh sách chuyến của một thành viên (phân trang, tối đa 1.000 chuyến mỗi trạng thái); tài khoản rất lớn sẽ cần chỉ mục hoặc API. Số lần đi chỉ xấp xỉ, có chủ ý.
- Chuyến đã hoàn thành rồi lưu trữ vẫn ở trên bản đồ; chuyến lưu trữ mà chưa hoàn thành thì biến mất, thành viên có thể không ngờ — trang có ghi chú nói rõ.
- Chữ "Planner map" nay là hai thứ; các tài liệu khác nói "Planner map" (roadmap, specs) là bản đồ tuyến theo chuyến.
- Hoàn tác: chỉ thêm mới — revert PR.
