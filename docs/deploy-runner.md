# Deploy runner — Chuyện Nhà Hưng

> Đi đâu cũng có chuyện.

A runbook to install the GitHub Actions **self-hosted runner** on the dev VM as a
hardened systemd service, so the `deploy-dev` workflow can deploy
([ADR 0016](adr/0016-auto-deploy-dev.md),
[feature](features/auto-deploy-dev.md)). Nothing here is run for you: every
privileged step is done by the owner.

🇻🇳 Bản tiếng Việt: [deploy-runner.vi.md](deploy-runner.vi.md)

## Why a systemd service, not a container

A containerised runner has to mount `/var/run/docker.sock`, which is root on the VM
anyway, and then the compose files and bind mounts (`/opt/chuyennhahung/...`) no
longer have the same paths for the runner and for the Docker daemon. It also costs
RAM on a 1.9 GB host. A systemd service runs on the host, sees the real paths, and is
what GitHub's own `svc.sh` installs. Use a container only if you later want
ephemeral runners or several runners on one host.

## What you are accepting

The runner user is in the `docker` group, which is **root-equivalent on this VM**. Any
workflow that asks for the label `cnh-dev` runs there, and anyone with write access
to the repository can push such a workflow. So: keep collaborators few, keep fork-PR
workflows off, and treat this VM as dev-only with no production secret on it.

## Step 1 — A dedicated user

```bash
sudo adduser --disabled-password --gecos "" cnh-runner
sudo usermod -aG docker cnh-runner
```

No `sudo` rights, no SSH login (`--disabled-password`). Use the user only for the
runner.

## Step 2 — Give it the minimum on the stack

The deploy script reads the stack's `compose.yml` and writes one state file. It must
**not** read `.env` — Docker Compose reads it for the runner user, so the file needs
to be readable by the one who runs `docker compose`; check how your stack grants this
and prefer a group that contains only `cnh-runner` over making `.env` world-readable.

```bash
sudo setfacl -m u:cnh-runner:r /opt/chuyennhahung/compose.yml
sudo setfacl -m u:cnh-runner:rwx /opt/chuyennhahung
sudo touch /opt/chuyennhahung/.deployed-tag
sudo chown cnh-runner /opt/chuyennhahung/.deployed-tag
```

`/opt/chuyennhahung/.env` stays mode `600`. If `docker compose` then fails to read
it as `cnh-runner`, that is the trade-off to decide consciously (give the runner read
access to `.env`, or move the app's variables into the compose project another way)
rather than loosening the file silently. This is not verified on the VM yet.

## Step 3 — Register the runner

In GitHub: repository **Settings → Actions → Runners → New self-hosted runner**
(Linux). The page shows a registration token **once**; type it only in your own
terminal, never in chat. As `cnh-runner`:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
# download and extract exactly as the GitHub page shows, then:
./config.sh --url https://github.com/<owner>/<repo> --labels cnh-dev --name cnh-dev-vm
```

Add only the label `cnh-dev` (plus the default `self-hosted`, `linux`). Do not reuse
this runner for other repositories.

## Step 4 — Install it as a service

From the runner folder, as a user with `sudo`:

```bash
sudo ./svc.sh install cnh-runner
sudo ./svc.sh start
sudo ./svc.sh status
```

## Step 5 — Harden the unit

Create a drop-in for the unit that `svc.sh` made (find its name with
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

Do **not** add `NoNewPrivileges=true`, `ProtectSystem=strict` or
`PrivateDevices=true` without testing: Docker needs its socket and cgroups, and these
settings can break `docker compose`. Apply with
`sudo systemctl daemon-reload && sudo systemctl restart <unit>`.

## Step 6 — Check it

```bash
sudo systemctl status <unit>
journalctl -u <unit> -n 50 --no-pager
```

In GitHub the runner shows **Idle** with the `cnh-dev` label. Then run **Deploy dev**
manually from `main` (a tag of an image that already exists, or none to build) and
watch it. First-run checks: `docker compose version` works for `cnh-runner`, the
`ghcr.io` pull succeeds with the job token, and `/opt/chuyennhahung/.deployed-tag`
gets written.

## Day-to-day

| Task | How |
|---|---|
| Update the runner | It self-updates; if it stalls, stop the service, extract the new release, start again |
| Remove it | `sudo ./svc.sh stop && sudo ./svc.sh uninstall`, then `./config.sh remove` with a removal token from GitHub |
| Rotate | Remove and register again; the registration token is single-use |
| Stop deploys quickly | `sudo systemctl stop <unit>` — jobs queue instead of running |

## Limits

- Not verified on the VM yet: the ACL layout, that `docker compose` runs under
  `cnh-runner` with `.env` kept at `600`, and that the hardening options leave Docker
  working. Test each change with a manual **Deploy dev** run.
- The runner is not ephemeral: its workspace persists between jobs
  (`persist-credentials: false` keeps the token out of it). `--ephemeral` needs a
  re-registration wrapper and is not set up here.
- This is dev only. Prod needs its own VM, runner label and trigger.
