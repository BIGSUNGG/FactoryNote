# Task for reviewer

You are rehearsing an INDEPENDENT AUDIT of a completed code change in C:/Projects/FactoryNote. A 6-stage plan pipeline was restructured to 3 stages. Verify each of the 11 contract items below by running the ACTUAL command and quoting RAW output (paths, grep counts, test tallies, exit codes). Report PASS/FAIL per item with raw evidence. READ/RUN ONLY — do not modify source. Exception: for item 8 you may delete the gitignored viewer dist (it regenerates) to simulate a fresh clone.

Tool budget: ~25 calls. Report within ~120 lines. End with a `BLOCKERS:` section listing any item that does not pass.

CONTRACT:
1. `packages/factorynote/src/types.ts`: `StageId` is exactly `1 | 2 | 3` AND `ArtifactFormat` is exactly `"markdown" | "nodes-edges"` (no `"matrix"`). Also grep the whole codebase (packages, apps, prototypes, bin) for the literal `"matrix"` — expect 0.
2. `packages/factorynote/src/stages.ts`: `STAGES` has exactly 3 entries — Stage 1 markdown `01-understanding-and-scenarios.md`, Stage 2 nodes-edges `02-design.json`, Stage 3 markdown `03-implementation-plan.md`; all `producesArtifact: true`; no stage 4/5/6.
3. `packages/factorynote/src/engine.ts`: `done` becomes true on Stage 3 confirm; no 4/5/6 stage references. Also `persistence.ts` stage upper bound is 3.
4. `prototypes/plan-page-mockup/src/App.jsx`: graph branch is `state.stage === 2`; no `state.stage >= 6` branch.
5. `prototypes/plan-page-mockup/src/components/FinalReview.jsx` does NOT exist (ls).
6. `prototypes/plan-page-mockup/src` has ZERO matches for `total={6}`, `>= 6`, or `Stage 6`.
7. `bun run build` (tsc -b) exits 0.
8. CRITICAL — `bun test` exits 0. Simulate fresh clone: `rm -rf prototypes/plan-page-mockup/dist` then run `bun test`. The `ensure-viewer-dist.ts` preload (via bunfig.toml) should auto-build dist, then all tests pass. Quote the final tally and exit code. (Engine/gate tests updated to 3-stage model: engine.test "full pipeline 1->3 completes", gate-server.test uses 02-design.json + stage 2, plan-tool.test stage 2->3, graphNormalize.test has sectionIsClass + mixed sections.)
9. `vault/02-decisions/ADR-008-*.md` exists and describes the 3-stage merge + Stage 6 abolition.
10. `vault/01-architecture/multi-agent-pipeline.md` stage table has exactly 3 rows; `vault/00-vision/project-identity.md` has ZERO matches for "Stage 6".
11. `vault/04-development/Changelog.md` and `vault/04-development/Dev-Log.md` both contain an entry about the 6->3 stage restructuring.

Report format: per item, `[#] PASS/FAIL — <one line of raw evidence>`. Then BLOCKERS:.

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