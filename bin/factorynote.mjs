#!/usr/bin/env node
// @factorynote CLI — Tier 0 진입점(순수 Node, 의존 0). ADR-003.
// 파이프라인 상태 조회/검사. 본 구동(에이전트·게이트)은 pi 의 /factorynote 확장이 담당.
//   factorynote status [feature]   상태 출력(기능명 생략 시 전체 목록)
//   factorynote <feature>          = status <feature>
//   factorynote help               사용법
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const HOME = process.env.FACTORYNOTE_HOME || process.cwd();
const ROOT = join(HOME, ".factorynote");

// 레거시 state(고정 3단계, stages 필드 없음) 위치→이름 폴백.
const LEGACY_STAGE_NAMES = [
	"",
	"요청 이해·시나리오",
	"모듈·클래스 설계",
	"구현 계획",
];

function stageName(s) {
	if (Array.isArray(s.stages)) return s.stages[s.stage - 1] ?? "?";
	return LEGACY_STAGE_NAMES[s.stage] || "?";
}

async function readState(feature) {
	try {
		const raw = await readFile(join(ROOT, feature, "state.json"), "utf8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function fmt(s) {
	if (!s) return "(상태 없음)";
	const name = stageName(s);
	const total = Array.isArray(s.stages) ? s.stages.length : 3;
	return `feature=${s.feature} stage=${s.stage}/${total}(${name}) gateOpen=${s.gateOpen} done=${s.done} loop=${s.loopCount} updated=${new Date(s.updatedAt).toISOString()}`;
}

async function statusOne(feature) {
	const s = await readState(feature);
	if (!s) {
		console.log(`factorynote: "${feature}" 파이프라인 상태가 없습니다.`);
		console.log(
			`  pi 세션에서 /factorynote 로 plan 모드를 켜고 기능을 요청하세요.`,
		);
		return 0;
	}
	console.log(fmt(s));
	const hist = (s.history || [])
		.map(
			(h) =>
				`  - stage${h.stage} ${h.verdict} @ ${new Date(h.at).toISOString()}`,
		)
		.join("\n");
	if (hist) console.log("이력:\n" + hist);
	return 0;
}

async function statusAll() {
	let entries;
	try {
		entries = await readdir(ROOT, { withFileTypes: true });
	} catch {
		console.log(`factorynote: .factorynote/ 없음 (${ROOT})`);
		return 0;
	}
	const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
	if (dirs.length === 0) {
		console.log("factorynote: 파이프라인 없음.");
		return 0;
	}
	for (const d of dirs) {
		const s = await readState(d);
		console.log(s ? fmt(s) : `${d}: (state.json 손상)`);
	}
	return 0;
}

const HELP = `FactoryNote CLI — human-gated plan pipeline 상태 도구.

사용법:
  factorynote status [feature]   파이프라인 상태 출력(기능명 생략 시 전체)
  factorynote <feature>          = status <feature>
  factorynote help               이 도움말

계획 구동(산출물 작성·게이트)은 pi 에서:
  /factorynote            설정 대시보드(plan 모드 on/off·설정 메뉴)
  (plan 모드에서 기능 요청 → 3단계 게이트 파이프라인)

상태/산출물 위치: .factorynote/<feature>/`;

async function main() {
	const [, , ...args] = process.argv;
	const cmd = args[0];
	if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
		console.log(HELP);
		return 0;
	}
	if (cmd === "status") {
		return args[1] ? statusOne(args[1]) : statusAll();
	}
	if (cmd === "--resume") {
		return statusOne(args[1] || "");
	}
	// factorynote <feature> → 상태 조회.
	return statusOne(cmd);
}

main().then((code) => process.exit(code));
