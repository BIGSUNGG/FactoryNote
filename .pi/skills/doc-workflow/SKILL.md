---
name: doc-workflow
description: "FactoryNote documentation workflow. Load when writing/updating planning · design · decision (ADR) · Changelog · Dev-Log · problem · research notes in vault/, when a decision is made, when code/features are implemented or changed, or when hitting a problem/blocker. Enforces the vault/ 7-area structure, ADR writing, Changelog/Dev-Log updates, doc conventions (kebab-case file names, wikilinks, tags, freshness), and the 'docs are always current with code' principle."
---

# FactoryNote Documentation Workflow

This skill is the project rule that keeps the repo's documentation always current and aggressively records decisions, changes, and problems.

## Core Principles

1. **Docs are updated in the same change as code.** Stale docs are bugs.
2. **When in doubt, record.** Decisions → ADR, changes → Changelog, problems → 05-problems.
3. **The source of truth is `vault/`** (the hand-written vault). `graphify-out/` is a regenerated artifact — never edit it.

## Vault Structure (absolute path basis)

```text
vault/
├─ Home.md                  ← MOC. New docs get linked here.
├─ 00-vision/               ← identity · goals · 5 principles · glossary
├─ 01-architecture/         ← pipeline · agent roles · implementation architecture
├─ 02-decisions/            ← ADR-NNN-kebab-title.md (settled matters)
├─ 03-design/<feature>/     ← per-feature design artifacts (workflow stage outputs)
├─ 04-development/          ← Changelog.md + Dev-Log.md (changes)
├─ 05-problems/             ← issues · blockers · postmortems
├─ 06-research/             ← research notes
└─ 90-meta/                 ← Doc-Conventions.md, How-To-Update-Docs.md, templates/
```

## Trigger → Action

Check the following before starting or finishing work.

| Situation | Action |
| ------ | ------ |
| Architecture · tool · convention decision | Write `02-decisions/ADR-NNN-*.md` (use `90-meta/templates/adr.md`). If changing an existing decision, mark the old ADR `superseded` and link to the new one. |
| Code/feature implementation or change | Update `04-development/Changelog.md` (Added/Changed/Fixed/Removed) and `Dev-Log.md` (entry for today's date) in the same session. |
| Bug · blocker · unexpected problem | Write `05-problems/<short-name>.md` (symptom/cause/action/impact/lesson). Mark status when resolved. |
| Research on external tools · libraries · approaches | Write `06-research/<topic>.md` (summary + evidence + conclusion). |
| Feature design artifact | `03-design/<feature>/<artifact>.md` (requirements/scenarios/module-architecture/...). |
| Vision · principle · terminology definition | Add docs under `00-vision/`, `01-architecture/`. |

## Conventions (summary)

- File names: `Kebab-Case.md`, no spaces. ADRs: `ADR-NNN-kebab-title.md`.
- Every doc starts with an H1 title.
- frontmatter (optional, recommended): `updated: YYYY-MM-DD`, `tags: [area, topic]`. ADRs require `status`.
- Relationships use Obsidian wikilinks `[[Kebab-Name]]`. New docs link from [[Home]] or their area.
- Body text in Korean; identifiers/paths kept in English. (User-facing vault docs stay Korean; AI-facing harness artifacts — AGENTS.md, skills, hook sources — are English.)
- If you touched a doc, set `updated` to today.
- Full rules: `vault/90-meta/Doc-Conventions.md`, `vault/90-meta/How-To-Update-Docs.md`.

## Procedure (every change)

1. **Impact scan**: which docs does this change affect? (If a graphify graph exists, check scope with `graphify query`/`explain`.)
2. **Record**: update or create docs per the trigger table above.
3. **Link**: connect new docs from [[Home]] or related docs.
4. **Freshness**: set `updated` to today on every doc you updated.
5. **Verify**: before PR/commit, ask "which docs were affected?" and fill any missing records.

## Graphify Integration

- `/graphify . --obsidian` graphs the repo (including vault). Output goes to `graphify-out/` (gitignored).
- Never mix the hand-written vault with graphify output.
- Details: `vault/06-research/graphify.md`.

## Anti-patterns to Avoid

- Leaving decisions only in chat/code comments without an ADR.
- Changing code without updating Changelog/Dev-Log.
- Doc titles with spaces or mixed case (`User Auth.md` ❌ → `user-auth.md` ✅).
- Manually editing or committing `graphify-out/`.
- Creating a new doc without linking it from [[Home]] (orphan doc).
