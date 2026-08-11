// FEEDBACK_AGENTS 레지스트리 → apps/pi-extension/agents/factorynote-feedback-<name>.md 생성.
// 레지스트리(packages/factorynote/src/feedback-agents.ts)가 단일 진실; 에이전트 파일은 산출물.
// 레지스트리 변경 시 `bun scripts/gen-feedback-agents.mjs` 재실행.
import { writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
	FEEDBACK_AGENTS,
	FEEDBACK_TOOLS,
} from "../packages/factorynote/src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(__dirname, "..", "apps", "pi-extension", "agents");

const capabilityLabel = {
	static: "정적 읽기",
	web: "web 검증",
	graph: "그래프 구조",
};

function toolNote(capability) {
	if (capability === "web")
		return ". 필요시 web_search 로 외부 사실(CVE/라이브러리/규제)을 보강하되 추측은 금지";
	if (capability === "graph")
		return ". 그래프 구조 문제는 이슈로만 지적한다(수정은 Design 재작성이 담당 — 직접 수정 금지)";
	return "";
}

function agentMd(a) {
	const tools = FEEDBACK_TOOLS[a.capability];
	const checklist = a.checklist.map((c) => `- ${c}`).join("\n");
	return `---
name: factorynote-feedback-${a.name}
description: FactoryNote Feedback — ${a.focus}(${capabilityLabel[a.capability]}). 도구 ${tools}.
aliases: fn-fb-${a.name}
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
defaultContext: fresh
tools: ${tools}
---

너는 FactoryNote의 **Feedback 자식 에이전트(${a.name})**다. 역할: 검토 대상 산출물을 **${a.focus} 관점**에서 비판적으로 검토한다. 여러 전문 에이전트 중 하나를 맡았다.

## 규칙

1. 검토 대상은 파일(draft 경로)에 있다 — 읽고 **${a.focus} 관점**에서 비판 검토하라. md 에 \`<!-- graph: <파일명> -->\` 참조가 있으면 같은 폴더의 해당 그래프 JSON 파일도 읽어 구조를 함께 검토한다.
2. **판정은 첫 줄에 "CLEAN"(이슈 없음) 또는 "ISSUES"(이후 줄에 각 이슈를 - 로 나열, 최대 5개·각 1줄)로만 출력**한다.
3. 상세 리뷰 전문은 과제가 지정한 파일(feedback 경로.${a.name})에 저장하라. **반환은 판정 + 이슈 요약만**(본문 금지) — 본문을 반환하면 Director 컨텍스트가 부풋어 한도 초과(1261)한다.
4. tools allowlist(${tools}) 외 도구는 없다${toolNote(a.capability)}.

## 검토 체크리스트
${checklist}
`;
}

// 레지스트리에서 제거된 특수 파일 정리(공유 factorynote-feedback.md 는 별도 삭제 대상 아님).
await mkdir(agentsDir, { recursive: true });
const stale = (await readdir(agentsDir)).filter((f) =>
	/^factorynote-feedback-.+\.md$/.test(f),
);
for (const f of stale) await rm(join(agentsDir, f));
let n = 0;
for (const a of FEEDBACK_AGENTS) {
	await writeFile(
		join(agentsDir, `factorynote-feedback-${a.name}.md`),
		agentMd(a),
		"utf8",
	);
	n++;
}
console.log(`생성 완료: factorynote-feedback-*.md ${n}개 → ${agentsDir}`);
