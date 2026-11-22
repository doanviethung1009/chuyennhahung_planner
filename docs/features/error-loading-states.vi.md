# Tính năng — Trạng thái lỗi và chờ

🇻🇳 English version: [error-loading-states.md](error-loading-states.md)

## Summary

Nền chung cho những gì khách thấy khi một trang công khai chậm, rỗng hoặc hỏng (UXS-1
của UI/UX master audit, các finding UXA-03, UXA-07 và phần lỗi của UXA-08, UXA-12).
Trước đây: lỗi ném ra hiện trang mặc định của framework không thương hiệu, trang chậm
thì trắng cho đến khi server xong, môi trường chưa có story hiện trang chủ rỗng, và
"không đọc được dữ liệu" bị nói như "chưa có gì".

## Routes

Không có. Không thêm hay đổi route nào (quy tắc 2 của CLAUDE.md không bị đụng tới).

## Data

Namespace thông điệp `states` (`loading`, `errorTitle`, `errorBody`, `retry`,
`backHome`) cùng `home.empty.*`, `stories.errorTitle/errorBody`,
`community.errorTitle/errorBody` và `tripDetail.errorTitle/retry`, ở cả hai catalogue.
Không đổi dữ liệu nội dung hay Planner.

## How it works

- `src/app/[locale]/error.tsx` là error boundary cho mọi trang công khai. Nó hiển thị
  trong layout theo locale (header, footer và provider thông điệp vẫn còn), chỉ thay
  phần trang: một `<h1>`, `role="alert"`, nút **Thử lại** (`reset`) và link về trang
  chủ. Nội dung lỗi không bao giờ hiện ra; log chỉ ghi digest hoặc tên lớp lỗi.
- `src/app/global-error.tsx` là chốt cuối khi chính layout gốc hỏng. Ở tầng này không
  có provider, nên nó đọc chữ trực tiếp từ hai file catalogue và lấy ngôn ngữ từ URL
  (`/en…` là tiếng Anh, còn lại là tiếng Việt).
- `src/app/[locale]/loading.tsx` phủ mọi trang công khai động (`/`, `/stories`,
  `/trip-templates`, `/my-trips` và các trang còn lại): khung xương `aria-hidden`,
  **không có heading** (trang thay thế mang `<h1>` duy nhất), một dòng `role="status"`,
  chỉ nhấp nháy khi `motion-safe`.
- `StateNotice` (`src/components/ui/state-notice.tsx`) là một khung chung cho trạng
  thái rỗng và lỗi: lỗi có `role="alert"`, rỗng thì không.
- Trang chủ khi chưa có story nào hiển thị `HomeEmpty` (một `<h1>` và link tới lịch
  trình mẫu, tạo chuyến mới) thay vì không hiện gì.
- `/stories` và `/community-trips` hiện khung lỗi kèm link thử lại khi đọc thất bại.
  Với thư viện cộng đồng, việc này cần `loadCommunityTrips` trả `{ ok: false }`;
  `getCommunityTrips` vẫn trả `[]` khi lỗi nên mục trên trang chủ vẫn tự ẩn như cũ.
- Trang chi tiết chuyến giờ dùng tiêu đề khác nhau cho "đọc thất bại" và "không tìm
  thấy", và chỉ trường hợp thất bại mới có nút **Thử lại**.

## Files

| Path | Role |
|---|---|
| `src/app/[locale]/error.tsx` | Error boundary công khai |
| `src/app/global-error.tsx` | Hỏng ở layout gốc |
| `src/app/[locale]/loading.tsx` | Khung xương chờ dùng chung |
| `src/components/ui/state-notice.tsx` | Khung rỗng/lỗi |
| `src/components/home/home-empty.tsx` | Trang chủ khi chưa có story |
| `src/app/[locale]/stories/page.tsx`, `community-trips/page.tsx` | Khung lỗi khi đọc thất bại |
| `src/server/community/public.ts` | `loadCommunityTrips` |
| `src/components/planner/trip-detail.tsx` | Lỗi khác không tìm thấy, thử lại |
| `messages/vi.json`, `messages/en.json` | Chuỗi mới |

## Tests

`tests/dom/error-states.test.tsx`: `StateNotice` (alert và cấp heading); route boundary
(một `<h1>`, alert, gọi reset khi bấm, link về trang chủ, không in nội dung lỗi, bản
EN); global boundary dựng từ catalogue; `TripDetail` khi lỗi có tiêu đề riêng và thử
lại sẽ đọc lại, chuyến không tồn tại không có nút thử lại.
`tests/community-public-load.test.ts`: lỗi là `{ ok: false }` với thư viện cộng đồng
và `[]` với hợp đồng của trang chủ, chỉ log tên lớp lỗi. Đủ khóa VI/EN do
`tests/i18n.test.ts` kiểm.
**Chưa có test:** cách Next.js nối boundary thật và khung xương trong trình duyệt
(kiểm bằng tay), và nhánh lỗi của `/stories` (là trang, không phải component).

## Limits and open questions

- Khung xương chỉ có một hình dạng chung (đầu trang cộng lưới thẻ) cho mọi route;
  route có bố cục khác vẫn thấy cùng placeholder.
- Không có `Suspense` ở mức trang: trang chậm vẫn phải đợi lần đọc chậm nhất trước
  khi hiện ra, khung xương chỉ đến sớm hơn.
- `/my-trips/[id]` tải ở client và giữ tiêu đề chờ riêng (một `<h1>` rồi bị thay);
  phần đó thuộc UXS-5.
- Trạng thái rỗng của chuyến đi cộng đồng và review vẫn chỉ là một dòng chữ (UXS-6).
- `global-error` hiển thị không có font và header, theo chủ đích.
