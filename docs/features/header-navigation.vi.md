# Tính năng — Điều hướng header

🇬🇧 English version: [header-navigation.md](header-navigation.md)

## Summary

Header, drawer và footer giờ dẫn tới mọi phần của site trong một lần bấm. Địa điểm,
lịch trình mẫu và bản đồ trước đây chỉ có ở footer; menu chính gom chúng thành
**Khám phá** (điểm đến, địa điểm, bản đồ nhà Hưng) và **Lên lịch trình** (lịch trình,
lịch trình mẫu). Nút kêu gọi hành động đi đúng nơi: khách vẫn tới trang giới thiệu
planner, thành viên tới trang tạo chuyến. Đổi ngôn ngữ giữ chuỗi truy vấn và `returnTo`
của đăng nhập. Đây là UXS-2 của báo cáo UI/UX (UXA-01, 02, 04, 05, 06, 16, 18, 21; chủ
dự án đã chốt UXD-1, 2, 4, 8).

## Routes

Không có. Chỉ liên kết tới route sẵn có; không thêm hay đổi tên route.

| Internal | Vietnamese | English |
|---|---|---|
| `/destinations`, `/places`, `/map` | `/kham-pha`, `/dia-diem`, `/ban-do` | `/en/destinations`, `/en/places`, `/en/map` |
| `/itineraries`, `/trip-templates` | xem `src/i18n/routing.ts` | xem `src/i18n/routing.ts` |
| `/plan-your-trip` (CTA khách) | `/thiet-ke-chuyen-di` | `/en/plan-your-trip` |
| `/my-trips/new` (CTA thành viên) | `/chuyen-di-cua-toi/moi` | `/en/my-trips/new` |

## Data

Message trong `nav`: `groupExplore`, `groupPlan`, `createTrip` (mới); `destinations`
("Điểm đến"), `itineraries` ("Lịch trình") và `map` ("Bản đồ nhà Hưng" / "Hưng's map")
được đổi chữ để nhãn nhóm không trùng mục đầu và bản đồ của nhà Hưng không bị nhầm với
bản đồ của thành viên. `footer.planHeading` là mới. `myTrips.sectionMap` thành "Bản đồ
của bạn" / "Your map" (chỉ chuỗi; không đụng trang). Không lưu dữ liệu nào.

## How it works

- `nav-items.ts` giữ `primaryNav` gồm link và nhóm; `primaryLinks` làm phẳng.
- **Máy tính (từ 1280px):** một hàng. Nhóm là nút có `aria-expanded`, mở danh sách link
  ngắn (disclosure, không phải ARIA menu): Escape đóng và trả focus, phím mũi tên đổi
  mục, điều hướng bất kỳ đều đóng, nhóm được gạch chân khi một trang con đang mở. Link
  có `aria-current="page"`.
- **Drawer (dưới 1280px):** danh sách phẳng, mỗi nhóm có nhãn, mọi trang một lần chạm.
- **CTA:** `MainNav` đã đọc phiên. Khách: "Thiết kế chuyến đi" → `/plan-your-trip`;
  thành viên: "Tạo chuyến đi" → `/my-trips/new`. Khi phiên đang tải, ô CTA được giữ chỗ
  nhưng vô hình và nằm ngoài thứ tự Tab, nên thành viên không thấy nhãn của khách bị
  đổi; khi tắt script, link của khách hiện ra.
- **Đăng nhập:** icon dưới 1536px, icon kèm chữ từ 1536px. Container header rộng tới
  `screen-2xl` từ độ rộng đó.
- **Ngôn ngữ:** vẫn là thẻ `<a>` thật. Server dựng đường dẫn trang; sau hydrate mới nối
  query hiện tại (đọc bằng `useSyncExternalStore`, không dùng `useSearchParams` vì sẽ
  làm mọi trang thành động) và làm mới khi pointer-down và focus.
- **Footer:** ba chủ đề: Khám phá, Lập chuyến, Nhà Hưng. "Chuyến đi của tôi" rời footer
  (footer tĩnh không biết phiên, khách bấm sẽ gặp trang đăng nhập); thành viên dùng menu
  tài khoản. Tagline header cỡ 12px.

Đo bằng trình duyệt tích hợp (dev server; hàng header một dòng, mục tiêu 44px, không
đè, không cuộn ngang):

| Độ rộng | VI | EN |
|---|---|---|
| 1024, 1180 | drawer | drawer |
| 1280 | dư 13px | dư 53px |
| 1440 | dư 21px | dư 133px |
| 1536 | dư 51px, hiện chữ đăng nhập | dư 149px |

## Files

| Path | Role |
|---|---|
| `src/components/layout/nav-items.ts` | `primaryNav` (link và nhóm), `primaryLinks` |
| `src/components/layout/main-nav.tsx` | `NavDropdown`, hàng desktop, drawer, chọn CTA |
| `src/components/layout/site-header.tsx` | Dựng nhãn, truyền hai CTA, mở rộng container ở 2xl |
| `src/components/layout/account-menu.tsx` | Chữ đăng nhập từ 2xl |
| `src/components/layout/locale-switcher.tsx` | Giữ query |
| `src/components/layout/site-footer.tsx` | Ba cột |
| `messages/vi.json`, `messages/en.json` | `nav.*`, `footer.planHeading`, `myTrips.sectionMap` |

## Tests

- [`routing.test.ts`](../../tests/routing.test.ts) — mọi mục và nhóm nav có trong cả hai
  catalogue; địa điểm, lịch trình mẫu, bản đồ nằm trong link chính.
- [`header-account.test.ts`](../../tests/header-account.test.ts) — CTA theo phiên, ô giữ
  chỗ vô hình khi đang tải, chữ đăng nhập từ 2xl, disclosure của nhóm, không chữ dưới
  12px, cột footer, khách không gặp bất ngờ đăng nhập.
- [`dom/main-nav.test.tsx`](../../tests/dom/main-nav.test.tsx) — CTA khách và thành viên,
  không đổi nhãn, nhóm mở đúng link, `aria-current`, Escape.
- [`dom/locale-switcher.test.tsx`](../../tests/dom/locale-switcher.test.tsx) — giữ query
  và `returnTo`; link trang thuần trước hydrate.
- Số đo ở trên làm thủ công; bẫy focus của drawer trên build production vẫn thuộc UXS-7.

## Limits and open questions

- Ở 1280px bản VI chỉ dư 13px: thêm nhãn dài hay mục thứ bảy cần gom nhóm lại hoặc dời
  breakpoint.
- Nhóm mở bằng bấm, không bằng hover.
- Link đổi ngôn ngữ đọc thanh địa chỉ sau hydrate; trước đó (hoặc không có JavaScript)
  là trang không kèm query.
- `returnTo` giữ nguyên, nên vẫn là đường dẫn của ngôn ngữ cũ; trang đăng nhập nhận cả hai.
- Thành viên vào "Chuyến đi của tôi" chỉ qua menu tài khoản; footer không còn link này.
- Ở 2xl, ô đăng nhập của khách giãn từ 44px ra thành chữ trong lúc phiên đang tải.
