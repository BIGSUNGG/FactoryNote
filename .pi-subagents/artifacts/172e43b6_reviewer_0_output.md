All docs verified: ADR-006 exists, implementation-architecture.md has graphSections content (lines 62-65, 132-146), Changelog.md line 22 documents the editor with "자체체크 33건", Dev-Log.md line 43 documents the exact fix round ("수리(감사 지적): type:"class"→cls"). 

I now have everything. Let me compile the review.

## Review

### REQUIRED FIX 1 — PASS (class-node type reconciliation)
Trace verified end-to-end. A designPrompt-shaped node `{id, type:"class", name, module, attrs, methods, parentNode}` renders via ClassNode and is selectable:
- **`stages.ts` Stage-4 designPrompt** still tells the agent to emit `type:"class"` (and group as `type:"group"`): `클래스({id,type:`class`,name,module,attrs:[],methods:[],parentNode})`. ✓
- **`graphNormalize.js` `normalizeNode`** maps the agent type to the registry key — `graphNormalize.js:21-23`: `if (type === "group" || data.type === "group") type = "modGroup"; else if (type === "class" || data.type === "class" || !type) type = "cls";`. ✓
- **`GraphStage.jsx`** registers `cls`: `const NODE_TYPES_4 = { modGroup: ModGroup, cls: ClassNode };` and selects only class nodes on click: `onNodeClick={(_, n) => { if (isClass ? n.type === "cls" : true) setSelected(...) }}`. ✓

### REQUIRED FIX 2 — PASS (Stage-4 self-check exists and runs)
- `prototypes/plan-page-mockup/src/lib/graphNormalize.test.js` exists. Key assertion: `expect(n.type).toBe("cls"); expect(NODE_TYPES_4.has(n.type)).toBe(true);` for a designPrompt-shaped class node.
- Runs green: `bun test` → **33 pass / 0 fail**. Test output includes `(pass) Stage 4: agent class node (type:class) → registered cls + parent + data`. ✓

### CONTRACT — 6/7 (item 3 compromised by new bug)
1. `bun run build` exit 0 ✓  2. mockup `npm run build` exit 0 ✓  3. `bun test` 33/0 ✓  4. GraphStage multi-section mgmt + gate POST graphSections + App routes 3/4 → ✓  5. stages.ts Stage 3/4 `.json` artifactFile + graph designPrompt ✓  6. ADR-006 + impl-arch graphSections + Changelog/Dev-Log (updated count 33) ✓  7. **react-flow CRUD present but BROKEN** — see NEW ISSUES.

### NEW ISSUES — 1 (Blocker)
**`gridPos` used but not imported in `GraphStage.jsx` → runtime ReferenceError in `addNode`.** The import is only `import { normalizeSections } from "../lib/graphNormalize"` (line 37), yet `addNode` calls `gridPos(s.nodes.length)` at **lines 221 and 234**. `gridPos` IS exported from `graphNormalize.js:8` but never imported into the component. Result: clicking "＋ 모듈 추가" (Stage 3) throws `ReferenceError: gridPos is not defined` on every call; adding a class in Stage 4 also crashes when no group exists. The build (tsc/vite) does not catch this because the bare identifier is only resolved at call-time in the browser. This breaks the "react-flow CRUD" portion of contract item 3. One-line fix: `import { normalizeSections, gridPos } from "../lib/graphNormalize";`.

Other type checks clean: Stage-3 agent emits layer-only nodes → inferred to `module`/`external` (both in `NODE_TYPES_3`); `group`→`modGroup`, `class`→`cls` (both in `NODE_TYPES_4`). No further agent-type-vs-registry mismatch found.

**No staged files** (`git diff --cached` empty). `GraphStage.jsx` is untracked (new in this change set), so this bug belongs to the current work.

### Verdict
REQUIRED FIX 1: **PASS**. REQUIRED FIX 2: **PASS**. CONTRACT: **6/7**. NEW ISSUES: gridPos missing import (blocker). Overall: **NOT approve-ready** — the two requested fixes are correctly and cleanly implemented, but a new runtime crash in `addNode` blocks the CRUD contract. Trivial one-line fix; recommend fixing then re-running `npm run build` (a click-through smoke of "add module" would also catch it).

BLOCKERS: GraphStage.jsx lines 221/234 — `gridPos` referenced but not imported; `addNode` (Stage-3 add module, Stage-4 add class w/o group) throws ReferenceError. Fix: add `gridPos` to the `graphNormalize` import.