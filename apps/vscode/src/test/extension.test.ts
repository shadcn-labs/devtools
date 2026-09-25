// Runs under Mocha's TDD UI inside the VS Code extension host (@vscode/test-cli),
// which provides `suite`/`test` as globals; this is not a Vitest file.
/* oxlint-disable vitest/prefer-importing-vitest-globals */
import assert from "node:assert/strict";
import path from "node:path";

import type { BridgeHealth } from "@shadcn-labs/devtools-plugin-api";
import { BRIDGE_HEADER, BRIDGE_PORTS } from "@shadcn-labs/devtools-plugin-api";
import { commands, extensions, window, workspace } from "vscode";

const EXTENSION_ID = "shadcn-labs.shadcn-labs-devtools";

/** Health of every bridge port that answers. */
const probeBridges = async (): Promise<
  { port: number; health: BridgeHealth }[]
> => {
  const results = await Promise.all(
    BRIDGE_PORTS.map(async (port) => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, {
          headers: { [BRIDGE_HEADER]: "1" },
          signal: AbortSignal.timeout(1000),
        });
        return { health: (await res.json()) as BridgeHealth, port };
      } catch {
        // Port closed or another service.
        return null;
      }
    })
  );
  return results.filter((result) => result !== null);
};

/** Port of the VS Code bridge serving `root`. */
const findBridge = async (root: string): Promise<number | null> => {
  const bridges = await probeBridges();
  const match = bridges.find(
    ({ health }) => health.host === "vscode" && health.root === root
  );
  return match?.port ?? null;
};

suite("Shadcn Labs extension", () => {
  let root = "";

  suiteSetup(async () => {
    const folder = workspace.workspaceFolders?.[0];
    assert.ok(folder, "fixture workspace is open");
    root = folder.uri.fsPath;
    const extension = extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} is installed`);
    await extension.activate();
    assert.equal(extension.isActive, true);
  });

  test("bridge health reports the VS Code host and the fixture root", async () => {
    assert.notEqual(await findBridge(root), null);
  });

  test("open-og-source opens the metadata image file in the editor", async () => {
    const port = await findBridge(root);
    assert.ok(port);
    const res = await fetch(`http://127.0.0.1:${port}/request`, {
      body: JSON.stringify({ pathname: "/", type: "open-og-source" }),
      headers: { "content-type": "application/json", [BRIDGE_HEADER]: "1" },
      method: "POST",
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      file: path.join("app", "opengraph-image.tsx"),
    });
    assert.equal(
      window.activeTextEditor?.document.uri.fsPath,
      path.join(root, "app", "opengraph-image.tsx")
    );
  });

  test("every contributed command is registered", async () => {
    const extension = extensions.getExtension(EXTENSION_ID);
    assert.ok(extension);
    const contributed = (
      extension.packageJSON.contributes.commands as { command: string }[]
    ).map((c) => c.command);
    assert.deepEqual(contributed.toSorted(), [
      "shadcnLabs.addItem",
      "shadcnLabs.refreshRegistries",
      "shadcnLabs.restartBridge",
      "shadcnLabs.setupToolbar",
      "shadcnLabs.showBridgeStatus",
    ]);
    const registered = new Set(await commands.getCommands(true));
    for (const id of contributed) {
      assert.ok(registered.has(id), `${id} is registered`);
    }
  });
});
