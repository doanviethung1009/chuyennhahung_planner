# Spec Community Platform — QC

🇻🇳 English version: [specs-community-qc.md](specs-community-qc.md)

Trạng thái: **Đề xuất**. Nhãn **[C] [P] [A]**: xem
[specs-community-overview.vi.md](specs-community-overview.vi.md). Tài liệu này không viết
test nào. Một lần review `qc` cho bề mặt cộng đồng hiện có đã chạy ngày 2026-11-16 (PASS_WITH_NOTES; khoảng trống là mục backlog P10-13 và P10-14). Với các phase mới, reviewer `qc` độc lập **CHƯA CHẠY** và chỉ chạy khi chủ dự án yêu cầu (`/qc-check`).

## Mục tiêu và phạm vi

Nói cách chứng minh mỗi phase đã xong: chiến lược kiểm thử, tiêu chí nghiệm thu theo phase
và lưới hồi quy phải luôn xanh. Các kiểm tra tất định là cổng; review chạy theo yêu cầu. [C]

## Yêu cầu

- **Q1** Một phase chỉ xong khi `npm run typecheck`, `npm run lint` và `npm run test` qua
  **và đầu ra được nêu**; kiểm tra chưa chạy báo NOT RUN, không bao giờ PASS. [C]
- **Q2** Mọi hành vi kho mới được test qua **cả hai** kho (file JSON và adapter PostgreSQL),
  như ADR 0014 yêu cầu cho migration của nó. [C]
- **Q3** Mọi projection công khai mới có test liệt kê danh sách cho phép. [C]
- **Q4** Mọi chuỗi mới qua `tests/i18n.test.ts`; mọi tài liệu mới qua `tests/docs.test.ts`. [C]
- **Q5** Test mới viết bằng Vitest (`vitest ^3`); không thêm framework test. [C]
- **Q6** Fixture không chứa dữ liệu cá nhân thật, không handle, số điện thoại hay email thật. [C]

## Thiết kế

### Chiến lược

| Mức | Nội dung | Ở đâu (tên đề xuất) |
|---|---|---|
| Unit, thuần | Chuyển trạng thái `submission.ts`, `scoreMatch`, danh sách cho phép khi sao chép, mã hóa/giải mã cursor, bộ tách URL video | `tests/community-submission.test.ts`, `tests/community-clone.test.ts`, … |
| Repository | Thao tác trên cả hai kho, tính duy nhất, idempotency, xóa mềm, ẩn danh | `tests/community-repository.test.ts` |
| API | Ma trận route × người gọi, envelope, `If-Match`, giới hạn tốc độ, cổng đóng | `tests/community-api.test.ts` |
| Media | Hợp đồng adapter, fixture (đa định dạng, bị cắt, quá lớn, GPS), hết hạn URL ký | `tests/community-media.test.ts` |
| Bảo mật | Bộ XSS, `404` theo quyền sở hữu, liệt kê ẩn danh, CSRF, client-boundary | `tests/community-security.test.ts` |
| UI | Tính khớp i18n, token, client boundary; ảnh chụp `npm run verify:ui` ở 375, 768, 1280 | các suite hiện có cùng ảnh chụp |
| Thủ công | Đường chỉ dùng bàn phím, lượt đọc bằng screen reader trên editor và hộp thoại, upload trên Safari mobile | checklist trong tài liệu tính năng |

### Lưới hồi quy (phải xanh ở mọi phase)

Từ `.claude/context/project-context.md`: `tests/i18n.test.ts`, `tests/docs.test.ts`,
`tests/design-tokens.test.ts`, `tests/routing.test.ts`, `tests/content.test.ts`,
`tests/client-boundary.test.ts`, `tests/security-headers.test.ts`,
`tests/planner-roles.test.ts`, `tests/admin-content-session.test.ts`,
`tests/planner-password.test.ts`, `tests/planner-google.test.ts`, các suite Travel
Content, và các test chuyến và đánh giá cộng đồng hiện có. Hành vi Phase 05 đến 09 được các test này khẳng định không đổi.

### Tiêu chí nghiệm thu theo phase

