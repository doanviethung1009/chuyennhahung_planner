import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

  it('builds and pushes the tools image on the hosted runner, never deploys it', () => {
    const build = wf.slice(wf.indexOf('  build:'), wf.indexOf('  deploy:'));
    expect(build).toContain('target: tools');
    expect(build).toContain('needs.plan.outputs.tools_image');
    const deploy = wf.slice(wf.indexOf('  deploy:'));
    expect(deploy).not.toContain('tools');
  });
});

describe('Dockerfile tools stage', () => {
  it('lets the non-root user write next to vitest.config.ts (vite-node temp bundle)', () => {
    const tools = read('Dockerfile').split('FROM builder AS tools')[1]!.split('FROM node:')[0]!;
    expect(tools).toMatch(/chown node:node [^\n]*\/app\b/);
    expect(tools).toContain('USER node');
  });
});

describe('deploy/compose.app.yml tools service', () => {
  const compose = read('deploy/compose.app.yml');

  it('can pull a prebuilt image (TOOLS_IMAGE) and still builds locally by default', () => {
    expect(compose).toContain('image: ${TOOLS_IMAGE:-chuyennhahung/app-tools}:${APP_IMAGE_TAG:-latest}');
    expect(compose).toContain('target: tools');
    expect(compose).toContain('profiles: ["tools"]');
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
        PLANNER_DATABASE_URL: 'postgres://cnh_app:pw@db.example:5432/cnh_planner?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt',
      });
      expect(r.status).toBe(0);
      const env = readFileSync(envOf(stack), 'utf8');
      expect(env).toContain('PLANNER_DATABASE_URL=postgres://cnh_app:pw@db.example:5432/cnh_planner?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt');
      expect(env).not.toMatch(/^(POSTGRES_ADMIN_PASSWORD|CNH_APP_PASSWORD|CONTENT_DATABASE_URL)=/m);
      expect(r.stdout + r.stderr).not.toContain('pw@');
    });

    /** A directory of fake commands placed first on PATH. */
    const shims = (cmds: Record<string, string>) => {
      const dir = mkdtempSync(join(tmpdir(), 'cnh-shim-'));
      for (const [name, body] of Object.entries(cmds)) {
        writeFileSync(join(dir, name), `#!/usr/bin/env bash\n${body}\n`);
        chmodSync(join(dir, name), 0o755);
      }
      return { PATH: `${dir}:${process.env.PATH}` };
    };

    it('writes nothing and exits 1 when openssl fails or returns nothing', () => {
      for (const body of ['exit 1', 'exit 0']) {
        const stack = newStack();
        const r = run(stack, shims({ openssl: body }));
        expect(r.status, body).toBe(1);
        expect(existsSync(envOf(stack)), body).toBe(false);
      }
    });

    it('exits 1 with a clear message when chgrp fails, leaving the file private', () => {
      const stack = newStack();
      const r = run(stack, { ...shims({ getent: 'exit 0', chgrp: 'exit 1' }), RUNNER_GROUP: 'fake-runner' });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('stays mode 600');
      expect(r.stdout).not.toContain('wrote');
      expect(statSync(envOf(stack)).mode & 0o077).toBe(0);
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

describe('deploy/deploy.sh nginx sync (fake docker)', () => {
  // After a healthy deploy the script copies deploy/nginx/* over the checkout the
  // running nginx has mounted, validates it inside the container and reloads.
  function run(opts: { nginxTestFails?: boolean; writable?: boolean }) {
    const dir = mkdtempSync(join(tmpdir(), 'cnh-nginx-'));
    const bin = join(dir, 'bin');
    const stack = join(dir, 'stack');
    const live = join(dir, 'live');
    spawnSync('mkdir', ['-p', bin, stack, live]);
    writeFileSync(join(stack, '.deployed-tag'), 'sha-old\n');
    writeFileSync(join(live, 'default.conf'), 'OLD CONF\n');
    writeFileSync(join(live, 'maintenance.html'), read('deploy/nginx/maintenance.html'));
    if (opts.writable === false) chmodSync(join(live, 'default.conf'), 0o444);
    const calls = join(dir, 'calls.log');
    const fake = `#!/usr/bin/env bash
echo "$*" >>"${calls}"
case " $* " in
  *" ps "*) echo cid ;;
  *" inspect "*) echo "ghcr.io/x/y:sha-new" ;;
  *" nginx -t"*) ${opts.nginxTestFails ? 'exit 1' : 'exit 0'} ;;
esac
exit 0
`;
    writeFileSync(join(bin, 'docker'), fake);
    chmodSync(join(bin, 'docker'), 0o755);
    const r = spawnSync('bash', [join(root, 'deploy/deploy.sh'), 'sha-new'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        APP_IMAGE: 'ghcr.io/x/y',
        STACK_DIR: stack,
        NGINX_CONF_DIR: live,
        WAIT_SECONDS: '0',
      },
    });
    return { r, conf: readFileSync(join(live, 'default.conf'), 'utf8'), calls: readFileSync(calls, 'utf8') };
  }

  it('copies the commit config, validates it and reloads nginx', () => {
    const { r, conf, calls } = run({});
    expect(r.status).toBe(0);
    expect(conf).toBe(read('deploy/nginx/default.conf'));
    expect(calls).toContain('exec cid nginx -t');
    expect(calls).toContain('exec cid nginx -s reload');
  });

  it('restores the previous config and fails when nginx rejects the new one', () => {
    const { r, conf } = run({ nginxTestFails: true });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('nginx rejected the new config');
    expect(conf).toBe('OLD CONF\n');
  });

  it('warns and still succeeds when the target is not writable by the runner', () => {
    const { r, conf } = run({ writable: false });
    if (process.getuid?.() === 0) return; // root ignores the mode bits
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('nginx sync skipped');
    expect(conf).toBe('OLD CONF\n');
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

describe('external-db TLS rule', () => {
  it('--init-env refuses an external-db URL without sslmode=verify-full, writing nothing', () => {
    const stack = mkdtempSync(join(tmpdir(), 'cnh-stack-'));
    const clean = { ...process.env };
    for (const k of ['PLANNER_DATABASE_URL', 'CONTENT_DATABASE_URL', 'RUNNER_GROUP']) delete clean[k];
    const run = (extra: Record<string, string>) =>
      spawnSync('bash', [join(root, 'deploy/deploy.sh'), '--init-env'], {
        env: { ...clean, STACK_DIR: stack, SITE_URL: 'http://10.0.0.1', DB_OVERLAY: 'external-db', ...extra },
        encoding: 'utf8',
      });
    const tls = '?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt';
    const cases: Record<string, string>[] = [
      { PLANNER_DATABASE_URL: 'postgres://u:p@db/cnh_planner' },
      { PLANNER_DATABASE_URL: 'postgres://u:p@db/cnh_planner?sslmode=verify-full' },
      { PLANNER_DATABASE_URL: `postgres://u:p@db/cnh_planner${tls}`, CONTENT_DATABASE_URL: 'postgres://u:p@db/cnh_content' },
      { PLANNER_DATABASE_URL: `postgres://u:p@db/cnh_planner?sslmode=verify-fullx&sslrootcert=/run/secrets/pg-ca.crt` },
      { PLANNER_DATABASE_URL: `postgres://u:p@db/cnh_planner?x=sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt` },
      { PLANNER_DATABASE_URL: `postgres://u:p@db/cnh_planner?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crtx` },
      { PLANNER_DATABASE_URL: `postgres://u:p@db/cnh_planner?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt&sslmode=disable` },
      { PLANNER_DATABASE_URL: `postgres://u:p@db/cnh_planner?sslmode=disable&sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt` },
      { PLANNER_DATABASE_URL: `postgres://u:p@db/cnh_planner#?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt` },
    ];
    for (const extra of cases) {
      const r = run(extra);
      expect(r.status).toBe(2);
      // A `#` is refused by the character rule, the rest by the TLS rule.
      expect(r.stderr).toMatch(/database URLs must/);
    }
    expect(existsSync(join(stack, '.env'))).toBe(false);
  });
});

describe('deploy.sh --check', () => {
  const script = join(root, 'deploy/deploy.sh');
  const long = 'x'.repeat(40);
  const stackWith = (env: string, mode = 0o600, ca = true) => {
    const stack = mkdtempSync(join(tmpdir(), 'cnh-check-'));
    writeFileSync(join(stack, '.env'), env);
    chmodSync(join(stack, '.env'), mode);
    if (ca) {
      mkdirSync(join(stack, 'secrets'));
      writeFileSync(join(stack, 'secrets/pg-ca.crt'), 'x');
    }
    return stack;
  };
  const check = (stack: string, overlay = 'external-db') =>
    spawnSync('bash', [script, '--check'], {
      env: { ...process.env, STACK_DIR: stack, DEPLOY_ROOT: stack, DB_OVERLAY: overlay },
      encoding: 'utf8',
    });
  const good = `NEXT_PUBLIC_SITE_URL=http://10.0.0.1
ADMIN_API_TOKEN=${long}
GUEST_KEY_SECRET=${long}
PLANNER_DATABASE_URL=postgres://u:p@db/cnh_planner?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt
`;

  it('passes a complete external-db file', () => {
    expect(check(stackWith(good)).status).toBe(0);
  });

  it('fails on short secrets, missing TLS, missing CA file and a world-readable file', () => {
    const weak = good.replace(long, 'short').replace('?sslmode=verify-full', '?x=1');
    const r = check(stackWith(weak, 0o644, false));
    expect(r.status).toBe(1);
    for (const m of ['ADMIN_API_TOKEN', 'sslmode=verify-full', 'pg-ca.crt', 'world-accessible']) expect(r.stderr).toContain(m);
  });

  it('never prints a secret value', () => {
    const r = check(stackWith(good.replace('db/cnh_planner', 'db/uniqueDbName123')));
    expect(r.stdout + r.stderr).not.toContain(long);
    expect(r.stdout + r.stderr).not.toContain('uniqueDbName123');
  });

  it('checks CONTENT_DATABASE_URL TLS and refuses DB_BIND_ADDR=0.0.0.0', () => {
    const noTls = check(stackWith(`${good}CONTENT_DATABASE_URL=postgres://u:p@db/cnh_content\n`));
    expect(noTls.status).toBe(1);
    expect(noTls.stderr).toContain('CONTENT_DATABASE_URL');
    const tls = '?sslmode=verify-full&sslrootcert=/run/secrets/pg-ca.crt';
    expect(check(stackWith(`${good}CONTENT_DATABASE_URL=postgres://u:p@db/cnh_content${tls}\n`)).status).toBe(0);
    const open = check(stackWith(`${good}DB_BIND_ADDR=0.0.0.0\n`));
    expect(open.status).toBe(1);
    expect(open.stderr).toContain('DB_BIND_ADDR');
    expect(check(stackWith(`${good}DB_BIND_ADDR=10.0.0.5\n`)).status).toBe(0);
    for (const bad of ['::', '10.0.0.5,0.0.0.0', 'db.example', '0.0.0.0', '00.0.0.0', '999.999.999.999', '10.0.0.256', '010.001.1.1']) {
      expect(check(stackWith(`${good}DB_BIND_ADDR=${bad}\n`)).status, bad).toBe(1);
    }
    const fake = check(stackWith(good.replace('?sslmode=verify-full&', '?x=sslmode=verify-full&')));
    expect(fake.status).toBe(1);
    expect(fake.stderr).toContain('PLANNER_DATABASE_URL');
  });

  it('local-db needs the Postgres passwords instead of TLS', () => {
    const local = good.replace(/\?sslmode.*/, '');
    expect(check(stackWith(local, 0o600, false), 'local-db').status).toBe(1);
    expect(check(stackWith(`${local}POSTGRES_ADMIN_PASSWORD=a\nCNH_APP_PASSWORD=b\n`, 0o600, false), 'local-db').status).toBe(0);
  });
});

describe('nginx logging policy', () => {
  const strip = (s: string) => s.replace(/#.*$/gm, '');
  const conf = strip(read('deploy/nginx/default.conf'));
  const fmt = conf.match(/log_format\s+cnh\s+([^;]+);/)?.[1] ?? '';

  it('uses a custom format that carries no query, cookie, authorization or referer', () => {
    expect(fmt).not.toBe('');
    for (const v of ['$request ', '$request"', '$request_uri', '$args', '$query_string', '$http_cookie', '$http_authorization', '$http_referer', '$http_x_']) {
      expect(fmt).not.toContain(v);
    }
    expect(fmt).toContain('$log_uri');
    expect(conf).toMatch(/access_log\s+\/var\/log\/nginx\/access\.log\s+cnh\s*;/);
    // Inside `server {}` so it REPLACES the image's http-level `access_log main`
    // (full request line with query); at http level both would be written.
    const serverBody = conf.slice(conf.indexOf('server {'));
    expect(serverBody).toMatch(/access_log\s+\/var\/log\/nginx\/access\.log\s+cnh\s*;/);
    expect(conf.slice(0, conf.indexOf('server {'))).not.toMatch(/access_log\s+\/var\/log/);
    expect(conf).toMatch(/error_log\s+\/var\/log\/nginx\/error\.log\s+warn\s*;/);
  });

  it('masks every share-token path, with and without a locale prefix', () => {
    // The map's own regex, run against real URIs (PCRE and JS agree on this subset).
    const rx = conf.match(/~(\^\/[^\s]+)\s+\/\$area\/\[redacted\]/)?.[1];
    expect(rx).toBeTruthy();
    const masked = new RegExp(rx!);
    for (const uri of [
      '/chia-se/TOKEN', '/vi/chia-se/TOKEN', '/en/chia-se/TOKEN',
      '/shared/TOKEN', '/vi/shared/TOKEN', '/en/shared/TOKEN', '/api/shared/TOKEN',
    ]) expect(masked.test(uri), uri).toBe(true);
    for (const uri of ['/vi/stories', '/en/stories/shared-things', '/api/planner/abc/share/rotate', '/api/health']) {
      expect(masked.test(uri), uri).toBe(false);
    }
    expect(conf).toContain('[redacted]');
  });

  it('never references the image\'s `main` or `combined` access-log formats', () => {
    expect(conf).not.toMatch(/\b(main|combined)\b/);
  });

  it('rotates access 14 days and error 30 days, and setup-host installs it', () => {
    const lr = read('deploy/logrotate/chuyennhahung');
    const block = (name: string) => lr.match(new RegExp(`${name}\\.log \\{([^}]*)\\}`))?.[1] ?? '';
    expect(block('access')).toMatch(/daily/);
    expect(block('access')).toMatch(/rotate 14\b/);
    expect(block('error')).toMatch(/rotate 30\b/);
    expect(read('deploy/scripts/setup-host.sh')).toContain('/etc/logrotate.d/chuyennhahung');
    expect(read('deploy/scripts/setup-host.sh')).toContain('DEPLOY_ROOT must be an absolute path');
    expect(lr).toMatch(/error\.log CAN/);
  });
});

describe('compose hardening', () => {
  it('caps container logs and memory for every long-running service', () => {
    for (const f of ['deploy/compose.yml', 'deploy/compose.app.yml']) {
      const c = read(f);
      const services = c.match(/^ {2}(nginx|postgres|app):$/gm) ?? [];
      expect(c.match(/max-size: "10m"/g)?.length, f).toBe(services.length);
      expect(c.match(/mem_limit:/g)?.length, f).toBe(services.length);
    }
  });

  it('bakes no LAN address into the database overlay and defaults Google sign-up off', () => {
    expect(read('deploy/compose.postgres-lan.yml')).toContain('${DB_BIND_ADDR:?');
    expect(read('deploy/compose.postgres-lan.yml').replace(/#.*$/gm, '')).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    const app = read('deploy/compose.app.yml');
    expect(app).toContain('GOOGLE_SIGNUP_ENABLED: ${GOOGLE_SIGNUP_ENABLED:-false}');
    expect(app).not.toContain('GOOGLE_REDIRECT_URI:');
  });

  it('keeps a real .env out of git', () => {
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^deploy\/\.env$/m);
  });
});

describe('deploy/.env.example', () => {
  const example = read('deploy/.env.example');
  const keys = [...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]);

  it('lists every variable the compose files read', () => {
    const compose = ['deploy/compose.yml', 'deploy/compose.app.yml', 'deploy/compose.postgres-lan.yml']
      .map(read)
      .join('\n')
      .replace(/^\s*#.*$/gm, '');
    const used = new Set([...compose.matchAll(/\$\{([A-Z][A-Z0-9_]+)[:}?-]/g)].map((m) => m[1]));
    for (const k of used) expect(keys, k).toContain(k);
  });

  it('lists the secrets the app needs and holds no real secret value', () => {
    for (const k of ['ADMIN_API_TOKEN', 'GUEST_KEY_SECRET']) expect(example).toMatch(new RegExp(`^${k}=$`, 'm'));
    expect(example).not.toMatch(/^(ADMIN_API_TOKEN|GUEST_KEY_SECRET|GOOGLE_CLIENT_SECRET)=\S/m);
  });
});
