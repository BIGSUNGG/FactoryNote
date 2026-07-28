# 🚀 Plan: Dark Mode 지원 기능 추가

> **상태:** 검토 대기 중
> **작성일:** 2025-01-15
> **담당:** Frontend Team
> **우선순위:** 🔴 High

---

## 📖 Context

현재 애플리케이션은 라이트 모드만 지원한다. 사용자 피드백의 **23%**가 다크 모드 요청이며, 경쟁사 대부분이 이미 지원하고 있어 사용자 경험 저하 요인으로 작용한다.

### 문제 요약

| 항목 | 현재 상태 | 목표 |
| ------ | ----------- | ------ |
| 테마 | 라이트 모드만 | 라이트/다크 토글 |
| CSS 변수 | 하드코딩 색상 | 토큰 기반 시스템 |
| 설정 저장 | N/A | `localStorage` 영속화 |
| 시스템 감지 | N/A | `prefers-color-scheme` |

### 핵심 목표

1. 사용자가 원클릭으로 라이트/다크 모드 전환 가능
2. OS 시스템 설정을 자동으로 감지하여 초기값 적용
3. 모든 컴포넌트가 두 테마 모두에서 깨짐 없이 렌더링

---

## 🎯 Approach

> 기존 CSS 구조를 **CSS Custom Properties(변수)** 기반으로 리팩토링하고, `data-theme` 속성을 `<html>` 에 추가하여 전역 테마를 제어한다.

### 설계 결정

- **CSS 변수** 사용 → Tailwind `dark:` variant 대신 순수 CSS 변수 채택
  - 이유: 기존 CSS가 Tailwind 클래스를 쓰지 않으므로 의존성 최소화
- **토글 버튼** 위치: 헤더 우측 상단 (사용자가 가장 먼저 발견하는 위치)
- **전환 애니메이션**: 200ms `transition` → 깜빡임 최소화

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --accent: #0066ff;
}

[data-theme="dark"] {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --text-primary: #e0e0e0;
  --accent: #4d9fff;
}
```

```typescript
// themeManager.ts — 테마 초기화 및 토글 로직
type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

export function initTheme(): void {
  const saved = localStorage.getItem('theme') as Theme | null;
  applyTheme(saved ?? getSystemTheme());
}
```

---

## 📁 Files to Modify

| 파일 | 변경 유형 | 설명 |
| ------ | ----------- | ------ |
| `src/styles/tokens.css` | **신규** | CSS 변수 정의 (라이트/다크) |
| `src/styles/global.css` | 수정 | 하드코딩 색상 → 변수 참조로 교체 |
| `src/components/Header.tsx` | 수정 | 토글 버튼 추가 |
| `src/utils/themeManager.ts` | **신규** | 테마 로직 (초기화, 토글, 영속화) |
| `src/hooks/useTheme.ts` | **신규** | React 훅 래퍼 |
| `index.html` | 수정 | FOUC 방지용 인라인 스크립트 |

---

## ♻️ Reuse

> 새로 작성하기 전에 기존 코드를 먼저 확인했다.

- **`src/utils/storage.ts` → `safeGet()` / `safeSet()`**
  이미 `localStorage` 안전 래퍼가 존재함. `themeManager.ts`에서 그대로 재사용.
- **`src/components/IconButton.tsx`**
  토글 버튼은 새 컴포넌트 없이 기존 `IconButton`에 아이콘만 교체해서 사용.
- **`src/constants/icons.ts` → `SunIcon`, `MoonIcon`**
  아이콘 라이브러리 이미 설치됨. 추가 의존성 불필요.

---

## ✅ Steps

### Phase 1: 기반 작업

- [ ] `tokens.css` 생성 — 라이트/다크 CSS 변수 정의
- [ ] `global.css`에서 하드코딩 색상을 변수로 일괄 교체
- [ ] 각 컴포넌트별 CSS 파일에서 색상값 스캔 (`grep`으로 `#` 또는 `rgb` 검색)
- [ ] 라이트 모드에서 시각적 회귀 없는지 확인

### Phase 2: 테마 로직

- [ ] `themeManager.ts` 작성 — `initTheme()`, `toggleTheme()`, `getTheme()`
- [ ] `useTheme.ts` 훅 작성 — React 컴포넌트에서 사용할 수 있도록 래핑
- [ ] `index.html`에 FOUC(Flash of Unstyled Content) 방지 인라인 스크립트 추가

  ```html
  <script>
    (function() {
      var t = localStorage.getItem('theme');
      if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
    })();
  </script>
  ```

### Phase 3: UI 통합

- [ ] `Header.tsx`에 토글 버튼 추가 (`IconButton` + `SunIcon`/`MoonIcon`)
- [ ] 토글 시 현재 테마에 맞춰 아이콘 자동 전환
- [ ] 전환 애니메이션 200ms `transition` 적용

### Phase 4: 검증

- [ ] 모든 주요 페이지에서 라이트 ↔ 다크 전환 테스트
- [ ] 시스템 설정 변경 시 자동 감지 동작 확인
- [ ] 새로고침 후에도 테마 설정 유지되는지 확인
- [ ] `prefers-color-scheme` 미지원 브라우저 폴백 확인

---

## 🧪 Verification

### 자동화 테스트

```bash
# 1. 타입 체크
npm run typecheck

# 2. 기존 테스트 통과
npm test

# 3. 시각적 회귀 테스트 (Chromatic)
npm run chromatic
```

### 수동 체크리스트

- [ ] 홈페이지 — 다크 모드에서 텍스트 가독성 양호
- [ ] 대시보드 — 차트 색상이 배경과 충돌하지 않음
- [ ] 로그인 페이지 — 입력 필드 테두리가 보임
- [ ] 모달/드롭다운 — 오버레이가 다크 배경에 맞게 조정됨
- [ ] 버튼 hover/focus 상태 — 다크 모드에서도 명확히 구분됨

### 브라우저 지원

| 브라우저 | 최소 버전 | 비고 |
| ---------- | ----------- | ------ |
| Chrome | 88+ | CSS 변수, `prefers-color-scheme` |
| Firefox | 87+ | 전체 지원 |
| Safari | 14+ | 전체 지원 |
| Edge | 88+ | Chromium 기반 |

---

## ⚠️ Risks & Notes

- **서드파티 위젯** (채팅, 분석)이 자체 테마를 가질 수 있음 → 다크 모드에서 어색할 가능성. 별도 처리 필요 시 후속 티켓으로 분리.
- **인라인 스타일**이 남아있는 컴포넌트는 변수가 적용되지 않음 → `grep`으로 `style=` 사용처 전수 조사 완료 (3곳 발견, Phase 1에서 수정).

---

## 📌 Open Questions

1. 토글 버튼 위치를 **헤더** vs **사용자 설정 드롭다운** 중 어디로? → 헤더 우선 (빠른 접근)
2. `auto` 모드(시스템 추종)를 별도 옵션으로 둘 것인가? → MVP에서는 제외, 피드백 후 검토
