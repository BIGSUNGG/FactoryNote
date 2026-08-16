import { resolveRepoRoot } from "./repro-serve.mjs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drivePlan } from "../apps/pi-extension/src/plan-tool.ts";

const root = await mkdtemp(join(tmpdir(), "fn-repro-"));
const VIEWER_DIST = resolveRepoRoot("apps/plan-viewer/dist");
let gateUrl = "(no onReady)";

const out = await drivePlan({
  root,
  viewerDistDir: VIEWER_DIST,
  feature: "reprofeat",
  artifactMd: "# Stage 1\n\n데모 산출물.",
  onReady: async (url) => {
    gateUrl = url;
    const s = await (await fetch(url + "/api/state")).json();
    console.log("onReady fired. url=", url, "gateOpen=", s.gateOpen, "stage=", s.stage);
    await fetch(url + "/api/decision", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({verdict:"confirm", comments:[]}) });
  },
});
console.log("drivePlan result: stage=", out.stage, "done=", out.done, "verdict=", out.gateResult?.verdict);
console.log("gateUrl:", gateUrl);
