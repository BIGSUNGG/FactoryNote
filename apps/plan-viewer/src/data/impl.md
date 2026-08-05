# Stage 5 — 구현 계획

> **상태**: 검토 대기 · **담당**: Backend · **Stage**: 5/6

설계를 바탕으로 구현 순서·의존성·마일스톤을 정한다.

## Phase 1 — 기반

- `HashUtil` (bcrypt cost 12)
- `TokenService` (JWT sign/verify)
- 에러 타입 정의

## Phase 2 — 저장/사용자

- `UserRepository` + DB 마이그레이션
- `UserService` (create/findById)
- `Mailer` 연동

## Phase 3 — 인증 오케스트레이션

- `AuthService` (signup/login/logout)
- 토큰 갱신 흐름
- rate-limit 미들웨어

## Phase 4 — 엔드포인트

- `AuthController` 라우트
- 요청 검증 DTO
- OpenAPI 문서

---

> Phase는 선행 Phase에 의존(1 → 2 → 3 → 4). 확정 시 파이프라인 종료(구현 진입).
