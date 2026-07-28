---
updated: 2026-07-26
tags: [meta, workflow]
---

# 문서 업데이트 절차

"언제 무엇을 기록하는가"에 대한 트리거 맵. [[Doc-Conventions]]와 함께 본다.
원칙: **망설이면 기록한다.** 오래된 문서는 버그다.

## 트리거 → 기록 위치

| 상황 | 기록할 곳 | 형식 |
| ------ | ----------- | ------ |
| 아키텍처/도구/컨벤션 결정을 내림 | `02-decisions/ADR-NNN-*.md` | [ADR 템플릿](templates/adr.md) |
| 코드·기능을 구현/변경함 | `04-development/Changelog.md` + `Dev-Log.md` | Keep a Changelog + 일일 로그 |
| 버그·블로커·예상치 못한 문제 발생 | `05-problems/<issue>.md` | 문제→원인→조치→교훈 |
| 외부 도구·라이브러리·접근법 조사 | `06-research/<topic>.md` | 요약 + 증거 + 결론 |
| 기능 설계 산출물 작성(워크플로 6단계) | `03-design/<feature>/<artifact>.md` | 단계별 산출물 |
| 비전·원칙·용어 정립 | `00-vision/`, `01-architecture/` | — |

## 결정을 기록할 때 (ADR)

1. `02-decisions/`에 `ADR-NNN-kebab-title.md` 생성 (NNN은 다음 번호).
2. [템플릿](templates/adr.md)의 항목 채우기: 맥락, 결정, 이유, 대안, 결과.
3. `status: proposed` → 검토 후 `accepted`. 번복 시 `superseded` + 후속 ADR 링크.
4. [[Home]] 또는 관련 설계 문서에서 링크.

## 변경을 기록할 때 (Changelog + Dev-Log)

- **Changelog.md**: 사용자/외부에 보이는 변경 단위. [Keep a Changelog](https://keepachangelog.com/) 섹션(Added/Changed/Fixed/Removed).
- **Dev-Log.md**: 날짜별 작업 기록. 무엇을 했는지, 왜, 무엇이 남았는지.
- 둘 다 코드 변경과 같은 세션에서 갱신.

## 문제를 기록할 때

1. `05-problems/<short-name>.md` 생성.
2. 현상 / 재현 / 원인 / 조치 / 영향 / 교훈 구조.
3. 해결되면 상태 표시하고 관련 ADR/Changelog에서 인용.

## 문서를 최신으로 유지하는 습관

- PR이나 커밋을 마치기 전에 "어떤 문서가 영향받는가" 자문.
- graphify 그래프(`graphify-out/`)로 영향 범위를 확인할 수 있다.
- 기록이 빠졌다고 판단되면 그 자리에서 보충.
