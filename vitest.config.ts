import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname ?? process.cwd();

export default defineConfig({
  resolve: {
    alias: {
      "@degenlab/shared-types": path.resolve(root, "packages/shared-types/src/index.ts"),
      "@degenlab/pnl": path.resolve(root, "packages/pnl/src/index.ts"),
      "@degenlab/market-data": path.resolve(root, "packages/market-data/src/index.ts"),
      "@degenlab/solana-adapter": path.resolve(root, "packages/solana-adapter/src/index.ts"),
      "@degenlab/database": path.resolve(root, "packages/database/src/index.ts"),
      "@degenlab/ledger": path.resolve(root, "packages/ledger/src/index.ts"),
      "@degenlab/card-renderer": path.resolve(root, "packages/card-renderer/src/index.ts"),
    },
  },
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    environment: "node",
    testTimeout: 15000,
  },
});
