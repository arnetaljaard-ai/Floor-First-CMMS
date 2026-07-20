import path from "path";

// If TypeScript can't find the plugin's types in this environment, ignore the error.
// @ts-ignore
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ["src/**/*.browser.{test,spec}.{ts,tsx}"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
