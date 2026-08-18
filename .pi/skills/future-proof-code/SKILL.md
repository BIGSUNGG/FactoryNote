---
name: future-proof-code
description: "Procedure skill for principle 2 (Build for the future). Load when implementing or refactoring code, or when deciding abstractions, module boundaries, or extension points. Defines OO modularization criteria and the 'needed scope only' restraint rule."
---

# Build for the Future — Modularization Criteria

Execution procedure for principle 2 in AGENTS.md. Object-oriented modularization for extensibility and maintainability.

## Criteria

- If a unit has more than one responsibility, split it (decision / IO / display). Each unit's name must reveal its intent.
- Logic used in two places → one place. Used in one place → do not abstract ("needed scope only").
- Create extension points **only when the second requirement arrives**. For the first requirement: simple implementation + one comment marking the change hotspot.
- Object/module boundaries follow data-flow direction — callers must not need to know internal representation.

## Check Questions

After implementing, ask yourself:

1. Can the next person state this module's responsibility in one sentence?
2. If one requirement is added, do the edits concentrate in one module?
3. Is there any code for a speculative future ("might need later")? Delete it.

## Anti-pattern

Over-application: stacking abstraction layers for "might need later" — forbidden until a second requirement exists. Future-proofing means **organizing change hotspots**, not prediction.
