---
updated: 2026-07-28
tags: [research, plannotator, ux, plan-format]
---

# Plannotator Plan 페이지 분석

Plannotator(`http://localhost:56665/`)가 렌더링한 단일 Plan 페이지의 **요소·레이아웃·정보 구조·디자인 패턴**을 분석한다. FactoryNote 설계의 참고작(Plannotator) 산출물 구조를 이해하기 위한 조사 노트. 정체성·차이는 [[project-identity]], 아키텍처 비교는 [[multi-agent-pipeline]]을 본다.

> **분석 대상은 샘플 plan이다.** 분석에 쓴 페이지는 `BIGSUNGG/FactoryNote` 리포의 *Dark Mode 지원 기능 추가* plan이었으나, 이는 **예시일 뿐**이다. Plannotator 페이지에서 **고정(도구/템플릿)인 부분**과 에이전트가 **요청마다 동적으로 생성하는 부분**을 엄격히 구분한다(§4). 동적 내용(Dark Mode 코드·파일·수치 등)은 구조 분석이 아니므로 요약만 남긴다.

> **분석 방법**: 페이지가 React SPA라 일반 HTTP fetch로는 빈 셸만 반환한다. Orca computer-use로 Chrome 창의 **접근성 트리(accessibility tree)**를 수집해 렌더링된 DOM 구조·텍스트·표·코드를 추출했다. 시각 픽셀(정확한 색상/폰트)은 창이 화면 밖에 있어 캡처하지 못했으므로, 디자인은 컴포넌트·마크다운 패턴 수준에서 서술한다.

## 1. 페이지 정체 (도구 수준 — 고정)

| 항목 | 값 |
| ------ | ------ |
| 도구 | Plannotator (`plannotator.ai`) |
| 페이지 단위 | 1개 웹 페이지 = 1개의 완성된 Plan |
| 레이아웃 | 좌측 사이드바(목차) + 중앙 문서 본문 + 우측 어노테이션 패널 (3단) |
| 대상 리포 표시 | 본문 상단 바에 `<owner>/<repo> · <branch>` 표시 |

> 각 plan의 *제목·상태·담당·우선순위 값*은 동적(§3)이지만, **페이지가 하나의 plan 단위로 구성된다**는 구조 자체는 Plannotator의 고정 설계다.

## 2. 전체 레이아웃 (요소 분석 — 고정)

```
┌─────────────────────────────────────────────────────────────┐
│ TOP TOOLBAR                                                 │
│ Plannotator 로고 │ Send Feedback │ Approve │ Hide annot.   │
│                   │ Show AI chat │ Options │ (설정 토글)     │
├──────────────┬──────────────────────────────────┬───────────┤
│ LEFT SIDEBAR │ MAIN DOCUMENT (Plan 본문)        │ RIGHT     │
│              │                                  │ ANNOT     │
│ Contents     │ 🚀 Plan: <제목>                  │ PANEL     │
│ Files        │ ─────────────────                │           │
│ Archive      │ 📖 Context ...                   │ Annotations│
│ ───────      │ ...                              │           │
│ Table of     │ (템플릿 골격 10섹션, §4 참조)     │           │
│ contents     │                                  │           │
├──────────────┴──────────────────────────────────┴───────────┤
│ BOTTOM TOOLBAR (어노테이션 도구)                              │
│ Select Pinpoint Markup Comment Redline Label │ Wide/Focus/Edit│
└─────────────────────────────────────────────────────────────┘
```

### 2.1 상단 툴바 요소

| 요소 | 역할 |
| ------ | ------ |
| Plannotator 로고 | `plannotator.ai` 링크 |
| **Send Feedback** | 피드백 전송 |
| **Approve** | Plan 승인 — Plannotator의 단일 승인 지점 |
| **Hide annotations** | 주석 레이어 토글 |
| **Show AI chat** | AI 채팅 패널 토글 |
| **Options** | 페이지 옵션 |
| settings-manager-toggle | 우측 설정 매니저 토글 버튼 |

### 2.2 좌측 사이드바

세 개의 보기 전환 버튼 + 목차:

- **Contents** — 문서 섹션 목차. 클릭 시 해당 섹션으로 점프.
- **Files** — 리포 파일 뷰.
- **Archive** — 과거 plan 보관.
- **Table of contents** — 섹션을 이모지 헤더로 나열(§4 골격과 동일).
- **Collapse sidebar** — 사이드바 접기.

### 2.3 우측 어노테이션 패널

- 제목 *Annotations*. 본문 텍스트를 선택해 주석을 다는 구조. (샘플 페이지엔 주석 없었음.)

### 2.4 하단 어노테이션 도구 모음

