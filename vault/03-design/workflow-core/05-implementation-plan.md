---
updated: 2026-07-28
tags: [design, workflow-core, implementation-plan]
stage: 5
status: approved
---

# Workflow Core 구현 계획 (정확화)

클래스 구조([[04-class-structure]])·뷰어 포맷([[06-viewer-ui]])을 **즉시 구현 가능한 서브태스크 + 검증 게이트**로 전개한다. 각 태스크는 파일·함수 단위이고 완료 조건이 명시된다.

## 구현 결정 (변경 없음)

| 항목 | 결정 | 근거 |
| ---- | ---- | ---- |
| 언어 | Node.js `.mjs` + JSDoc | 빌드 없음, 의존 0 |
| 상태 검증 | 손검(스키마 버전) | npm 의존 0; 늘면 zod |
| 런타임 의존 | **0개** | pi-crew는 Pi 실행기(M4 호출), .mjs는 순수 Node |
| 실행 모델 | 에이전트가 SKILL.md 따라 `.mjs` CLI 호출 | Hybrid: 프로토콜 본체, 코드는 신뢰성 |

## 파일 레이아웃 (목표 — Phase 0 산출물)

```
<사용자 리포>/
  .pi/skills/factorynote/          # Protocol 레이어(커밋)
    SKILL.md                       # M2 orchestrator 프로토콜
    stages/                        # M1 (5 산출물 + Stage 6 검증)
      01-requirements.md … 05-implementation-plan.md
    templates/                     # 산출물 템플릿
      document.md  graph.json  review-matrix.md
  src/factorynote/                 # Engine+Adapter 코드(커밋)
    state.mjs                      # M3
    adapter-pi.mjs                 # M4 Tier 1
    entry.mjs                      # M5
  .factorynote/                    # 런타임(gitignore)
    state.json                     # M3 상태
```

> `adapter-inline`(Tier 0)은 `SKILL.md` 프로토콜로 흡수(코드 아님).

---

## Phase 0 — 기반 (마일스톤 M0: 스캐폴드 + 데이터)

### 0.1 리포 스캐폴드

- 디렉토리 생성: `src/factorynote/`, `.pi/skills/factorynote/{SKILL.md, stages/, templates/}`
- `.gitignore`에 `.factorynote/` 추가
- **검증**: `node -e "require('fs').existsSync('.pi/skills/factorynote/stages')"` → true; 트리 존재

### 0.2 M1 Stage Registry

- `stages/01-requirements.md` … `05-implementation-plan.md` (5개). 각 정의(JSONC in frontmatter/code block):

  ```jsonc
  { "stage": 1, "name": "요청 이해", "artifact": "requirements",
    "format": "document",            // document | graph | review (06-viewer-ui)
    "designPrompt": "...", "feedbackCriteria": ["..."], "artifactTemplate": "<ref>" }
  ```

- Stage 6은 산출물 없음 — `06-verification-gate.md`에 검증 기준(1-5 정합 체크리스트)만.
- `templates/`: `document.md`(마크다운), `graph.json`(`{nodes:[{id,type,position,data,parentNode?}], edges:[{id,source,target,data}]}` — 06-viewer-ui 계약), `review-matrix.md`.
- **검증**: 5개 stage 파일 로드 → `format` 필드 포함; graph 템플릿이 react-flow 호환 스키마.

---

## Phase 1 — Tier 0 수직 슬라이스 (마일스톤 M1: `/factorynote demo` 동작)

### 1.1 M3 `state.mjs`

함수 단위 구현 (JSDoc 타입):

- `SCHEMA_VERSION = 1` 상수
- `init(feature, { outputDir = "designs", loopCap = 3 }): State` — 신규 state 생성
- `load(): State | null` — `.factorynote/state.json` 읽기 + `validate`; 없으면 null
- `save(state): void` — **write-then-rename** atomic (`.tmp` → rename)
- `validate(state): state` — 버전·stage 범위(1-6)·artifacts 슬롯; 위반 시 throw
- `advance(state, verdict): state` — `{approve → stage+1, artifacts[N].status=approved/approvedAt; modify → loop 재진입; correct → invalidate}` + `audit` push
- `invalidate(state, from): state` — `from` 이후 artifacts `status=invalidated`, `regressions` push
- **검증(단위)**: `init→save→load` 동일; `advance(approve)` 시 `stage` 증가 + artifact approved; `invalidate(3)` 시 artifacts[3,4] invalidated, regressions 기록.

### 1.2 M2 `SKILL.md` (Tier 0 프로토콜)

- 04-class-structure 의사코드를 Tier 0 규칙으로:
  - 단일 에이전트가 **Design→Feedback 역할 인라인 전환**(pi-crew 없이).
  - `state.mjs` CLI 호출로 상태 읽기/갱신(state가 권위, NFR-2).
  - 각 Stage: `stages/<NN>` 로드 → designPrompt 수행 → feedbackCriteria 자체 검토 → 클린 시 게이트.
  - 게이트: 산출물 제시 → 승인/수정/정정 대기 → `advance`/`invalidate`.
  - 루프 상한(`loopCap`) 시 미해결 이슈와 에스컬레이션.
