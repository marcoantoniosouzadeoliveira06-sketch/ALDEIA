# Codex-native workflow

## Scope classification

| Scope | Example | Required process |
| --- | --- | --- |
| Low | Copy fix or isolated safe style change | Inspect target, edit, run focused check |
| Medium | One feature or endpoint with callers | Discover relevant files, short plan, implement, verify |
| High | Auth, persistence, deployment, external integration, broad refactor | Map contracts, plan with risks and acceptance checks, integrate, review |

## Default loop

```text
Understand request → inspect relevant code → choose simplest valid approach
→ plan proportionally → implement → verify → review → concise report
```

Do not invent a formal design document for a one-line safe change. Do not skip
planning merely because a request is long or urgent.

## Context budget

- Start with `rg --files`, `rg -n`, and narrow ranges.
- Expand to another file only when the current hypothesis needs it.
- Use compact Git and check commands; request full logs only after a failure.
- Prefer one primary agent. Parallel work requires independent tasks, distinct
  files, named ownership, and an integration check after the wave.

## Session end

Record a lesson only if rediscovering it would cost meaningful time or risk.
Put the one-line pointer in `MEMORY.md`; put detail in `knowledge/`.

## Reporting

For each applicable quality gate, say `PASS`, `FAIL`, or `NOT EXECUTED`.
State blockers and unverified external configuration plainly.
