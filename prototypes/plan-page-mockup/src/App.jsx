// FactoryNote Plan 뷰어 — 라우터. hash 로 6 Stage 전환.
// plan/scenarios/impl = PlanPage(마크다운 문서 UI). modules/classes/review = 전용 UI.
import { useState, useEffect } from "react";
import PlanPage from "./components/PlanPage";
import ModuleDesign from "./components/ModuleDesign";
import Classes from "./components/Classes";
import FinalReview from "./components/FinalReview";
import planMd from "./data/plan.md?raw";
import scenariosMd from "./data/scenarios.md?raw";
import implMd from "./data/impl.md?raw";

const routeFromHash = () => {
	const h = window.location.hash;
	if (h.includes("scenarios")) return "scenarios";
	if (h.includes("modules")) return "modules";
	if (h.includes("classes")) return "classes";
	if (h.includes("impl")) return "impl";
	if (h.includes("review")) return "review";
	return "plan";
};

export default function App() {
	const [view, setView] = useState(routeFromHash);
	useEffect(() => {
		const onHash = () => setView(routeFromHash());
		window.addEventListener("hashchange", onHash);
		return () => window.removeEventListener("hashchange", onHash);
	}, []);

	if (view === "modules") return <ModuleDesign />;
	if (view === "classes") return <Classes />;
	if (view === "review") return <FinalReview />;
	if (view === "scenarios")
		return <PlanPage mdSource={scenariosMd} stage={2} />;
	if (view === "impl") return <PlanPage mdSource={implMd} stage={5} />;
	return <PlanPage mdSource={planMd} stage={1} />;
}
