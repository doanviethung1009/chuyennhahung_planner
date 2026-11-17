# ADR 0024 — Định danh khách và quyền riêng tư (D4): băm có khóa, lưu 30 ngày, không IP thô trong bảng nghiệp vụ

🇻🇳 English version: [0024-guest-identity-privacy.md](0024-guest-identity-privacy.md)

- **Trạng thái:** Đã chấp nhận (chủ dự án xác nhận các điểm (a)–(e) ngày 2026-11-17)
- **Ngày:** 2026-11-17
- **Chủ trì:** system-architect
- **Ảnh hưởng:** `src/server/planner/repository.ts` (`guestKeyOf`, so khớp restriction, một lượt dọn theo hạn lưu), `src/server/persistence/postgres-rate-limiter.ts` (băm khóa), `src/server/planner/schemas.ts`, migration `0014`, `docs/usage.*` (một secret), tài liệu riêng tư. Làm rõ thêm, không sửa, [ADR 0015](0015-community-review-author-controls.vi.md) (restriction của khách) và [ADR 0019](0019-community-foundation.vi.md) §3 "Khóa".
- **Thuộc:** Phase 10 batch 10.6b (backlog P10-11); quyết định riêng tư P11-D1 (Q9) trong `.claude/roadmap/backlog.md`.

## Bối cảnh

