---
updated: 2026-07-28
tags: [design, plan-page, ui, requirements]
---

# Plan 페이지 핵심 기능 — 블록 코멘트와 MD 렌더링

FactoryNote의 Plan 뷰어(각 Stage 산출물을 사용자에게 보여주는 화면)에 **반드시 포함되어야 하는 두 핵심 기능**을 정의한다. 두 기능은 React 목업(`prototypes/plan-page-mockup/`)에서 동작을 검증했으며, 향후 본 구현에서도 이 사양을 준수해야 한다.

> **배경**: Plannotator 분석([[plannotator-plan-page]])에서 차용한 어노테이션·마크다운 렌더링 패턴을 FactoryNote의 6단계 게이트 모델([[multi-agent-pipeline]])에 맞춰 재설계. Plannotator는 단일 `Approve` one-shot이지만, FactoryNote는 *직접 편집을 막고 코멘트로 모아 '수정 지시'로 일괄 반영*하는 것이 핵심 차이.

---

## 기능 1 — 블록 단위 hover-to-comment

### 요구

Plan 본문의 **모든 블록**이 코멘트 대상이다. 사용자는 블록을 직접 편집하지 않고, 코멘트를 달아 `Design Agent`에게 수정을 지시한다(5대 원칙 — 승인 전 반영 불가).

### 지원 블록 (전부 코멘트 가능)

마크다운 문법의 모든 블록 요소:

| 마크다운 | 블록 |
| --- | --- |
| `#`~`######` | heading(level 1–6) |
| 본문 | paragraph |
| `-` / `1.` | list(ordered/unordered) |
| `- [ ]` / `- [x]` | task list |
| ` ``` ` | code |
| `![]()` | image |
| `\| 표 \|` | table |
| `>` | blockquote |
| `---` | hr |

inline 강조(`**굵게**` `*기울임*` `~~취소~~` `` `코드` `` `[link]()` )는 블록 안에 포함되어 렌더된다.

### 상호작용 사양

1. **hover** → 해당 블록 영역 강조(배경 + 보더). `cursor: pointer`.
2. **좌클릭** → 코멘트 팝오버(창) 표시. 별도 코멘트 버튼을 두지 않는다(**버튼 ❌, hover+좌클릭 ⭕**).
3. **팝오버는 한 번에 하나만**. 다른 블록 클릭 시 기존 팝오버는 닫히고 새 블록의 팝오버가 열린다. 같은 블록 재클릭 → 닫힘.
4. **팝오버 위치** = 블록(섹션)의 **좌측 끝과 팝오버 좌측 끝이 정렬**(`left: 0` 기준, 블록 하단).
5. 팝오버 내용: 블록 id 헤더 + ✕ 닫기 + 기존 코멘트 목록 + 입력 필드.
6. 코멘트가 달린 블록은 우측에 `💬N` 카운트 배지 상시 표시 + 영역 강조.

### 표 셀 단위 코멘트 (필수)

- 표는 블록 전체 코멘트뿐 아니라 **각 셀(th/td) 개별 코멘트**를 지원한다.
- 셀 식별자: `${blockId}-r${row}-c${col}` (헤더 행은 `r-1`).
- 셀 좌클릭 → 셀 전용 팝오버. 셀 클릭 이벤트는 부모(표 전체)로 전파되지 않는다(`stopPropagation`).
- **표 레이아웃 보호**: 셀 팝오버는 표 DOM 트리 바깥(`document.body` portal)에 `position: fixed`로 렌더하여 표 모양에 영향을 주지 않는다. 클릭한 셀의 화면 좌표(`getBoundingClientRect`)에 배치.

### 코멘트 → 일괄 적용 (수정 지시 게이트)

- 코멘트는 **pending** 상태로 큐에 쌓인다(우측 '내 검토 코멘트' 패널 + 각 블록).
- 하단 **'수정 지시 (N)'** 버튼 클릭 시 pending 코멘트 전체가 **한 번에 applied** 처리된다. N은 pending 수, 0이면 버튼 비활성.
- applied 된 블록은 `✏ 수정 지시 반영됨` 배지 + 본문 옅게.
- **직접 편집은 금지**. 코멘트 → 일괄 반영 흐름만 허용(FactoryNote 5대 원칙의 UI 강제).

### 읽기 전용 요소

task list 체크박스 등 사용자가 토글하면 안 되는 요소는 `disabled`/`readOnly`. 단, 블록 빈 영역 클릭은 코멘트 팝오버로 연결(체크박스 자체는 `stopPropagation`).

---

## 기능 2 — MD 파일 기반 Plan 렌더링

### 요구

Plan 섹션(본문)은 **마크다운 파일(`.md`)을 인자로 받아 렌더링**한다. 하드코딩 데이터가 아니다.

### 변환 모델

- `.md` 소스 → **블록 배열**(`blocks[]`)로 변환 후 렌더.
- 각 블록은 고유 id(`b{인덱스}`)를 가지며, **기능 1의 코멘트 대상**이 된다. 즉 두 기능은 같은 블록 모델 위에서 동작한다.
- 변환기(`mdToBlocks`)는 [markdown-it](https://github.com/markdown-it/markdown-it) 기반. `table`·`strikethrough` 규칙 활성화.

### 지원 문법 (전체)

기능 1의 블록 표에 나열한 모든 마크다운 문법. inline 포맷(strong/em/code/link/strike)은 각 블록 내에서 html로 렌더된다(`.md`는 신뢰 산출물이므로 허용).

### 자동 파생

- **목차(Table of contents)**: heading 블록(h2/h3)에서 자동 생성. 별도 수기 목차 ❌.
- **페이지 타이틀·메타**: 고정 UI 헤더 없이 `.md`의 `#`(h1)과 `>`(blockquote)에서 온다. `.md` 하나가 페이지 전체(타이틀·메타·본문·목차)를 결정.

