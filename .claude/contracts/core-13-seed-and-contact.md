# Task Contract: CORE-13 Dữ liệu seed & địa chỉ liên hệ (P-4, P-6)
- Class: **S/M**. Branch đề xuất: `fix/seed-template-source-story` cắt từ `origin/main` @ `d154d96`. **State: APPROVED (2026-11-19); câu hỏi mở còn lại cần trả lời trước khi code.**

## Bằng chứng
- **P-4** `src/content/travel/seed.ts:452-453`: template `da-lat-3-ngay-lang-man` có `sourceStorySlug: 'ba-ngay-lang-man-o-da-lat'`; nhưng story trỏ tới template (`src/content/stories.ts:133,161`, `plannerTemplateSlug`) là `di-da-lat-lan-thu-sau`. Chuyến tạo từ mẫu ghi nguồn story khác với story người dùng vừa đọc.
- **P-6** `src/content/site.ts:99` `takedownContact: 'homecenter1009@gmail.com'`, hiện ở `/community-trips`. Quy ước 8: dữ liệu thật của chủ dự án phải được xác nhận. Báo cáo ghi chủ dự án đã xác nhận đây là địa chỉ thật dùng công khai.

## Đề xuất
1. **P-4:** trước khi sửa, xác minh hai story đều tồn tại và story nào là nguồn đúng về mặt nội dung (hỏi chủ dự án nếu mơ hồ). Phương án: đổi `sourceStorySlug` thành `di-da-lat-lan-thu-sau`, hoặc để nguyên nếu `ba-ngay-lang-man-o-da-lat` là story gốc có chủ đích; nếu đổi, kiểm tra `tests/**` (seed, integrity, template publish "story chưa publish") và dữ liệu đã nạp trên PG (seed chỉ nạp khi rỗng → không tự cập nhật bản đã có; ghi chú vào runbook nếu cần sửa tay).
2. **P-6:** **không đổi mã.** Đóng mục này với ghi chú "đã xác nhận" trong handoff; không nhắc lại địa chỉ trong tài liệu mới.
3. Test cập nhật nếu đổi seed; docs chỉ khi có đoạn nêu quan hệ này.

## Câu hỏi mở
P-4: story nào là nguồn đúng của template Đà Lạt 3 ngày?

## Kiểm tra / Done
typecheck, lint, test PASS kèm output. Handoff ≤25 dòng `.claude/contracts/handoff/core-13-seed-and-contact.md`.
