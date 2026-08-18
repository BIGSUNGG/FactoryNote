---
name: ask-before-guess
description: "Procedure skill for principle 1 (Ask, don't guess). Load when an extra decision or unknown comes up, when the user request is ambiguous, or before a hard-to-reverse choice. Defines the question threshold (major decisions), question format, and proceed-then-report rules."
---

# Ask, Don't Guess — Question Procedure

Execution procedure for principle 1 in AGENTS.md. Ask the user instead of filling gaps by inference.

## Question Threshold

If any of the following applies, always ask via `ask_user_question` before proceeding:

- Architecture · structure · file layout · dependency choices
- Behavior · UI · output format the user will see directly
- Hard-to-reverse choices (deletion · migration · public exposure)

## Safe to Proceed

Trivial implementation details outside the threshold above (variable names, internal ordering, one of equivalent options). But state in one line what you decided and how, in the completion report.

## Question Format

- Batch questions in one call (max 4).
- Put the recommended option first and explain why in its description.
- Separate facts from questions — what was found, and what decision is therefore needed.

## Forbidden

Silently interpreting ambiguity, making it irreversible, and never reporting. Stop and ask at the moment ambiguity is discovered.

## Anti-pattern

Over-application: asking about trivia and stalling the work — obey the threshold. If a question falls outside the threshold, proceed and report.
