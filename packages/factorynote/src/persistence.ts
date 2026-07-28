// M3 Persistence — `.factorynote/state.json` atomic r/w + 감사 로그.
// 신뢰성 = 얇은 코드(NFR-2: 결정론적). 산출물 작성 = 프로토콜(에이전트).
// 인터페이스만 정의; write-then-rename + 스키마 검증 구현은 구현 계획(Stage 5) 확정 후.

import type { PipelineState } from "./types.ts";

export interface Persistence {
	load(): Promise<PipelineState | null>;
	/** atomic write-then-rename + 스키마 검증 + 감사 로그 기록. */
	save(state: PipelineState): Promise<void>;
}
