---
updated: 2026-07-28
tags: [design, workflow-core, class-structure]
stage: 4
status: approved
---

# Workflow Core 클래스 수준 구조

모듈([[03-module-architecture]])을 파일·인터페이스·스키마 수준으로 정의한다.
표기는 TypeScript 양식(가독성)이나 **런타임은 Node.js `.mjs` 스크립트(빌드 단계 없음, 의존성 최소)**.

> Hybrid 원칙 재확인: **프로토콜(M1·M2)은 마크다운, 코드(M3 상태·M4 Tier1·M5)는 얇은 `.mjs`**.
> 언어 결정(TS vs JS+JSDoc vs 순수 JS)은 Stage 5 구현계획에서 확정; 여기선 구조만.

## M3. State Schema — `.factorynote/state.json`

가장 구체적이고 권위 있는 산물(NFR-2: 상태가 게이트 판정의 권위).

```jsonc
{
  "version": 1,                       // 스키마 버전(진화 대비)
  "feature": "auth",
  "outputDir": "designs",     // 산출물 디렉터리(설정 가능, 기본 designs/)
  "status": "running",                // running | completed | aborted
  "stage": 3,                         // 현재 단계 1-6
  "loopCount": 2,                     // 현재 단계 Design↔Feedback 반복수
  "loopCap": 3,                       // 사용자 조정 가능(FR-2)
  "artifacts": {  // 단계 1-5 산출물 (Stage 6은 검증 게이트, 슬롯 없음)
    "1": { "path": "designs/auth/01-requirements.md",
           "status": "approved", "approvedAt": "2026-07-28" },
    "2": { "path": ".../02-scenarios.md", "status": "approved", "approvedAt": "..." },
    "3": { "path": ".../03-module-architecture.md", "status": "draft", "approvedAt": null }
  },
  "regressions": [                    // 회귀 이력(FR-7)
    { "from": 4, "to": 2, "reason": "...", "at": "...", "invalidated": [3, 4] }
  ],
  "audit": [                          // 감사 로그(NFR-3)
    { "at": "...", "stage": 1, "event": "gate_approved" },
    { "at": "...", "stage": 3, "event": "loop_feedback", "issues": 2 }
  ],
  "updatedAt": "2026-07-28T12:00:00Z"
}
```

**연산(얇은 코드 `state.mjs`):**

```ts
load(): State                  // 읽기 + 스키마 검증(손상 시 에스컬레이션, NFR-2)
save(state): void              // write-then-rename 으로 atomic 쓰기
advance(stage, verdict): void  // 단계 진행/게이트 판정 기록 → audit 추가
invalidate(from): void         // 회귀 시 하류 artifacts status=invalidated
```

> `tier`는 **영속하지 않는다** — resume 시 런타임 감지(pi-crew 가용성)로 재결정. 영속하면 환경 변화에 부실해짐.

## M4. AgentSpawn 인터페이스

```ts
type Role = "design" | "feedback";
interface StageContext { feature: string; stage: number; priorArtifacts: string[]; }

type AgentResult =
  | { kind: "artifact"; content: string }                 // Design 산출물
  | { kind: "verdict"; clean: boolean; issues: Issue[] }; // Feedback 판정

interface Issue { severity: "security" | "bottleneck" | "structure"; detail: string; }

interface AgentSpawn {
  spawn(role: Role, task: string, ctx: StageContext): Promise<AgentResult>;
  available(): boolean;   // 이 어댑터가 현재 환경에서 쓸 수 있는가
}
```

**구현체 2종:**

| 구현 | tier | 동작 | 파일 |
| ---- | ---- | ---- | ---- |
| `InlineAdapter` | 0 | `spawn` = Orchestrator가 역할 컨텍스트 전환(별도 프로세스 아님). `available()` 항상 true. | 규칙(SKILL.md 내) |
| `PiCrewAdapter` | 1 | `spawn` = pi-crew/Agent 로 서브에이전트 스폰·결과 수집. `available()` = pi-crew 감지 시 true. | `adapter-pi.mjs` |

> **선택 규칙**: resume/시작 시 `PiCrewAdapter.available()` → true면 Tier 1, else `InlineAdapter`(Tier 0). NFR-7 우아한 축소.

## Artifact Schema — 단계 산출물 계약

각 산출물은 마크다운 + frontmatter. **상태 권위는 `state.json`**(NFR-2); frontmatter `status`는 파생 미러.

```yaml
---
updated: 2026-07-28
tags: [design, <feature>, <stage-topic>]
stage: <N>                       # 1-6
status: draft | approved | invalidated
---
```

본문 = M1 템플릿에 따른 단계 내용(요구사항 명세 / 시나리오 / ... ).

## M1. Stage Definition 포맷 — `stages/<NN>-<name>.md`

