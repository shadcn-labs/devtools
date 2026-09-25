import type { ExtensionContext, LogOutputChannel } from "vscode";
import { commands, window, workspace } from "vscode";

import type { BridgeManager } from "./bridges";
import { createBridgeManager } from "./bridges";
import { createCatalog } from "./catalog";
import { addItemCommand, setupToolbarCommand } from "./commands";
import { createEditorHost } from "./host";
import { REGISTRY_VIEW_ID, createRegistryView } from "./registry-view";

let bridges: BridgeManager | undefined;

/** Register a command whose failures surface as an error message, not a crash. */
const register = (log: LogOutputChannel, id: string, run: () => unknown) =>
  commands.registerCommand(id, async () => {
    try {
      await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`${id}: ${message}`);
      void window.showErrorMessage(`Shadcn Labs: ${message}`);
    }
  });

export const activate = async (context: ExtensionContext): Promise<void> => {
  const log = window.createOutputChannel("Shadcn Labs", { log: true });
  const host = createEditorHost();
  const catalog = createCatalog();
  const manager = createBridgeManager({
    host,
    log,
    version: String(context.extension.packageJSON.version),
  });
  const view = createRegistryView({
    extensionUri: context.extensionUri,
    host,
    log,
  });
  bridges = manager;

  context.subscriptions.push(
    log,
    host,
    manager,
    view,
    window.registerWebviewViewProvider(REGISTRY_VIEW_ID, view),
    register(log, "shadcnLabs.addItem", () => addItemCommand(host, catalog)),
    register(log, "shadcnLabs.setupToolbar", () => setupToolbarCommand(host)),
    register(log, "shadcnLabs.restartBridge", async () => {
      await manager.restart();
      window.setStatusBarMessage("Shadcn Labs: toolbar bridge restarted", 3000);
    }),
    register(log, "shadcnLabs.refreshRegistries", () => {
      catalog.clear();
      view.refresh();
    }),
    register(log, "shadcnLabs.showBridgeStatus", () => manager.showStatus()),
    workspace.onDidChangeWorkspaceFolders(() => manager.restart()),
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("shadcnLabs.bridge")) {
        void manager.restart();
      }
    })
  );

  await manager.restart();
};

export const deactivate = async (): Promise<void> => {
  await bridges?.close();
  bridges = undefined;
};
