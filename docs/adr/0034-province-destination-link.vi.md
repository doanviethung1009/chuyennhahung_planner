# ADR 0034 — Nối 34 tỉnh với destination qua `Destination.provinceSlug`

🇬🇧 English version: [0034-province-destination-link.md](0034-province-destination-link.md)

- **Trạng thái:** Đã chấp nhận
- **Ngày:** 2026-11-22
- **Người sở hữu:** system-architect
- **Ảnh hưởng:** `src/content/types.ts` (`Destination.provinceSlug`), `src/content/destinations.ts`, `src/content/provinces.ts`, `src/server/content/public-places.ts`, `src/app/[locale]/places/page.tsx`, `src/app/[locale]/destinations/page.tsx`, `tests/provinces.test.ts`, `docs/features/vietnam-provinces.*`

ADR này ghi lại một quyết định mà code đã mang sẵn: dữ liệu tham chiếu 34 tỉnh (tài liệu tính năng `vietnam-provinces`) được merge ở PR #222, còn liên kết với destination và hai bộ lọc tỉnh ở `/places` và `/destinations` theo sau ở PR #225 và #228 mà không có ADR. [`vietnam-provinces.vi.md`](../features/vietnam-provinces.vi.md) nói liên kết này "cần một quyết định riêng". Chủ dự án đã chấp nhận ADR này ngày 2026-11-22. Việc chấp nhận chỉ bao gồm thiết kế liên kết; độ chính xác của dữ liệu tỉnh vẫn chưa được kiểm (xem Việc kéo theo).

## Bối cảnh

Site có hai hệ từ vựng địa lý. `Destination` là đơn vị biên tập: 16 mục trong `src/content/destinations.ts`, một file tĩnh (không phải bảng database), được place, story, collection, review và chuyến đi tham chiếu bằng slug. [ADR 0001](0001-travel-content-system.vi.md) gọi nó là quy mô tỉnh hoặc vùng. `Province` là đơn vị hành chính: sau đợt sáp nhập 2025 có 34 đơn vị (6 thành phố và 28 tỉnh), nằm trong `src/content/provinces.ts` cùng `formerNames` cho 63 đơn vị cũ đã được gộp.

Khách hỏi "Lâm Đồng có gì" theo cách hành chính, trong khi đợt sáp nhập đã dời ranh giới dưới những cái tên người ta vẫn dùng: Hà Giang nay nằm trong Tuyên Quang, Hội An trong Đà Nẵng, Quy Nhơn trong Gia Lai. `Destination.area` cố ý mang tính địa lý ("sống sót qua các đợt đổi tỉnh") nên không trả lời được câu đó. Không có liên kết thì bộ lọc tỉnh phải dùng chuỗi tự do hoặc một danh sách thứ hai viết tay.

Code hôm nay làm gì, và còn gì chưa rõ:

- `Destination.provinceSlug` là một slug bắt buộc, một giá trị. Mọi destination đều có.
- Place không có tỉnh riêng. Nó lấy tỉnh qua `place.destinationSlug`; `src/server/content/public-places.ts` xử lý bộ lọc tỉnh bằng `destinationSlugsInProvince()`.
- Story có `destinationSlug: null` ([ADR 0012](0012-public-travel-from-content-repository.vi.md)) vì vậy không có tỉnh.
- Chuyến đi, template, collection và bản đồ thành viên ([ADR 0029](0029-member-map.vi.md)) vẫn dùng slug destination nên không bị đụng tới.
- Không có gì được lưu trong PostgreSQL hay JSON content store; liên kết nằm trong file tĩnh nên không có migration.
- Tọa độ và danh sách sáp nhập trong `provinces.ts` được viết từ kiến thức, không từ bộ dữ liệu chính thức (tài liệu tính năng dặn kiểm lại với Nghị quyết 202/2025/QH15). Việc đó chưa làm.

## Quyết định

