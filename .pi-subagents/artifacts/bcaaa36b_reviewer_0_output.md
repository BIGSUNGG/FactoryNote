All checks complete. Here's the decisive sweep.

## Review

### UNDEFINED-IDENTIFIER SWEEP — GraphStage.jsx
**Import line (22):** `import { gridPos, normalizeSections } from "../lib/graphNormalize";`

Usages of lib identifiers in the file (grep-confirmed):
- `normalizeSections` — line 120 (useState init) → **imported** ✓
- `gridPos` — lines 221, 234 (addNode positioning) → **imported** ✓
- `normalizeNode` — **not used** in GraphStage (internal-only in graphNormalize.js) → correctly not imported ✓
- `normalizeEdge` — **not used** in GraphStage (internal-only) → correctly not imported ✓

Import set = exactly the two used identifiers. No used-but-not-imported, no unused-import noise.

**Other-identifier skim** — all resolve:
- reactflow: `ReactFlow, Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, addEdge, Handle, Position, NodeResizer` — all used
- react: `useCallback, useEffect, useState`; `createPortal` — all used
- local components `Topbar/Stepper/GateBar` — all rendered
- handlers `addNode/deleteNode/updateNode/moveClass/...`, panels `ModuleNode/ClassNode/ModGroup/DepRows/ModulePanel/ClassPanel/EdgePanel/CommentBox`, consts `LAYERS/STAGE_DEFS/NODE_TYPES_3/NODE_TYPES_4` — all declared in-file, all referenced via props/JSX

**Sweep result: CLEAN.** No ReferenceError risk at runtime.

### CONTRACT — 7/7
| # | Check | Evidence | |
|---|-------|----------|--|
| 1 | `bun run build` exit 0 | `tsc -b` → EXIT:0 | ✓ |
| 2 | prototype `npm run build` exit 0 | vite: 285 modules, built 1.31s → EXIT:0 | ✓ |
| 3 | `bun test` 33/0 | "33 pass / 0 fail / 91 expect() / 6 files" | ✓ |
| 4 | Stage 3/4 artifactFile `.json` | stages.ts:54 `03-modules.json`, :69 `04-classes.json` | ✓ |
| 5 | designPrompt emits type:class/group | stages.ts:72 `type:\`group\`` & `type:\`class\`` | ✓ |
| 6 | graphNormalize.test.js class→cls | "Stage 4: agent class node (type:class) → registered cls + parent + data" pass | ✓ |
| 7 | Docs | ADR-006-graph-editor.md ✓; impl-arch graphSections (lines 64,132,141,146,169,200) ✓; Changelog:22 "자체체크 33건" ✓; Dev-Log:42 "33건" ✓ | ✓ |

Prior-round fixes confirmed intact: Stage-4 `class`→`cls` normalization (graphNormalize.js:18-21) + `gridPos` import present. No regression.

Git: no staged files (` M` = working-tree-only; first column empty). New source files (GraphStage.jsx, graphNormalize.js/.test.js, graph.ts/.test.ts, ADR-006) are untracked — expected for the goal deliverable.

### Verdict
- UNDEFINED-IDENTIFIER SWEEP: **clean**
- CONTRACT: **7/7**
- Overall: **APPROVE-READY yes**

BLOCKERS: none.