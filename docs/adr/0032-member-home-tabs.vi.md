# ADR 0032 — Tab trang chủ thành viên: mỗi lần hiện một mục, chọn bằng `?tab=`

🇻🇳 English: [0032-member-home-tabs.md](0032-member-home-tabs.md)

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-21
- **Chủ sở hữu:** system-architect
- **Ảnh hưởng:** `src/app/[locale]/my-trips/page.tsx`, mới `src/components/planner/member-home-tabs.tsx` và `src/lib/member-home-tab.ts`, `src/components/map/member-map-share-panel.tsx`, `member-map-view.tsx`, `src/server/planner/member-map.ts` (`getMemberSession`), `member-map-share-preview.ts` (overview), `messages/*.json`. Task Contract `member-home-tabs`. Sửa đổi [ADR 0031](0031-member-home-merge.vi.md) §1; không đổi quy tắc của ADR 0029 hay 0030.

## Bối cảnh

ADR 0031 đặt bản đồ trên danh sách chuyến trong một trang và bác bỏ toggle vì "ẩn một view và cần state client". Khi có chia sẻ (ADR 0030), trang dài thành bốn mục trước khi tới chuyến đầu tiên. Chủ dự án nói kéo xuống làm mất tập trung và muốn dùng tab.

Ngoài ra chủ nghi bản đồ chia sẻ không có dữ liệu. Thực tế không phải: theo thiết kế (ADR 0030 §2) nó chỉ hiện chuyến đã hoàn thành. Cái thiếu là lời giải thích cho chủ vì sao một chuyến kế hoạch không có trên đó.

## Quyết định

1. **Ba mục: Chuyến đi (mặc định), Bản đồ, Chia sẻ.** Mỗi lần một mục, một `<h1>` cho trang, một `<h2>` cho mỗi mục.
2. **Mục được chọn bằng `?tab=map|trips|share`, đọc phía server** (`searchParams`). Giá trị thiếu hoặc lạ → mặc định, tham số lặp lấy giá trị đầu; giá trị thô không bao giờ được phản chiếu ra. Trang vốn đã dynamic và private nên không mất cache. Liên kết sâu, Back/Forward và trình duyệt tắt JavaScript đều chạy; `returnTo` đã giữ query cho `/my-trips`.
3. **Liên kết thật, không dùng ARIA `tablist`.** Một `<nav>` ba liên kết, mục đang mở có `aria-current="page"`, đích bấm ≥44px. Mỗi mục là một URL do server trả, nên mẫu tablist (roving tabindex, phím mũi tên, state client) vừa nặng hơn vừa sai ngữ nghĩa.
4. **Mỗi mục chỉ đọc dữ liệu của nó.** Bản đồ: `getMemberMap`. Chia sẻ: `getMemberMapShareOverview` (bản xem trước công khai kèm một con số). Chuyến đi: `getMemberSession` (chỉ `identify`) và `MyTrips` phía client. Khách thấy bản đồ trống và đăng nhập ở mọi tab, không có thanh tab, và không mount `MyTrips` hay panel chia sẻ (giữ bất biến ADR 0029, 0031).
5. **Giải thích bản đồ chia sẻ, không đổi dữ liệu.** Mục Chia sẻ cho chủ biết có bao nhiêu chuyến đang dùng chưa hoàn thành (một con số, chỉ chủ thấy) kèm liên kết sang Chuyến đi; cảnh báo <2 điểm hiện trước nút bật; chú giải Bản đồ nói chấm rỗng không được chia sẻ; chữ trống ở trang công khai trung tính hơn và vẫn không tiết lộ gì. `PublicMemberMap`, các nhóm, token và quy tắc 404 không đổi.

## Các phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn) `?tab=` phía server, liên kết | Liên kết sâu, Back, không cần JS, không state client, không route mới | Đổi tab là một điều hướng server |
| B ARIA tablist với state client | Đổi tức thì, phím mũi tên | JS, state, đồng bộ URL, nhiều test hơn, sai ngữ nghĩa cho URL |
| C Đường dẫn riêng (`/my-trips/map`) | URL gọn | Va chạm `/my-trips/[id]`; thêm `pathnames` và redirect |
| D Hash URL | Đơn giản | Server không đọc được; hỏng khi tắt JS |
| E Hiện chuyến kế hoạch ở bản chia sẻ | Bản đồ đầy hơn | Lộ nơi thành viên sắp ở; đã bị ADR 0030 bác bỏ |

## Hệ quả

- Dễ hơn: màn hình tập trung; danh sách chuyến chỉ tải khi mở; điều khiển chia sẻ và bản xem trước ở cùng một chỗ.
- Khó hơn: đổi tab là render lại trang ở server; spec E2E phải chọn theo role và tên (xem feature document).
- Rollback: revert PR; không migration, API hay dữ liệu. Liên kết `?tab=` cũ bị bỏ qua và trang một cột quay lại.
