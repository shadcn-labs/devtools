import type { UserConfig } from "tsdown";
import { defineConfig } from "tsdown";

// The .vsix ships without node_modules: everything except the `vscode` module
// provided by the extension host is bundled.
const node: UserConfig = {
  deps: {
    alwaysBundle: [/^@shadcn-labs\//u],
    neverBundle: ["vscode"],
    onlyBundle: false,
  },
  dts: false,
  fixedExtension: true,
  format: "cjs",
  platform: "node",
  target: "node20",
};

export default defineConfig([
  {
    ...node,
    entry: { extension: "src/extension.ts" },
    name: "extension",
  },
  {
    ...node,
    clean: false,
    entry: { "test/extension.test": "src/test/extension.test.ts" },
    name: "test",
  },
  {
    clean: false,
    deps: { alwaysBundle: [/.*/u], onlyBundle: false },
    dts: false,
    entry: { webview: "src/webview.ts" },
    format: "iife",
    minify: true,
    // tsdown appends `.iife`; the webview HTML references dist/webview.js.
    outputOptions: { entryFileNames: "[name].js" },
    platform: "browser",
    target: "chrome120",
  },
]);
