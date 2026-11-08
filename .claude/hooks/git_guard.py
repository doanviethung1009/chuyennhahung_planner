#!/usr/bin/env python3
"""Conservative approval gate for common dangerous Bash operations.

Vendored from the AIEOS starter kit, plus one project addition: CLAUDE.md
rule 9 says `main` only ever moves through a merged PR, so a commit or push
while HEAD is on `main` is denied outright.

Not a security sandbox or shell parser. Human approvals remain essential.
If you genuinely need a denied operation, run it yourself in a terminal.
"""
import json
import re
import subprocess
import sys

try:
    event = json.load(sys.stdin)
except (ValueError, OSError):
    sys.exit(0)
cmd = str(event.get("tool_input", {}).get("command", ""))
# Ask human for write-to-remote or destructive commands; always deny common
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
main_mutation = r"\bgit\s+(?:commit|push|merge)\b"
reason = ("AIEOS Git/production safety gate: explicit human authorization "
          "required or unsafe operation blocked.")


def on_main() -> bool:
    """True only when HEAD is demonstrably on main. Unknown state -> False."""
    # symbolic-ref works on an unborn branch too, where rev-parse --abbrev-ref
    # just echoes "HEAD"; that would let a first commit on main slip through.
    try:
        head = subprocess.run(
            ["git", "symbolic-ref", "--short", "-q", "HEAD"],
            capture_output=True, text=True, timeout=5, check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return head.returncode == 0 and head.stdout.strip() == "main"


decision = None
if any(re.search(p, cmd, flags=re.I) for p in deny):
    decision = "deny"
elif re.search(main_mutation, cmd, flags=re.I) and on_main():
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
