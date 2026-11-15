import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
});

describe('compose.app.yml', () => {
  it('lets the deploy script choose the image and keeps the local build', () => {
    const c = read('deploy/compose.app.yml');
    expect(c).toContain('${APP_IMAGE:-chuyennhahung/app}:${APP_IMAGE_TAG:-latest}');
    expect(c).toMatch(/target: runner/);
  });
});
