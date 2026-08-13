# Plan: ER · Class 다이어그램 그래프 타입 추가

## Context

FactoryNote는 현재 3종 그래프(계층 트리 · Sequence · Flowchart)를 지원한다.
Stage 2 설계에서 데이터 모델(DB 스키마)과 클래스 구조(OOP)를 시각화하려면,
현재로는 Flowchart의 노드/엣지로 억지로 표현해야 한다 — 필드 타입·키 제약·상속·가시성 등
구조적 정보를 담을 수 없다.

ER 다이어그램(엔티티-릴레이션)과 Class 다이어그램(UML)을 새 그래프 종류로 추가하면,
에이전트가 Stage 2 설계에서 데이터 모델과 클래스 구조를 구조적으로 표현하고
사용자가 게이트에서 읽기 전용 SVG로 확인할 수 있다.

**기존 패턴**: Sequence·Flowchart 구현(ADR-021)과 완전히 동일한 구조를 따른다 —
단일 파일 envelope, `type` 필드 판별, 읽기 전용 SVG 렌더러 + 순수 배치 함수.

## Approach

### 1. 데이터 모델 — 두 envelope 추가

**ER 다이어그램** (`type: "er"`):

```json
{
  "version": 2,
  "type": "er",
  "title": "데이터 모델",
  "entities": [
    {
      "id": "user",
      "name": "User",
      "fields": [
        { "name": "id", "type": "UUID", "keys": ["PK"] },
        { "name": "email", "type": "TEXT", "keys": ["UNIQUE"] },
        { "name": "dept_id", "type": "UUID", "keys": ["FK"] }
      ]
    }
  ],
  "relations": [
    { "from": "user", "to": "department", "cardinality": "N:1", "label": "소속" }
  ]
}
```

**Class 다이어그램** (`type: "class"`):

```json
{
  "version": 2,
  "type": "class",
  "title": "클래스 구조",
  "classes": [
    {
      "id": "AuthService",
      "name": "AuthService",
      "attrs": [
        { "name": "db", "type": "Database", "visibility": "private" },
        { "name": "logger", "type": "Logger", "visibility": "private" }
      ],
      "methods": [
        { "name": "login", "params": ["id", "pw"], "return": "Token" },
        { "name": "logout", "params": [], "return": "void" }
      ],
      "extends": "BaseService",
      "implements": ["IAuth"]
    }
  ],
  "associations": [
    { "from": "AuthService", "to": "UserStore", "type": "composition", "label": "uses" }
  ]
}
```

둘 다 단일 파일 — 자식 트리 없음(Sequence·Flowchart와 동일). `position` 등 좌표 필드 금지.

### 2. 렌더 방침

ER: 엔티티를 테이블 박스(헤더=엔티티명, 행=필드)로 렌더. 관계는 엔티티 간 선 +
cardinality 라벨. 관계선 끝에 crow's foot 기호(N:1, 1:N, 1:1, N:M) 표현.

