import path from "node:path";

import type {
  BridgeHost,
  BridgeServer,
} from "@shadcn-labs/devtools-bridge/server";
import { startBridgeServer } from "@shadcn-labs/devtools-bridge/server";
import { findProjectRoot } from "@shadcn-labs/devtools-core/node";
import type { Disposable, LogOutputChannel, QuickPickItem } from "vscode";
import {
  MarkdownString,
  QuickPickItemKind,
  StatusBarAlignment,
  commands,
  window,
  workspace,
} from "vscode";

export interface BridgeManager extends Disposable {
  /** Stop every bridge and start one per project folder per current settings. */
  restart: () => Promise<void>;
  showStatus: () => Promise<void>;
  /** Stop every bridge and remove the status bar item. */
  close: () => Promise<void>;
}

interface Running {
  root: string;
  server: BridgeServer;
}

interface Failed {
  root: string;
  error: string;
}

/** Origins from settings; anything that is not a bare http(s) origin is dropped. */
const readAllowedOrigins = (log: LogOutputChannel): string[] => {
  const raw = workspace
    .getConfiguration("shadcnLabs.bridge")
    .get<unknown[]>("allowedOrigins", []);
  const origins: string[] = [];
  for (const value of raw) {
    try {
      const url = new URL(String(value));
      if (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.origin === value
      ) {
        origins.push(value);
        continue;
      }
    } catch {
      // Reported below.
    }
    log.warn(
      `Ignoring invalid shadcnLabs.bridge.allowedOrigins entry: ${String(value)}`
    );
  }
  return origins;
};

export const createBridgeManager = ({
  host,
  log,
  version,
}: {
  host: BridgeHost;
  log: LogOutputChannel;
  version: string;
}): BridgeManager => {
  let running: Running[] = [];
  let failed: Failed[] = [];
  let enabled = true;
  // Serializes restarts triggered by overlapping folder/config events.
  let queue: Promise<void> = Promise.resolve();

  const status = window.createStatusBarItem(
    "shadcnLabs.bridge",
    StatusBarAlignment.Right,
    100
  );
  status.name = "Shadcn Labs Bridge";
  status.command = "shadcnLabs.showBridgeStatus";

  const render = () => {
    if (!enabled) {
      status.text = "$(beaker) Labs: off";
      status.tooltip =
        "Shadcn Labs toolbar bridge is disabled (shadcnLabs.bridge.enabled).";
      status.show();
      return;
    }
    if (running.length === 0 && failed.length === 0) {
      status.hide();
      return;
    }
    const ports = running.map((r) => `:${r.server.port}`).join(" ");
    status.text =
      failed.length > 0
        ? `$(warning) Labs ${ports}`.trimEnd()
        : `$(beaker) Labs ${ports}`;
    const tooltip = new MarkdownString("**Shadcn Labs toolbar bridge**\n\n");
    for (const r of running) {
      tooltip.appendMarkdown(`- \`127.0.0.1:${r.server.port}\` — `);
      tooltip.appendText(r.root);
      tooltip.appendMarkdown("\n");
    }
    for (const f of failed) {
      tooltip.appendMarkdown("- not running — ");
      tooltip.appendText(`${f.root}: ${f.error}`);
      tooltip.appendMarkdown("\n");
    }
    status.tooltip = tooltip;
    status.show();
  };

  const stopAll = async () => {
    const closing = running;
    running = [];
    failed = [];
    await Promise.all(
      closing.map(async ({ root, server }) => {
        await server.close();
        log.info(`Bridge stopped on port ${server.port} (${root})`);
      })
    );
  };

  const warnStartFailure = async (root: string, message: string) => {
    const choice = await window.showWarningMessage(
      `Shadcn Labs toolbar bridge could not start for ${path.basename(root)}: ${message}`,
      "Show Log"
    );
    if (choice) {
      log.show();
    }
  };

  const doRestart = async () => {
    await stopAll();
    enabled = workspace
      .getConfiguration("shadcnLabs.bridge")
      .get("enabled", true);
    if (!enabled) {
      log.info("Bridge disabled by shadcnLabs.bridge.enabled.");
      render();
      return;
    }
    const allowedOrigins = readAllowedOrigins(log);
    const roots: string[] = [];
    for (const folder of workspace.workspaceFolders ?? []) {
      const root = folder.uri.fsPath;
      // Only folders that are themselves a project (a monorepo root counts).
      if (folder.uri.scheme === "file" && findProjectRoot(root) === root) {
        roots.push(root);
      } else {
        log.info(`Skipping ${root}: no package.json`);
      }
    }
    // Concurrent starts are safe: a server that loses a port race gets
    // EADDRINUSE and moves on to the next bridge port.
    const results = await Promise.allSettled(
      roots.map((root) =>
        startBridgeServer({
          allowedOrigins,
          handlers: host,
          host: "vscode",
          root,
          version,
        })
      )
    );
    for (const [index, result] of results.entries()) {
      const root = roots[index] ?? "";
      if (result.status === "fulfilled") {
        running.push({ root, server: result.value });
        log.info(
          `Bridge listening on 127.0.0.1:${result.value.port} for ${root}`
        );
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        failed.push({ error: message, root });
        log.warn(`Bridge failed for ${root}: ${message}`);
        void warnStartFailure(root, message);
      }
    }
    render();
  };

  /** Run `task` after every previously queued task has settled. */
  const enqueue = (task: () => Promise<void>): Promise<void> => {
    const previous = queue;
    queue = (async () => {
      try {
        await previous;
      } catch {
        // The previous task already reported its failure.
      }
      await task();
    })();
    return queue;
  };

  const restart = () => enqueue(doRestart);

  const showStatus = async () => {
    type Item = QuickPickItem & { run?: () => unknown };
    const items: Item[] = [
      ...running.map((r): Item => ({
        description: `127.0.0.1:${r.server.port}`,
        detail: r.root,
        label: `$(pass) ${path.basename(r.root)}`,
      })),
      ...failed.map((f): Item => ({
        description: "not running",
        detail: f.error,
        label: `$(warning) ${path.basename(f.root)}`,
      })),
    ];
    if (items.length === 0) {
      items.push({
        label: enabled
          ? "$(info) No workspace folder with a package.json"
          : "$(circle-slash) Bridge disabled",
      });
    }
    items.push(
      { kind: QuickPickItemKind.Separator, label: "" },
      enabled
        ? {
            label: "$(debug-restart) Restart Toolbar Bridge",
            run: () => commands.executeCommand("shadcnLabs.restartBridge"),
          }
        : {
            label: "$(settings-gear) Enable in Settings",
            run: () =>
              commands.executeCommand(
                "workbench.action.openSettings",
                "shadcnLabs.bridge.enabled"
              ),
          },
      { label: "$(output) Show Log", run: () => log.show() }
    );
    const picked = await window.showQuickPick(items, {
      placeHolder: "Shadcn Labs toolbar bridge",
    });
    await picked?.run?.();
  };

  const close = () => {
    status.dispose();
    return enqueue(stopAll);
  };

  return {
    close,
    dispose() {
      void close();
    },
    restart,
    showStatus,
  };
};
