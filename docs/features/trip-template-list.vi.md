# Tính năng — Danh sách lịch trình mẫu

🇻🇳 English version: [trip-template-list.md](trip-template-list.md)

## Summary

Một trang công khai liệt kê các lịch trình mẫu mà chủ dự án đã mở cho mọi người. Mỗi thẻ chỉ có chữ,
cho biết số ngày, phong cách, nhịp độ, nhóm đi và chi phí ước tính, kèm một nút "Dùng mẫu này" dẫn thẳng
tới `/trip-setup/[template]` để khách tạo bản sao riêng trong Planner. Trước đây chỉ vào được mẫu qua lời
kêu gọi ở cuối một câu chuyện. Việc: WEB-2 = P04-4.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/trip-templates` | `/lich-trinh-mau` | `/en/trip-templates` |

Trang được index và có trong sitemap; danh sách rỗng hoặc lỗi là `noindex, follow`.
`/trip-setup/[template]` vẫn `noindex`. Có link ở footer (cột "Khám phá") và ở nút chọn mẫu trên
`/plan-your-trip`. Không nằm trong điều hướng chính.

## Data

- Đọc `TravelTemplate` qua `getRepository().listTemplates({ visibility: 'public', limit: 100, offset: 0 })`.
  Không đổi API, schema hay repository.
- **"Rút" nghĩa là `visibility` quay về `private`.** Đây là điều kiện duy nhất được dùng, giống
  `/trip-setup/[template]`, `GET /api/travel/templates` và CTA của story, nên thẻ nào hiện ra cũng bấm
  vào được. Trạng thái story nguồn không được xét.
- `PublicTemplateCard` (`src/server/content/public-templates.ts`) là allow-list tường minh, dựng từng trường:
  `slug`, `title`, `summary`, `durationDays`, `travelStyle`, `pace`, `groupSize`, `estimatedTotalVnd`,
  `destinationSlug` (chỉ để tra tên điểm đến). Không có story nguồn, snapshot, version, mốc thời gian,
  visibility, slug lịch trình/địa điểm, hay dữ liệu ngày/hoạt động.
- Messages: `tripTemplates` và `nav.tripTemplates` (vi và en); nhãn phong cách và nhịp độ dùng lại
  `travelStyle` và `pace`; chi phí dùng `formatVnd`.
- Seed có một template công khai (`da-lat-3-ngay-lang-man`); thêm mẫu cần dữ liệu thật của chủ dự án.
  Không bịa mẫu để lấp trang.

## How it works

`page.tsx` là server component, `force-dynamic`, nên template bị rút biến mất ở request kế tiếp. Trang gọi
`listPublicTemplates()`; điều kiện `visibility: 'public'` nằm trong hàm đó, không nằm ở nơi gọi. Thứ tự theo
slug (như `listTemplates` trả về).

- **Thẻ:** `TemplateCard` là component thuần nhận nhãn đã dịch qua props. Một `<h2>`, một link; chữ của
  link là "Dùng mẫu này" cộng tiêu đề mẫu chỉ dành cho trình đọc màn hình. Không ảnh vì template không có
  trường ảnh.
- **Một lần đọc mỗi request:** `load()` được bọc bằng `cache()` của React, nên `generateMetadata` và trang dùng chung một lần đọc store; mỗi request mới vẫn đọc lại.
- **Rỗng:** thông báo kèm link thật tới `/stories` và `/my-trips/new`; trang `noindex`.
- **Lỗi:** lỗi đọc store được bắt trong trang, chỉ ghi log tên lỗi, và hiện khối `role="alert"` kèm link thử
  lại về chính trang. Không bao giờ hiện như "rỗng".
- **Bố cục:** 1 cột ở 375px, 2 cột ở 768px, 3 cột ở 1280px; một `<h1>` từ `PageHeader`.

## Files

| Path | Role |
|---|---|
| `src/server/content/public-templates.ts` | `PublicTemplateCard`, `toPublicTemplateCard`, `listPublicTemplates` |
| `src/app/[locale]/trip-templates/page.tsx` | Trang, metadata, rẽ nhánh rỗng/lỗi |
| `src/components/templates/template-card.tsx` | Thẻ chỉ có chữ |
| `src/components/templates/template-states.tsx` | Khối rỗng và lỗi |
| `src/i18n/routing.ts`, `src/app/sitemap.ts` | Route và mục sitemap |
| `src/components/layout/site-footer.tsx` | Link ở footer |
| `src/app/[locale]/plan-your-trip/page.tsx` | Nút chọn mẫu nay trỏ về đây |
| `messages/vi.json`, `messages/en.json` | `tripTemplates`, `nav.tripTemplates`, chữ nút ở `plan-your-trip` |

## Tests

- `tests/trip-templates-list.test.ts` (node): bản đồ route; chỉ liệt kê template công khai và template vừa
  chuyển private biến mất ở lần đọc kế tiếp; lỗi store bị ném chứ không thành rỗng; thẻ có đúng các khóa
  trong allow-list và JSON không chứa trường nội bộ; nối dây sitemap, footer, `/plan-your-trip`; khóa vi/en
  khớp nhau; `noindex` khi rỗng hoặc lỗi.
- `tests/dom/template-card.test.tsx` (jsdom, ADR 0027): một `h2`, đúng một link tới `/tao-chuyen-di/<slug>`
  (`/en/trip-setup/<slug>` ở EN), tiêu đề chỉ-đọc-màn-hình trong link, không có `href="#"`; link ở trạng thái
  rỗng; trạng thái lỗi là alert có link thử lại.
- Chưa phủ: render chính trang async (jsdom không làm được) và bố cục 375/768/1280, đã kiểm tay.

## Limits and open questions

- Template còn `public` mà story nguồn đã bị gỡ hoặc xóa vẫn được liệt kê và dùng được. Sửa tận gốc là
  P07-21 để mọi nơi đổi cùng lúc.
- Chưa có lọc, tìm kiếm, phân trang: seed chỉ có một mẫu. Trang đọc tối đa 100 mẫu; quá số đó phần còn lại
  không hiện. Lọc theo `travelStyle` hoặc điểm đến repository đã hỗ trợ, thêm khi có hơn khoảng 12 mẫu.
- `GET /api/travel/templates` vẫn trả nguyên template (id, snapshot, version). Projection cho nó là việc
  riêng; trang này không dùng nó.
- Cần template thật của chủ dự án; đến lúc đó danh sách trông còn thưa.