`Select · Pinpoint · Markup · Comment · Redline · Label` — 시안 검토(redline/label) 중심의 협업 도구 세트. 우측에 보기 모드 토글: **Wide / Focus / Edit**. 그리고 `how does this work?` 도움말.

문서 본문 상단에는 리포 컨텍스트 바: `<owner>/<repo> · <branch>` + `Attachments`, `Add global comment`, `Copy plan` 버튼.

## 3. 문서 메타데이터 블록 (구조는 고정, 값은 동적)

제목 바로 아래 인용구(`>`) 블록으로 메타데이터를 표시한다. **필드 4개(상태·작성일·담당·우선순위)는 템플릿 고정**이고, 각 필드의 **값은 에이전트/plan마다 동적**이다.

```
상태: <동적>      작성일: <동적>
담당: <동적>      우선순위: <동적>
```

> 샘플에서는 *검토 대기 중 / 2025-01-15 / Frontend Team / 🔴 High* 였으나, 이 값 자체는 Dark Mode plan의 내용이지 Plannotator 구조가 아니다.

## 4. 메인 문서 — 템플릿 골격(고정) vs 동적 내용

> **이 절의 핵심.** Plan 본문은 두 층위로 나뉜다.
>
> - **(A) 고정 템플릿 골격** — 섹션 헤더 목록과 각 섹션의 표현 포맷(표·체크박스·코드 블록·인용구)은 Plannotator가 정한 plan 템플릿이다. 모든 plan에 동일하게 적용된다.
> - **(B) 동적 내용** — 골격 안의 실제 텍스트·코드·파일 경로·수치·주제는 **에이전트가 요청마다 다르게 생성**한다.
>
> 본 노트의 목적은 (A) 구조 분석이므로, (B)는 샘플 요약만 남긴다(§4.2).

### 4.1 Plan 템플릿 골격 (고정 — 도구의 구조)

| # | 섹션 | 표현 포맷 | 용도 |
| --- | ------ | ------ | ------ |
| - | 🚀 Plan: \<제목\> | H1 + 메타 인용구(§3) | 제목 + 상태/담당/우선순위 |
| 1 | 📖 Context | 인용구 + 정량 근거 | 배경·문제 제기 |
| 2 | 문제 요약 | 3열 표 (항목·현재·목표) | 현재 상태 → 목표 대비 |
| 3 | 핵심 목표 | 번호 목록 | 달성 조건 |
| 4 | 🎯 Approach | 인용구 요약 + 설계 결정 불릿 + 코드 블록 | 접근법 + 핵심 결정 + 예시 코드 |
| 5 | 📁 Files to Modify | 3열 표 (파일·변경유형·설명) | 변경 대상 파일 목록 |
| 6 | ♻️ Reuse | 불릿 | 기존 자산 재사용 지점 |
| 7 | ✅ Steps | Phase 그룹 + 체크박스 (+코드) | 구현 순서 |
| 8 | 🧪 Verification | 코드 + 체크박스 + 표 | 자동/수동 검증 + 브라우저 지원 |
| 9 | ⚠️ Risks & Notes | 불릿 | 리스크·주의사항 |
| 10 | 📌 Open Questions | 번호 + (임시 답) | 미결정 사항 |

섹션은 수평선 `---`으로 구분된다. 좌측 목차(§2.2)는 이 헤더와 1:1 매칭된다. **이 골격이 Plannotator가 모든 plan에 적용하는 고정 구조**이며, 본 노트가 분석 대상으로 삼는 '구조'다.

### 4.2 샘플 plan의 동적 내용 (Dark Mode — 참고 요약)

샘플에서 에이전트가 위 골격에 채운 내용의 요약. **값 자체는 이 plan에만 해당하며 구조 분석엔 무관**하다:

- **주제**: 라이트 모드만 지원 → 라이트/다크 토글 추가.
- **접근법**: CSS Custom Properties + `<html data-theme>` 속성. Tailwind `dark:` 대신 순수 CSS 변수(의존성 최소화). 전환 200ms transition.
- **주요 산출물 파일**: `tokens.css`(변수 정의), `themeManager.ts`(초기화·토글·localStorage 영속화), `useTheme.ts`(React 훅), `index.html`(FOUC 방지 인라인 스크립트).
- **재사용**: 기존 `storage.ts`, `IconButton.tsx`, `SunIcon`/`MoonIcon`.
- **검증**: typecheck + `npm test` + Chromatic 시각 회귀; Chrome 88+ / Firefox 87+ / Safari 14+ / Edge 88+.
- **미결정**: 토글 위치(헤더 선택), auto 모드(MVP 제외).

