import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: ["src/index.ts"],
  exports: {
    customExports: (exports) => ({
      ...exports,
      ".": { default: "./dist/index.js", types: "./dist/index.d.ts" },
    }),
  },
  format: "esm",
  platform: "browser",
});
