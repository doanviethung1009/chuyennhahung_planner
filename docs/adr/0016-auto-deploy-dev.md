# ADR 0016 — Automatic deploy of `main` to the dev VM

🇻🇳 Bản tiếng Việt: [0016-auto-deploy-dev.vi.md](0016-auto-deploy-dev.vi.md)

- **Status:** Accepted (owner chose the self-hosted runner on 2026-11-15); the pipeline has since run end to end on the dev VM (deploy test report 2026-11-15: five green runs, a rollback and a redeploy, commit `0216f46`); the report also found no backups and an unset `metadataBase`, and the admin browser flow was not run
- **Date:** 2026-11-15
- **Owner:** system-architect

## Context

Debugging and QC are fast on the developer's machine and should stay there. Once a
fix is settled locally and merged, the dev VM (`192.168.100.140`) should run it
without a manual `docker compose` session, and the same pipeline should later
serve prod.

Constraints that shape the answer:

- The VM has a LAN address, so GitHub-hosted runners cannot reach it. Anything
  that deploys must be started from the VM's side.
- The VM has 1.9 GB RAM; `next build` is the memory peak
  ([usage → One replica, small host](../usage.md#one-replica-small-host)).
- `NEXT_PUBLIC_SITE_URL` is baked into the bundle at build time, so an image is
  tied to one environment's URL.
- Migrations apply at start under an advisory lock and are forward-only
  ([ADR 0009](0009-postgres-persistence.md)).
- The repository is private on GitHub Free: Environment required reviewers and
  branch protection are unavailable, so no approval click can gate prod.

## Decision

1. **Trigger:** the `deploy-dev` workflow starts only from a successful `CI` run of
   a push to `main`, or a manual dispatch on `main`. Never from a pull request.
2. **Build on GitHub, not on the VM:** a hosted runner builds the `runner` target
   with the dev `NEXT_PUBLIC_SITE_URL` and pushes it to GHCR as
   `sha-<commit>` and `dev`.
3. **Deploy through a self-hosted runner on the VM** (outbound connection only).
   `deploy/deploy.sh <tag>` logs in to GHCR for the pull, runs
   `docker compose up -d --no-build --no-deps app` with the compose files of the commit
   being deployed, waits for `/api/health` inside the container, and writes the
   tag to `/opt/chuyennhahung/.deployed-tag`.
4. **Rollback:** if the health probe fails the script re-deploys the previous tag
   and fails the run. A manual rollback is the same workflow dispatched with
   `tag=sha-<old>`, which skips the build.
5. **Prod later** reuses this shape with its own image (its own URL), its own
   runner label and a trigger a human controls — a `v*` tag or a manual
   dispatch — not an automatic push.

## Options considered

| Option | For | Against |
|---|---|---|
| A (chosen) self-hosted runner on the VM | Output in the Actions tab, immediate, one rollback path, no inbound port | About 150 MB of RAM on a small host; a runner on the VM is a trust boundary that must never see PR code |
| B systemd timer polling GHCR | No runner, nothing to register, lightest | Up to a couple of minutes late, logs only on the VM, no failure shown in GitHub |
| C Tailscale for a hosted runner, then SSH | Familiar push model | A third-party network plus an SSH key stored in GitHub secrets |
| D build on the VM | No registry | The build does not fit the memory |

B lost for one reason: a failed deploy is invisible where the team already looks.

## Consequences

Easier: merging is the release step for dev; every deploy is one immutable
`sha-` tag; rollback is a dispatch.

Harder:

- **A rollback restores the image, not the schema.** Migrations stay forward-only,
  so each migration must keep the previous release working (add first, remove in a
  later release).
- One image per environment: prod cannot promote the dev image.
- The runner holds a foothold on the dev VM. It is acceptable because the
  triggers exclude pull requests (a static test guards that), the registry
  credential is the job's token used for one login/logout, and `.env` is never
  read by the script. **The boundary is wider than this one file**: anyone with
  write access can push a branch with a different workflow that asks for the
  `cnh-dev` label and runs on the VM, so everyone with write access is effectively
  root on the dev VM. Keep collaborators few, run the runner as a dedicated user,
  consider `--ephemeral`, and keep fork-PR workflows off. (`/sec-check`, 2026-11-15.)
  The deploy runs as whichever user the runner service uses,
  which must be in the `docker` group — effectively root on that VM.
- Only one app replica is supported (`concurrency: deploy-dev`, one container),
  so a deploy has a short gap while the container restarts. Acceptable on dev.
- CI results are advisory on this plan ([git governance](../../.claude/rules/05-git-governance.md)),
  yet the deploy gates on a green CI run, so a red CI run simply does not deploy.

To reverse: delete the workflow and script; the manual flow in
[usage → Deploy](../usage.md#deploy) is unchanged.

## Follow-up

- Owner: register the runner on the VM with label `cnh-dev`, set the repository
  variable `DEV_SITE_URL` if it differs from `http://192.168.100.140`, and check
  the GHCR package is readable by the repository — see
  [usage → Auto deploy to dev](../usage.md#auto-deploy-to-dev) and
  [deploy-runner.md](../deploy-runner.md).
- Open: HTTPS for dev, and the prod workflow, each with its own ADR or amendment.
- Recommended: `/sec-check` on this change before the runner is registered.
