---
updated: 2026-08-06
tags: [design, classes, ui, requirements, stage-4]
---

# 클래스 설계 페이지 핵심 기능 — 모듈 계층 클래스 에디터

FactoryNote Plan 뷰어의 **Stage 4(클래스 수준 설계)** 산출물 페이지 사양. React 목업(`apps/plan-viewer/`의 `#/classes`)에서 검증. 향후 본 구현에서 이 사양을 준수해야 한다.

> 모듈 설계 페이지([[03-design/module-design/features|module-design features]])와 같은 **react-flow 에디터 UI**를 공유하되, **모듈(그룹)이 클래스를 감싸는 계층 구조**가 핵심 차이. Stage 3의 모듈 노드 → Stage 4의 모듈 그룹(컨테이너) + 클래스 노드(자식).

---

## 기능 1 — 모듈 계층 구조 (핵심)

### 요구

모듈이 **큰 박스(그룹)** 로 클래스를 감싼다. 클래스는 반드시 어느 모듈에 속한다.

### 사양

- **모듈 그룹 노드**(`modGroup`): 점선 박스 + 좌상단 모듈명 라벨(API/Service/Util/Repository/External). 컨테이너.
- **클래스 노드**는 `parentNode`로 소속 모듈에 연결, `extent: "parent"`로 모듈 박스 안에 제한.
- **모듈 드래그 시 클래스가 함께 이동** (react-flow parent-child).
- 모듈 그룹은 `selectable: false` (컨테이너 전용, 클래스 단위로만 선택·CRUD).

---

## 기능 2 — 클래스(노드) 상세·편집·CRUD

### 요구

클래스 노드 클릭 → 상세 + 편집 + 코멘트.

### 사양

- 클래스 노드: 이름 + 모듈 라벨 + 속성 섹션 + 메서드 섹션 (UML 박스).
- 상세 패널: **이름·모듈(select)·속성(textarea, 한 줄씩)·메서드(textarea)** 편집. 즉시 반영.
- `labelOf`로 id·이름 분리 (이름 변경해도 관계 유지).
- 관계 목록: 사용(→)·사용됨(←).
- **모듈 이동**: 상세의 **모듈 select**로 클래스를 다른 모듈로 이동(`parentNode`·`extent`·`position`·`module` 라벨 갱신).

---

## 기능 3 — 관계(엣지 A→B) 상세·편집·CRUD

### 요구

클래스 간 관계(사용/상속)의 생성·방향·설명·제거.

### 사양

- 핸들 연결 드래그(`onConnect`) → 관계 추가. id = `"${from}->${to}"`.
- 관계 상세: `from → to` + 설명 편집 + 코멘트.
- 엣지 우클릭 → **방향 반전** / **제거**.

---

## 기능 4 — 우클릭 컨텍스트 메뉴 (위치별)

| 우클릭 위치 | 메뉴 |
| --- | --- |
| **빈 공간** | ＋ 클래스 추가 (기본 Service) |
| **모듈 박스** | ＋ **이 모듈에** 클래스 추가 |
| **클래스 노드** | ✕ 클래스 제거 |
| **관계(엣지)** | ↔ 방향 반전 · ✕ 관계 제거 |

- 모듈 우클릭 → `addNode(parentId=해당 모듈)` — **클래스가 그 모듈 안에** 생성, module 라벨 자동 동기화.
- 클래스 제거 시 연결 관계도 함께 제거.

---

## 기능 5 — 모듈 박스 크기 조절

### 요구

모듈 섹션(그룹 박스)의 크기를 사용자가 조절한다.

### 사양

- 모듈 그룹 노드에 **react-flow `NodeResizer`** 적용.
- 박스 테두리에 리사이즈 핸들(항상 표시, 모노톤). 드래그로 너비·높이 조절(최소 140×90).
- 박스를 줄여 자식 클래스가 가려지면(extent parent 한계) 클래스 위치 조정 필요.

---

## 코멘트 → 일괄 적용 (수정 지시 게이트)

- 클래스·관계 코멘트는 같은 pending 큐 → 하단 **'수정 지시 (N)'** 로 일괄 applied.
- 직접 편집은 목업 데모. 본 구현에서는 편집·코멘트를 Design Agent 제안/명령으로 처리 (5대 원칙 — [[project-identity]]).

---

## 향후 본 구현 필수 요구사항 (체크리스트)

### 모듈 계층

- [ ] 모듈 그룹 노드(점선 박스 + 라벨)가 클래스를 감싼다
- [ ] 클래스 `parentNode` + `extent: "parent"` 로 모듈 안 제한
- [ ] 모듈 드래그 시 자식 클래스 함께 이동

### 클래스

- [ ] 클래스 노드: 이름·모듈·속성·메서드 (UML 박스)
- [ ] 상세에서 이름·모듈·속성·메서드 편집
- [ ] **모듈 select 로 클래스 이동** (parent + 라벨 동기화)
- [ ] 빈 공간/모듈/클래스 우클릭 → 추가/제거
- [ ] **모듈 우클릭 → 해당 모듈에 클래스 추가**

### 관계

- [ ] 핸들 연결 드래그 → 관계 추가
- [ ] 관계 상세에서 설명 편집 + 코멘트
- [ ] 엣지 우클릭 → 방향 반전/제거

### 모듈 박스

- [ ] `NodeResizer` 로 모듈 박스 크기 조절 (최소치 포함)

### 공통

- [ ] 클래스·관계 코멘트 → '수정 지시' 일괄 applied
- [ ] 편집·코멘트 Design Agent 제안 처리 (5대 원칙)

---

## 목업 참조

- 코드: `apps/plan-viewer/src/components/Classes.jsx`
  - `ModGroup`(점선 컨테이너 + `NodeResizer`) · `ClassNode` · `ClassPanel`(모듈 select 포함) · `RelPanel` · 우클릭 메뉴
  - 진입: `/#classes`

## 한계 (본 구현 과제)

- 새 클래스 기본 위치가 모듈 박스 좌측 상단 고정 — 자동 레이아웃 미제공.
- 모듈 그룹 노드가 `selectable: false`라 NodeResizer 핸들이 안 잡힐 수 있음(작동 확인 필요 → `selectable: true` 조정).
- 직접 편집 즉시 반영 — 본 구현에서 Design Agent 제안으로 전환.

## 참고

- [[03-design/module-design/features|module-design features]] — 동일 react-flow UI (Stage 3, 모듈 노드)
- [[03-design/plan-viewer/ui-mapping|ui-mapping]] — Stage별 UI 매핑
- [[multi-agent-pipeline]] — Stage 4 위치
- [[project-identity]] — 5대 원칙
- [[Home]]
