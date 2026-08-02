# Task for reviewer

Independently REHEARSE a 7-item verification contract for the FactoryNote "Stage 3/4 graph editor" goal in the repo at C:/Projects/FactoryNote. You are a fresh-context auditor. For EACH item below, run the exact check and report PASS or FAIL with quoted raw evidence (command output / grep match / file excerpt). Be skeptical — do not take my word; verify from the repo.

Tool budget: ~30-40 calls. Report within ~120 lines. If you near your token limit, STOP and report what you have (partial > dead). End with a `BLOCKERS:` section (or `BLOCKERS: none`).

ITEMS:

1. `bun run build` exits 0 AND `cd prototypes/plan-page-mockup && npm run build` exits 0. (Run both, quote exit codes / tail.)

2. Graph-flow tests pass: run `bun test apps/pi-extension` (and `bun test packages/factorynote`). Look for a test that (a) GET /api/state returns graphSections for a graph artifact, and (b) a drivePlan test where submitting a graph + POSTing `{verdict:"confirm", graphSections:[...]}` saves the graph to `.factorynote/<feature>/03-modules.json` and advances the stage. Quote the passing test names.

3. grep `apps/pi-extension/src` for: `/api/state` response building includes `graphSections`; `/api/decision` parses `graphSections`; and `drivePlan` writes `graphSections` to a `.json` artifact. Quote the matching lines+files.

4. grep `prototypes/plan-page-mockup/src` for: multi-section management (section add/rename/delete handlers), react-flow node/edge CRUD (right-click context menu + onConnect), Stage 3/4 rendering a graph editor while 1/2/5/6 use PlanPage (check App.jsx routing), and the gate POST including `graphSections`. Quote matches.

5. Full regression: `bun test` — all pass, count the passing tests (expect ~26, 0 fail).

6. Read `packages/factorynote/src/stages.ts`: confirm Stage 3 `artifactFile` is `03-modules.json` and Stage 4 is `04-classes.json`, and each `designPrompt` instructs multi-section graph JSON generation. Quote the artifactFile + a snippet of designPrompt.

7. Docs: `vault/02-decisions/ADR-006-graph-editor.md` exists; `vault/01-architecture/implementation-architecture.md` mentions `graphSections`; `vault/04-development/Changelog.md` and `Dev-Log.md` have a graph-editor entry. Quote a line from each.

Report format: per item `ITEM N: PASS/FAIL — <evidence>`. Then overall verdict (all 7 pass = contract satisfied). BLOCKERS section at end.

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