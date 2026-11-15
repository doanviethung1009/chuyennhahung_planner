# Runbook — Google sign-in on the dev VM

> Đi đâu cũng có chuyện.

How to turn Google sign-in on, change it and fix it on the deployed stack, and how it
ties to the deploy pipeline ([deploy-runner.md](deploy-runner.md),
[ADR 0016](adr/0016-auto-deploy-dev.md)). The design is in
[ADR 0007](adr/0007-password-and-google-sign-in.md); this file is the operating
procedure. Every privileged step is done by the owner.

🇻🇳 Bản tiếng Việt: [runbook-google-sign-in.vi.md](runbook-google-sign-in.vi.md)

## How it links to deploy

```mermaid
flowchart LR
  L[".env.local on your Mac<br/>(local only)"] -. never copied by CI .-> X(( ))
  V["/opt/chuyennhahung/.env<br/>mode 600, on the VM"] --> C["deploy.sh → docker compose<br/>--env-file .env"]
  C --> A["app container<br/>GOOGLE_CLIENT_ID / SECRET"]
  A --> R["/api/planner/oauth/google/*"]
  G["Google Cloud Console<br/>redirect URI"] --> R
```

- The deploy runner never sees your `.env.local`. `deploy/deploy.sh` passes
  `$STACK_DIR/.env` (default `/opt/chuyennhahung/.env`) to Compose, and
  [compose.app.yml](../deploy/compose.app.yml) forwards `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET` and `GOOGLE_SIGNUP_ENABLED` into the `app` container.
- Secrets are **runtime** variables: they are not in the image and not in the
  workflow. Only `NEXT_PUBLIC_SITE_URL` is baked at build time, and the Google
  redirect URI is derived from it.
- Compose reads `.env` as the runner user; see Step 2 of
  [deploy-runner.md](deploy-runner.md) for the permission trade-off.

## Prerequisites

| Need | Where |
|---|---|
| Dev VM with the stack and runner installed | [deploy-runner.md](deploy-runner.md), [deploy-database.md](deploy-database.md) |
| An OAuth 2.0 Web client in Google Cloud Console | owner's Google account — **flag: real data, not in the repo** |
| A public origin Google accepts | see *Redirect URI* below |

## Step 1 — Register the redirect URI

In Google Cloud Console → APIs & Services → Credentials → the OAuth client, add under
**Authorised redirect URIs**, exactly:

```
<NEXT_PUBLIC_SITE_URL>/api/planner/oauth/google/callback
```

For local development that is `http://localhost:3000/api/planner/oauth/google/callback`.

For the dev VM, Google does not accept the bare IP (`http://192.168.100.140/…`). What
works, **verified on the dev VM**, is a `nip.io` hostname over plain HTTP: the name
`192-168-100-140.nip.io` resolves to `192.168.100.140` through nip.io's public DNS, so
nothing is created or edited, and nginx already accepts any host (`server_name _`). The
dev URI is therefore:

```
http://192-168-100-140.nip.io/api/planner/oauth/google/callback
```

1. Add it under **Authorised redirect URIs**. Leave **Authorised JavaScript origins**
   empty: the flow runs entirely on the server, and that field rejects any path with
   `Invalid Origin: URIs must not contain a path or end with "/"`. That message means the
   URI was pasted into the wrong field.
2. Set the repository variable `DEV_SITE_URL` to `http://192-168-100-140.nip.io`
   (`gh variable set DEV_SITE_URL --body …`) and run **Deploy dev** with `tag` empty,
   because `NEXT_PUBLIC_SITE_URL` is baked into the image at build time.
3. Set the same value as `NEXT_PUBLIC_SITE_URL` in the VM's `.env` (Step 2). The server
   derives the redirect URI from it at run time, so a stale value there sends Google the
   old URI.

`GOOGLE_REDIRECT_URI` overrides the derived value but is **not** forwarded by
`compose.app.yml` today, so use the hostname route.

Only people on the same LAN reach the site, and the name depends on nip.io staying up.

## Step 2 — Put the credentials on the VM

Type the secret only in your own terminal, never in chat or a ticket.

```bash
sudo nano /opt/chuyennhahung/.env
```

```
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
# optional: false stops a first Google sign-in from creating an account
GOOGLE_SIGNUP_ENABLED=true
```

```bash
sudo chmod 600 /opt/chuyennhahung/.env
```

Never use the `NEXT_PUBLIC_` prefix for these; `tests/client-boundary.test.ts` guards it.

## Step 3 — Roll it out

The container only reads its environment when it is created. Run **Deploy dev** from
`main` with `tag` = `sha-<current commit>` (no build): `deploy.sh` runs
`compose up -d app`, and Compose recreates a service whose resolved configuration
changed (verified: a run with the same image tag and only `GOOGLE_SIGNUP_ENABLED`
changed in `.env` recreated the container with the new value). Check it:

```bash
docker compose -f /opt/chuyennhahung/app/deploy/compose.yml ps   # app is healthy
journalctl -u <runner unit> -n 50 --no-pager                      # deploy output
```

## Step 4 — Verify

| Check | Expected |
|---|---|
| Open `/dang-nhap` | the "Continue with Google" button is visible |
| Click it | Google consent, then back on the site signed in |
| `curl -i <origin>/api/planner/oauth/google/start` | `302` to `accounts.google.com`; **`404` means a variable is missing** (fail closed) |
| A first sign-in with a new address | creates a `member`; Google never grants `editor` or `admin` |

## Day-to-day

| Task | How |
|---|---|
| Rotate the client secret | Create a new secret in Google Console, edit `.env`, redeploy (Step 3), delete the old secret |
| Close self-service signup | `GOOGLE_SIGNUP_ENABLED=false`, redeploy; existing links still sign in |
| User sees `link_required` | An account with that email exists but is not linked. Sign in with the password, then use *Link Google account* on `/doi-mat-khau` |
| User sees `account_conflict` | Google reassigned the address to another `sub`. An operator checks, then unlinks: `DELETE /api/admin/planner/users/:userId/google` (see [runbook-api.md](runbook-api.md)) |
| User sees `account_not_found` | `GOOGLE_SIGNUP_ENABLED=false` and no account yet; create one in `/quan-tri` |
| `redirect_uri_mismatch` from Google | The URI in Step 1 differs from `NEXT_PUBLIC_SITE_URL` + the callback path, character for character |
| The admin is locked out | `npm run admin:create` — see [usage.md](usage.md) *Accounts and passwords at a glance* |

## Rollback

Google sign-in is additive. To switch it off, empty both variables in `.env` and
redeploy: both routes answer `404`, the button disappears, password sign-in keeps
working. To roll back the code, run **Deploy dev** with an older `sha-<commit>` tag;
the credentials stay in `.env`.

## Limits and open questions

- Verified on the dev VM: Google accepts the `nip.io` HTTP redirect URI, `start`
  answers `302` with that `redirect_uri`, and a browser sign-in on the dev network
  works. Not verified: the unlink and `account_conflict` paths.
- With `GOOGLE_SIGNUP_ENABLED=false` a Google address with no account gets
  `account_not_found`; with `true` anyone with a Google account can create a `member`.
  Set it back to `false` when the dev VM is not for open testing.
- The rate limits and the signup throttle are in-memory and per process, so a restart
  resets them.
- `GOOGLE_REDIRECT_URI` is not forwarded by `deploy/compose.app.yml`. Add it there
  (in a reviewed change) only if a hostname cannot be arranged.
- Credentials that have appeared in a chat, a log or a screenshot must be treated as
  leaked: rotate them.
