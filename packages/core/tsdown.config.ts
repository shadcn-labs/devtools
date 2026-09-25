import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: ["src/index.ts", "src/node.ts"],
  exports: true,
  format: "esm",
  platform: "node",
});
