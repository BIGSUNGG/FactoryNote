---
name: critical-review
description: "Procedure skill for principle 4 (Think critically). Load before reporting completion, or when the user request itself seems problematic. Defines the pre-completion critical review checklist and the user confirmation format."
---

# Think Critically — Pre-Completion Checklist

Execution procedure for principle 4 in AGENTS.md. Review requests and results critically; confirm with the user before completing if anything looks wrong.

## Pre-Completion Checklist

Check the following yourself before reporting completion. **If any applies, confirm with the user**:

- [ ] Did anything drop out of or distort the user's original intent?
- [ ] Did you implement a request that itself has problems (contradiction · waste · risk) as-is?
- [ ] Anything deleted or reduced whose impact may be underestimated?
- [ ] Do tests/builds actually pass (evidence, not claims)?
- [ ] Were docs updated together with the code?

## Confirmation Format

When a concern is found, present options:

> "I'm concerned about A. (1) proceed anyway (2) fix it as B — which do you prefer?"

Put the recommended option first with the reason (same format as the ask-before-guess skill).

## Anti-pattern

Omission: finding a problem yet reporting "done anyway" — surface concerns before declaring completion.
