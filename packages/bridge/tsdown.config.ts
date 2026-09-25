import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: ["src/client.ts", "src/server.ts"],
  exports: true,
  format: "esm",
  platform: "node",
});
