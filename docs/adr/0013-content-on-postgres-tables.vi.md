# ADR 0013 — Travel Content chuyển sang các bảng PostgreSQL chuẩn hoá

🇬🇧 English: [0013-content-on-postgres-tables.md](0013-content-on-postgres-tables.md)

- **Trạng thái:** Accepted (đã chấp nhận) — chủ dự án chọn phương án B (bảng chuẩn hoá) ngày 2026-11-14
- **Ngày:** 2026-11-14
- **Người sở hữu:** system-architect
- **Ảnh hưởng:** `src/server/persistence/**`, `src/server/content/instance.ts`, `db/migrations/0004_content.sql` (mới), `scripts/**`, `deploy/compose.app*.yml`, `tests/**`, `docs/architecture.*`, `docs/usage.*`

## Bối cảnh

[ADR 0008](0008-postgres-document-store.vi.md) quyết định cả hai hệ thống rời file JSON
để sang PostgreSQL. [ADR 0009](0009-postgres-persistence.vi.md) đã làm cho Planner, dưới
dạng các bảng chuẩn hoá nằm sau repository không đổi. Còn lại là store của Travel
Content: `src/server/content/instance.ts` vẫn tạo store file JSON ở
`.data/travel-content.json`.

Giờ đây đó không còn là nợ mà là điểm nghẽn. [ADR 0012](0012-public-travel-from-content-repository.vi.md)
khiến mọi trang Travel công khai đọc content repository ở mỗi request, và
[ADR 0011](0011-admin-content-cms.vi.md) cho editor ghi từ trình duyệt. Với hai instance,
một lần sửa ở instance này instance kia không thấy, và hai người ghi có thể đè lên nhau.
`deploy/compose.app.yml` đã ghi chú: không scale app cho tới khi cả hai store dùng
Postgres. File content còn nằm cùng volume với app nên công sức biên tập của site không
có bản backup theo thời điểm.

Điều đã biết: content gồm năm collection (`places`, `stories`, `collections`, `reviews`,
`templates`), khoảng 30 KB trong seed và tăng theo từng bài; chỉ editor ghi, người đọc chỉ
đọc; mọi bất biến nằm trong `ContentRepository` (`src/server/content/repository.ts`,
~30 phương thức) làm việc trên toàn bộ `ContentData` qua `DocumentStore.transact`. Điều chưa
biết: bộ content lớn tới đâu sau hai năm, và editor có cần lịch sử chỉnh sửa hay tìm kiếm
bằng SQL không.

Ứng dụng dự kiến chạy lâu dài. Chủ dự án yêu cầu so sánh hai hình dạng theo tiêu chí đó và
chọn **B**.

## Quyết định

1. **Bảng chuẩn hoá, mỗi collection một bảng, nằm sau `ContentStore` không đổi.**
   `content_places`, `content_stories`, `content_collections`, `content_reviews`,
   `content_templates`, cộng `content_revision` (bộ đếm cho cache). Repository và 26
   handler không đổi; store nạp năm bảng thành `ContentData`, chạy mutation của repository
   trên bản sao rồi chỉ ghi những dòng khác biệt. Đây là kỹ thuật của ADR 0009, không phải
   viết lại repository.
2. **Một engine bảng dùng chung cho cả hai store.** Phần ánh xạ dòng, phần diff và giao
   thức transaction/cache của Postgres được tham số hoá bằng danh sách bảng, cột khoá, khoá
   lock và bảng revision. Planner truyền tham số của mình; hành vi và test của Planner không
   đổi. Không có bản sao thứ hai của phần diff để trôi lệch.
3. **Cột có kiểu cho giá trị vô hướng, JSONB cho cấu trúc.** Slug, trạng thái, ngày,
   timestamp, rating, chi phí, số đếm, điểm đến và danh mục là cột, có `CHECK` cho các enum.
   Văn bản song ngữ `{vi, en}`, các block của story, gallery, SEO, affiliate link, các ngày
   của template và source snapshot là `jsonb`: chúng được đọc và ghi như một khối và hiện
   chưa có nhu cầu truy vấn. Danh sách slug là `text[]`, có thể đánh index về sau. `slug` là
   khoá chính (`id` với review), nên tính duy nhất do cơ sở dữ liệu bảo đảm chứ không chỉ
   repository.
4. **`CONTENT_DATABASE_URL` chọn store, giống cách `PLANNER_DATABASE_URL` làm.** Có giá
   trị nghĩa là PostgreSQL và **không bao giờ** lùi về file; chưa đặt thì giữ file JSON
   (development, test). Nó có thể trỏ vào database của Planner hoặc database riêng
   (ADR 0008 §1 ưu tiên hai database để tách phạm vi ảnh hưởng). Migration là một bộ đánh
   số trong `db/migrations`; mỗi store chạy toàn bộ bộ này trên database nó trỏ tới, nên
   bảng của store kia có thể tồn tại ở đó nhưng rỗng. Chúng rẻ và giữ được một runner, một
   `schema_migrations`, một cách rollback.
5. **Chưa có khoá ngoại giữa các entity content.** `ContentRepository` chưa có quy tắc
   "đang được tham chiếu": hiện được phép xoá một place mà story liệt kê, và template cố ý
   tồn tại lâu hơn story nó được cắt ra (ADR 0001 §4). FK ở database sẽ đổi hành vi đó ngay
   trong cùng thay đổi chuyển storage — đúng sai lầm ADR 0008 từ chối. Quy tắc tham chiếu là
   một quyết định riêng về sau; các cột `text[]` và `validateIntegrity` là lớp bảo vệ tạm.
