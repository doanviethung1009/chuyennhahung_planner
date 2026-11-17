# Handoff — Phase 11 ADR (2026-11-17)
Branch `docs/adr-phase11-profiles-copy` (chưa commit/push/PR). Chỉ tài liệu, không code/migration.
- Mới: `docs/adr/0025-member-profiles-and-use-this-trip.md` + `.vi.md` (Proposed), đăng ký ở `docs/adr/README.*`.
- Sửa: `docs/specs-community-database.*` (migration Phase 11 = `0015` profiles, `0016` origin; Phase 12+ dịch +2; `origin` = `{sourceTripId,sourceTitle,sourceAuthor,copiedAt}`), `.claude/roadmap/backlog.md` (P11-1/3/D2), `PHASES.md` Phase 11.
- Khuyến nghị: profile riêng tư mặc định, trang công khai sau cờ `profilePublicOpen` (tắt đến khi có Chính sách riêng tư); `allowCopy` trong `listing` mặc định tắt, chỉ người tạo bật; bản sao dựng từ phép chiếu công khai (bỏ note, chi phí, ngày, token); không đăng lại bản sao ở Phase 11 (`origin` ⇒ không `public`).
- Điều 3 Terms ĐÃ có; thiếu cờ theo chuyến (RK16). Không sửa chữ Terms/`termsVersion`.
- PR đề xuất: 11.1 store hồ sơ → 11.2 trang công khai → 11.3 allowCopy+origin → 11.4 API use + nút.
- Chủ dự án quyết (ADR mục Follow-up, 8 câu): trang công khai ở P11?; ai bật sao chép; đăng lại bản sao?; bản sao cũ khi tắt; nội dung Chính sách riêng tư; copier phải đồng ý Terms; hạn mức 10/giờ·30/ngày + không chép ước tính chi phí; chữ Terms (D5).
- Chưa kiểm trong code: trường thật của phép chiếu share (ADR 0005), hạn mức số chuyến/người. `/sec-check`: NOT RUN.
