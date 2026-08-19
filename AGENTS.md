# FactoryNote — Agent Orientation

## 4 Working Principles (Agent Behavior)

1. **Ask, don't guess** — Do not fill in missing decisions or unknowns by guessing. Ask the user (`ask_user_question`) and proceed with the answer. Question threshold: ask only on **major decisions** (architecture · user-visible behavior · hard-to-reverse choices); proceed on trivial implementation details and report what you decided. Procedure: [ask-before-guess](.pi/skills/ask-before-guess/SKILL.md)
2. **Build for the future** — Design for extensibility and maintainability, follow object-oriented principles, and keep code modular. But do not pre-build for speculative futures — modularize **only within the needed scope**. Procedure: [future-proof-code](.pi/skills/future-proof-code/SKILL.md)
3. **Docs first** — Every user request becomes a planning document; everything implemented gets an implementation record. Always consult related docs before starting work. Doc rules follow the [doc-workflow](.pi/skills/doc-workflow/SKILL.md) skill (decisions→ADR, changes→Changelog·Dev-Log, new docs→Home link). Procedure: [doc-first-workflow](.pi/skills/doc-first-workflow/SKILL.md)
   - **Viewer-visible changes require a test-viewer update** — when work changes anything the user sees in the plan viewer (rendering · UI · layout · sample documents), update the test viewer demo (`apps/plan-viewer/dev/mock-api.js` scenarios · `apps/plan-viewer/src/data/*.md` sample docs) in the same session so the user can verify via `cd apps/plan-viewer && bun run dev` (port 5180). A visible change the user cannot demo-verify is unfinished. Rationale: [ADR-031](vault/02-decisions/ADR-031-viewer-test-viewer-rule.md)
4. **Think critically** — Review user requests and completed implementations critically. If something looks wrong, confirm with the user whether it is acceptable as-is before wrapping up. Procedure: [critical-review](.pi/skills/critical-review/SKILL.md)

> Reminder hooks: `.pi/extensions/work-principles.ts` warns when a run changed code but no docs; `.pi/extensions/viewer-test-viewer.ts` warns when viewer code changed but the test viewer wasn't updated (both principle 3). Rationales: [ADR-028](vault/02-decisions/ADR-028-work-principles-harness-application.md) · [ADR-031](vault/02-decisions/ADR-031-viewer-test-viewer-rule.md).

## Project Overview

FactoryNote is a **human-gated plan-generation workflow package** on top of the pi harness. It writes artifacts in 3 stages; the user reviews, revises, and confirms each stage at a gate. **AI can never pass a gate — only the user can.**

- Design truth: [`vault/Home.md`](vault/Home.md) · Implementation: [`vault/01-architecture/implementation-architecture.md`](vault/01-architecture/implementation-architecture.md)
- FactoryNote pipeline's 5 principles (gate rules): `vault/00-vision/project-identity.md`, [ADR-008](vault/02-decisions/ADR-008-3-stage-pipeline.md)

## Repo Layout

```text
packages/factorynote/    # Layer 1-2 core (harness-agnostic) — engine · persistence · 3-stage Registry
apps/pi-extension/       # Layer 3 Pi adapter (main) — /factorynote · factorynote_plan · web gate
apps/plan-viewer/        # Viewer (React) — built dist served by the gate
bin/factorynote.mjs      # CLI (pure Node, state inspection)
scripts/install.mjs      # Local pi install (pure Node)
vault/                   # Docs (Obsidian) — planning · design · ADRs · architecture · guides
.pi/skills/              # Project skills (doc-workflow + 4 principle skills)
.pi/extensions/          # Project extensions (work-principles · viewer-test-viewer reminder hooks, test-gate)
```

> Workspace packages export TS sources directly. pi (jiti) · bun load TS directly → no JS build artifacts. `tsc -b` is typecheck + declarations only.

## Build / Test

- `bun run build` (= `tsc -b` typecheck + viewer build + `install.mjs` deploy → **build = deploy**) · `bun test` (self-checks). After code changes, both must exit 0.
- Pure typecheck only: `bun run typecheck`.
- **Test gate**: `.pi/extensions/test-gate.ts` runs `bun test` when an agent run settles (`agent_settled`) — on failure it injects a fix instruction (max 3 attempts, then escalates to the user), so work cannot end until tests pass. Commits are blocked by `scripts/git-hooks/pre-commit` with the same logic (enable once per clone: `git config core.hooksPath scripts/git-hooks`).

## Documentation

- Decisions → `vault/02-decisions/ADR-NNN-*.md`, changes → `vault/04-development/Changelog.md` + `Dev-Log.md`, new docs → link from `vault/Home.md`. Full rules in the `.pi/skills/doc-workflow` skill.
- plan mode (this tool): toggle with `/factorynote` in pi. When ON, only plans are produced (no code); the `factorynote_plan` tool drives the 3 stages; the web page is the gate.

## Key Documents

- [`vault/01-architecture/implementation-architecture.md`](vault/01-architecture/implementation-architecture.md) — implemented code structure · data flow
- [`vault/90-meta/usage-guide.md`](vault/90-meta/usage-guide.md) · [`vault/90-meta/development-guide.md`](vault/90-meta/development-guide.md)
- [`vault/02-decisions/ADR-005-mvp-implementation.md`](vault/02-decisions/ADR-005-mvp-implementation.md) — MVP decisions