> 구체적 CSS/TS 코드 전문, 파일 표 전체, Phase별 체크리스트 전문은 이 샘플 plan의 산출물이지 Plannotator 구조가 아니다. 에이전트가 상황에 맞춰 매번 새로 작성하므로 본 노트엔 요약만 남긴다.

## 5. 디자인 / UX 패턴 (고정)

시각 픽셀은 캡처하지 못했으나, 트리 구조와 마크다운 렌더링 단서로 **템플릿 수준의 패턴**을 확인했다.

| 패턴 | 구현 |
| ------ | ------ |
| 섹션 헤더 | 이모지 + 제목. 목차(§2.2)와 1:1 매칭. 스캔성 극대화. |
| 섹션 구분 | 수평선 `---`로 시각적 단절. |
| 메타데이터 | 인용구 `>` 블록으로 제목 아래 상태/담당/우선순위 묶어 표시(§3). |
| 코드 | 전용 블록 + 우상단 `Copy code` 버튼. 파일명·식별자는 인라인 코드. |
| 표 | 매핑·비교 정보를 3열 표로 정리(문제 요약·Files to Modify·브라우저 지원). |
| 작업 항목 | 체크박스 `- [ ]` + Phase 그룹화. 진행률 가시화. |
| 강조 | 우선순위 색상 이모지(예 🔴), 수치는 굵게. |
| 탐색 | 좌측 목차 = 헤더와 1:1 매칭, 클릭 점프. |

전반적으로 **GitHub PR 설명 / Markdown 문서**의 관용을 그대로 가져오되, 목차·어노테이션·승인 버튼·보기 모드를 덧붙인 *계획 리뷰용 리더* UI다.

## 6. Plannotator 고유 협업 기능 (고정)

일반 마크다운 뷰어를 넘는, 시안/계획 리뷰 특화 기능:

- **Approve** — 페이지 최상단의 단일 승인 버튼. Plan의 유일한 게이트.
- **어노테이션 도구** — `Select / Pinpoint / Markup / Comment / Redline / Label`. 본문 텍스트/요소에 주석·필기·라벨.
- **보기 모드** — `Wide`(넓게) / `Focus`(집중) / `Edit`(편집).
- **AI chat** — 사이드 AI 채팅 패널.
- **Contents / Files / Archive** — 목차·리포 파일·과거 plan 아카이브 전환.
- **Copy plan** — plan 전체 복사. **Add global comment** · **Attachments**.

## 7. 결론 — FactoryNote 관점 시사점

Plannotator는 **고정 템플릿 골격(§4.1)을 한 번에(one-shot) 채워 단일 문서로 제공**한다. [[project-identity]]의 비교표와 정확히 일치한다:

- **통제 지점 = 1회**(상단 `Approve`). 사용자는 완성된 결과물을 받아들이거나 전체를 다시 요청하는 것만 가능. 단계별 게이트가 없다.
- **산출물 = 단일 문서**. 템플릿 골격 10섹션이 한 페이지에 평면적으로 채워진다. **골격은 고정이지만 그 안의 내용은 에이전트가 요청마다 동적 생성**한다. FactoryNote는 이 산출물을 6단계 Stage로 분해해 단계마다 별도 게이트를 둔다([[multi-agent-pipeline]]).
- **협업은 어노테이션 중심**. Plannotator의 강점은 *결과물에 대한 사후 리뷰*(redline/comment)다. FactoryNote는 *과정 중 인간 승인*(Design↔Feedback 루프 후 게이트)에 무게를 둔다.

### 차용할 만한 요소 (설계 참고)

Plannotator의 **템플릿 골격과 표현 포맷**은 FactoryNote 산출물 렌더링에도 유효하다:

- **이모지 섹션 헤더 + 목차 1:1 매칭** — Stage 산출물 가시성에 직접 활용 가능.
- **메타데이터 인용구 블록** — 각 Stage 산출물의 상태·게이트 결과 표시.
- **Files to Modify 표 + Reuse 섹션** — Stage 5(구현 계획) 산출물 포맷으로 적용.
- **체크박스 + Phase 그룹화** — Stage 5/6 검증 항목 표현.
- **Copy code / Copy plan** — 산출물 재사용성.

반면 Plannotator의 단일 `Approve` 버튼은 FactoryNote의 6단계 게이트 모델과 충돌하므로, FactoryNote 구현 시 **Stage별 승인 UI**(6개의 게이트)로 대체해야 한다.

## 참고

- [[project-identity]] — FactoryNote 정체성, Plannotator와의 차이
- [[multi-agent-pipeline]] — 6단계 파이프라인, Design↔Feedback 루프
- [[graphify]] — 같은 영역의 다른 조사 노트
- [[Home]]
