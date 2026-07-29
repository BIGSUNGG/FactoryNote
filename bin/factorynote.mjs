#!/usr/bin/env node
// @factorynote CLI — Tier 0 진입점 (순수 Node, 의존 0). ADR-003.
// `/factorynote <feature>` 의 독립 CLI 투영. Pi 내부에서는 M5 바인딩이 직접 호출.
// 구현은 Stage 5: apps/pi-extension 의 factorynote() 로 위임 예정.

const [, , feature] = process.argv;

if (!feature) {
	console.error("usage: factorynote <feature>");
	console.error("       factorynote --resume <feature>");
	process.exit(2);
}

console.error(`factorynote: "${feature}" — not implemented (Stage 5)`);
process.exit(1);