6. **Seed vẫn còn, dưới một lock.** `TRAVEL_CONTENT_AUTOSEED` giữ nguyên ý nghĩa. Với
   Postgres, seed chạy trong lúc giữ session advisory lock, nên các replica khởi động cùng
   lúc chỉ seed một lần. Bản triển khai production import content thật rồi đặt
   `TRAVEL_CONTENT_AUTOSEED=false`.
7. **Chuyển dữ liệu là một cặp script.** `npm run content:import -- <file>` kiểm tra
   `travel-content.json` bằng schema của repository rồi chèn vào các bảng rỗng trong một
   transaction; `npm run content:export -- <file>` ghi ra file mà store JSON mở được. Export
   là đường rollback. `npm run db:migrate` migrate mọi database có đặt URL.
8. **Đọc và lỗi.** Cache theo từng instance, kiểm chứng bằng `content_revision`, đúng như
   ADR 0009 §2. Database không với tới được thì trả `503 service_unavailable` không kèm chi
   tiết driver; các trang public, vì là động, hiện trang lỗi cho tới khi nó trở lại. Không
   âm thầm lùi về nội dung cũ hay nội dung file.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
|---|---|---|
| A: một dòng JSONB `documents`, như bước 1 của ADR 0008 | Thay đổi nhỏ nhất, ra nhanh nhất, rollback rẻ | Mỗi lần ghi viết lại cả bộ và giữ một lock cho cả bộ; không có ràng buộc hay SQL trên content; một lần ghi hỏng có thể phá tất cả; việc chuyển sang chuẩn hoá vẫn còn nợ |
| **B (được chọn): bảng chuẩn hoá sau repository không đổi** | Ghi theo dòng; khoá, enum và index nằm ở database; có đường tới tìm kiếm, audit và đọc có đích; cùng engine đã được kiểm chứng của Planner; một chỗ để lớn lên nhiều năm | Tốn công hơn lúc này; phải bảo trì một phần ánh xạ; vẫn nạp mọi dòng khi revision đổi |
| B′: bảng chuẩn hoá và viết lại repository chạy SQL theo từng phương thức | Truy vấn có đích, đọc ít nhất | Đổi mọi bất biến và storage cùng lúc nên lỗi có hai nghi phạm; nhiều tuần công cho một tải ta chưa có |
| C: giữ JSON trên volume dùng chung | Không phải viết code | Không an toàn đa instance và không có backup |

Phương án về nhì là **A**. B thắng nhờ tiền đề của chủ dự án — ứng dụng sống lâu — và vì
engine đã có sẵn: chi phí khiến B thua ở ADR 0008 (viết lại mọi phương thức repository)
được tránh bằng cách giữ repository và ánh xạ dòng.

## Hệ quả

**Dễ hơn.** Nhiều instance app sau nginx dùng chung content mà không mất cập nhật.
`pg_dump` sao lưu được. Tính duy nhất của slug và giá trị enum do database bảo đảm. Tìm
kiếm, lọc theo trạng thái và audit có chỗ để xây mà không cần một lần migrate storage nữa.
Store của Planner và content dùng chung một engine đã được kiểm thử.

**Khó hơn.**

- **Revision đổi thì nạp lại cả năm bảng.** Một lần editor lưu khiến mọi replica nạp lại ở
  lần đọc kế tiếp. Ổn với hàng trăm story; ngưỡng để chuyển các lần đọc nóng
  (`getPublicContent`, các endpoint danh sách) sang truy vấn có đích là p95 đọc trên khoảng
  200 ms hoặc tổng dung lượng content trên khoảng 5 MB.
- **Một lock ghi toàn cục cho store content.** Hai editor lưu cùng lúc phải chờ nhau. Chấp
  nhận được vì chỉ staff ghi.
- **Phần ánh xạ phải theo kịp schema.** Thêm field trong `schemas.ts` mà không thêm cột thì
  field bị âm thầm bỏ khi ghi — nên một test round-trip trên mọi field của schema, kể cả dữ
  liệu seed, làm hỏng build khi sót.
- **Thêm một secret.** `CONTENT_DATABASE_URL` theo cùng quy tắc với `PLANNER_DATABASE_URL`
  (chỉ phía server, không log, không đưa vào lỗi).
- **Bảng của cả hai store có thể cùng nằm trong một database.** Đã ghi lại, vô hại, và là cái
  giá của một bộ migration.
- **Đảo ngược.** Rẻ cho tới khi editor bắt đầu coi database là bản duy nhất: export ra file,
  bỏ URL. Sau đó hãy export định kỳ.

## Việc tiếp theo

1. Tổng quát hoá engine và ánh xạ content, với các suite của Planner xanh trước.
2. Migration `0004_content.sql` cùng rollback; store, instance, lock khi seed.
3. `content:import`, `content:export`, `db:migrate` cho cả hai URL.
4. Test: ánh xạ và diff offline, giao thức với driver giả, tích hợp (cần
   `TEST_DATABASE_URL`), và service Postgres sẵn có trong CI.
5. Tài liệu: feature document, `architecture`, `usage`, ghi chú deploy về việc scale.
6. Các quyết định riêng về sau: khoá ngoại và quy tắc "đang được tham chiếu"; đọc có đích
   khi chạm ngưỡng trên; lịch sử chỉnh sửa cho editor. Khuyến nghị `/sec-check` trước lần
   deploy production đầu tiên.
