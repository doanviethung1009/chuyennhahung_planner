---
name: release-check
description: Read-only release checklist for QC/security, migration rollback, deployment dependencies and approval. User-invoked only.
disable-model-invocation: true
---

Check release candidate: $ARGUMENTS

Gather evidence — do not assert anything you have not checked:

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` — each as
  PASS / FAIL / NOT RUN with its real output.
- `qc` verdict and `security` verdict, with any BLOCKED item still open.
- VI/EN parity: both catalogues in sync, no untranslated user-visible string.
- Documentation contract: every document has its Vietnamese twin with a mirrored
  heading structure and is registered in its index; any shipped feature has its
  feature document (CLAUDE.md rules 10–12).
- Tour redirects still resolving: `/tour`, `/tours`, `/tour/:slug`, `/tours/:slug`,
  in both locales (CLAUDE.md rule 2).
- Accessibility spot-check on changed pages; screenshots at 375px, 768px, 1280px
  for visible UI change.
- Migrations: present, reversible, with a stated rollback. Secrets: none in the diff.
- Breaking changes, monitoring, ownership, and PR approval state.

Produce **GO** or **NO-GO**, listing the evidence that is missing rather than
assuming it passed.

Do not deploy, merge, push or run any irreversible command. Release actions require
explicit human authorization.
