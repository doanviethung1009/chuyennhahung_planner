# Tính năng — Phát sinh ngân sách khi chia sẻ

🇻🇳 English version: [shared-budget-overrun.md](shared-budget-overrun.md)

## Summary

Khi chia sẻ chuyến đi cho cả nhóm, phần ngân sách trước đây chỉ có mục tiêu và chi phí
dự kiến, nên cả team không thấy được chi tiêu đã vượt ngân sách hay mỗi người phải góp
thêm bao nhiêu. Trang chia sẻ và trang chuyến đi của chủ chuyến giờ hiện tổng dự báo,
phần vượt và số tiền mỗi người góp thêm. Dựa trên [travel-planner-core.vi.md](travel-planner-core.vi.md)
và [trip-editor.vi.md](trip-editor.vi.md).

## Routes

Không có. Sửa trực tiếp `/shared/[token]` và `/my-trips/[id]`.

## Data

`TripBudgetSummary` thêm `overrunVnd` và `perPerson.overrunVnd`. `SharedTripView.budget` thêm
`projectedTotalVnd`, `overrunVnd`, `overrunPerPersonVnd`. Các khoá thông điệp
`budgetProjected`, `overrunHeading`, `overrunTotal`, `overrunPerPerson`, `withinBudget`,
`overrunNote` trong namespace `shared` và `tripDetail` (VI và EN).

## How it works

`overrunVnd = max(0, dự báo − mục tiêu)`, và bằng 0 khi mục tiêu là 0 (chưa đặt ngân sách
nên không có gì để vượt). Dự báo là số đã chi cộng ước tính của các hoạt động chưa chi,
nên không đếm trùng. Phần mỗi người là phần vượt chia cho số người, **làm tròn lên** để
nhóm đủ tiền. Trang chia sẻ là phép chiếu theo danh sách cho phép: chỉ thêm ba tổng này;
từng khoản chi, nhãn và `actualTotalVnd` vẫn riêng tư. Có mục tiêu mà chưa vượt thì trang
báo là chưa vượt ngân sách.

## Files

| Path | Role |
|---|---|
| `src/server/planner/budget.ts` | Tính `overrunVnd` và phần mỗi người |
| `src/server/planner/schemas.ts` | Kiểu `SharedTripView.budget` |
| `src/server/planner/repository.ts` | Danh sách cho phép trong `buildSharedView` |
| `src/app/[locale]/shared/[token]/page.tsx` | Khối phát sinh trên trang công khai |
| `src/components/planner/trip-detail.tsx` | Các dòng dự báo, phát sinh, mỗi người cho chủ chuyến |
| `messages/vi.json`, `messages/en.json` | Chuỗi mới |

## Tests

`tests/planner-budget.test.ts` kiểm tra phần vượt, phần mỗi người và bằng 0 khi vừa ngân
sách. `tests/planner-sharing.test.ts` kiểm tra các tổng được chia sẻ, không lộ nhãn khoản
chi hay `actualTotalVnd`, và đúng tập khoá của phần ngân sách.

## Limits and open questions

Tổng dự báo cho người có link biết gần đúng số đã chi; chủ chuyến cần quyết định có chấp
nhận điều đó với chuyến công khai không. Chia đều bỏ qua ai đã trả và phần riêng từng
người; chưa có chia tiền thật sự giữa các thành viên. Giao diện chưa được kiểm tra trên
trình duyệt.
