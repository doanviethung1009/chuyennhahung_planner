# Feature — <name>

🇻🇳 Bản tiếng Việt: [_template.vi.md](_template.vi.md)

<!--
Copy this file to docs/features/<slug>.md, then copy it again to
docs/features/<slug>.vi.md and translate it in full. Keep all seven `##`
headings in both files — tests/docs.test.ts checks them — and keep the heading
structure identical between the two languages. Register the feature in
features/README.md and features/README.vi.md. Delete these comments.
-->

## Summary

What the feature is for, and who it serves, in two or three sentences. Lead with
the user-facing purpose, not the implementation.

## Routes

| Internal | Vietnamese | English |
|---|---|---|
| `/example` | `/vi-du` | `/en/example` |

Write `None` if the feature adds no route.

## Data

The content collections, types or message namespaces it reads. Name the fields
that carry real meaning, and say where a value must be real rather than
plausible (coordinates, handles, contact details).

## How it works

The mechanism: server or client, what renders where, which `lib/` helpers it
calls, what happens on the error or empty path. Enough that someone can change
it without reading every file first.

## Files

| Path | Role |
|---|---|
| `src/...` | ... |

## Tests

Which test files cover it and what they actually assert. If a behaviour is
deliberately untested, say which and why.

## Limits and open questions

What this does not do, what it costs, what would break if it grew, and anything
still waiting on the owner's real data or an approved ADR. A feature document
with nothing in this section is almost certainly incomplete.