- **검증**: SKILL가 6단계·게이트·루프·state 호출을 명확히 지시 (에이전트가 따를 수 있는가 리뷰).

### 1.3 M5 `entry.mjs`

- `/factorynote <feature>` 진입: `load()` → 있으면 resume 메시지, 없으면 `init(feature)`.
- SKILL 트리거(Pi 명령/스킬 바인딩 — 아래 미해결).
- **검증**: `node src/factorynote/entry.mjs demo` 실행 → state 생성 또는 resume.

### 1.4 스모크 테스트

- 가짜 feature `demo`로 6단계 엔드투엔드(Tier 0). `designs/demo/01-…05-` 산출물 생성.
- **검증(게이트)**: `state.json.status = completed`; `artifacts[1-5].status = approved`; `designs/demo/` 5 파일; Stage 3·4는 `format: graph` 산출물(nodes/edges JSON) 생성 확인.

---

## Phase 2 — Tier 1 (마일스톤 M2: pi-crew 분리)

### 2.1 M4 어댑터

- `adapter-pi.mjs`: `PiCrewAdapter` — `spawn(role, task, ctx)`가 `crew_agent`/`Agent` 호출 후 결과 파싱(`AgentResult`).
- Tier 0 `InlineAdapter` = SKILL 프로토콜(코드 아님).
- `available()`: pi-crew 감지 시 true.
- **검증**: `PiCrewAdapter.available()` true일 때 `spawn("design", ...)` → artifact 반환.

### 2.2 SKILL 통합

- resume/시작 시 `PiCrewAdapter.available()` → Tier 1, else Tier 0. state에 `tier` 기록.
- **검증**: 두 티어 전환이 state 기반으로 결정.

### 2.3 격리 테스트

- 분리 Design/Feedback 에이전트로 feature 1주기.
- **검증**: 에이전트 로그에 역할 분리; Feedback이 독립 컨텍스트에서 이슈 탐지.

---

## Phase 3 — 폴리싱 (마일스톤 M3: 완성도)

| 태스크 | 내용 | 의존 |
| ---- | ---- | ---- |
| 3.1 에러 처리 | 어댑터 실패/상태 충돌 복구(NFR-6) | 2.3 |
| 3.2 상태 마이그레이션 | `version` 기반 스키마 진화(NFR-2) | 1.1 |
| 3.3 감사 로그 | 루프/게이트/회귀 이벤트 영속(NFR-3) | 1.1 |
| 3.4 회귀 루프 | 다단계 회귀 시 루프 카운트 리셋(FR-7/FR-2) | 1.2 |
| 3.5 품질 | 산출물 frontmatter/이름 Doc-Conventions 준수 | 0.2 |

---

## 검증 게이트 (Phase별 완료 조건)

- **Phase 0**: stages 5개 로드 + `format` 필드 + graph 템플릿 스키마. 트리 존재.
- **Phase 1**: `/factorynote demo` → 6단계 completed + 5 산출물(그래프 포함).
- **Phase 2**: pi-crew 분리 에이전트로 1주기.
- **Phase 3**: NFR(에러/마이그레이션/감사/회귀) 충족.

## 우선순위 원칙 (변경 없음)

1. **M1(Stage Registry) 최우선** — 가장 단순한 의존 없는 데이터.
2. **M3(state)를 M2보다 먼저** — 프로토콜은 state 위에.
3. **Tier 0 → Tier 1** — pi-crew 없이 검증 후 강화(NFR-7 우아한 축소).
4. **폴리싱은 동작 후** — 작동하는 파이프라인 먼저(ponytail: 동작 > 완전성).

## 미해결 (구현 중 결정, 로그 필수)

| 항목 | 해소 시점 |
| ---- | ---- |
| `/factorynote` 바인딩(Pi 스킬 vs 명령) | Phase 1.3 — Pi 스킬 문서(`docs/skills.md`) 확인 |
| pi-crew 어댑터 `spawn` shape(`crew_agent`/`Agent`) | Phase 2.1 — 실제 shape 확인 |
| Tier 0 SKILL 준수 보장 | **state.json 권위**(NFR-2) — 에이전트가 state로 판정; 스모크로 검증 |
| 상태 스키마 검증 도구(zod) | 스키마 성장 시 Phase 3.2에서 검토 |

## 참고

- [[01-requirements]] · [[03-module-architecture]] · [[04-class-structure]] · [[06-viewer-ui]]
- [[ADR-003-viewer-architecture]] · [[03-design/plan-viewer/ui-mapping|ui-mapping]]
- [[Home]]
