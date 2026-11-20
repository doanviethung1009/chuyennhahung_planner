# Handoff — MEMBER-MAP (thiết kế, chưa có mã)
- Cập nhật: chủ đã trả lời Q0–Q5 (cuối contract); nâng XL, tách 2 lát (riêng tư L, chia sẻ token XL). Nhánh: `docs/member-map-contract` (từ `origin/main` @ 0c794f8). Chưa commit/push/PR. Chỉ thêm 2 file dưới `.claude/` (contract + handoff này).
## Đã làm
- Triage: **L** (XL nếu chia sẻ công khai). Contract: `.claude/contracts/member-map.md`, state DESIGNED, **chờ chủ duyệt**.
- Khảo sát thật: phiên (ADR 0004/0007, `home-page.ts`), `listTrips(ownerId)`, `Trip.destinationSlug` = `Destination.slug`, `planningStatus`, `listOwnReviews` (`visitedOn`), `VietnamMap`, `lib/map.ts`.
## Đề xuất
- Trang riêng `/my-map` (VI `/ban-do-cua-toi`), server component đọc phiên; không API, không migration, private-only v1.
- Đã đi = chuyến `completed` (+ review `visitedOn`) → chấm đặc; `draft|planned` → chấm rỗng. Toạ độ/nhãn từ seed `destinations` (chỉ đọc); nhãn cố định vẫn chỉ `featured`.
- Tái dùng `VietnamMap` (chỉ thu hẹp kiểu prop). Không sửa `destinations.ts`, không đụng `/map`.
- ADR 0029 (VI+EN, đăng ký `docs/adr/README.*`); tách "Planner map" thành bản đồ thành viên (cho phép) vs bản đồ tuyến theo chuyến (vẫn hoãn); sửa quy tắc 6 chỉ khi chủ đồng ý.
## Cần chủ trả lời (Q0–Q7 trong contract)
- Q0 nghĩa "Planner map"; Q1 nguồn đã đi; Q2 `/my-map` hay `/map` đổi theo đăng nhập; Q3 khách thấy gì; Q4 chia sẻ; Q5 archive; Q6 nhãn.
## Checks
- typecheck/lint/test/build: NOT RUN (không có mã). `npm ci`: không cần ở bước này. `/qc-check`: NOT RUN. `/sec-check`: NOT RUN — **khuyến nghị** trước merge (danh tính + dữ liệu thành viên).
## Rủi ro/Phụ thuộc
- PR #198 (docs `travel-map.*`) đang mở: không sửa chồng; feature doc mới đợi/rebase sau #198.
- Số ADR 0029 có thể bị chiếm bởi PR khác: kiểm tra lúc viết.
## Next
- Chủ duyệt/chỉnh contract → mở session thực thi bằng `UNIVERSAL_TASK_EXECUTION.md`.