### 인자 전달

- 런타임에는 Plan 뷰어가 Stage 산출물 마크다운 문자열을 인자로 받아 `mdToBlocks`로 변환 → 렌더.
- 목업에서는 정적 파일(`src/data/plan.md`)을 `?raw`로 import.

---

## 향후 본 구현 필수 요구사항 (체크리스트)

구현자는 아래를 모두 만족해야 한다.

### 블록 코멘트

- [ ] 마크다운 모든 블록 타입이 코멘트 대상(heading·paragraph·list·task·code·image·table·quote·hr)
- [ ] hover 시 영역 강조 + `cursor:pointer`, **별도 코멘트 버튼 없이** 좌클릭으로 팝오버 오픈
- [ ] 팝오버는 **전역 단일**(한 번에 하나만), 블록 좌측 끝과 정렬
- [ ] 표 **셀 단위** 코멘트 지원, 셀 id 체계(`${blockId}-r{r}-c{c}`)
- [ ] 셀 팝오버는 `document.body` portal + `fixed`로 **표 레이아웃 영향 0**
- [ ] 직접 편집 ❌ → 코멘트 pending 큐 → '수정 지시' 일괄 applied
- [ ] task 체크박스 등 읽기 전용 요소 보호

### MD 렌더링

- [ ] Plan 본문 = `.md` 인자 기반 (하드코딩 ❌)
- [ ] 마크다운 전 문법 지원(위 블록 표)
- [ ] inline 포맷(strong/em/code/link/strike) 렌더
- [ ] 목차·타이틀·메타가 `.md`에서 자동 파생
- [ ] 변환된 블록이 코멘트 모델과 동일(id 부여)

---

## 목업 참조

- 코드: `prototypes/plan-page-mockup/`
  - `src/lib/mdToBlocks.js` — 변환기
  - `src/components/Block.jsx` — 블록 렌더 + 코멘트 팝오버 + 표 셀 팝오버(portal)
  - `src/data/plan.md` — 모든 마크다운 문법을 1회씩 포함한 샘플
  - `src/components/Document.jsx` — 블록 시퀀스 렌더
- 시안 HTML: `prototypes/plan-page/variant-A-stepper.html` (모노톤 레이아웃 원본)

> 목업은 정적(게이트 전환·셀 반영 시뮬레이션). 본 구현에서는 `Design Agent`·`Feedback Agent`와 연결되어 코멘트가 실제 수정을 유발한다.

## 참고

- [[plannotator-plan-page]] — Plannotator 분석 (어노테이션·렌더링 패턴 참조)
- [[multi-agent-pipeline]] — Design↔Feedback 루프, 수정 지시 게이트
- [[project-identity]] — 5대 원칙(직접 반영 금지)
- [[Home]]
