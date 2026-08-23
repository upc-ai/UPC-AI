import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    // userEvent pointer-event sequences are macrotask-heavy; cold-disk dev
    // machines (and first CI runs) blow past the 5s default.
    testTimeout: 15_000,
  },
});