| Phase | Cho trước / Khi / Thì |
|---|---|
| Phase 10 | Cho máy trạng thái, khi thử mọi cặp trạng thái, thì chỉ các cạnh của sơ đồ thành công, còn lại trả `invalid_state`. Cho các dòng `listing` cũ, khi đọc, thì ánh xạ thành `pending/published/rejected` và không mất gì. Cho hai instance mô phỏng, khi một bên chạm giới hạn, thì bên kia cũng thấy. |
| Phase 10–11 | Cho một chuyến đã đăng, khi một member dùng nó, thì họ nhận bản nháp riêng có dòng riêng cùng `origin`, và nguồn không đổi từng byte. Cho tác giả ẩn danh, khi sao chép hay đăng, thì không tác giả nào xuất hiện ở bất kỳ đâu. Cho nguồn bị rút, khi đọc các bản sao, thì chúng nguyên vẹn. |
| Phase 13 (images) | Cho ảnh JPEG có GPS, khi tải lên, thì các biến thể lưu không còn metadata. Cho file không phải ảnh đặt tên `.jpg`, thì `rejected`. Cho tài sản chưa đăng, khi lấy mà không có chữ ký, thì bị từ chối. |
| Phase 12–13 | Cho văn bản `<script>` và trình xử lý sự kiện trong mọi trường, khi render, thì vô hại. Cho host video không hỗ trợ được dán vào, thì `422`. Cho nhật ký có tài sản còn đang xử lý, khi gửi duyệt, thì bị chặn. Cho sửa trọng yếu một nhật ký đã đăng, thì quay về `pending`. |
| Phase 14 | Cho 50 lượt thích song song, thì số đếm là 50. Cho tài khoản bị xóa, thì nội dung công khai, hồ sơ và theo dõi của nó biến mất. Cho ngưỡng báo cáo của nhân viên trên một bình luận, thì bị giữ tới khi nhân viên quyết định. |
| Phase 15 | Cho chưa có sở thích, thì trang giống `main`. Cho có sở thích, thì `scoreMatch` tất định và `reasons` bằng các số hạng của điểm. Cho truy vấn tiếng Việt không dấu, thì tìm được tiêu đề có dấu. |
| Phase 16 | Theo ADR, viết khi phase mở. |

## Luồng xử lý và trạng thái lỗi

Các dòng lỗi của từng route trong [API](specs-community-api.vi.md) trở thành ca kiểm thử
một-một. Cổng đóng, user bị cấm, `If-Match` cũ, giới hạn tốc độ, vượt hạn mức và lưu trữ
không khả dụng là ca bắt buộc ở các phase của chúng.

## Phụ thuộc và bảo mật

Test phụ thuộc fixture media và một test double cho `MediaStore`. Test bảo mật được liệt kê
ở [bảo mật](specs-community-security.vi.md). Khuyến nghị `/qc-check` và `/sec-check` ở cuối các Phase 10, 12 và 14; không cái nào chạy nếu không được yêu cầu.

## Kịch bản kiểm thử

Ma trận trên, cộng thêm: gửi duyệt và quyết định đồng thời trên một mục; đua phiên bản trong
hàng đợi; hạn mức sao chép qua nửa đêm; moderator gỡ khi người đọc đang mở trang;
`AuditEvent` (`audit_events`) được nối thêm cho mọi chuyển trạng thái và không bao giờ bị sửa.

## Câu hỏi còn mở

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| 1 | Adapter PostgreSQL test được trong CI hay chỉ cục bộ? | Kiểm `.github/workflows/ci.yml`; dùng adapter JSON trong CI nếu không có database |
| 2 | Có cần load test đường ghi trước Phase 14 không? | Một bài nhỏ, để chốt quyết định DB5 bằng dữ liệu |
| 3 | Khoảng trống trong test cộng đồng hiện có: chưa có test HTTP 429 cho limiter đánh giá (P10-13), chưa có ca integration PostgreSQL cho `community_reviews` và `review_restrictions` (P10-14) | Đóng cả hai ở Phase 10 trước khi xây tiếp lên chúng |
