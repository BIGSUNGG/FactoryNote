---
updated: 2026-08-18
tags: [meta, usage, manual, how-to]
---

# 사용 가이드 — FactoryNote 설치·실행·게이트 UX

FactoryNote MVP를 pi 하네스에서 **설치하고 직접 사용하는 방법**을 다룬다.
아키텍처/코드는 [[implementation-architecture]], 기획은 [[multi-agent-pipeline]] 을 본다.

> **TL;DR**: `bun scripts/install.mjs` 설치 후 pi에서 `/factorynote`로 plan 모드를 켜고, 기능 요청 → 디렉터가 스테이지를 구성해 단계별 산출물 작성 → 웹 게이트에서 검토·확정하는 흐름을 안내한다. 전제 조건(pi-subagents 확장)과 트러블슈팅 포함.

## 전제 조건

- **pi**(`@earendil-works/pi-coding-agent`)가 전역 설치되어 있고 대화형 세션이 가능할 것.
- **pi-subagents 확장** — Director 가 Design/Feedback 자식 에이전트를 스폰하는 `subagent` 도구와 에이전트 발견을 제공. **pi 에 번들되지 않으므로 별도 설치 필요** — 없으면 자식 스폰 불가(“Unknown agent”/도구 부재)로 FactoryNote 흐름이 동작하지 않는다.
- **Node.js**(확장 런타임) — pi 와 함께 이미 설치됨.
- (개발/수정 시) **Bun** — 빌드/테스트용.

## 설치

리포 루트에서:

```bash
bun scripts/install.mjs
```

이 스크립트는(순수 Node — Windows/macOS/Linux 공통, bash/WSL 의존 없음):

1. 뷰어가 빌드되어 있지 않으면 `apps/plan-viewer` 에서 `bun run build`.
2. 확장을 `~/.pi/agent/extensions/factorynote/` 에 배치(확장 TS + `@factorynote/core` 로컬 패키지 + 뷰어 `dist/`).
3. **에이전트를 사용자 스코프 `~/.pi/agent/agents/` 에 배포**(Design + 전문 Feedback 32개) — pi-subagents 가 발견하는 파일시스템 위치. stale `factorynote-*.md` 정리 후 복사(타 에이전트는 보존).

> 설치 후 **새 pi 세션**에서 pi 가 확장을 자동 발견한다.(`/reload` 불필요 — 새 세션 시작 시 로드)

설치 확인:

```bash
ls ~/.pi/agent/extensions/factorynote/index.json   # index.ts 가 있어야 함
```

> 참고: `pi list` 는 `settings.json` 의 패키지만 표시한다. FactoryNote 는 **자동 발견** 확장이므로 `pi list` 에는 나타나지 않는다(정상).

## 기본 사용 흐름

### 1. plan 모드 켜기

pi 대화형 세션에서:

```
/factorynote
```

→ 설정 대시보드(메뉴)가 열린다. feedback·design·stage·auto 설정을 조정한 뒤 `confirm — 현재 설정으로 plan 모드 ON` 을 고르면 모드가 켜지고, 이후 매 턴 계획 전용 프롬프트가 주입된다.
(서브커맨드 없음 — 모든 설정과 plan 모드 on/off 는 메뉴에서만. 끄려면 `/factorynote` 재입력 후 `off — plan 모드 OFF` 항목 선택)

> **auto-advance(개발/데모용 탈출구)**: `/factorynote` → `auto — 게이트 자동 승인` 메뉴 항목으로 켜고 끈다(선택마다 토글). ON 이면 각 단계를 사용자 클릭 없이 자동 통과하되, **게이트 브라우저는 열어 진행을 관찰**할 수 있다(이상하면 에이전트 중단으로 개입). 5대 원칙을 의도적 우회하는 탈출구이므로 **프로덕션 계획에는 비권장**. 파이프라인 완료 시 자동 해제.

> **Feedback 수준(검토 강도)**: `/factorynote` → `feedback` 메뉴 항목으로 내부 Design↔Feedback 루프의 검토 에이전트 수를 조절한다(세션 유지, 기본 `medium`). none = Feedback 없이 게이트 직행 · low = 1개(1~3 영역 담당) · medium = 2~3개 · high = 4~6개 · ultra = 9개([[ADR-017-feedback-levels]]). 병렬 스폰이 라우터 호출 수 제한으로 실패하면 3~4개씩 순차 배치로 분할 재시도한다. 수준과 무관하게 게이트 승인은 항상 사용자 몫이다.

> **Design 위성 수준**: `/factorynote` → `design` 메뉴 항목으로 Design 단계 산출물을 병렬 작성하는 에이전트 수(주 문서 + 위성)를 선택한다(세션 유지, 기본 `low` = 주 문서만). low = 주 문서만 · medium = 주 + 위성 1 · high = 주 + 위성 2([[ADR-031-parallel-design-satellites]]). `factorynote_plan` 도구의 `designLevel` 파라미터가 메뉴 설정보다 우선한다.

> **최대 스테이지 개수 제한**: `/factorynote` → `stage` 메뉴 항목으로 파이프라인의 최대 스테이지 개수 상한을 설정한다(세션 유지, `무제한` 선택으로 해제). 디렉터가 구성을 상한 초과로 제출하면 앞에서부터 잘라서 적용된다([[ADR-031-dynamic-stage-composition]]). `factorynote_plan` 도구의 `maxStages` 파라미터가 메뉴 설정보다 우선한다.

### 2. 기능 요청하기

plan 모드에서 자연어로 요청:

