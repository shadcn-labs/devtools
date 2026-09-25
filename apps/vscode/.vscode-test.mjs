import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@vscode/test-cli";

// Fresh copy per run so the test never touches the checked-in fixture.
const workspaceFolder = mkdtempSync(path.join(tmpdir(), "shadcn-labs-vscode-"));
cpSync(
  fileURLToPath(new URL("test-fixture", import.meta.url)),
  workspaceFolder,
  {
    recursive: true,
  }
);
process.on("exit", () =>
  rmSync(workspaceFolder, { force: true, recursive: true })
);

export default defineConfig({
  files: "dist/test/**/*.test.cjs",
  launchArgs: [
    "--disable-extensions",
    "--skip-welcome",
    "--skip-release-notes",
  ],
  mocha: { timeout: 30_000, ui: "tdd" },
  version: "stable",
  workspaceFolder,
});
