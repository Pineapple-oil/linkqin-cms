import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 后台管理端：React + Vite。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 代理到后端，避免开发期 CORS。
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
