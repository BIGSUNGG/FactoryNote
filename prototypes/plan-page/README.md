# FactoryNote 계획 페이지 시안 (4종)

Plannotator의 plan 페이지 구성을 참고하되, FactoryNote의 차별점 — **6단계 Stage 게이트**와 **Design↔Feedback 내부 루프** — 을 살린 계획 페이지 UI 시안 4종. 모두 sleek 디자인 시스템(`#3B82F6` primary · Inter · 8pt grid · radius 8px)을 따른다.

브라우저에서 바로 열기:

| 시안 | 파일 | 철학 |
| --- | --- | --- |
| A — 스텝퍼 + 단일 스크롤 | [variant-A-stepper.html](./variant-A-stepper.html) | Plannotator에 가장 가깝다. 게이트만 Stage마다. |
| B — Stage 포커스 | [variant-B-focus.html](./variant-B-focus.html) | 한 번에 한 Stage만. 게이트가 헤더에 명확. |
| C — 분할 (산출물 + Feedback) | [variant-C-split-feedback.html](./variant-C-split-feedback.html) | IDE 스타일. Design↔Feedback 루프가 핵심 시각 요소. |
| D — 파이프라인 | [variant-D-pipeline.html](./variant-D-pipeline.html) | 6단계 흐름을 수평 노드로. 정정 회귀까지 한눈에. |

> 더미 콘텐츠는 4종 모두 동일(`auth-module` 가상 프로젝트, Stage 1 요구사항 명세, 라운드 2 Feedback)하여 레이아웃 공정 비교가 가능하다.

## Plannotator에서 가져온 것 · 바꾼 것

**가져온 요소** (참고: [[plannotator-plan-page]] 분석)

- 이모지 섹션 헤더 · 메타데이터 인용구 블록
- `FR-1`/`NFR-1` 식별자 + 모노스페이스 태그
- 3단 그리드(목차 / 본문 / 사이드)
- Wide/Focus/Edit 보기 모드 토글(시안 C)

**Plannotator와 결정적으로 다른 점**

- Plannotator는 상단 `Approve` **단일 게이트**(one-shot). 시안 A–D는 모두 **Stage별 게이트**(확정/수정/정정 3액션)를 전면에 배치.
- Plannotator는 산출물이 한 페이지 평면 나열. 시안 B·C·D는 **현재 Stage 1개만 노출**, 나머지는 잠금(lock 🔒) 처리 — 5대 원칙(승인 전 다음 단계 진입 불가)을 UI로 강제.
- Plannotator엔 없는 **Design↔Feedback 루프 상태**(라운드 수, 이슈, 클린 판정)를 모든 시안에 표시.

## 시안별 트레이드오프

### A — Stage 스텝퍼 + 단일 스크롤

Plannotator 사용자에게 가장 익숙한 형태. 상단 6단계 스텝퍼 + 좌측 목차 + 우측 Feedback/어노테이션 패널. 하단 고정 게이트 바.

- **장점**: 학습 비용 최소, 긴 산출물 스크롤에 적합, Plannotator 마이그레이션 매끄러움.
- **단점**: 6단계 전체 흐름은 스텝퍼 색으로만 암시 — 회귀(정정) 경로가 직관적이지 않음.

### B — Stage 포커스

좌측 6 Stage 세로 레일(상태 아이콘 ✓/▶/🔒), 중앙 현재 Stage 산출물, 우측 Feedback 타임라인. 상단에 큰 게이트 액션 바.

- **장점**: "지금 이 게이트를 통과해야 다음으로"가 가장 명확. 잠금 상태가 시각적 강압.
- **단점**: 전체 계획을 한눈에 보기 어려움(한 Stage만 보임). 산출물이 길면 레일과 본문 균형 붕괴.

### C — 분할 (산출물 + Feedback 사이드)

좌 Stage 트리 · 중앙 산출물 에디터(편집 가능 느낌) · 우측 **Feedback Agent 실시간 패널**. 각 이슈 카드에 "Design 재검토 요청" 액션. Design↔Feedback 루프가 UI의 주인공.

- **장점**: FactoryNote의 핵심 메커니즘(루프)을 가장 잘 드러냄. 수정 사이클이 잦은 Stage 1·3·4에 특히 적합.
- **단점**: 3페인 + 에디터로 정보 밀도 최고 — 복잡해 보일 수 있음. 최종 검증(Stage 6, 읽기 전용)엔 과함.

### D — 파이프라인

상단 6 Stage 수평 노드(게이트 = 노드), 선으로 연결. 중앙 선택 Stage 상세. 회귀(정정)를 빨간 점선 엣지로 시각화. 전체 흐름이 헤더 자체.

- **장점**: 6단계 파이프라인 전체와 현재 위치가 가장 명확. 정정 회귀 시각화에 최적.
- **단점**: 산출물 본문이 상대적으로 좁아짐. 노드-상세 분할로 폭이 쪼개짐.

## 비교표

| 기준 | A 스텝퍼 | B 포커스 | C 분할 | D 파이프라인 |
| --- | --- | --- | --- | --- |
| Plannotator 친숙도 | ★★★★★ | ★★★ | ★★ | ★★ |
| 게이트 명확성 | ★★★ | ★★★★★ | ★★★★ | ★★★★ |
| Design↔Feedback 가시성 | ★★ | ★★★★ | ★★★★★ | ★★★ |
| 전체 흐름 한눈에 | ★★ | ★ | ★★ | ★★★★★ |
| 긴 산출물 가독성 | ★★★★★ | ★★★★ | ★★★ | ★★ |
| 회귀(정정) 표현 | ★ | ★★ | ★ | ★★★★★ |
| 화면 복잡도 | 낮음 | 중 | 높음 | 중 |

## 추천

- **1순위 B(포커스)** — 게이트 강제가 FactoryNote 5대 원칙의 본질이므로, 그 의도를 UI에 가장 정직하게 반영. 기본 레이아웃으로 채택 후보.
- **보조 C(분할)** — Design↔Feedback 루프가 빈번한 Stage(1 요구사항·3 모듈·4 클래스)에서만 C 뷰로 전환. Stage 6(최종 검증)은 A/D 읽기 뷰로.
- **D(파이프라인)** — Plan 개요 페이지(진입 화면)나 회귀 디버그용 "전체 흐름" 보기로 활용.

즉 **B를 기본 + Stage 성격에 따라 C/D로 보기 전환**하는 하이브리드가 가장 FactoryNote다운 방향일 수 있음. 최종 결정은 사용자 게이트(이 산출물 자체를 Stage 1 산물로 확정할지)에서.

## sleek 토큰 적용 메모

4종 모두 동일 CSS 변수(`:root`) — primary `#3B82F6`, secondary `#8B5CF6`, success `#16A34A`, warning `#D97706`, danger `#DC2626`, text `#111827`, surface `#FFFFFF`, radius `8px`, spacing 8pt 스케일(`4/8/16/24/32px`). 폰트는 Inter + JetBrains Mono(Google Fonts 로드, 오프라인엔 system-ui 폴백). `[DESIGN.md](../../DESIGN.md)` 토큰과 일치.

## 한계

- 정적 HTML — 게이트 액션·Stage 전환·Feedback 루프는 시각만 구현(기능 없음).
- 데스크톱 우선. 모바일 반응형은 미구현.
- 단일 가상 콘텐츠만. 실제 산출물 다양성(시나리오·클래스 명세 등)은 렌더링 안 함.
