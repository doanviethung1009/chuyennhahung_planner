import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * The `PreToolUse` guard in `.claude/hooks/git_guard.py` is what mechanically
 * enforces CLAUDE.md rule 9 (`main` only moves through a merged PR), so its
 * decisions are tested rather than trusted.
 *
 * It shipped with two defects, both covered here:
 *   - it read the branch of whichever directory it happened to run in, not the
 *     directory the command would run in. With git worktrees those differ, so
 *     it blocked legitimate commits and let a real commit to `main` through.
 *   - it matched command patterns inside quoted heredoc bodies, so writing
 *     documentation that mentions a git command was treated as running one.
 */
const root = resolve(import.meta.dirname, '..');
const hook = resolve(root, '.claude/hooks/git_guard.py');

const python = (() => {
  for (const candidate of ['python3', 'python']) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  return null;
})();

type Decision = 'deny' | 'ask' | 'allow';

interface Verdict {
  decision: Decision;
  reason: string;
}

/** Run the hook the way Claude Code does: event JSON on stdin. */
function runGuard(command: string, cwd: string): Verdict {
  const result = spawnSync(python!, [hook], {
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      cwd,
      tool_input: { command },
    }),
    encoding: 'utf8',
  });

  expect(result.status, `hook crashed: ${result.stderr}`).toBe(0);

  const stdout = result.stdout.trim();
  // No output is how the hook says "no opinion", which lets the call proceed.
  if (stdout === '') return { decision: 'allow', reason: '' };

  const parsed = JSON.parse(stdout).hookSpecificOutput;
  return {
    decision: parsed.permissionDecision as Decision,
    reason: parsed.permissionDecisionReason as string,
  };
}

const tempRoots: string[] = [];

/** A throwaway repository with `branch` checked out and one commit on it. */
function repoOn(branch: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'git-guard-'));
  tempRoots.push(dir);
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: dir, stdio: 'pipe' });

  git('init', '-q', '-b', branch);
  git('-c', 'user.email=t@example.com', '-c', 'user.name=t',
    'commit', '-q', '--allow-empty', '-m', 'init');
  return dir;
}

/** A throwaway repository sitting on an unborn (commit-less) branch. */
function unbornRepoOn(branch: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'git-guard-unborn-'));
  tempRoots.push(dir);
  execFileSync('git', ['init', '-q', '-b', branch], { cwd: dir, stdio: 'pipe' });
  return dir;
}

afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(python === null)('git_guard PreToolUse hook', () => {
  describe('always denies unsafe operations, whatever the branch', () => {
    const cases = [
      'git push --force origin feature',
      'git push -f origin feature',
      'git reset --hard HEAD~1',
      'git clean -fd',
      'rm -rf src',
      'claude --dangerously-skip-permissions',
    ];

    it.each(cases)('denies %s', (command) => {
      expect(runGuard(command, repoOn('feature')).decision).toBe('deny');
    });
  });

  describe('protects main (rule 9)', () => {
    it('denies a commit while main is checked out', () => {
      const verdict = runGuard('git commit -m "feat: x"', repoOn('main'));
      expect(verdict.decision).toBe('deny');
      expect(verdict.reason).toContain('rule 9');
    });

    it.each(['git push origin main', 'git merge feature'])(
      'denies %s while main is checked out',
      (command) => {
        expect(runGuard(command, repoOn('main')).decision).toBe('deny');
      },
    );

    it('denies a first commit on an unborn main', () => {
      // `rev-parse --abbrev-ref HEAD` prints the literal "HEAD" here, which is
      // why the hook uses `symbolic-ref`.
      expect(runGuard('git commit -m "x"', unbornRepoOn('main')).decision)
        .toBe('deny');
    });
  });

  describe('judges the branch of the command’s own directory', () => {
    it('only asks for a commit on a feature branch', () => {
      expect(runGuard('git commit -m "feat: x"', repoOn('feature')).decision)
        .toBe('ask');
    });

    it('does not block a feature-branch commit because another checkout is on main', () => {
      // The regression: this repository is worked on through worktrees, where
      // the main checkout and the worktree sit on different branches.
      repoOn('main');
      expect(runGuard('git commit -m "feat: x"', repoOn('feature')).decision)
        .toBe('ask');
    });

    it('falls back to asking when the directory is not a repository', () => {
      const notARepo = mkdtempSync(join(tmpdir(), 'git-guard-bare-'));
      tempRoots.push(notARepo);
      expect(runGuard('git commit -m "x"', notARepo).decision).toBe('ask');
    });
  });

  describe('reads commands, not quoted heredoc bodies', () => {
    it('ignores a git command quoted inside a heredoc', () => {
      const command = [
        "cat > notes.md <<'EOF'",
        'Run `git commit` on a branch, then `git push -u origin branch`.',
        'EOF',
      ].join('\n');
      expect(runGuard(command, repoOn('main')).decision).toBe('allow');
    });

    it('still sees a real command after a heredoc closes', () => {
      const command = [
        "cat > notes.md <<'EOF'",
        'documentation only',
        'EOF',
        'git commit -m "docs: notes"',
      ].join('\n');
      expect(runGuard(command, repoOn('main')).decision).toBe('deny');
    });

    it('still inspects an unquoted heredoc, where substitution runs', () => {
      // `$(...)` inside an unquoted heredoc really executes, so the body of one
      // must stay visible to the guard.
      const command = ['cat > f <<EOF', '$(git push --force)', 'EOF'].join('\n');
      expect(runGuard(command, repoOn('feature')).decision).toBe('deny');
    });
  });

  describe('stays out of the way otherwise', () => {
    it.each(['git status', 'git diff --stat', 'npm run test', 'ls -la'])(
      'allows %s',
      (command) => {
        expect(runGuard(command, repoOn('main')).decision).toBe('allow');
      },
    );
  });
});
