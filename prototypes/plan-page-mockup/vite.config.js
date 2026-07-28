import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 시안 A(모노톤) React 목업 — Vite 설정
export default defineConfig({
	plugins: [react()],
	server: { port: 5173, open: true },
});