```jsonc
{
  "stage": 1,
  "name": "요청 이해",
  "artifact": "requirements",
  "designPrompt": "Design 에이전트가 생산할 것(요구사항 명세)...",
  "feedbackCriteria": [
    "요구사항이 측정 가능한가",
    "범위 경계·제약·가정이 명시되었는가",
    "보안/신뢰성 누락 없는가"
  ],
  "artifactTemplate": "<frontmatter + 절 골격>"
}
```

5개 산출물 파일(`01-requirements` … `05-implementation-plan`) + Stage 6 검증 게이트(산출물 파일 없음). 읽기 전용 데이터(M1).

## M2. Orchestrator 프로토콜 구조 — `SKILL.md`

에이전트가 따르는 규칙 문서(= M2 "코드"). 의사코드 형태:

```
load(state) or init(feature)
for stage in 1..6:
  loop:
    artifact = spawn("design", stage.designPrompt, ctx)
    verdict  = spawn("feedback", artifact, stage.feedbackCriteria, ctx)
    if verdict.clean: break
    state.loopCount++; record audit
    if state.loopCount >= state.loopCap: break(미클린→게이트 에스컬레이션, 이슈 목록 포함)
  present(artifact, verdict) → 사용자 게이트
  verdict = await humanGate()        // approve | modify | correct
  match verdict:
    approve  → state.advance; save artifact(approved)
    modify   → (재디자인 또는 사용자 편집) → 다시 게이트
    correct  → state.invalidate(stage); regress to target stage
state.status = completed
```

> 게이트 판정·루프 카운트는 모두 `state.json`에 기록되어 **상태 파일이 권위**(NFR-2). 에이전트가 재시작해도 state에서 복원.

## 파일/패키지 레이아웃

```
<사용자 리포>/
  .pi/skills/factorynote/          # Protocol 계층 (커밋됨)
    SKILL.md                       # M2 orchestrator 규칙
    stages/                        # M1 (5 산출물 단계 + Stage 6 검증 게이트)
      01-requirements.md … 05-implementation-plan.md
    templates/                     # 산출물 템플릿
  src/factorynote/                 # Engine+Adapter 코드 (커밋됨)
    state.mjs                      # M3 (atomic r/w + 검증 + 무효화)
    adapter-pi.mjs                 # M4 Tier 1 (PiCrewAdapter)
    adapter-inline.md              # M4 Tier 0 (규칙 — InlineAdapter는 코드 아님)
    entry.mjs                      # M5 (/factorynote 핸들러)
  .factorynote/                    # 런타임 (gitignore)
    state.json                     # M3 상태(권위)
```

> 코드는 패키지 일부로 **커밋**. `.factorynote/state.json`만 런타임(gitignore). Claude/Codex 바인딩(`.claude/commands/`, 등)은 Adapter 계층 확장으로 Stage 5 이후.

## 모듈 → 파일 매핑

| 모듈 | 계층 | 파일 | 형태 |
| ----------------- | -------- | ------------------------------------------------------- | -------- |
| M1 Stage Registry | Protocol | `.pi/skills/factorynote/stages/*.md` | 마크다운 |
| M2 Orchestrator | Protocol | `.pi/skills/factorynote/SKILL.md` | 마크다운 규칙 |
| M3 Persistence | Engine | `src/factorynote/state.mjs` + `.factorynote/state.json` | 코드 + 데이터 |
| M4 Agent Adapter | Adapter | `adapter-pi.mjs`(Tier1) + `SKILL.md` 규칙(Tier0) | 코드 + 규칙 |
| M5 Command Entry | Adapter | `src/factorynote/entry.mjs` | 코드 |

## Feedback 패스 결과 (Design↔Feedback 루프)

- **부실 상태**: 초안에 `tier`를 state에 저장 → 환경 변화(pi-crew 설치/제거)에 부실 → **영속 제거, 런тime 감지**로 변경(NFR-7 정합).
- **이중 권위**: artifact frontmatter `status`와 `state.json.artifacts[N].status`가 충돌 가능 → **`state.json`이 권위, frontmatter는 파생 미러**로 명확화(NFR-2).
- **과잉**: Issue/AgentResult를 별도 타입 파일로 → 인라인 정의로 축소(ponytail).
- **누락**: `AgentSpawn.available()` 없었음 → Tier 선택(0 vs 1)을 결정적이게 만드는 판별 함수 추가.
- **검증 범위**: state.mjs `load()`가 스키마 검증만 하고 복구는 안 했던 초안 → "검증 실패 시 에스컬레이션(사용자 알림)" 명시(NFR-2 장애 처리와 정합).
- **구조(게이트에서 포착, vault 결합 오류)**: M3 산출물 경로가 `vault/03-design/`에 결합 → FactoryNote 자체 vault(프로젝트 문서)와 기능 산출물을 혼동 → **설정 가능 `outputDir`(기본 `designs/`)** 도입, state 스키마에 `outputDir` 필드 추가. 4개 문서(01-04)의 vault 참조 전면 제거. (FR-4 사후 정정: 산출물은 vault 아님.)
