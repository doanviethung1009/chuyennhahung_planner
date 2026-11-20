# Task Contract: CORE-13 Dữ liệu seed & địa chỉ liên hệ (P-4, P-6)
- Class: **S/M**. Branch đề xuất: `fix/seed-template-source-story` cắt từ `origin/main` @ `d154d96`. **State: DONE — không đổi mã (P-4 là thiết kế có chủ đích, P-6 đã xác nhận). Xem kết luận cuối file.**

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

## Kết luận (2026-11-19)
- **P-4 không phải lỗi.** `sourceStorySlug` (nguồn gốc: chuyện mà mẫu được cắt ra, chặn lưu trữ story khi còn mẫu công khai — `repository.ts:370-372`) và `plannerTemplateSlug` (CTA: mẫu là lịch trình thật của story — `stories/[slug]/page.tsx:73`) là hai trường độc lập theo ADR 0012; `schemas.ts:299-301` ghi rõ "a template may be cut from a different story". Seed khớp nội dung: `seed.ts:262,449` ghi mẫu là "cắt từ story trên" (`ba-ngay-lang-man-o-da-lat`), còn `stories.ts:133-161` là story biên tập có CTA tới mẫu. Chuyến tạo từ mẫu ghi nguồn đúng là story gốc. Không sửa dữ liệu.
- Hệ quả để biết: story gốc `ba-ngay-lang-man-o-da-lat` có `plannerTemplateSlug: null` nên không hiện CTA; nếu chủ dự án muốn CTA ở cả hai story thì đó là một thay đổi nội dung riêng (seed acceptance-test được nhiều test dùng).
- **P-6:** đóng, chủ dự án đã xác nhận địa chỉ là thật; không đổi mã.
