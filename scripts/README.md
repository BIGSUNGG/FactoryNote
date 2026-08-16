# scripts

설치·생성·검증 스크립트. 루트에 소스를 두지 않는다(2026-08 하드닝 — 레이아웃 정합).

## 설치·생성

- `install.mjs` — Pi 확장 설치(순수 Node, Windows/macOS/Linux 공통). `bun run build` 의 마지막 단계로도 실행(빌드=배포).
- `gen-feedback-agents.mjs` — `packages/factorynote/src/feedback-agents*.ts` 레지스트리에서 `apps/pi-extension/agents/factorynote-feedback-<name>.md` 생성(ADR-014).

## 테스트 지원

- `ensure-viewer-dist.ts` — `bunfig.toml` preload. 뷰어 dist(gitignore 빌드 산출물)가 없거나 소스보다 낡으면 vite 재빌드 — 신규 클론·소스 변경 어느 쪽이든 게이트 테스트가 최신 dist 로 동작. `viewerDistIsStale` 단위 테스트 동반(`ensure-viewer-dist.test.ts`).

## repro 스모크(수동 검증)

- `repro-serve.mjs` — 공용 뷰어 서빙 미니 서버 + `resolveRepoRoot`(실행 cwd 무관 경로 해석).
- `repro-drilldown.mjs` + `repro-drilldown-browser.mjs` — 실제 Chrome headless(CDP)로 그래프 드릴다운 회귀([[../vault/05-problems/graph-drilldown-pointer-events]]). Chrome 설치 필요.
- `repro-graph-kinds.mjs` — 4종 그래프(트리·sequence·flowchart·구 고정이름) 쇼케이스 게이트 서빙.
- `repro-drive.mjs` — `drivePlan` 1스텝 실구동(게이트 오픈→confirm→결과).

실행: `bun scripts/repro-*.mjs` (레포 루트 기준).

## Console 정책(의도적 예외)

`install.mjs`·`gen-feedback-agents.mjs`·`repro-*.mjs` 의 `console.log/warn/info` 는 **도구 CLI 의 출력 매커니즘**이다 — ast-grep `no-console-except-error-js` 경고를 의도적으로 억제한다.

| 스크립트 | 용도 | console 사용 근거 |
| -------- | ---- | ------------------ |
| `bin/factorynote.mjs` | 상태 조회 CLI | `factorynote status`·`factorynote <feature>` 출력 |
| `install.mjs` | 설치 CLI | 설치 진행 상황·결과를 사용자 터미널에 보고 |
| `gen-feedback-agents.mjs` | 생성 CLI | 생성 개수·대상 디렉토리를 사용자 터미널에 보고 |
| `repro-*.mjs` | 스모크 검증 | 서빙 URL·진행 로그를 개발자 터미널에 보고 |

이들 스크립트에 logger 도입은 과잉 — 스크립트는 단일 목적 CLI 도구이며, 로그는 사용자 피드백 수단이다.
