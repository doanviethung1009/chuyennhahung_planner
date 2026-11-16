# Tính năng — Trang chủ: chuyến đầu tiên và Continue Planning

🇬🇧 English version: [home-continue-planning.md](home-continue-planning.md)

## Summary

Thành viên đã đăng nhập giờ thấy thêm một dải phía trên hero ở trang chủ. Chưa có chuyến nào
thì dải mời **tạo chuyến đầu tiên**; chỉ còn chuyến đã xong hoặc đã lưu trữ thì đề nghị **một
chuyến mới**; có chuyến chưa xong thì hiện **Continue Planning**: tên chuyến, điểm đến, độ dài,
đếm ngược nếu có ngày, trạng thái, và nút vào trình sửa chuyến. Khách, crawler hay người có
phiên không hợp lệ thấy trang chủ đúng như trước. Stories, destinations, chuyến cộng đồng và
review không đổi với mọi người.

## Routes

Không có route mới. Dải liên kết tới các route hiện có:

| Nội bộ | Tiếng Việt | Tiếng Anh |
|---|---|---|
| `/` | `/` | `/en` |
| `/my-trips/new` | `/chuyen-di-cua-toi/moi` | `/en/my-trips/new` |
| `/my-trips/[id]` | `/chuyen-di-cua-toi/[id]` | `/en/my-trips/[id]` |
| `/my-trips` | `/chuyen-di-cua-toi` | `/en/my-trips` |

## Data

Không bảng, endpoint hay migration mới. Trang chủ đọc Planner như trang admin: cookie
`planner_session`, `identify`, rồi `listTrips` (đang dùng, thêm archived với `limit: 1` chỉ khi
không có chuyến đang dùng). Messages dưới `home.member` ở cả hai catalogue.

`readHomeMember()` trả `guest`, `first-trip`, `next-trip` hoặc `continue`; cái cuối mang một
`ContinueTrip` với đúng bảy trường (`id`, `title`, `destinationSlug`, `durationDays`,
`startDate`, `daysUntilStart`, `planningStatus`). Chủ, share token, ghi chú, ngân sách và
version không bao giờ rời module server.

## How it works

- **Chỉ ở server.** [`readHomeMember`](../../src/server/planner/home-page.ts) đọc cookie,
  chỉ chuyển cookie cho `identify`, và lùi về `guest` khi có bất kỳ lỗi, đang chờ đổi mật
  khẩu, hay danh tính kiểu bearer ([ADR 0022](../adr/0022-home-mvp-server-session.vi.md)).
  Dải là server component, không JavaScript client, nên có ngay trong phản hồi đầu — không
  khung chờ, không xô lệch bố cục.
- **Chọn chuyến nào.** [`pickContinueTrip`](../../src/lib/home/continue-trip.ts): không bao
  giờ chọn chuyến `completed`; ngày khởi hành sớm nhất từ hôm nay (ngày lịch Việt Nam); nếu
  không thì chuyến không ngày cập nhật gần nhất; nếu không thì chuyến có ngày đã qua cập nhật
  gần nhất; hòa thì theo `updatedAt` rồi `id`.
- **Trang công khai không đổi.** `generateMetadata`, layout và header không đọc dữ liệu
  request; request không có cookie render cùng HTML như trước.
- **Cache.** Request có cookie được Next trả `private, no-cache, no-store` qua render động
  (đã kiểm trên bản build production); không cần luật nào trong `next.config.ts`.

## Files

- `src/server/planner/home-page.ts` — `readHomeMember`, `resolveHomeMember`
- `src/lib/home/continue-trip.ts` — `pickContinueTrip`, `daysUntil`, `vietnamToday`
- `src/components/home/home-member-band.tsx` — dải
- `src/app/[locale]/page.tsx` — một lần đọc và một component phía trên `<Hero />`
- `messages/vi.json`, `messages/en.json` — `home.member.*`

## Tests

- `tests/home-continue-trip.test.ts` — hàm chọn, xử lý hòa điểm, ngày Việt Nam.
- `tests/home-member.test.ts` — khách, cookie rác, token bearer, chờ đổi mật khẩu,
  first/next/continue, bộ khóa chính xác, cách ly giữa hai thành viên, store lỗi.
- `tests/home-page-boundary.test.ts` — ngoại lệ duy nhất không lan sang layout, header,
  metadata hay trang khác.

## Limits and open questions

- Chưa có số hoạt động hay tiến độ trong dải: cần đọc đầy đủ chuyến.
- Các bước onboarding, "Dành cho bạn", hoạt động cộng đồng và mục đã lưu thuộc
  [spec cá nhân hóa](../specs-home-personalization.vi.md) lớn hơn, chưa xây.
- Nếu có CDN hay cache dùng chung đặt trước `/`, nó phải bỏ qua cache với request có cookie
  phiên, hoặc trang chủ phải chuyển sang thiết kế đảo client của
  [ADR 0021](../adr/0021-personalized-home.vi.md) (câu hỏi Q5 của spec).
- Dải thành viên đã được kiểm trong trình duyệt trên bản build production bằng tiếng Việt và
  tiếng Anh ở độ rộng điện thoại và desktop; `/qc-check` và `/sec-check` chưa được chạy.
