import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  // `client` is its own entry, so its "use client" directive stays at the top
  // of dist/client.js; Rolldown's generic warning about directives is moot.
  entry: ["src/index.tsx", "src/client.tsx"],
  exports: true,
  format: "esm",
  inputOptions: {
    onLog: (level, log, handler) => {
      if (log.code !== "MODULE_LEVEL_DIRECTIVE") {
        handler(level, log);
      }
    },
  },
  platform: "neutral",
});