1. **Tỉnh được gắn vào destination, một lần.** `Destination.provinceSlug` bắt buộc và phải trỏ tới một `Province` trong `src/content/provinces.ts`. Đây là nơi duy nhất lưu tỉnh.
2. **Mọi thứ khác suy ra tỉnh** qua destination của nó: place, và bất cứ thứ gì đã mang slug destination. Không thêm trường `provinceSlug` vào `Place`, `TravelStory`, `Trip`, `TravelTemplate` hay bất kỳ entity nào được lưu.
3. **Danh sách tham chiếu vẫn là file tĩnh có kiểu**, cùng vị thế với `destinations.ts`. Không chuyển vào content store và không có CRUD admin trong quyết định này.
4. **Toàn vẹn là một test, không phải quy tắc lúc chạy.** `tests/provinces.test.ts` làm build thất bại khi `provinceSlug` của destination không khớp tỉnh nào, và `tests/destinations-province-filter.test.ts` khi bộ lọc đưa ra một tỉnh rỗng. Cách này giống các dữ liệu tham chiếu tĩnh khác trong `src/content/**`.
5. **`Destination.area` vẫn mang tính địa lý**, không bị thay thế hay suy ra từ tỉnh.
6. **Story không có destination thì không có tỉnh.** Nó không xuất hiện dưới bộ lọc tỉnh, và ta không thêm liên kết thứ hai để chữa chuyện đó.

## Các phương án đã cân nhắc

| Phương án | Điểm cộng | Điểm trừ |
|---|---|---|
| A (đã chọn): một `provinceSlug` trên `Destination`, nơi khác suy ra | Một chỗ để sửa khi tỉnh đổi. Không migration dữ liệu đã lưu. Khớp cách mọi entity khác đã trỏ tới destination | Destination nằm vắt hai tỉnh thì không biểu diễn được. Place thừa hưởng tỉnh của destination ngay cả khi nó nằm bên kia ranh giới |
| B: thêm `provinceSlug` cho `Place` (và story) | Chính xác tới cấp place | Bản sao được lưu trôi lệch so với destination. Cần migration nội dung và một trường admin. Đợt sáp nhập sau phải sửa từng place |
| C: mảng `provinceSlugs` trên `Destination` | Xử lý destination vắt qua nhiều tỉnh | Bộ lọc nhiều giá trị, số đếm mơ hồ, và "nó thuộc tỉnh nào" không còn một đáp án. Hiện không destination nào cần |
| D: thay `Destination` bằng `Province` | Một hệ từ vựng | Destination là đơn vị biên tập mang thương hiệu, có URL và nội dung riêng; một đợt sáp nhập kiểu 2025 sẽ buộc đổi tên hoặc gộp trang công khai |

Phương án về nhì là C. Nó bị loại vì chưa destination nào vắt hai tỉnh, và liên kết nhiều giá trị làm mọi bộ lọc và số đếm mơ hồ cho một trường hợp chưa tồn tại.

## Hệ quả

Dễ hơn: trang hay bộ lọc theo tỉnh chỉ là một phép tra, không phải một dự án dữ liệu. Một đợt đổi tỉnh là sửa mỗi destination bị ảnh hưởng cộng `provinces.ts`, không cần migration dữ liệu. Có thể đảo ngược: bỏ trường và các bộ lọc, dữ liệu đã lưu không đổi.

Khó hơn:

- Một destination chỉ thuộc một tỉnh. Một mục thật sau này vắt hai tỉnh (một destination quy mô vùng như đồng bằng) buộc phải chọn một. Khi đó xem lại phương án C.
- Độ chính xác của place bị chặn bởi destination của nó. Một place ở bên kia ranh giới tỉnh bị xếp sai tỉnh.
- Toàn vẹn chỉ được thực thi lúc build. Trình soạn nội dung lúc chạy hiện không tạo được liên kết sai vì destination không sửa được ở đó; điều này hết đúng vào ngày destination chuyển vào content store, và quyết định này cần được xem lại cùng lúc.
- Độ chính xác của dữ liệu tỉnh chưa được kiểm (xem Bối cảnh). Một mục `formerNames` hay tọa độ sai sẽ hiện ra với khách qua các bộ lọc.
- Story không có destination không xuất hiện trong bộ lọc tỉnh.

## Việc kéo theo

- Chủ dự án: kiểm `provinces.ts` (danh sách sáp nhập, tọa độ, nhóm vùng) với Nghị quyết 202/2025/QH15. Vẫn còn mở.
- Tài liệu: thêm một ghi chú ngắn về tỉnh vào phần dữ liệu của `docs/architecture.md` + `.vi.md`. `docs/features/vietnam-provinces.*` nên trỏ về đây thay vì nói liên kết "cần một quyết định riêng".
- Không thuộc quyết định này, mỗi việc cần ADR riêng: bản đồ thành viên cấp tỉnh (ADR 0029 là cấp quốc gia), đưa destination vào content store, hoặc `provinceSlug` trên chuyến đi.
