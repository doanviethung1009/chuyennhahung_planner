# Kiến trúc — Chuyện Nhà Hưng

🇬🇧 English version: [architecture.md](architecture.md)

Một trang kể chuyện du lịch lấy tiếng Việt làm gốc. Chuyện đi chơi, điểm đến, bản
đồ hành trình, lịch trình theo ngày, review video, và một điểm vào để thiết kế
chuyến đi. *Backend* của Planner thuộc phase sau; xem [Các phase](#các-phase).

## Tổng quan nhanh

| Hạng mục | Lựa chọn | Ở đâu |
|---|---|---|
| Framework | Next.js 16, App Router, React 19 | [`src/app/`](../src/app) |
| Render | Server component, prerender toàn bộ khi build | mọi `page.tsx` |
| Ngôn ngữ | TypeScript `strict` + `noUncheckedIndexedAccess` | [`tsconfig.json`](../tsconfig.json) |
| i18n | `next-intl` 4, VI không prefix, EN ở `/en` | [`src/i18n/`](../src/i18n) |
| Styling | Tailwind v4, token `@theme` theo hướng CSS-first | [`src/app/globals.css`](../src/app/globals.css) |
| Nội dung | Dữ liệu seed TypeScript có type, không CMS | [`src/content/`](../src/content) |
| Test | Vitest 3 (Node 20.14 chặn Vitest 4/5) | [`tests/`](../tests) |
| Lưu trữ | **Không có.** Không database, không API route, không server action | — |

Không có backend. Mỗi trang là một tệp tĩnh sinh ra lúc build từ dữ liệu có type
trong repo — đó là lý do cả site chạy được mà không cần gì ngoài một file server.

## Đường đi của một request

```
request
  │
  ├─ next.config.ts redirects ......... /tour, /tours cũ → route lịch trình (308)
  │
  ├─ src/middleware.ts ................ next-intl: xác định locale + đổi pathname
  │                                     bản địa hoá → pathname nội bộ
  │                                     (bỏ qua /api, /_next, /opengraph-image, *.*)
  │
  ├─ src/app/[locale]/layout.tsx ...... font, <html lang>, header/main/footer,
  │                                     NextIntlClientProvider
  │
  └─ src/app/[locale]/**/page.tsx ..... server component
         ├─ đọc src/content/**         (dữ liệu seed có type)
         ├─ đọc messages/<locale>.json qua useTranslations/getTranslations
         ├─ ghép các src/components/**
         └─ export generateMetadata → src/lib/metadata.ts
```

Các route không phụ thuộc locale nằm ngoài `[locale]`:
[`robots.ts`](../src/app/robots.ts), [`sitemap.ts`](../src/app/sitemap.ts) và
[`opengraph-image.tsx`](../src/app/opengraph-image.tsx).

## Routing và bản địa hoá

Tiếng Việt là sản phẩm; tiếng Anh là bản dịch. VI render **không có prefix**, EN
có prefix, và `localeDetection` **tắt** có chủ đích — Accept-Language sẽ đẩy một
khách Việt dùng điện thoại cài tiếng Anh sang trang tiếng Anh.

Pathname chuẩn (nội bộ) viết bằng tiếng Anh và khớp 1:1 với cây thư mục
`app/[locale]`. URL mà khách thực sự thấy ở từng locale được định nghĩa một lần,
trong [`src/i18n/routing.ts`](../src/i18n/routing.ts):

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/` | `/` | `/en` |
| `/stories` | `/chuyen-di-choi` | `/en/stories` |
| `/stories/[slug]` | `/chuyen-di-choi/[slug]` | `/en/stories/[slug]` |
| `/destinations` | `/kham-pha` | `/en/destinations` |
| `/destinations/[slug]` | `/kham-pha/[slug]` | `/en/destinations/[slug]` |
| `/map` | `/ban-do` | `/en/map` |
| `/itineraries` | `/len-lich-trinh` | `/en/itineraries` |
| `/itineraries/[slug]` | `/len-lich-trinh/[slug]` | `/en/itineraries/[slug]` |
| `/plan-your-trip` | `/thiet-ke-chuyen-di` | `/en/plan-your-trip` |
| `/reviews` | `/goc-review` | `/en/reviews` |
| `/about` | `/ve-nha-hung` | `/en/about` |

Hai type giữ cho điều hướng không sai: `AppPathname` là mọi route nội bộ, còn
`StaticPathname` loại bỏ các route `[slug]` để một route động không bao giờ bị
đưa vào menu như một mục phẳng trong
[`nav-items.ts`](../src/components/layout/nav-items.ts).

**Route tour là vĩnh viễn.** Tour được mô hình hoá thành lịch trình — một lịch
trình đã mang đủ thời lượng, giá tham khảo, số khách và kế hoạch từng ngày như
một tour. `/tour`, `/tours`, `/tour/:slug`, `/tours/:slug` và các bản `/en` là
redirect 308 trong [`next.config.ts`](../next.config.ts). Đổi đích hay bỏ chúng
phải có ADR được duyệt. Chi tiết:
[features/itineraries.vi.md](features/itineraries.vi.md).

Thêm một locale là ba việc làm cùng lúc: `locales` + `pathnames` trong
`routing.ts`, thêm `messages/<locale>.json`, và thêm key mới vào **mọi** field
`Localized<T>` trong `src/content/**`. `tests/i18n.test.ts` và
`tests/content.test.ts` sẽ fail đến khi làm đủ cả ba.

## Tầng nội dung

Nội dung là TypeScript có type, không phải CMS. `Localized<T>` chính là
`Record<Locale, T>`, nên chính hệ type — không phải người review — là thứ bắt lỗi
thiếu bản dịch.

| Bộ dữ liệu | File | Số lượng |
|---|---|---|
| Điểm đến | [`destinations.ts`](../src/content/destinations.ts) | 8 |
| Chuyện đi chơi | [`stories.ts`](../src/content/stories.ts) | 6 |
| Lịch trình | [`itineraries.ts`](../src/content/itineraries.ts) | 4 |
| Review video | [`video-reviews.ts`](../src/content/video-reviews.ts) | 6 |
| Site + mạng xã hội | [`site.ts`](../src/content/site.ts) | — |

Các shape nằm trong [`src/content/types.ts`](../src/content/types.ts). Hai field
có ý nghĩa kiến trúc: `coords` của điểm đến là toạ độ WGS84 thật mà bản đồ chiếu
lên, và `cover` trỏ tới tranh SVG sinh tự động đúng tinh thần thương hiệu
(`npm run covers`) để site không bao giờ có ảnh lỗi.

`site.ts` được đánh dấu **cần chủ nhà xác nhận** — các handle và email liên hệ là
giá trị hợp lý nhưng chưa được kiểm chứng.

## Ranh giới module

Hướng phụ thuộc là một chiều. Tầng dưới không bao giờ gọi lên tầng trên.

```
app/[locale]/**      trang: chỉ ghép, không tự fetch
   ↓
components/**        ui/ · layout/ · cards/ · sections/ · map/ · seo/
   ↓
lib/**               format.ts · map.ts · metadata.ts   (hàm thuần)
   ↓
content/** · i18n/** · messages/**                      (dữ liệu + hợp đồng)
```

- `lib/` là tầng thuần, không side effect: format ngày/giá/thời lượng, phép chiếu
  bản đồ, dựng metadata. Đây là tầng unit test nhắm trực tiếp vào.
- `components/ui/` chứa primitive (`Button`, `Container`, `Section`, `Badge`,
  `Prose`, `CoverImage`); `sections/` chứa các khối ghép ở tầm trang; `cards/`
  mỗi bộ dữ liệu một card. Card không bao giờ tự fetch — trang truyền dữ liệu vào.
- `src/i18n/navigation.ts` là nguồn duy nhất của `Link`, `getPathname` và các
  helper cùng họ. Import thẳng `next/link` sẽ bỏ qua bản đồ pathname bản địa hoá.

## Render và ranh giới client

Mặc định là server component; `'use client'` phải có lý do nêu rõ. Hiện tại bundle
client tồn tại cho đúng hai thứ: drawer điều hướng trên mobile (bẫy focus, Escape,
tự đóng khi chuyển trang) trong
[`main-nav.tsx`](../src/components/layout/main-nav.tsx), và bộ đổi ngôn ngữ.

Bản đồ hành trình **không** phải client component, có chủ đích: đó là một SVG
silhouette với các thẻ `<a>` thật, vị trí tính bởi [`lib/map.ts`](../src/lib/map.ts),
nên nó đi được bằng bàn phím và bot vẫn đọc được khi tắt JavaScript.

## SEO

Ở đây SEO là yêu cầu cấu trúc, không phải bước đánh bóng.
[`src/lib/metadata.ts`](../src/lib/metadata.ts) dựng URL canonical cho từng trang
cùng bộ `hreflang` đầy đủ, với `x-default` trỏ về tiếng Việt. Mỗi trang export
`generateMetadata`; JSON-LD phát qua
[`components/seo/json-ld.tsx`](../src/components/seo/json-ld.tsx) ở những chỗ có
type schema.org phù hợp. `sitemap.ts` liệt kê mọi route ở mọi locale. Chi tiết:
[features/seo-and-metadata.vi.md](features/seo-and-metadata.vi.md).

## Design token

Mọi màu, font, bán kính bo, bóng đổ và easing được định nghĩa một lần, trong khối
`@theme` của [`globals.css`](../src/app/globals.css). Không nơi nào khác được
hard-code. `tests/design-tokens.test.ts` parse CSS thật và kiểm tra tương phản
WCAG AA — đó là lý do màu primary tương tác là `clay-600` chứ không phải
`clay-500`, và là lý do `--color-border-strong` tồn tại. Chi tiết:
[features/design-system.vi.md](features/design-system.vi.md).

## Kiểm chứng

| Cổng | Lệnh | Bảo vệ điều gì |
|---|---|---|
| Type | `npm run typecheck` | `Localized<T>` đủ locale, route an toàn kiểu |
| Lint | `npm run lint` | bộ rule `eslint-config-next` |
| Test | `npm run test` | nội dung, đồng bộ i18n, routing, bản đồ, token, tài liệu |
| Build | `npm run build` | mọi trang prerender được |
| UI | `npm run verify:ui` | ảnh chụp ở 375/768/1440, fail nếu tràn ngang |

## Các phase

Những thứ vắng mặt có chủ đích, và không được dựng sớm:

- **Backend của Planner.** `/thiet-ke-chuyen-di` là trang nội dung với đường liên
  hệ thật (mailto, Zalo, Messenger) và không có form — một nút submit không có gì
  phía sau là một nút chết. Mở phase này nghĩa là database, validation, rate
  limiting và một ADR, theo đúng thứ tự đó.
- **Card video bấm được.** Chúng ta không có URL của từng video, nên card chỉ để
  trình bày. Muốn bấm được thì phải thêm field URL vào `VideoReview` và cập nhật
  `tests/content.test.ts`.
- **Ảnh thật.** Ảnh cover là SVG sinh tự động cho tới khi chủ nhà đưa ảnh thật.

## Phân quyền sở hữu

| Agent | Sở hữu |
|---|---|
| `system-architect` | Topology route, hợp đồng dữ liệu, ADR, `docs/architecture.*`, sơ đồ |
| `backend-engineer` | `src/app/api/**`, server action, lưu trữ, validation |
| `frontend-engineer` | Trang, component, token, `messages/*.json` |

Ai ship tính năng thì người đó viết tài liệu cho nó trong
[`features/`](features/README.vi.md), bằng cả hai ngôn ngữ. Quy tắc:
[`CLAUDE.md`](../CLAUDE.md).
