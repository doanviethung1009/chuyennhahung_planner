# Runner deploy — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

Runbook cài **runner tự host** của GitHub Actions trên VM dev thành một service systemd
đã hardening, để workflow `deploy-dev` deploy được
([ADR 0016](adr/0016-auto-deploy-dev.vi.md),
[tính năng](features/auto-deploy-dev.vi.md)). Không có gì ở đây được chạy giúp bạn:
mọi bước cần quyền cao do chủ nhà tự làm.

🇬🇧 English version: [deploy-runner.md](deploy-runner.md)

## Vì sao là service systemd, không phải container

Runner đóng gói trong container phải mount `/var/run/docker.sock`, vốn đã là root trên
VM, và khi đó các file compose cùng bind mount (`/opt/chuyennhahung/...`) không còn
cùng đường dẫn giữa runner và Docker daemon. Nó cũng tốn RAM trên host 1,9 GB. Service
systemd chạy ngay trên host, thấy đúng đường dẫn thật và là thứ `svc.sh` của GitHub
cài. Chỉ dùng container nếu sau này bạn muốn runner dùng một lần hoặc nhiều runner
trên một host.

## Bạn đang chấp nhận điều gì

User của runner thuộc nhóm `docker`, **tương đương root trên VM này**. Workflow nào xin
nhãn `cnh-dev` đều chạy ở đó, và ai có quyền ghi vào repository đều đẩy được workflow
như vậy. Vì thế: giữ ít cộng tác viên, tắt workflow cho PR từ fork, và coi VM này chỉ
là dev, không để secret của production trên đó.

## Bước 1 — User riêng

```bash
sudo adduser --disabled-password --gecos "" cnh-runner
sudo usermod -aG docker cnh-runner
```

Không có quyền `sudo`, không đăng nhập SSH (`--disabled-password`). Chỉ dùng user này
cho runner.

## Bước 2 — Cấp tối thiểu trên stack

Script deploy đọc `compose.yml` của stack và ghi một file trạng thái. Nó **không** được
đọc `.env` — nhưng Docker Compose tự đọc file đó dưới user của runner, nên file phải
đọc được bởi người chạy `docker compose`; hãy xem stack của bạn cấp quyền thế nào và
ưu tiên một nhóm chỉ chứa `cnh-runner` thay vì mở `.env` cho mọi người đọc.

```bash
sudo setfacl -m u:cnh-runner:r /opt/chuyennhahung/compose.yml
sudo setfacl -m u:cnh-runner:rwx /opt/chuyennhahung
sudo touch /opt/chuyennhahung/.deployed-tag
sudo chown cnh-runner /opt/chuyennhahung/.deployed-tag
```

`/opt/chuyennhahung/.env` giữ mode `600`. Nếu `docker compose` không đọc được nó dưới
`cnh-runner`, đó là đánh đổi phải quyết có chủ đích (cho runner quyền đọc `.env`, hoặc
chuyển biến của app vào compose project theo cách khác) thay vì lặng lẽ nới quyền file.
Chưa kiểm chứng trên VM.

## Bước 3 — Đăng ký runner

Trên GitHub: repository **Settings → Actions → Runners → New self-hosted runner**
(Linux). Trang này hiện token đăng ký **một lần**; chỉ gõ nó trong terminal của bạn,
không bao giờ trong chat. Dưới user `cnh-runner`:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
# tải và giải nén đúng như trang GitHub chỉ, rồi:
./config.sh --url https://github.com/<owner>/<repo> --labels cnh-dev --name cnh-dev-vm
```

Chỉ thêm nhãn `cnh-dev` (cùng `self-hosted`, `linux` mặc định). Không dùng chung
runner này cho repository khác.

## Bước 4 — Cài thành service

Từ thư mục runner, bằng user có `sudo`:

```bash
sudo ./svc.sh install cnh-runner
sudo ./svc.sh start
sudo ./svc.sh status
```

## Bước 5 — Hardening unit

Tạo drop-in cho unit mà `svc.sh` vừa tạo (tìm tên bằng
`systemctl list-units 'actions.runner.*'`):

```bash
sudo systemctl edit actions.runner.<owner>-<repo>.cnh-dev-vm.service
```

```ini
[Service]
PrivateTmp=true
ProtectHome=read-only
ReadWritePaths=/home/cnh-runner/actions-runner /opt/chuyennhahung
ProtectKernelTunables=true
ProtectControlGroups=true
Restart=on-failure
RestartSec=10
```

**Không** thêm `NoNewPrivileges=true`, `ProtectSystem=strict` hay `PrivateDevices=true`
khi chưa test: Docker cần socket và cgroup của nó, các tuỳ chọn này có thể làm hỏng
`docker compose`. Áp dụng bằng
`sudo systemctl daemon-reload && sudo systemctl restart <unit>`.

## Bước 6 — Kiểm tra

```bash
sudo systemctl status <unit>
journalctl -u <unit> -n 50 --no-pager
```

Trên GitHub runner hiện **Idle** với nhãn `cnh-dev`. Sau đó chạy tay **Deploy dev** từ
`main` (tag của image đã có, hoặc để trống để build) và theo dõi. Kiểm tra lần đầu:
`docker compose version` chạy được dưới `cnh-runner`, pull `ghcr.io` thành công bằng
token của job, và `/opt/chuyennhahung/.deployed-tag` được ghi.

## Vận hành hằng ngày

| Việc | Cách làm |
|---|---|
| Cập nhật runner | Nó tự cập nhật; nếu kẹt, dừng service, giải nén bản mới, chạy lại |
| Gỡ runner | `sudo ./svc.sh stop && sudo ./svc.sh uninstall`, rồi `./config.sh remove` với token gỡ từ GitHub |
| Xoay vòng | Gỡ rồi đăng ký lại; token đăng ký chỉ dùng một lần |
| Dừng deploy nhanh | `sudo systemctl stop <unit>` — job xếp hàng thay vì chạy |

## Giới hạn

- Chưa kiểm chứng trên VM: cách đặt ACL, việc `docker compose` chạy dưới `cnh-runner`
  với `.env` giữ `600`, và việc các tuỳ chọn hardening vẫn để Docker chạy được. Test
  từng thay đổi bằng một lần chạy tay **Deploy dev**.
- Runner không dùng một lần: workspace còn lại giữa các job (`persist-credentials: false`
  giữ token ngoài đó). `--ephemeral` cần wrapper đăng ký lại và chưa được dựng ở đây.
- Chỉ dành cho dev. Prod cần VM, nhãn runner và trigger riêng.
