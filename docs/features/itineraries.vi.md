# Tính năng — Lịch trình (và các route tour)

🇬🇧 English version: [itineraries.md](itineraries.md)

## Mục đích

Kế hoạch theo từng ngày cho những chuyến nhà mình đã đi thật. **Ở site này, lịch
trình *chính là* thực thể tour** — nó đã mang đủ thời lượng, giá tham khảo, số
khách và nhịp đi, nên không có model "tour" riêng và các URL tour cũ redirect về
đây.

## Route

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/itineraries` | `/len-lich-trinh` | `/en/itineraries` |
| `/itineraries/[slug]` | `/len-lich-trinh/[slug]` | `/en/itineraries/[slug]` |

Redirect vĩnh viễn (308) trong [`next.config.ts`](../../next.config.ts):

```
/tour, /tours              → /len-lich-trinh
/tour/:slug, /tours/:slug  → /len-lich-trinh/:slug
/en/tour, /en/tours        → /en/itineraries
/en/tour/:slug             → /en/itineraries/:slug
```

**Các redirect này vĩnh viễn cả về mặt cam kết.** Bỏ hay đổi đích chúng phải có
ADR được duyệt — 308 bị browser và máy tìm kiếm cache lại, nên sai ở đây là cái
sai rất đắt để sửa.

## Dữ liệu

[`src/content/itineraries.ts`](../../src/content/itineraries.ts) — 4 mục kiểu
`Itinerary`: `slug`, `title`, `summary`, `days`, `nights`, `priceFromVnd` (giá
tham khảo, mỗi khách, VND), `groupSize`, `pace` (`relaxed` / `balanced` /
`active`), `bestFor`, `destinationSlugs`, `highlights`, `dayByDay`
(`ItineraryDay[]` gồm `day`, `title`, `detail`), `cover`, `featured`.

Helper: `itineraryBySlug`, `getItinerary(slug)`,
`getItinerariesForDestination(destinationSlug)`.

`priceFromVnd` là con số **tham khảo**, không phải báo giá. Nó render qua
`formatVnd`: bản tiếng Việt viết gọn thành "triệu đ" đúng kiểu người Việt viết về
du lịch, bản tiếng Anh dùng `Intl.NumberFormat` dạng tiền tệ.

## Cách hoạt động

Toàn bộ là server component. Trang danh sách liệt kê mọi lịch trình kèm thời
lượng, giá từ và nhịp đi; trang chi tiết render `highlights`, rồi `dayByDay` dưới
dạng danh sách có thứ tự, rồi các điểm đến mà nó đi qua. Slug lạ → `notFound()`.

`generateStaticParams` prerender mọi slug theo từng locale. `dayByDay` được kiểm
bằng test chứ không bằng thói quen: các ngày phải đánh số liên tiếp từ 1 và số
ngày phải khớp field `days`, nên một kế hoạch không thể âm thầm mâu thuẫn với
chính tiêu đề của nó.

## File liên quan

| Đường dẫn | Vai trò |
|---|---|
| [`src/app/[locale]/itineraries/page.tsx`](../../src/app/[locale]/itineraries/page.tsx) | Trang danh sách |
| [`src/app/[locale]/itineraries/[slug]/page.tsx`](../../src/app/[locale]/itineraries/[slug]/page.tsx) | Trang chi tiết, kế hoạch từng ngày, JSON-LD |
| [`src/components/cards/itinerary-card.tsx`](../../src/components/cards/itinerary-card.tsx) | Card |
| [`src/components/sections/featured-itineraries.tsx`](../../src/components/sections/featured-itineraries.tsx) | Khối ở trang chủ |
| [`src/content/itineraries.ts`](../../src/content/itineraries.ts) | Dữ liệu seed + hàm tra cứu |
| [`next.config.ts`](../../next.config.ts) | Redirect tour → lịch trình |
| [`src/lib/format.ts`](../../src/lib/format.ts) | `formatVnd` |

## Test

`tests/content.test.ts` — slug không trùng và an toàn cho URL,
`destinationSlugs` trỏ đúng, mọi field `Localized<T>` đủ hai locale, `cover` có
trên đĩa, và các ngày của lịch trình đánh số liên tiếp từ 1 và khớp `days`. Bảng
redirect không được unit-test (nó là config của Next.js, không phải code);
`npm run build` là thứ chứng minh nó nạp được.

## Giới hạn và câu hỏi còn mở

Không đặt chỗ, không kiểm tình trạng còn chỗ, không form hỏi giá — đó là phase
Planner, và `/thiet-ke-chuyen-di` là đường liên hệ thật cho tới khi phase đó mở.
Xem [plan-your-trip.vi.md](plan-your-trip.vi.md).

Giá là số tĩnh trong một file TypeScript, nên nó âm thầm cũ đi và muốn đổi thì
phải build lại. Nếu giá bắt đầu biến động, nó cần một field ngày tháng và một dòng
"cập nhật ngày…" hiện ra, chứ không phải một lần sửa lặng lẽ.

Bốn lịch trình thì chưa cần lọc theo nhịp đi hay thời lượng, dù cả hai field đã
có sẵn cho việc đó.
