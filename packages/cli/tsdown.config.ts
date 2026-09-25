import { defineConfig } from "tsdown";

// A bin, not a library: no type declarations or `exports` map.
export default defineConfig({
  dts: false,
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
});
