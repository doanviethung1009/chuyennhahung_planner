# ADR 0001 — Travel Content System: thực thể, lưu trữ và bề mặt quản trị

🇬🇧 English version: [0001-travel-content-system.md](0001-travel-content-system.md)

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-11-08
- **Người quyết**: chủ nhà (chọn cách lưu trữ + validation), system-architect (hợp đồng)
- **Thay thế**: không thay thế gì
- **Ảnh hưởng tới**: `src/server/content/**`, `src/app/api/**`, `src/content/travel/**`

## Bối cảnh

Yêu cầu ban đầu đặt ra một Travel Content System gồm năm module — Travel Stories,
Travel Places, Destination Collections, Travel Reviews và Travel Templates dùng
lại được — kèm chỉ dẫn *"tái sử dụng các bảng CMS, places và destination có sẵn"*
và *"chỉ thêm migration khi thật cần"*.

Tiền đề đó không đúng với repo này. Tại thời điểm viết ADR, ở đây:

- **không có database** — không Prisma, Drizzle, Postgres, SQLite, Supabase, Mongo
  hay Kysely, và không có bất kỳ công cụ migration nào;
- **không có CMS** — nội dung là các module seed TypeScript có type trong
  `src/content/**`, được server component import trực tiếp;
- **không có API route**, **không có server action**, **không có auth**;
- **không có thực thể `Place` nào cả**. `Destination` là một thực thể biên tập ở
  quy mô tỉnh/vùng (8 bản ghi: Hà Giang, Sa Pa, Ninh Bình, Huế, Hội An, Đà Lạt,
  Phú Quốc, Mộc Châu) với một toạ độ tâm duy nhất. Nó *không phải* một địa điểm
  ở mức GPS.

Vậy là không có bảng nào để tái sử dụng. Thứ *có thể* tái sử dụng — và đang được
tái sử dụng — là các **thực thể và slug sẵn có**: `Destination`, `Story`,
`Itinerary` và `VideoReview`.

Ràng buộc từ quy tắc 6 của `CLAUDE.md`: backend Planner là phase sau, và không
được dựng sớm bảng hay endpoint cho Planner. Bản yêu cầu cũng nói rõ không xây AI
Planner trong phase này.

## Quyết định

### 1. Lưu trữ: tầng repository, chưa có database

Các thực thể được định nghĩa thành model có type, nằm sau một interface store
không phụ thuộc cách lưu trữ (`ContentStore`: `read()` / `write()`), với hai bản
hiện thực:

| Bản hiện thực | Dùng cho | Ghi chú |
|---|---|---|
| `createMemoryStore` | test, preview | seed riêng cho từng instance, không I/O |
| `createJsonFileStore` | dev / tự host | ghi atomic (file tạm + `rename`), hàng đợi ghi trong tiến trình |

`TravelContentRepository` giữ toàn bộ logic nghiệp vụ và các bất biến, và chỉ nói
chuyện với `ContentStore`. Chuyển sang SQL về sau là **thêm một adapter mới** cộng
một migration phát lại seed — không phải sửa route handler, validation hay test.

**Phase này không thêm migration nào**, theo đúng *"chỉ thêm migration khi thật cần"*.

**Giới hạn đã biết và chấp nhận có ý thức:** store JSON chỉ an toàn với một tiến
trình Node duy nhất. Nó xếp các lượt ghi vào một hàng đợi trong tiến trình, nên
hai instance chạy song song (hoặc một bản deploy serverless có hơn 1 lambda) có
thể làm mất một lượt ghi do xen kẽ đọc–sửa–ghi. Đây là store cho môi trường phát
triển và chạy một instance. Khi nào cần deploy nhiều instance thì đó là lúc chọn
SQL và viết migration thật đầu tiên.

### 2. Validation: `zod`

Thêm đúng một dependency (`zod@3.25.76`, dòng 3.x — bản 4.x đòi Node mới hơn mức
sàn 20.14 mà repo này build trên đó). Mọi lượt mutation phía admin đều được parse
ngay tại biên route; các type nghiệp vụ được **suy ra từ schema**, nên validator
và model không thể lệch nhau. Khoá lạ bị loại bỏ, không được tin.

### 3. Ranh giới thực thể — cái gì tái sử dụng, cái gì mới

| Module | Thực thể | Quan hệ với nội dung sẵn có |
|---|---|---|
| Travel Places | `Place` (mới) | **Tham chiếu** `Destination.slug`. Lấp đúng khoảng trống ở mức GPS mà destination không phủ. |
| Travel Stories | `TravelStory` (mới) | Bản **kế nhiệm giàu nội dung hơn, có thể xuất bản** của `Story`. Xem ghi chú bên dưới. |
| Destination Collections | `DestinationCollection` (mới) | Thuần tuyển chọn — chỉ giữ tham chiếu slug tới destination, story và place. Không tự sở hữu nội dung nào. |
| Travel Reviews | `TravelReview` (mới) | **Khác với `VideoReview`**. Xem ghi chú bên dưới. |
| Travel Templates | `TravelTemplate` (mới) | **Tham chiếu** `Itinerary.slug` như một dịch vụ tour liên quan và `TravelStory.slug` như nguồn gốc. Không thay thế `Itinerary`. |