Các lệnh ghi ẩn danh của cộng đồng (review khách, báo cáo) cần một định danh để chống spam. Hiện là `guestKeyOf(clientKey)` trong `src/server/planner/repository.ts`: 32 ký tự hex đầu của **SHA-256 không salt** của địa chỉ lấy từ header chuyển tiếp. Không gian IPv4 đủ nhỏ để liệt kê, nên giá trị lưu thực tế là địa chỉ có thể đảo ngược (phát hiện `/sec-check` #1, backlog P10-11). Nó nằm trong `community_reviews.guest_key`, `review_restrictions.guest_key` và `reports.client_key`; limiter lưu SHA-256 không salt riêng của cùng địa chỉ trong `rate_limit_counters` (giữ 48 giờ). Hiện không có gì xóa các khóa này.

Định hướng D4 của chủ dự án (2026-11-17): HMAC-SHA256 cho khóa khách; không IP thô trong bảng nghiệp vụ; không công khai khóa hay secret; giữ định danh chống spam 30 ngày; không theo dõi phục vụ quảng cáo; có Chính sách riêng tư và cách xóa dữ liệu.

Chưa biết: cấu hình proxy và log thật trên VM (địa chỉ thô nằm trong access log của nginx, ngoài tầm ứng dụng), cơ sở pháp lý và lời văn chính sách (chủ dự án cấp), và hiện có bao nhiêu restriction khách đang hiệu lực. **Đã kiểm 2026-11-17 trên database `cnh_planner` (truy vấn của chủ dự án, dev):** 0 restriction đang hiệu lực, 0 giá trị `community_reviews.guest_key` và 0 `reports.client_key`, nên migration xóa khóa không đổi dữ liệu nào ở đó. Không nói gì về môi trường khác.

## Quyết định

1. **Băm có khóa.** `guestKeyOf` thành `HMAC-SHA256(secret, clientKey)`, hex, 32 ký tự đầu (cùng hình dạng cột). Một helper, dùng cho review, restriction, báo cáo **và** băm khóa của limiter, nên không còn băm không salt nào của địa chỉ.
2. **Secret.** Biến môi trường chỉ phía server (tên chốt trong PR; ≥32 ký tự như `ADMIN_API_TOKEN`), không bao giờ log, trả ra hay commit. Nếu thiếu ở nơi nhận lệnh ghi của khách, các lệnh ghi đó từ chối (`503 service_unavailable`); không lùi về băm không salt. Đổi secret làm mất hiệu lực ban và chống trùng cùng lúc; chấp nhận, không đánh phiên bản.
3. **Không IP thô trong bảng nghiệp vụ.** Hiện đã đúng (lưu bản băm); ADR giữ nguyên và không thêm log hay cột nào chứa địa chỉ. IP thô trong log hạ tầng (nginx) ngoài tầm ứng dụng và được nêu rõ trong chính sách.
4. **Lưu 30 ngày.** Định danh khách bị xóa 30 ngày sau khi ghi: `community_reviews.guest_key` và `reports.client_key` đặt `NULL` (nội dung review và báo cáo vẫn còn, theo quy tắc riêng). Lượt dọn cơ hội, theo lô, trong các transaction ghi hiện có như lượt dọn audit log, nên không cần scheduler. Bộ đếm limiter giữ 48 giờ như cũ.
5. **Restriction khách nằm gọn trong 30 ngày.** Hạn tối đa restriction khách giảm từ 90 xuống **30 ngày** (mặc định vẫn 30), để khóa nó giữ không sống lâu hơn hạn lưu. Khi restriction khách kết thúc (hết hạn hoặc gỡ), khóa bị xóa và dòng còn lại làm bản ghi. CHECK của `0008` (`subject='guest' ⇒ guest_key IS NOT NULL`) được thay trong migration bằng bản cho phép khóa null khi đã có `lifted_at`, và lượt dọn đặt `lifted_at` (`lifted_by` = `key expired`) khi xóa khóa.
6. **Khóa hiện có.** Không thể đổi khóa lại (địa chỉ không được lưu), nên migration xóa mọi `guest_key` / `client_key` hiện có và gỡ các restriction khách đang hiệu lực với `lifted_by` = `privacy migration`. Không khôi phục được.
7. **Không theo dõi quảng cáo.** Là nguyên tắc chính sách đã nêu; công việc này không thêm analytics hay định danh quảng cáo. (Chưa kiểm trên toàn site ở đây; cần kiểm trước khi công bố.)
8. **Chính sách riêng tư và xóa dữ liệu tách khỏi thay đổi code.** Nội dung chính sách và trang công khai là của chủ dự án (P11-D1); không tự bịa. Thành viên đã tự xóa được tài khoản (review và dòng terms đi theo). Khách theo thiết kế không còn tìm lại được sau băm có khóa, nên đường của họ là hộp thư gỡ bài (`contribution.takedownContact`) nêu địa điểm và thời điểm, kèm một thao tác của staff gỡ nội dung review; thao tác staff đó chưa tồn tại và là task riêng.

## Các phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn) HMAC + xóa sau 30 ngày + restriction tối đa 30 ngày | Đúng lời của chủ dự án; một con số lưu; thay đổi nhỏ | Staff không cấm khách quá 30 ngày; đổi secret làm mất ban |
| B Giữ khóa restriction đến hết hạn (tới 90 ngày) như ngoại lệ đã nêu | Giữ trần 90 ngày của ADR 0015 | Hai con số lưu; mâu thuẫn "30 ngày" |
| C Không có khóa cho khách (chỉ dựa limiter) | Không lưu gì cá nhân | Không chống trùng theo địa điểm, không hạn chế được khách |
| D Giữ SHA-256, chỉ rút ngắn hạn lưu | Không phải quản lý secret | Còn đảo ngược được khi còn tồn tại |

Phương án về nhì: B. Thua vì chủ dự án yêu cầu một hạn 30 ngày, và khách quay lại sau 30 ngày dù sao cũng không phân biệt được với khách mới.

## Hệ quả

Dễ hơn: một helper cho mọi khóa ẩn danh; trả lời được "bạn lưu gì về khách"; tập định danh có giới hạn và được dọn.

Khó hơn, và không miễn phí:

- **Phải cấp một secret** ở mọi môi trường, và bản deploy thiếu nó sẽ chặn review khách và báo cáo (có chủ đích).
- **Xóa là không đảo ngược**, và migration kết thúc một lần mọi restriction khách đang hiệu lực.
- **Trần 30 ngày** ngắn hơn 90 ngày của ADR 0015; ADR 0015 không bị sửa, ADR này làm rõ thêm.
- **Giả mạo ẩn danh chưa được sửa**: khóa vẫn suy ra từ header chuyển tiếp (P10-12, chủ dự án D10).
- **IP thô thật vẫn còn trong log nginx** cho đến khi chủ dự án quyết định thời hạn lưu của chúng.
- **Xóa dữ liệu khách theo yêu cầu** cần thao tác staff chưa tồn tại.
- **Hoàn tác** code không khôi phục các khóa đã xóa.

## Việc tiếp theo

- Batch 10.6b (`.claude/contracts/phase10-10-6-security-hardening.md`): helper và secret, khóa limiter, migration `0014` (xóa khóa, gỡ restriction khách đang hiệu lực, thay CHECK), lượt dọn, schema (`guestKey` nullable trên restriction khách đã gỡ), trần 30 ngày, test (cùng client → cùng khóa, khác secret → khác khóa, khóa cũ không suy lại được, lượt dọn xóa đúng ở 30 ngày chứ không sớm hơn, restriction khớp trong hạn), `docs/usage.*` cho secret, mục Limits của feature doc.
- Chủ dự án (P11-D1): nội dung Chính sách riêng tư và nơi công bố; thời hạn lưu log nginx thật; lời nêu không theo dõi quảng cáo (sau khi kiểm).
- Task riêng: staff gỡ nội dung review của khách theo yêu cầu.
- **Chủ dự án đã xác nhận ngày 2026-11-17** (cả năm, theo khuyến nghị): (a) restriction khách tối đa 30 ngày (phương án A) thay vì 90; (b) migration xóa mọi khóa hiện có và kết thúc restriction khách đang hiệu lực; (c) băm khóa của limiter chuyển sang cùng HMAC; (d) trang chính sách riêng tư và thao tác staff xóa dữ liệu khách là task riêng, không thuộc P10-11; (e) đổi secret làm mất ban, không đánh phiên bản.
