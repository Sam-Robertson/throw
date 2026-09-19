import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for pure library code (src/**/*.test.ts). Nothing here touches
// the database or Stripe.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
