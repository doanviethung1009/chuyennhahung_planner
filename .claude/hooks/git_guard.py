#!/usr/bin/env python3
"""Conservative approval gate for common dangerous Bash operations.

Vendored from the AIEOS starter kit, plus one project addition: CLAUDE.md
rule 9 says `main` only ever moves through a merged PR, so a commit, push or
merge while HEAD is on `main` is denied outright.

Two things this gate is careful about, both of which it originally got wrong
(see the PR that introduced them, doanviethung1009/chuyennhahung_planner#8):

1. It asks the *command's own* directory which branch it is on. This repository
   is worked on through git worktrees, where the main checkout and the worktree
   sit on different branches, so reading the wrong directory's HEAD both blocked
   legitimate commits and silently let a real commit to `main` through.
2. It ignores quoted heredoc bodies, which are literal data the shell never
   executes. Writing documentation that mentions a git command is not running
   one.

Not a security sandbox and not a shell parser. Human approvals remain
essential. If you genuinely need a denied operation, run it yourself.
"""
from __future__ import annotations  # keeps `str | None` valid on Python < 3.10

import json
import os
import re
import subprocess
import sys

try:
    event = json.load(sys.stdin)
except (ValueError, OSError):
    sys.exit(0)

raw_command = str(event.get("tool_input", {}).get("command", ""))
# Claude Code reports the directory the command will run in. Fall back to this
# process's own directory only if it is absent.
working_dir = event.get("cwd") or os.getcwd()

# Only *quoted* heredocs (<<'TAG' / <<"TAG") are stripped. An unquoted heredoc
# body still undergoes command substitution, so `$(git push ...)` inside one
# really does run and must stay visible to the patterns below.
QUOTED_HEREDOC = re.compile(
    r"<<-?[ \t]*(['\"])(?P<tag>[A-Za-z_][A-Za-z0-9_]*)\1.*?^[ \t]*(?P=tag)[ \t]*$",
    re.S | re.M,
)


def strip_quoted_heredocs(command: str) -> str:
    """Drop quoted heredoc bodies; an unterminated one is left alone, which
    keeps the guard conservative rather than blind."""
    return QUOTED_HEREDOC.sub("", command)


def current_branch(directory: str) -> str | None:
    """The branch checked out in `directory`, or None if that cannot be told.

    `symbolic-ref` is used rather than `rev-parse --abbrev-ref`, which prints
    the literal "HEAD" on an unborn branch and would let a first commit on
    `main` through.
    """
    try:
        result = subprocess.run(
            ["git", "symbolic-ref", "--short", "-q", "HEAD"],
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None


cmd = strip_quoted_heredocs(raw_command)

# Ask a human for write-to-remote or destructive commands; always deny common
# bypass patterns. Regex is intentionally conservative, not exhaustive.
deny = [
    r"--dangerously-skip-permissions",
    r"\bgit\s+push\b[^\n]*(?:--force|-f\b)",
    r"\bgit\s+reset\s+--hard\b",
    r"\bgit\s+clean\s+-[A-Za-z]*f",
    r"\brm\s+-[A-Za-z]*r[A-Za-z]*f\b",
]
ask = [
    r"\bgit\s+(?:push|merge|rebase|commit|tag|branch\s+-[dD])\b",
    r"\b(?:kubectl\s+(?:delete|apply)|terraform\s+(?:apply|destroy))\b",
    r"\b(?:DROP\s+(?:DATABASE|TABLE)|TRUNCATE\s+TABLE)\b",
]
# Project addition: `main` is protected by convention (CLAUDE.md rule 9).
MAIN_MUTATION = r"\bgit\s+(?:commit|push|merge)\b"

reason = ("AIEOS Git/production safety gate: explicit human authorization "
          "required or unsafe operation blocked.")

decision = None
if any(re.search(p, cmd, flags=re.I) for p in deny):
    decision = "deny"
elif (re.search(MAIN_MUTATION, cmd, flags=re.I)
      and current_branch(working_dir) == "main"):
    decision = "deny"
    reason = ("CLAUDE.md rule 9: `main` only moves through a merged PR. "
              "Branch first (git switch -c <type>/<slug>), then commit. "
              "If this is genuinely intended, run the command yourself.")
elif any(re.search(p, cmd, flags=re.I) for p in ask):
    decision = "ask"

if decision:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason,
    }}))
