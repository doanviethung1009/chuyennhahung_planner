import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ADR 0016: the dev deploy runs on a self-hosted runner on the VM, so these
 * static checks guard the trust boundary (never run pull-request code there)
 * and keep the script and compose wiring parseable. The deploy itself is not
 * exercised here — it needs the VM.
 */
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('deploy-dev workflow', () => {
  const wf = read('.github/workflows/deploy-dev.yml');

  it('is never triggered by a pull request', () => {
    expect(wf).not.toMatch(/^\s*pull_request(_target)?\s*:/m);
  });

  it('only starts from a green CI push to main or a dispatch on main', () => {
    expect(wf).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(wf).toContain("github.event.workflow_run.event == 'push'");
    expect(wf).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(wf).toContain("github.ref == 'refs/heads/main'");
  });

  it('runs the deploy job on the self-hosted runner and the build on a hosted one', () => {
    expect(wf).toMatch(/runs-on: \[self-hosted, linux, cnh-dev\]/);
    expect(wf.match(/runs-on: ubuntu-latest/g)?.length).toBe(2);
  });

  it('never interpolates workflow values into a run: shell line of the deploy job', () => {
    const deploy = wf.slice(wf.indexOf('  deploy:'));
    expect(deploy).toContain('run: bash deploy/deploy.sh "$DEPLOY_TAG"');
    expect(deploy).not.toMatch(/run:.*\$\{\{/);
    expect(wf).toContain('persist-credentials: false');
  });

  it('serialises deploys without cancelling a running one', () => {
    expect(wf).toContain('group: deploy-dev');
    expect(wf).toContain('cancel-in-progress: false');
  });
});

describe('deploy/deploy.sh', () => {
  it('is valid bash', () => {
    const r = spawnSync('bash', ['-n', join(root, 'deploy/deploy.sh')], { encoding: 'utf8' });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('rejects a call without a tag and a malformed tag before touching docker', () => {
    const script = join(root, 'deploy/deploy.sh');
    const env = { ...process.env, APP_IMAGE: 'ghcr.io/x/y' };
    expect(spawnSync('bash', [script], { env, encoding: 'utf8' }).status).not.toBe(0);
    const bad = spawnSync('bash', [script, 'a;b'], { env, encoding: 'utf8' });
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('invalid image tag');
  });

  describe('--init-env', () => {
    const script = join(root, 'deploy/deploy.sh');
    const clean = { ...process.env };
    for (const k of ['DB_OVERLAY', 'PLANNER_DATABASE_URL', 'CONTENT_DATABASE_URL', 'SITE_URL', 'STACK_DIR', 'RUNNER_GROUP']) delete clean[k];
    const run = (stack: string, extra: Record<string, string> = {}) =>
      spawnSync('bash', [script, '--init-env'], {
        env: { ...clean, STACK_DIR: stack, SITE_URL: 'http://10.0.0.1', DB_OVERLAY: 'local-db', RUNNER_GROUP: 'no-such-group-xyz', ...extra },
        encoding: 'utf8',
      });
    const newStack = () => mkdtempSync(join(tmpdir(), 'cnh-stack-'));
    const envOf = (stack: string) => join(stack, '.env');

    it('writes a private .env with generated secrets, never prints them, and never overwrites', () => {
      const stack = newStack();
      const first = run(stack);
      expect(first.status).toBe(0);
      const env = readFileSync(envOf(stack), 'utf8');
      expect(env).toContain('NEXT_PUBLIC_SITE_URL=http://10.0.0.1');
      for (const key of ['ADMIN_API_TOKEN', 'GUEST_KEY_SECRET', 'POSTGRES_ADMIN_PASSWORD', 'CNH_APP_PASSWORD', 'PLANNER_DATABASE_URL']) {
        expect(env).toMatch(new RegExp(`^${key}=\\S{16,}$`, 'm'));
      }
      expect(statSync(envOf(stack)).mode & 0o077).toBe(0);
      for (const key of ['ADMIN_API_TOKEN', 'GUEST_KEY_SECRET', 'POSTGRES_ADMIN_PASSWORD', 'CNH_APP_PASSWORD']) {
        const secret = env.match(new RegExp(`^${key}=(.+)$`, 'm'))![1];
        expect(first.stdout + first.stderr).not.toContain(secret);
      }

      const second = run(stack);
      expect(second.status).toBe(1);
      expect(readFileSync(envOf(stack), 'utf8')).toBe(env);
    });

    it('requires SITE_URL and DB_OVERLAY, and PLANNER_DATABASE_URL for external-db, writing nothing', () => {
      const stack = newStack();
      expect(run(stack, { SITE_URL: '' }).status).not.toBe(0);
      expect(run(stack, { DB_OVERLAY: '' }).status).not.toBe(0);
      expect(run(stack, { DB_OVERLAY: 'external-db' }).status).not.toBe(0);
      expect(existsSync(envOf(stack))).toBe(false);
    });

    it('rejects values that would inject keys or be interpolated, writing nothing', () => {
      const stack = newStack();
      const ext = { DB_OVERLAY: 'external-db' };
      const bad: Record<string, string>[] = [
        { SITE_URL: 'http://a\nADMIN_API_TOKEN=x' },
        { SITE_URL: 'http://a b' },
        { SITE_URL: 'http://a/$HOME' },
        { SITE_URL: 'ftp://a' },
        { ...ext, PLANNER_DATABASE_URL: 'postgres://u:p@h/db\nADMIN_API_TOKEN=x' },
        { ...ext, PLANNER_DATABASE_URL: 'postgres://u:pa$ss@h/db' },
        { ...ext, PLANNER_DATABASE_URL: 'mysql://u:p@h/db' },
        { ...ext, PLANNER_DATABASE_URL: 'postgres://u:p@h/db', CONTENT_DATABASE_URL: 'postgres://u:p@h/c d' },
      ];
      for (const extra of bad) expect(run(stack, extra).status, JSON.stringify(extra)).toBe(2);
      expect(existsSync(envOf(stack))).toBe(false);
    });

    it('external-db writes the given URLs and no database passwords', () => {
      const stack = newStack();
      const r = run(stack, {
        DB_OVERLAY: 'external-db',
        PLANNER_DATABASE_URL: 'postgres://cnh_app:pw@db.example:5432/cnh_planner?sslmode=verify-full',
      });
      expect(r.status).toBe(0);
      const env = readFileSync(envOf(stack), 'utf8');
      expect(env).toContain('PLANNER_DATABASE_URL=postgres://cnh_app:pw@db.example:5432/cnh_planner?sslmode=verify-full');
      expect(env).not.toMatch(/^(POSTGRES_ADMIN_PASSWORD|CNH_APP_PASSWORD|CONTENT_DATABASE_URL)=/m);
      expect(r.stdout + r.stderr).not.toContain('pw@');
    });

    const gid = spawnSync('id', ['-gn'], { encoding: 'utf8' }).stdout.trim();
    const hasGetent = spawnSync('getent', ['group', gid]).status === 0;
    it.skipIf(!hasGetent || !gid)('sets group and mode 640 when the runner group exists', () => {
      const stack = newStack();
      expect(run(stack, { RUNNER_GROUP: gid }).status).toBe(0);
      expect(statSync(envOf(stack)).mode & 0o777).toBe(0o640);
    });
  });
});

describe('deploy/deploy.sh and the one-VM stack (docker-deploy.md)', () => {
  const sh = read('deploy/deploy.sh');

  it('uses the stack files of the deployed commit, bind mounts included', () => {
    for (const f of ['compose.yml', 'compose.app.yml', 'compose.app.bind.yml']) {
      expect(sh).toContain(`"$HERE/${f}"`);
    }
    expect(sh).toContain('"$HERE/compose.app.$DB_OVERLAY.yml"');
    expect(sh).toContain('--profile local-db');
    expect(sh).toContain('--env-file "$STACK_DIR/.env"');
  });

  it('only (re)creates the app, so nginx and postgres keep running through a deploy', () => {
    expect(sh).toContain('up -d --no-build --no-deps app');
  });

  it('every overlay the script names exists', () => {
    for (const f of ['compose.yml', 'compose.app.bind.yml', 'compose.app.external-db.yml', 'compose.app.local-db.yml']) {
      expect(() => read(`deploy/${f}`)).not.toThrow();
    }
  });
});

describe('deploy/deploy.sh rollback logic (fake docker)', () => {
  // A failed `up` leaves the old container running and healthy; the script must
  // not mistake that for a successful deploy or record the new tag.
  function run(failUp: boolean) {
    const dir = mkdtempSync(join(tmpdir(), 'cnh-deploy-'));
    const bin = join(dir, 'bin');
    const stack = join(dir, 'stack');
    spawnSync('mkdir', ['-p', bin, stack]);
    writeFileSync(join(stack, '.deployed-tag'), 'sha-old\n');
    const fake = `#!/usr/bin/env bash
case " $* " in
  *" up "*) ${failUp ? 'exit 1' : 'exit 0'} ;;
  *" ps "*) echo cid ;;
  *" inspect "*) echo "ghcr.io/x/y:sha-old" ;;
esac
exit 0
`;
    writeFileSync(join(bin, 'docker'), fake);
    chmodSync(join(bin, 'docker'), 0o755);
    const r = spawnSync('bash', [join(root, 'deploy/deploy.sh'), 'sha-new'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, APP_IMAGE: 'ghcr.io/x/y', STACK_DIR: stack, WAIT_SECONDS: '0' },
    });
    return { r, state: readFileSync(join(stack, '.deployed-tag'), 'utf8').trim() };
  }

  it('fails and keeps the old tag when `up` fails', () => {
    const { r, state } = run(true);
    expect(r.status).toBe(1);
    expect(state).toBe('sha-old');
  });

  it('fails when the container still runs another image, even if it is healthy', () => {
    const { r, state } = run(false);
    expect(r.status).toBe(1);
    expect(state).toBe('sha-old');
  });
});

describe('deploy/scripts/backup.sh (fake docker)', () => {
  function run(dump: string) {
    const dir = mkdtempSync(join(tmpdir(), 'cnh-backup-'));
    const bin = join(dir, 'bin');
    const rootDir = join(dir, 'root');
    spawnSync('mkdir', ['-p', bin, join(rootDir, 'data', 'app'), join(rootDir, 'backups')]);
    const log = join(dir, 'docker.log');
    writeFileSync(join(bin, 'docker'), `#!/usr/bin/env bash\necho "$*" >> "${log}"\n${dump}\nexit 0\n`);
    chmodSync(join(bin, 'docker'), 0o755);
    const r = spawnSync('bash', [join(root, 'deploy/scripts/backup.sh'), 'local-db'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DEPLOY_ROOT: rootDir },
    });
    const calls = existsSync(log) ? readFileSync(log, 'utf8') : '';
    const made = spawnSync('ls', [join(rootDir, 'backups')], { encoding: 'utf8' }).stdout.trim();
    return { r, calls, made, rootDir };
  }

  it('passes the secrets file to Compose and writes non-empty dumps', () => {
    const { r, calls, made, rootDir } = run('echo DUMPDATA');
    expect(r.status).toBe(0);
    expect(calls).toContain(`--env-file ${rootDir}/.env`);
    expect(calls).toContain('--profile local-db');
    const dumps = spawnSync('ls', [join(rootDir, 'backups', made)], { encoding: 'utf8' }).stdout;
    expect(dumps).toContain('cnh_planner.dump');
    expect(dumps).toContain('cnh_content.dump');
    expect(dumps).toContain('app-data.tgz');
  });

  it('fails and leaves no backup directory when pg_dump produces nothing', () => {
    const { r, made } = run(':');
    expect(r.status).toBe(1);
    expect(made).toBe('');
  });
});

describe('nginx proxy headers', () => {
  // The app keys its rate limiter on the first X-Forwarded-For hop and trusts
  // X-Forwarded-Proto (TRUST_PROXY_HEADERS), so nginx must OVERWRITE them — a
  // client-supplied value must never survive. Comments are stripped because
  // they mention the forbidden variable on purpose.
  const strip = (s: string) => s.replace(/#.*$/gm, '');
  const files = ['deploy/nginx/default.conf', 'deploy/nginx-app.conf'];

  for (const f of files) {
    describe(f, () => {
      const conf = strip(read(f));

      it('overwrites X-Forwarded-For with the socket address, never appends', () => {
        expect(conf).toMatch(/proxy_set_header\s+X-Forwarded-For\s+\$remote_addr\s*;/);
        expect(conf).not.toContain('$proxy_add_x_forwarded_for');
        expect(conf).not.toMatch(/\$http_x_forwarded_for/i);
      });

      it('sets the scheme, host and real IP from nginx, not from the client', () => {
        expect(conf).toMatch(/proxy_set_header\s+X-Forwarded-Proto\s+\$scheme\s*;/);
        expect(conf).toMatch(/proxy_set_header\s+X-Forwarded-Host\s+\$host\s*;/);
        expect(conf).toMatch(/proxy_set_header\s+Host\s+\$host\s*;/);
        expect(conf).toMatch(/proxy_set_header\s+X-Real-IP\s+\$remote_addr\s*;/);
        expect(conf).not.toMatch(/\$http_x_forwarded_proto/i);
      });

      it('sets each proxy header once', () => {
        for (const h of ['X-Forwarded-For', 'X-Forwarded-Proto', 'X-Forwarded-Host', 'X-Real-IP']) {
          expect(conf.match(new RegExp(`proxy_set_header\\s+${h}\\s`, 'g'))?.length).toBe(1);
        }
      });
    });
  }

  it('the stack config proxies to app:3000 resolved per request, with a maintenance fallback', () => {
    const conf = strip(read('deploy/nginx/default.conf'));
    expect(conf).toMatch(/resolver\s+127\.0\.0\.11/);
    expect(conf).toContain('set $upstream http://app:3000;');
    expect(conf).toMatch(/proxy_pass\s+\$upstream\s*;/);
    expect(conf).toMatch(/error_page\s+502\s+503\s+504\s+\/maintenance\.html\s*;/);
  });
});

describe('compose.app.yml', () => {
  it('lets the deploy script choose the image and keeps the local build', () => {
    const c = read('deploy/compose.app.yml');
    expect(c).toContain('${APP_IMAGE:-chuyennhahung/app}:${APP_IMAGE_TAG:-latest}');
    expect(c).toMatch(/target: runner/);
  });
});
