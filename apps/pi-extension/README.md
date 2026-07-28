# @factorynote/pi-extension

Pi harness 어댑터 (Layer 3). FactoryNote의 메인 구현체.

- **M4 Tier 1** — `PiAgentSpawn`: pi-crew로 Design/Feedback 분리 에이전트 스폰.
- **M5 Command Entry** — `/factorynote <feature>` 명령 바인딩 (신규 init vs 기존 resume).

코어(`@factorynote/core`)는 harness를 모른다. 이 패키지만 Pi에 접촉한다.
근거: [[vault/00-vision/project-identity]] (Pi = 루트 AGENTS.md + .pi/skills 하이브리드).

> Tier 0(Pi에서도 동작): 코어 산출물 마크다운 + Pi 승인 프롬프트로 게이트 (ADR-003).
> Tier 1(선택): pi-crew로 분리 에이전트 스폰. 구현은 Stage 5.
