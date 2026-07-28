---
status: accepted
updated: 2026-07-29
tags: [adr, structure, monorepo, tooling]
---

# ADR-004: 코드 레포 구조 — plannotator 모노레포 패턴 채택

## 상태

accepted

## 날짜

2026-07-29

## 맥락

[[03-design/workflow-core/03-module-architecture]]가 3계층(Protocol/Engine/Adapter)·5모듈(M1-M5)을 정의했으나, 이를 구현할 **코드 레포 폴더 레이아웃**은 "Stage 4에서 확정"으로 남아있었다. 패키지 맵 후보(`.pi/skills/factorynote/` + `.factorynote/` 또는 패키지 `scripts/`)는 초안이었다.

구현 착수 전 폴더 구조를 정해야 했다. 사용자가 외부 참고로 [plannotator](https://github.com/backnotprop/plannotator)의 폴더 패턴을 따르라고 지시했다. plannotator는 동일 도메모(harness 통합 패키지, Pi 확장 포함, apps/+packages/+docs/+bin/+scripts/+tests/, bun)의 성숙한 레포다.

추가 제약: `vault/`·`.pi/`는 개발 참고용이고 **배포에서 제외**한다(사용자 지시).

## 결정

plannotator의 모노레포 폴더 패턴을 FactoryNote의 3계층·5모듈에 매핑해 채택한다.

```
apps/        → Layer 3 (Adapter): harness 접촉층
  pi-extension/   M4 Tier1(pi-crew) + M5(/factorynote) — 메인 구현
  claude-code/    뼈대 (인터페이스만)
  codex/          뼈대 (인터페이스만)
packages/factorynote/  → Layer 1-2 (Protocol+Engine): harness 의존 없음
  protocol/stages/     M1 Stage Registry (마크다운)
  protocol/templates/  산출물 템플릿
  orchestrator/        M2 Director 규칙 (프로토콜)
  src/                 M3 Persistence(얇은 코드) + M4 AgentSpawn 인터페이스 + 타입
docs/  bin/  scripts/  tests/   plannotator 보조 디렉토리
```

- 패키지 매니저: **bun** + workspaces(`packages/*`, `apps/*`). TS-first, 빠른 install.
- `vault/`·`.pi/`는 배포 제외 참고. `apps/`·`packages/`·`docs/`·`bin/`·`scripts/`·`tests/`가 배포 산출물.

## 이유

- **harness-agnostic 원칙(NFR-1) 정합**: Layer 1-2(`packages/factorynote`)와 Layer 3(`apps/`)의 폴더 분리가 이식성 경계와 1:1 매핑. 복사 시 다른 harness로 이동 가능.
- **검증된 동일 도메인 레이아웃**: plannotator도 harness 통합 패키지(Pi/Claude Code/Codex 등)로, apps/=어댑터·packages/=코어 분리를 이미 쓴다. 패턴 재발명 불필요.
- **5모듈 → 최소 패키지**: 모듈 5개 중 대부분이 얇은 코드/프로토콜이므로 코어를 단일 패키지(`packages/factorynote`)로 둔다(ponytail, NFR-4).

## 대안

- **패키지 다중 분할**(`core`/`engine`/`shared` 등): plannotator처럼 여러 패키지로. 배제 — FactoryNote 모듈은 대부분 얇고 프로토콜(마크다운) 중심이라 패키지 쪼개기는 과잉 추상화. 코어 1개 + apps로 충분.
- **`adr/` 디렉토리 추가**(plannotator 동일): 배제 — `vault/02-decisions`(ADR) + `03-design`(specs) + `06-research`(research)가 이미 adr/의 상위 집합 역할. 중복 저장소는 컨벤션 충돌.
- **코어를 `.pi/skills/`에만 배치**(초안 후보): 배제 — harness 주입과 배포 산물(재사용 가능 패키지)의 역할이 다름. `.pi/`는 Pi 참고용, 패키지는 harness 중립 산출물로 분리.

## 결과

- 긍정: 이식성 경계(계층↔폴더) 명확. 확장 포인트(claude-code/codex) 자리 확보. vault와 배포 산물의 분리 명시.
- 부정: claude-code/codex는 뼈대만(구현 OUT). 레포 표면이 늘어남(모노레포 오버헤드).
- 후속: Stage 4(클래스 설계)에서 패키지 내 파일명·클래스 확정. M3/M4/M5 구현은 Stage 5. 코어 로직(M2)은 `orchestrator/` 마크다운으로 채운다.

## 참고

- [[ADR-003-viewer-architecture]] — 뷰어는 코어 위 별도 레이어(코어는 산출물만)
- [[03-design/workflow-core/03-module-architecture]] — 3계층·5모듈 정의
- [[project-identity]] — harness-agnostic 정체성
- 외부: <https://github.com/backnotprop/plannotator>
- `README.md`(루트 모노레포 구조), `package.json`(workspaces)
