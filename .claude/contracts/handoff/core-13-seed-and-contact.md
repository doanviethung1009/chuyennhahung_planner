# Handoff CORE-13 — seed & địa chỉ liên hệ (P-4, P-6)
- Đưa vào nhánh `fix/core-ui-polish` (PR #190) vì PR này đã chứa contract CORE-13. Không đổi mã nguồn, chỉ contract + handoff.
## Kết quả
- P-4: **không phải lỗi, không sửa.** `sourceStorySlug` (nguồn gốc) và `plannerTemplateSlug` (CTA) là hai trường độc lập theo ADR 0012 (`schemas.ts:299-301`). Mẫu `da-lat-3-ngay-lang-man` được cắt từ `ba-ngay-lang-man-o-da-lat` (`seed.ts:262,449`); story `di-da-lat-lan-thu-sau` chỉ trỏ CTA tới mẫu (`stories.ts:161`). Chuyến tạo từ mẫu ghi nguồn đúng.
- P-6: đóng, địa chỉ đã được chủ dự án xác nhận là thật.
## Kiểm tra
- Không đổi mã nên không chạy lại typecheck/lint/test cho bước này (PASS của #190 trước đó). `/qc-check`, `/sec-check`: NOT RUN.
## Cần chủ dự án quyết (tuỳ chọn)
- Story gốc `ba-ngay-lang-man-o-da-lat` có `plannerTemplateSlug: null` nên không có CTA vào mẫu. Muốn có thì là thay đổi nội dung riêng (seed này được nhiều test dùng).
