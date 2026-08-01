#!/usr/bin/env bash
# factorynote install — pi 확장을 로컬 pi(~/.pi/agent/extensions/)에 설치.
# pi는 jiti 로 TS 를 직접 로드하므로 컴파일 불필; @factorynote/core 는 로컬
# node_modules 패키지로 복사해 import 해석, 뷰어 dist 도 함께 배치.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
EXT_DIR="$AGENT_DIR/extensions/factorynote"

echo "factorynote install → $EXT_DIR"

# 1) 뷰어 빌드 보장.
if [ ! -f "$ROOT/prototypes/plan-page-mockup/dist/index.html" ]; then
	echo "  뷰어 빌드 중…"
	(cd "$ROOT/prototypes/plan-page-mockup" && npm install --silent && npm run build)
fi

# 2) 기존 설치 정리 후 재배치.
rm -rf "$EXT_DIR"
mkdir -p "$EXT_DIR/node_modules/@factorynote/core" "$EXT_DIR/viewer"

# 확장 TS 진입점(+형제 모듈).
cp "$ROOT/apps/pi-extension/src/index.ts" "$EXT_DIR/index.ts"
cp "$ROOT/apps/pi-extension/src/plan-tool.ts" "$EXT_DIR/plan-tool.ts"
cp "$ROOT/apps/pi-extension/src/gate-server.ts" "$EXT_DIR/gate-server.ts"

# 코어를 로컬 패키지로(@factorynote/core import 해석용). src/protocol/package.json 만.
cp -R "$ROOT/packages/factorynote/src" "$EXT_DIR/node_modules/@factorynote/core/src"
cp -R "$ROOT/packages/factorynote/protocol" "$EXT_DIR/node_modules/@factorynote/core/protocol"
cat >"$EXT_DIR/node_modules/@factorynote/core/package.json" <<'JSON'
{
  "name": "@factorynote/core",
  "version": "0.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts", "./protocol/*": "./protocol/*" }
}
JSON

# 뷰어 빌드 산출물.
cp -R "$ROOT/prototypes/plan-page-mockup/dist/." "$EXT_DIR/viewer/dist/"

# 확장 메타(pi 가 index.ts 자동 발견; type:module 로 ESM 인식 보조).
cat >"$EXT_DIR/package.json" <<'JSON'
{
  "name": "factorynote",
  "version": "0.0.0",
  "type": "module"
}
JSON

echo "설치 완료."
echo "  새 pi 세션에서: /factorynote   (plan 모드 토글)"
echo "  상태 조회 CLI : factorynote status   (또는 factorynote <feature>)"