Class: UML 클래스 박스(3단: 클래스명 / 속성 / 메서드)로 렌더. 가시성 기호(+ - #).
상속(extends)은 실선 + 빈 삼각형 화살목. association은 type별 선 스타일(composition=채운 마름모, aggregation=빈 마름모, dependency=점선).

배치: flowchart와 동일하게 Kahn 랭크 + barycenter 자동 배치를 원칙으로 하되,
ER/Class 박스는 너비가 가변(필드/메서드 수에 비례)이므로, 너비를 먼저 측정한 후
열 단위로 최대 너비에 맞춰 정렬. 겹침 0 보장(상수 간격).

## Files to modify

### Core (`packages/factorynote/src/`)

| 파일 | 변경 |
| ------ | ------ |
| `types/graph.ts` | `GraphERFile`·`GraphEREntity`·`GraphERField`·`GraphERRelation`·`GraphClassFile`·`GraphClassDef`·`GraphClassAttr`·`GraphClassMethod`·`GraphClassAssoc` 타입 추가. `GraphKind`에 `"er"`·`"class"` 확장. |
| `graph.ts` | `coerceGraphERFile`·`coerceGraphClassFile`(envelope 검증: version=2, type, entities/classes 필수, id 유일, relation/association 참조 유효). `graphKindOf`·`parseAnyGraphKind` 확장. `parseGraphERFile`·`parseGraphClassFile` 추가. |
| `types/index.ts` | 신규 타입 re-export |
| `index.ts` | 신규 함수·타입 export |
| `df-task.ts` | `graphLine()`의 `kinds` 문구에 ER·Class 규약 추가 |
| `feedback-agents-graph.ts` | `structure` 에이전트 체크리스트에 ER·Class envelope 검증 항목 추가 |
| `graph.test.ts` | ER·Class envelope 유효/불량 파싱 테스트, `parseAnyGraphKind` 확장 |

### Viewer (`apps/plan-viewer/src/`)

| 파일 | 변경 |
| ------ | ------ |
| `lib/layoutER.js` | **신규** — 엔티티 박스 너비 측정 + Kahn 랭크 배치 + crow's foot 관계 좌표. 순수 함수. |
| `lib/layoutClass.js` | **신규** — 클래스 박스 3단 높이 측정 + 랭크 배치 + 상속/association 좌표. 순수 함수. |
| `components/ERView.jsx` | **신규** — 읽기 전용 SVG 렌더러(SequenceView/FlowchartView 패턴) |
| `components/ClassView.jsx` | **신규** — 읽기 전용 SVG 렌더러 |
| `components/Block.jsx` | graph 블록 dispatch에 ER·Class 분기 추가 + 라벨 |
| `App.jsx` | (변경 불필요 예상 — `graphData` 맵이 이미 `{type, data}` 제네릭) |
| `styles/graph.css` | ER·Class SVG 스타일 (`.er-view`, `.class-view` 계열) |
| `components/GraphKindViews.test.jsx` | ERView·ClassView 렌더 테스트 추가 |

### Adapter (`apps/pi-extension/src/`)

| 파일 | 변경 |
|------|------|
| `viewer-state.ts` | import 신규 파서, `buildViewerState`에 ER·Class 파싱 분기 추가. 타입에 `GraphERFile`·`GraphClassFile` import. |

### 도구

| 파일 | 변경 |
|------|------|
| `scripts/gen-feedback-agents.mjs` | 체크리스트 갱신 후 에이전트 md 32개 재생성 |
| `repro-graph-kinds.mjs` | ER·Class 데모 데이터 + md 참조 추가 |

## Reuse

- **`coerceGraphFlowchartFile`** (`graph.ts:284`) — ER·Class coerce 함수의 정확한 템플릿. id 유일 검증(`coerceUniqueIds`), 존재 참조 검증 패턴 그대로 적용.
- **`layoutFlowchart.js`** — 랭크 배치 + barycenter 알고리즘을 ER·Class 배치에 재사용. 박스 너비/높이 가변 처리만 추가.
- **`FlowchartView.jsx`** — SVG 렌더 + marker 정의 + `useMemo` 패턴의 템플릿.
- **`graphKindOf`** (`graph.ts:333`) — type 필드 판별 로직에 2줄 추가.
- **`viewer-state.ts:buildViewerState`** — sequence·flowchart 파싱 분기 패턴(try seq → try flow → try tree)에 er·class 추가.
- **`Block.jsx:76-102`** — graph 블록 dispatch switch에 2 케이스 추가.

## Steps

- [ ] **1. Core 타입 정의** — `types/graph.ts`에 ER·Class 인터페이스 + `GraphKind` 확장. `types/index.ts` re-export.
- [ ] **2. Core 파싱/검증** — `graph.ts`에 `coerceGraphERFile`·`coerceGraphClassFile`·`parseGraphERFile`·`parseGraphClassFile` 추가. `graphKindOf`·`parseAnyGraphKind` 확장. `index.ts` export.
- [ ] **3. Core 테스트** — `graph.test.ts`에 ER·Class envelope 유효/불량 파싱, `parseAnyGraphKind` 확장 케이스 추가. `bun test` green 확인.
- [ ] **4. 배치 순수 함수** — `lib/layoutER.js`·`lib/layoutClass.js` 작성. 결정성·겹침 0 보장.
- [ ] **5. 뷰어 컴포넌트** — `ERView.jsx`·`ClassView.jsx` 작성. `Block.jsx` dispatch 분기 + 라벨 추가.
- [ ] **6. 뷰어 스타일** — `styles/graph.css`에 ER·Class SVG 스타일 추가.
- [ ] **7. 뷰어 테스트** — `GraphKindViews.test.jsx`에 ERView·ClassView 렌더 테스트 추가.
- [ ] **8. 어댑터 서빙** — `viewer-state.ts`에 ER·Class 파싱 분기 추가.
- [ ] **9. 에이전트 지시 갱신** — `df-task.ts` graphLine, `feedback-agents-graph.ts` 체크리스트, `gen-feedback-agents.mjs` 재실행.
- [ ] **10. 데모 스크립트** — `repro-graph-kinds.mjs`에 ER·Class 데모 데이터 + md 참조 추가.
- [ ] **11. 통합 검증** — `bun run build` + `bun test` + `bun repro-graph-kinds.mjs` 브라우저 확인.
- [ ] **12. 문서** — ADR-022 신규, Changelog·Home·implementation-architecture 갱신.

## Verification

1. **`bun test`** — 기존 142 pass + 신규 ER·Class 테스트 전부 green
2. **`bun run build`** — 0 종료 (tsc 타입체크 + viewer 빌드 + install.mjs 배포)
3. **`bun repro-graph-kinds.mjs`** — 브라우저에서 ER·Class 그래프가 정상 렌더되는지 확인:
   - ER: 엔티티 박스(필드 목록) + crow's foot 관계선 + cardinality 라벨
   - Class: UML 3단 박스 + 가시성 기호 + 상속 화살목 + association선
4. **`bun run typecheck`** — 순수 타입체크 0 에러