```
사용자 로그인 기능을 계획해줘
```

에이전트는 코드를 쓰지 **않고** `factorynote_plan` 도구를 호출해 파이프라인을 구동한다. 첫 호출에서 디렉터가 요청의 복잡도에 맞춰 스테이지 구성(종류·개수·순서)을 결정한다 — 카탈로그: 요청 이해(`understanding`) · 모듈·클래스 설계(`design`) · 구현 계획(`implementation`) · 리스크 분석(`risk-analysis`) · 테스트 전략(`test-strategy`) · 비기능 검증(`nfr`) ([[ADR-031-dynamic-stage-composition]]).

### 3. 산출물 작성 → 게이트(웹 페이지) 오픈

에이전트가 첫 단계 산출물을 마크다운으로 작성·제출하면 **브라우저가 자동으로 열린다**:
`http://127.0.0.1:<임의포트>`

> 브라우저가 안 열리면, pi 가 출력한 URL 을 직접 복사해 브라우저에 붙여넣는다.

### 4. 게이트에서 검토·결정

웹 페이지 하단 **게이트 바**에서 세 가지 행동:

| 버튼 | 의미 | 결과 |
| ---- | ---- | ---- |
| **✓ 확정** | 산출물 승인 | 다음 Stage 로 진행(에이전트가 다음 산출물 작성) |
| **✎ 수정 지시 (N)** | 코멘트로 수정 요청 | 현 Stage 산출물 재작성(코멘트가 에이전트에 전달) |
| **← 정정** | 방향이 틀렸으면 이전 단계로 | 이전 Stage 로 회귀 |

**코멘트 남기기**(수정 지시 전용):

- 블록 hover → 좌클릭 → 팝오버에 입력(블록 단위)
- 텍스트 드래그 → 영역 팝오버(인용 포함)
- 표 셀 클릭 → 셀 단위

코멘트는 pending 큐에 쌓이고, **✎ 수정 지시** 클릭 시 한 번에 에이전트로 전송된다.
(직접 편집은 불가 — 5대 원칙 "승인 전 반영 금지"의 UI 강제, [[project-identity]])

### 5. 파이프라인 완료

구성된 각 단계의 산출물 작성 + 게이트 통과 → **마지막 단계 게이트 확정이 곧 완료**.
승인된 3개 산출물이 `.factorynote/<feature>/` 아래 단계별 폴더에 누적된다.

## 산출물 · 상태 위치

모든 런타임 산출물은 프로젝트 루트 `.factorynote/` (gitignore 됨):

```
.factorynote/
└── <feature>/
    ├── state.json              # 파이프라인 상태(단계·게이트·이력) — 권위
    ├── design-prompt.md        # 현 단계 Design 작성 지시(보조)
    ├── feedback-menu.md        # 현 단계 Feedback 메뉴(보조)
    ├── draft.md                # 현 단계 초안(게이트 교환 파일)
    ├── <그래프 이름>.json       # 초안 동반 그래프 루트(에이전트 자유 네이밍·여러 개 허용, ADR-020)
    ├── <그래프 이름>/          # 해당 그래프 자식 파일 서브디렉터리
    ├── stage1/
    │   └── 01-understanding-and-scenarios.md   # Stage 1
    ├── stage2/
    │   ├── 02-design.md        # Stage 2(<!-- graph: ... --> 참조 포함)
    │   ├── <그래프 이름>.json   # 승격된 그래프 루트(이름 그대로, 자동 배치)
    │   └── <그래프 이름>/       # 그래프 자식 파일들
    └── stage3/
        └── 03-implementation-plan.md           # Stage 3
```

> 세션을 닫았다 다시 켜도 `state.json` 덕분에 **이어서 진행**(resume)된다.

## CLI — 상태 조회

pi 밖에서도 순수 Node CLI 로 상태를 볼 수 있다(ADR-003 Tier 0):

```bash
node bin/factorynote.mjs status            # 전체 feature 목록
node bin/factorynote.mjs status user-auth  # 특정 feature 상세 + 이력
node bin/factorynote.mjs help              # 사용법
```

> 본 구동(산출물 작성·게이트)은 pi 의 `/factorynote` 가 담당한다. CLI 는 조회 전용.

## 트러블슈팅

| 증상 | 원인 / 조치 |
| ---- | ---- |
| `/factorynote` 가 인식 안 됨 | 새 pi 세션에서 재시도(로드는 세션 시작 시). 설치 경로 확인(`~/.pi/agent/extensions/factorynote/index.ts`). |
| 브라우저가 안 열림 | pi 가 출력한 `http://127.0.0.1:포트` URL 을 수동으로 열기. 환경변수 `FACTORYNOTE_VIEWER_DIST` 로 dist 경로 오버라이드 가능. |
| 에이전트가 코드를 바로 쓰려 함 | plan 모드가 꺼져 있음 → `/factorynote` 로 켜기. 또는 명시적으로 "계획만 해줘" 로 요청. |
| 게이트 페이지가 빈 화면 | 뷰어 dist 미빌드 — `cd apps/plan-viewer && npm run build` 후 재설치. |
| 게이트 중단(Esc 등) 시 | modify 로 복귀("(게이트 중단됨)" 코멘트) — 산출물을 다시 제출하면 재개. |

## 참고

- [[implementation-architecture]] — 코드 구조·데이터 흐름
- [[90-meta/development-guide]] — 확장/수정 가이드
- [[ADR-005-mvp-implementation]] — MVP 결정
- [[Home]]
