import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { resolve } from "node:path";

// Two entry points:
//  - index.html   -> the builder (chat + preview iframe + PR button)
//  - preview.html -> renders the AI-generated app from src/generated/
// The preview iframe points at /preview.html so Vite HMR live-refreshes it
// the instant the agent writes files into src/generated/.
export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        preview: resolve(__dirname, "preview.html"),
      },
    },
  },
});