**`TravelStory` và `Story`.** Hai thứ này không trùng nhau: `Story` là một bản ghi
blog marketing phẳng (tiêu đề, trích dẫn, `body: string[]`, không trạng thái,
không SEO, không chi phí, không place) đang được các route `/chuyen-di-choi` render
thật. `TravelStory` bổ sung nội dung rich theo block, một gallery, ngày đi, chi phí
chuyến đi dạng số nguyên VND, liên kết tới place/review/itinerary, một vòng đời
xuất bản và metadata SEO. Việc chuyển sáu bản ghi `Story` hiện có sang
`TravelStory` và trỏ lại các route công khai là **một thay đổi riêng, do frontend
sở hữu** và cần ADR của chính nó — ở đây các route công khai không bị chạm tới.

**`TravelReview` và `VideoReview`.** `VideoReview` là một clip video cố tình không
có link (nền tảng, thời lượng, ảnh bìa), không điểm đánh giá và không có phần văn
xuôi — xem test "keeps video reviews link-free". `TravelReview` là một bài đánh giá
viết bằng chữ, có điểm, xuất bản được, về một place, một destination hay một
itinerary. Khác hình dạng, khác mục đích; không cái nào thay cái nào.

### 4. Blog, template và chuyến đi của người dùng là ba thứ riêng biệt

Ba mối quan tâm khác nhau, ba thực thể khác nhau, không chia sẻ state thay đổi được:

- **blog** = `TravelStory` — biên tập, đã xuất bản, bất biến khi đã công khai;
- **template** = `TravelTemplate` — dùng lại được, có version, dẫn xuất *từ* một
  story qua một `sourceSnapshot` bất biến và không bao giờ ghi ngược lại story đó;
- **chuyến đi của người dùng** = **không có trong phase này.** Không tạo model,
  bảng hay endpoint nào cho chuyến đi của người dùng. Đó là địa phận của Planner
  (quy tắc 6 trong `CLAUDE.md`).

Một template mang theo `sourceSnapshot`, đóng băng ngay lúc tạo: tiêu đề,
destination, ngày đi, chi phí thực tế và các slug place của story nguồn *đúng như
lúc đó*. Sau này sửa hay xoá story nguồn cũng không bao giờ làm biến đổi một
template đã xuất bản. `version` tăng lên sau mỗi lượt mutation cấu trúc.

### 5. Tiền là số nguyên VND, ở mọi nơi

Mọi trường tiền đều có tên kết thúc bằng `*Vnd`, type `z.number().int()`, không âm,
và chặn trên ở 10^12 để bắt lỗi sai đơn vị (ví dụ truyền xu thay vì đồng). Không
một số thực nào được chạm vào phần hạch toán chi phí. Các con số tổng được tính
lại từ chi phí từng hoạt động mỗi lần ghi, không bao giờ tin số do client gửi lên.

### 6. Phân quyền mặc định là đóng

Mutation phía admin đòi `Authorization: Bearer <ADMIN_API_TOKEN>`, so sánh bằng
`timingSafeEqual`. Nếu `ADMIN_API_TOKEN` chưa được đặt hoặc ngắn hơn 32 ký tự,
mọi route admin trả về `503 admin_auth_unconfigured` — nó không bao giờ tụt về một
mặc định cho qua khi chưa xác thực. Các endpoint đọc công khai chỉ phục vụ những
bản ghi đã xuất bản/công khai.

## Hệ quả

**Mặt được.** Ship được ngay hôm nay với hạ tầng bằng không; `typecheck`, `lint` và
`test` đều chạy offline. Route handler, validation, các bất biến và test đều viết
dựa trên interface, nên việc đổi sang SQL chỉ là thêm vào. Các trang công khai
hiện có và các redirect tour không bị chạm tới.

**Mặt mất.** Chỉ lưu trữ được trong một tiến trình (xem phần giới hạn ở trên).
Không có cơ chế ràng buộc toàn vẹn quan hệ — các bất biến tham chiếu nằm trong
repository, nên sửa trực tiếp file JSON có thể tạo ra slug mồ côi;
`validateIntegrity()` và bộ test nội dung tồn tại để bắt đúng chuyện đó.

**Việc cần làm tiếp, mỗi việc cần ADR riêng.** Chọn một engine SQL và viết
migration đầu tiên trước khi deploy nhiều instance; chuyển `Story` → `TravelStory`
và trỏ lại các route công khai; đưa place lên bản đồ; UI quản trị (frontend sở hữu).

## Dữ liệu chủ nhà vẫn phải cung cấp

Theo quy tắc 8 của `CLAUDE.md`, những chỗ sau được để **trống** trong seed thay vì
điền giá trị giả trông như thật:

- `affiliateLinks` ở mọi place — chưa có chương trình đối tác nào.
- `TravelReview.author` dùng tên thương hiệu "Nhà Hưng", không phải danh tính một
  người thật trong đội.
- `images` của place và gallery của story dùng lại các ảnh bìa SVG đã commit; ảnh
  chụp thật không có trong repo.
