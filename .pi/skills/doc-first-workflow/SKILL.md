---
name: doc-first-workflow
description: "Procedure skill for principle 3 (Docs first). Load before starting work to consult related docs, during/after implementation to check doc updates, or when the docs-first reminder hook notification appears. Defines the docs-first checklist, doc-workflow skill coordination, and hook notification response."
---

# Docs First — Before & Along Checks

Execution procedure for principle 3 in AGENTS.md. Requests become planning docs; implementations become implementation records.

## Before Starting Work

1. Find related docs via `vault/Home.md` (ADRs · designs · problem records).
2. If past decisions (ADRs) conflict with this work, do not proceed silently — report to the user.
3. Review the trigger table in the doc-workflow skill.

## During / After Work

Update ADR · Changelog · Dev-Log · Home links in the same session, per the doc-workflow procedure.

## Responding to the Reminder Hook

`.pi/extensions/work-principles.ts` notifies when a run changed code but no docs. On notification:

1. Check whether the change actually required doc updates (ignore for trivial cases like a one-line comment fix).
2. If needed, immediately fill the missing docs (Changelog · Dev-Log · related ADR · Home link).
3. If the doc-path classification was wrong (false positive), adjust `DOC_PATTERNS` in the extension.

## Anti-pattern

Formalism: creating doc titles without filling the content — an empty record is the same as none.
