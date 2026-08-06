# Agent Instructions

This repository is a minimal Node.js test environment.

- Use `npm` for project scripts and dependency management.
- Keep changes scoped to this repository.
- Do not commit generated dependencies such as `node_modules/` or secrets.
- Before handoff, inspect `git diff --check` and run relevant npm scripts when available.

## Agent skills

### Domain memory

`CONTEXT.md` is the shared-context entry point. Read it first, then follow its
`Scoped Contexts` table when relevant. When the project evolves, update only
evidence-backed shared purpose, vocabulary, durable project rules, boundaries,
known state, explicit unknowns, scope routing, and topic/ADR indexes; route
conditional detail to indexed `project-context/` topics and accepted
load-bearing decisions to indexed ADRs. Keep always-active agent rules in
`AGENTS.md`; exclude tentative plans, secrets, and raw logs.
