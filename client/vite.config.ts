import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const root = path.resolve(__dirname, "..");
  const env = loadEnv(mode, root, "");
  const relays = env.RELAYS || process.env.RELAYS;
  if (relays && !process.env.VITE_RELAYS) {
    process.env.VITE_RELAYS = relays;
  }
  if (mode === "test") {
    if (!process.env.VITE_RELAYS) process.env.VITE_RELAYS = "wss://test.relay";
    if (!process.env.VITE_BLOSSOM_UPLOAD_URL) process.env.VITE_BLOSSOM_UPLOAD_URL = "https://test.blossom/upload";
  }
  return {
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});