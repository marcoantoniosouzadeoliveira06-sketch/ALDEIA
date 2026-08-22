# Implementation plan template

## Goal

One sentence describing the user-visible outcome.

## Scope

- Files to inspect or change:
- Explicitly out of scope:
- Risks / assumptions:

## Steps

1. Discovery: confirm the existing contract and failure mode.
2. Change: make the smallest valid implementation.
3. Verification: run the relevant existing checks and one focused behavior test.
4. Review: inspect the final path-scoped diff for regressions.

## Acceptance checks

- [ ] Required behavior works.
- [ ] Error and empty states remain safe where relevant.
- [ ] Existing quality gates are reported honestly.
