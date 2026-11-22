# Tính năng — Tỉnh thành Việt Nam

🇬🇧 English version: [vietnam-provinces.md](vietnam-provinces.md)

## Tóm tắt

Danh sách tham chiếu có kiểu cho toàn bộ 34 đơn vị hành chính cấp tỉnh của Việt
Nam (6 thành phố và 28 tỉnh) sau đợt sáp nhập 2025. Đây là nền dữ liệu cho mọi
nơi cần nói "tỉnh nào" — chưa hiển thị trên giao diện.

## Đường dẫn

Không có.

## Dữ liệu

`provinces` trong [`src/content/provinces.ts`](../../src/content/provinces.ts), kiểu
`Province` trong `src/content/types.ts`: `slug`, `name` (vi/en), `kind`, `region`,
`coords` và `formerNames`. `coords` là điểm đại diện (một thành phố trong tỉnh) làm
tròn 2 chữ số, không phải ranh giới hay tâm. `formerNames` liệt kê 63 đơn vị cũ
đã gộp vào.

## Cách hoạt động

Dữ liệu tĩnh có kiểu cùng `getProvince(slug)`. Mỗi `Destination` có
`provinceSlug`; bộ lọc tỉnh ở `/places` dùng nó (xem [places.vi.md](places.vi.md)).
`Destination.area` vẫn là nhãn địa lý.

## Tệp

| Đường dẫn | Vai trò |
|---|---|
| `src/content/types.ts` | kiểu `Province` |
| `src/content/provinces.ts` | 34 đơn vị và `getProvince` |
| `tests/provinces.test.ts` | kiểm tra số lượng và tính toàn vẹn |

## Kiểm thử

`tests/provinces.test.ts`: 34 đơn vị (6 thành phố), slug duy nhất, 63 đơn vị cũ
mỗi cái xuất hiện đúng một lần, tên đủ hai ngôn ngữ, tọa độ nằm trong lãnh thổ.

## Giới hạn và câu hỏi còn mở

**Đã kiểm (2026-11-23):** 34 đơn vị, đơn vị nào là thành phố và đơn vị nào là
tỉnh, cùng `formerNames` của từng đơn vị khớp với Điều 1 của Nghị quyết
202/2025/QH15 (23 đơn vị sáp nhập và 11 đơn vị giữ nguyên; 63 đơn vị cũ, mỗi
đơn vị đúng một lần), so bằng script. Văn bản lấy từ một bản sao thứ cấp trên
luatvietnam.vn, không phải Công báo. `Huế` mang `Thừa Thiên Huế` làm tên cũ;
Nghị quyết chỉ ghi đơn vị này giữ nguyên, nên tên đó đến từ lần đổi tên trước
đó, không đến từ Nghị quyết.

**Chưa kiểm:** tọa độ (Nghị quyết không có; là một điểm thành phố đại diện làm
tròn 2 chữ số, chưa kiểm từng đơn vị), nhóm vùng Bắc/Trung/Nam (cách chia
truyền thống, không có trong Nghị quyết) và các slug. Chưa có quận/huyện/xã. Việc nối chuyến đi
hoặc story với tỉnh, hay đưa tỉnh vào bản đồ thành viên, cần quyết định riêng. Liên kết với điểm đến đã được quyết định trong [ADR 0034](../adr/0034-province-destination-link.vi.md).
