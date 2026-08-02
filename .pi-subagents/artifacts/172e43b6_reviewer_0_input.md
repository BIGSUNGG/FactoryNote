# Task for reviewer

Focused re-audit of the FactoryNote graph-editor goal at C:/Projects/FactoryNote, after a fix round. A prior auditor DISAPPROVED with a specific defect. Verify the fix is real and the contract still holds. Tool budget ~25 calls, report within ~100 lines, end with `BLOCKERS:` (or none). Treat my claims as untrusted — verify from the repo.

PRIOR AUDITOR'S REQUIRED FIXES (verify BOTH):
1. "Stage-4 class node type mismatch": stages.ts Stage-4 designPrompt tells the agent to emit class nodes with `type:"class"`, but the viewer's node-type registry key is `cls`. Confirm this is NOW reconciled: an agent-produced node shaped exactly as designPrompt describes (`{id, type:"class", name, module, attrs, methods, parentNode}`) must render via the ClassNode component and be selectable. Trace it: read `prototypes/plan-page-mockup/src/lib/graphNormalize.js` `normalizeNode` — does it map `type:"class"` (and `data.type==="class"`) → `"cls"`? And does `GraphStage.jsx` register `cls` in NODE_TYPES_4 and check `n.type==="cls"` in onNodeClick? Quote the lines.
2. "Add a Stage-4 class-rendering self-check": confirm `prototypes/plan-page-mockup/src/lib/graphNormalize.test.js` exists and RUNS (`bun test prototypes/plan-page-mockup/src/lib/graphNormalize.test.js`) — it must assert a designPrompt-shaped class node normalizes to a registered type. Quote the passing assertion + test output.

ALSO re-confirm the 7 contract items still hold (quick):
- `bun run build` exit 0; `cd prototypes/plan-page-mockup && npm run build` exit 0.
- `bun test` (full) — count passing tests (expect 33, 0 fail).
- GraphStage.jsx still has multi-section mgmt + react-flow CRUD + gate POST graphSections; App.jsx routes 3/4→GraphStage.
- stages.ts Stage 3/4 artifactFile .json + designPrompt graph JSON.
- Docs: ADR-006, implementation-architecture graphSections, Changelog/Dev-Log graph entry (note updated test count).

ALSO sanity-check you can't find any OTHER agent-type-vs-registry mismatch (e.g., does Stage-3 agent produce any type the registry lacks? does `group` map correctly?). Report any new issue.

Verdict format: REQUIRED FIX 1: PASS/FAIL (evidence). REQUIRED FIX 2: PASS/FAIL. CONTRACT: n/7. NEW ISSUES: none/<list>. Overall: approve-ready or not.

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```