# Tính năng — Thêm điểm đến

🇬🇧 English version: [more-destinations.md](more-destinations.md)

## Tóm tắt

Thêm tám điểm đến hai đứa **chưa đi** (Hà Nội, Quảng Ninh/Hạ Long, Quảng Bình/Phong Nha, Đà Nẵng, Quy Nhơn, Nha Trang, TP. Hồ Chí Minh, Cần Thơ) để người đọc xem và lên kế hoạch cho nhiều nơi hơn, cùng hai địa điểm nổi tiếng cho mỗi nơi đó và cho Hội An, Sa Pa, Hà Giang, Huế. Điểm đến chưa đi chỉ có thông tin khách quan — không bịa lời kể ngôi thứ nhất, ngày đi hay số lần đi.

## Đường dẫn

Không có. Dùng các route sẵn có `/destinations/[slug]` (`/kham-pha/[slug]`), `/places/[slug]` (`/dia-diem/[slug]`) và `/map` (`/ban-do`). Các redirect `/tour*` giữ nguyên.

## Dữ liệu

- `Destination.firstVisited` và `Destination.visits` giờ là tùy chọn; `isVisited()` trong `src/content/types.ts` là chỗ kiểm tra duy nhất. Thiếu hai trường này nghĩa là "chưa đi".
- `body` vẫn bắt buộc: với điểm đến chưa đi, đó là mô tả khách quan, câu cuối nói rõ hai đứa chưa đến.
- Message mới: `common.notVisited`, `map.legendNotVisited`; `destinations.description` được viết lại.
- Địa điểm nằm trong `src/content/travel/seed-places.ts` và thuộc `demoPlaces`. `rating` và `personalNote` là `null` (trải nghiệm của chủ dự án). `suggestedMinutes` và `estimatedCostVnd` là **ước tính cần xác nhận**; tọa độ là xấp xỉ. Việc của chủ dự án: xác nhận giá, điền rating và ghi chú sau khi đi.
- Ảnh bìa là SVG trừu tượng từ `scripts/generate-covers.mjs`, không phải ảnh thật.

## Cách hoạt động

Thẻ điểm đến hiện nhãn "Chưa đi" thay cho số lần đi; trang chi tiết ẩn ngày "lần đầu đến" và hiện "Chưa đi" ở ô số lần; `/map` liệt kê "Chưa đi" và vẽ chấm rỗng bán kính nhỏ nhất (`pinRadius(undefined)` bằng 5). Điểm đến chưa đi được nối sau các điểm đã đi nên trang chủ (bốn mục đầu) không đổi. `seedTravelContent` chỉ seed store rỗng, nên store có sẵn nhận địa điểm bằng `npm run content:seed-places` (chỉ tạo mới, có `--dry-run`; xem `docs/usage.vi.md`). Thay đổi này không chạy lệnh đó trên store thật nào.

## Tệp

| Đường dẫn | Vai trò |
|---|---|
| `src/content/types.ts` | trường tùy chọn, `isVisited()` |
| `src/content/destinations.ts` | tám điểm đến mới |
| `src/content/travel/seed-places.ts` | địa điểm nổi tiếng và hàm bổ sung |
| `src/content/travel/seed.ts` | `demoPlaces` nay gồm chúng |
| `scripts/content-seed-places.ts` | lệnh bổ sung |
| `scripts/generate-covers.mjs`, `public/images/covers/*.svg` | ảnh bìa |
| `src/components/cards/destination-card.tsx`, `src/components/map/vietnam-map.tsx`, `src/lib/map.ts`, `src/app/[locale]/map/page.tsx`, `src/app/[locale]/destinations/[slug]/page.tsx` | hiển thị trạng thái chưa đi |

## Kiểm thử

`tests/destinations-unvisited.test.ts` kiểm tra không bịa ngày hay số lần, câu nói rõ chưa đi ở cả hai ngôn ngữ, ảnh bìa tồn tại, mỗi điểm đến ≥ 2 địa điểm, slug điểm đến hợp lệ, `rating`/`personalNote` là null và việc bổ sung chỉ-tạo-mới, lặp lại không đổi. `tests/travel-content-acceptance.test.ts` đếm theo `demoPlaces.length`. Các test map, content, i18n sẵn có phủ phần còn lại.

## Giới hạn và câu hỏi mở

- Chi phí, thời lượng, tọa độ là ước tính cần chủ dự án xác nhận; rating và ghi chú để trống có chủ đích.
- Nội dung điểm đến là kiến thức chung, không phải trải nghiệm thật; thay sau khi đi (rồi thêm `visits` và `firstVisited`).
- Store có sẵn cần chạy tay `content:seed-places`.
- `qc` và `security` chưa chạy.
