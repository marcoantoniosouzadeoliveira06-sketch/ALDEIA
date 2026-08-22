# Vibe Coding Toolkit compatibility

This matrix records the Codex-native decision made during onboarding. It is a
reference, not a dependency list.

| Tool / pattern | Purpose | Codex compatibility | Decision | Token benefit | Maintenance cost |
| --- | --- | --- | --- | --- | --- |
| Superpowers workflow | Discover, decide, plan, implement, verify | Concept is portable; plugin is Claude-specific | **B — adapt** in `AGENTS.md` and workflow template | High | Low |
| Playbook / brainstorm-to-plan | Proportional planning before edits | Directly portable | **A — adopt** | High | Low |
| Ponytail | Prefer the simplest valid solution | Directly portable | **A — adopt** as an instruction rule | Medium | Low |
| Caveman | Concise communication | Directly portable | **A — adopt** in reporting style | Low | Low |
| Subagent orchestration | Use isolated specialists and safe waves | Codex has delegation, but parallel work has a cost | **B — conservative adapt** | Medium when justified | Low |
| RTK proxy | Compress repetitive shell output | Pattern portable; original binary is not public | **B — adapt** with local helper scripts | High | Low |
| ESLint + Biome gates | Lint / formatting strategy | Concept portable, tools absent here | **D — defer**; preserve existing checks | Neutral now | High if forced |
| Claude memory system | Small index plus detailed notes | Directly portable | **A — adopt** as `docs/ai` | High | Low |
| Obsidian memory | External long-term knowledge vault | No connected vault requirement | **D — skip** | Low | Medium |
| Context7 | Version-current library docs through MCP | Useful concept; no Context7 tool is connected | **B — use official docs/web until connected** | Medium | Low |
| Graphify | Persistent relationship graph | Project size and vanilla structure do not justify it | **D — skip** | Low | Medium |
| Claude hooks | Automatic terminal/session interception | No equivalent project hook contract is configured for Codex | **C — skip** | Low | High |
| Agent browser / Chrome DevTools | UI inspection and diagnostics | Codex already exposes browser-capable tools | **A — use existing capability when needed** | Medium | Low |

## Active operating model

1. Start from the project map and small memory index.
2. Locate symbols and read the smallest relevant surface.
3. For nontrivial work, state a short plan and choose the simplest valid path.
4. Implement only the scoped files, then run the existing relevant checks.
5. Save only durable lessons; do not turn every conversation into memory.
