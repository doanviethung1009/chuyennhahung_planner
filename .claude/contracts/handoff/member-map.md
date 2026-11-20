# Handoff — MEMBER-MAP (thiết kế đã duyệt; Lát 1 đang thực thi)
- Nhánh `docs/member-map-contract` · PR [#200](https://github.com/doanviethung1009/chuyennhahung_planner/pull/200) (chỉ contract + handoff, không mã).
## Đã làm
- Contract `.claude/contracts/member-map.md`: XL tách 2 lát. Lát 1 (L) `/my-map` riêng tư; Lát 2 (XL) chia sẻ qua token.
- Chủ đã chốt: trang riêng `/my-map`; đã đi (đặc) + đã lên kế hoạch (rỗng) ở bản riêng; khách thấy bản đồ trống + lời mời; completed-đã-archive vẫn tính; chia sẻ công khai chỉ điểm đã đi, ẩn danh mặc định.
- `/sec-check` thiết kế Lát 2 và diff PR: PASS_WITH_WARNINGS; contract đã sửa các mâu thuẫn (kiểu công khai riêng, Interface/AC/Rollback tách theo lát, archive, `displayName`, ngưỡng điểm, log nginx).
## Phụ thuộc / rủi ro
- Lát 1 chạy ở session `member-map-slice1` (có bản contract chép trước các sửa này; có thể trùng file khi merge).
- PR #198 (`travel-map.*`) không được sửa chồng. Số ADR 0029 kiểm tra lại lúc viết.
## Checks
- typecheck/lint/test/build: NOT RUN (chỉ file `.claude/`). `/qc-check`: NOT RUN. `/sec-check`: đã chạy cho thiết kế và diff; phải chạy lại trên mã Lát 1 và Lát 2.
## Next
- Lát 1: xong thì review PR. Lát 2: viết ADR 0029 (kèm yêu cầu SEC-CHECK) → chủ duyệt → mới viết mã.
