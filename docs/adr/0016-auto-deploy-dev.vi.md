# ADR 0016 — Tự động deploy `main` lên VM dev

🇬🇧 English version: [0016-auto-deploy-dev.md](0016-auto-deploy-dev.md)

- **Trạng thái:** Đã chấp nhận (chủ nhà chọn runner tự host ngày 2026-11-15); pipeline đã viết nhưng **chưa chạy** từ đầu đến cuối — cần chủ nhà đăng ký runner
- **Ngày:** 2026-11-15
- **Người sở hữu:** system-architect

## Bối cảnh

Debug và QC nhanh nhất ở máy của người phát triển và nên giữ ở đó. Khi một bản sửa
đã chốt ở local và được merge, VM dev (`192.168.100.140`) phải tự chạy nó mà không
cần phiên `docker compose` thủ công, và sau này cùng pipeline đó phục vụ prod.

Các ràng buộc định hình lời giải:

- VM chỉ có địa chỉ LAN nên runner của GitHub không với tới. Mọi thứ deploy phải
  được khởi động từ phía VM.
- VM có 1,9 GB RAM; `next build` là đỉnh bộ nhớ
  ([usage → Một replica, host nhỏ](../usage.vi.md#một-replica-host-nhỏ)).
- `NEXT_PUBLIC_SITE_URL` được đóng vào bundle lúc build, nên một image gắn với URL
  của một môi trường.
- Migration chạy lúc khởi động dưới advisory lock và chỉ đi tới
  ([ADR 0009](0009-postgres-persistence.vi.md)).
- Repo private trên GitHub Free: không dùng được Environment required reviewers và
  branch protection, nên không có nút duyệt nào chặn prod.

## Quyết định

1. **Kích hoạt:** workflow `deploy-dev` chỉ bắt đầu từ một lần chạy `CI` thành công
   của push lên `main`, hoặc dispatch tay trên `main`. Không bao giờ từ pull request.
2. **Build trên GitHub, không build trên VM:** runner của GitHub build target
   `runner` với `NEXT_PUBLIC_SITE_URL` của dev và đẩy lên GHCR với tag
   `sha-<commit>` và `dev`.
3. **Deploy qua runner tự host trên VM** (chỉ kết nối đi ra).
   `deploy/deploy.sh <tag>` đăng nhập GHCR để pull, chạy
   `docker compose up -d --no-build --no-deps app` với các file compose của commit đang
   deploy, chờ `/api/health` bên trong container, rồi ghi tag vào
   `/opt/chuyennhahung/.deployed-tag`.
4. **Rollback:** nếu health probe hỏng, script deploy lại tag trước và làm run thất
   bại. Rollback tay là cùng workflow dispatch với `tag=sha-<cũ>`, bỏ qua bước build.
5. **Prod sau này** dùng lại khuôn này với image riêng (URL riêng), nhãn runner riêng
   và một trigger do người điều khiển — tag `v*` hoặc dispatch tay — không tự chạy
   khi push.

## Các phương án đã xét

| Phương án | Ưu | Nhược |
|---|---|---|
| A (chọn) runner tự host trên VM | Có log trong tab Actions, tức thì, một đường rollback, không mở cổng vào | Tốn khoảng 150 MB RAM trên host nhỏ; runner trên VM là ranh giới tin cậy, không bao giờ được thấy code của PR |
| B timer systemd poll GHCR | Không runner, không phải đăng ký, nhẹ nhất | Trễ tới vài phút, log chỉ nằm trên VM, GitHub không hiện lỗi |
| C Tailscale cho runner của GitHub rồi SSH | Mô hình push quen thuộc | Thêm mạng bên thứ ba và khoá SSH lưu trong GitHub secrets |
| D build ngay trên VM | Không cần registry | Build không vừa bộ nhớ |

B thua vì một lý do: deploy hỏng không hiện ở nơi cả nhóm vẫn nhìn.

## Hệ quả

Dễ hơn: merge chính là bước phát hành lên dev; mỗi lần deploy là một tag `sha-` bất
biến; rollback là một dispatch.

Khó hơn:

- **Rollback khôi phục image, không khôi phục schema.** Migration vẫn chỉ đi tới, nên
  mỗi migration phải để bản trước còn chạy được (thêm trước, bỏ ở bản sau).
- Một image cho mỗi môi trường: prod không thể lấy lại image của dev.
- Runner là một chỗ đứng trên VM dev. Chấp nhận được vì trigger loại trừ pull request
  (có test tĩnh canh), credential registry là token của job dùng cho một lần
  login/logout, và script không bao giờ đọc `.env`. **Ranh giới rộng hơn một file
  này**: ai có quyền ghi đều có thể đẩy một nhánh với workflow khác xin nhãn `cnh-dev`
  và chạy trên VM, nên mọi người có quyền ghi thực chất là root trên VM dev. Giữ ít
  cộng tác viên, chạy runner bằng user riêng, cân nhắc `--ephemeral`, và tắt workflow
  cho PR từ fork. (`/sec-check`, 2026-11-15.) Deploy chạy bằng user của dịch vụ
  runner, user này phải thuộc nhóm `docker` — thực chất là root trên VM đó.
- Chỉ hỗ trợ một replica (`concurrency: deploy-dev`, một container), nên khi deploy
  có khoảng trống ngắn lúc container khởi động lại. Chấp nhận được ở dev.
- Kết quả CI trên gói này chỉ mang tính tư vấn ([git governance](../../.claude/rules/05-git-governance.md)),
  nhưng deploy chỉ chạy khi CI xanh, nên CI đỏ đơn giản là không deploy.

Để đảo ngược: xoá workflow và script; luồng tay trong [usage → Deploy](../usage.vi.md#deploy)
không đổi.

## Việc tiếp theo

- Chủ nhà: đăng ký runner trên VM với nhãn `cnh-dev`, đặt biến repository
  `DEV_SITE_URL` nếu khác `http://192.168.100.140`, và kiểm tra package GHCR đọc được
  từ repository — xem [usage → Tự động deploy lên dev](../usage.vi.md#tự-động-deploy-lên-dev) và
  [deploy-runner.vi.md](../deploy-runner.vi.md).
- Còn mở: HTTPS cho dev và workflow prod, mỗi việc một ADR hoặc bản sửa đổi riêng.
- Khuyến nghị: chạy `/sec-check` cho thay đổi này trước khi đăng ký runner.
