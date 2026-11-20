# ADR 0031 — Trang chủ thành viên: bản đồ thành viên và Chuyến đi của tôi thành một trang

🇻🇳 English: [0031-member-home-merge.md](0031-member-home-merge.md)

- **Trạng thái:** Proposed (chờ chủ dự án)
- **Ngày:** 2026-11-20
- **Chủ sở hữu:** system-architect
- **Ảnh hưởng:** `src/app/[locale]/my-trips/page.tsx`, xóa `src/app/[locale]/my-map/page.tsx`, `src/components/map/member-map-view.tsx`, `src/i18n/routing.ts`, `src/lib/return-to.ts`, `src/components/layout/account-menu.tsx`, `messages/*.json`, `next.config.ts` (redirect và các đường dẫn private). Task Contract `member-home-merge`. Sửa đổi [ADR 0029](0029-member-map.vi.md) (vị trí trang) và [ADR 0030](0030-member-map-sharing.vi.md) (chỗ đặt điều khiển chia sẻ).

## Bối cảnh

Bản đồ thành viên (`/my-map`) và Chuyến đi của tôi (`/my-trips`) là hai cách nhìn vào cùng các chuyến đi: đã hoàn thành là "đã đi", nháp và đã lên kế hoạch là "kế hoạch". Thành viên phải vào hai trang liên kết nhau cho một ý. Chủ dự án muốn một trang.

Hai trang khác nhau về kỹ thuật. `/my-map` là trang server động đọc cookie phiên, trả `private, no-store`, khách thấy bản đồ trống. `/my-trips` là client component gọi `GET /api/planner` và đẩy khách sang đăng nhập khi gặp 401.

## Quyết định

1. **Một trang tại `/my-trips`** (VI `/chuyen-di-cua-toi`): bản đồ ở trên, danh sách chuyến bên dưới. Không có nút chuyển chế độ: nó che mất một trong hai thứ thành viên cần và thêm state phía client.
2. **`/my-trips` thành trang server**, `force-dynamic`, `noindex`, trả `Cache-Control: private, no-store` qua `next.config.ts`. Trang đọc `getMemberMap()` cho bản đồ; danh sách vẫn là `MyTrips` (client) gọi `GET /api/planner` — không đổi API.
3. **Khách** thấy bản đồ trống và nút đăng nhập, và **không mount** `MyTrips` (nó sẽ chuyển sang đăng nhập khi 401, phá quy tắc ADR 0029 là khách thấy bản đồ trống). Thành viên chưa có chuyến thấy lời mời ở bản đồ và trạng thái rỗng của danh sách.
4. **`/my-map` bị bỏ.** `/ban-do-cua-toi` → `/chuyen-di-cua-toi` và `/en/my-map` → `/en/my-trips`, `permanent: true` (308) trong `next.config.ts`, có test như redirect tour. `/my-map` rời khỏi `pathnames`; menu tài khoản còn một mục, mọi link nội bộ chuyển sang `/my-trips`. `/my-trips/new` và `/my-trips/[id]` không đổi.
5. **Giữ nguyên bất biến:** chỉ allow-list `{ slug, visits? }`; không đụng `destinations.ts` và `/map`; không đụng `/shared-map/[token]`; đăng xuất là điều hướng đầy đủ để router cache không hiện trang của thành viên cũ.
6. **Chia sẻ (ADR 0030 lát 2c)** nằm trong khối bản đồ của trang này.

## Các phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn): bản đồ trên danh sách tại `/my-trips`, redirect `/my-map` | Một trang, không state client, thấy cả hai | Trang dài hơn trên mobile |
| B: nút chuyển Bản đồ / Danh sách | Trang ngắn hơn | Che một chế độ; cần state client và URL cho từng chế độ |
| C: giữ `/my-map` làm trang chủ, chuyển danh sách vào | Bản đồ nổi bật | `/my-trips/*` nằm dưới cha khác; nhiều redirect hơn |
| D: giữ hai trang | Không tốn công | Chính là điều chủ dự án phàn nàn |

## Hệ quả

- Dễ hơn: một mục menu; một chỗ cho điều khiển chia sẻ.
- Khó hơn: `/my-trips` mất cache tĩnh (vốn chỉ là vỏ mỏng); server đọc chuyến đi và review của thành viên mỗi request, như `/my-map` đã làm.
- Bookmark cũ và `returnTo` cũ vẫn chạy nhờ 308.
- Rollback: revert PR; redirect đi cùng.
