# Codex workflow for ALDEIA

## Start small

- At session start, read this file, `aldeia-site-oficial/docs/ai/PROJECT_MAP.md`,
  `aldeia-site-oficial/docs/ai/MEMORY.md`, and only files directly relevant to
  the request.
- For UI work, also follow `aldeia-site-oficial/.agents/AGENTS.md` and the
  applicable local skill instructions.
- Search filenames and symbols first. Read targeted ranges before opening a
  large file or expanding the scope.

## Work proportionally

- Trivial, isolated, low-risk fixes may be implemented directly.
- For behaviour changes, multi-file work, security, data, integrations, or
  deployment: discover, state a concise plan, implement the smallest valid
  change, verify, review, and report.
- Prefer existing platform features, dependencies, and project patterns. Add a
  dependency or abstraction only when the current stack cannot solve it simply.

## Context and output

- Prefer `rg`, targeted file ranges, `git status --short`, `git diff --stat`,
  and path-scoped diffs. Do not load entire repositories or long logs without a
  concrete reason.
- Use `npm run ai:status`, `npm run ai:diff`, and `npm run ai:check` when they
  fit the task. Do not hide meaningful failures.

## Safety and quality

- Preserve unrelated dirty-worktree changes. Never delete, move, deploy, push,
  or rotate credentials unless the user has authorized that exact action.
- Never put secrets, tokens, personal data, or runtime JSON data in project
  memory or reports.
- Run the relevant existing quality gate before claiming success and report
  `PASS`, `FAIL`, or `NOT EXECUTED` honestly.

## Agents and memory

- Default to one primary agent. Use subagents only for independent, non-
  overlapping work with clear file ownership or an independently valuable
  review.
- Persist only durable, expensive-to-rediscover facts in
  `aldeia-site-oficial/docs/ai/MEMORY.md`; put detail in `docs/ai/knowledge/`.
