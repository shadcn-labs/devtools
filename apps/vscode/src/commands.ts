import type { BridgeHost } from "@shadcn-labs/devtools-bridge/server";
import { handleBridgeRequest } from "@shadcn-labs/devtools-bridge/server";
import type { CatalogEntry, Command } from "@shadcn-labs/devtools-core";
import { formatCommand } from "@shadcn-labs/devtools-core";
import { detectProject } from "@shadcn-labs/devtools-core/node";
import type { PackageManager } from "@shadcn-labs/devtools-plugin-api";
import type { QuickPickItem, WorkspaceFolder } from "vscode";
import { QuickPickItemKind, window, workspace } from "vscode";

import type { Catalog } from "./catalog";

/** The only folder, or the user's pick when the window has several. */
export const pickWorkspaceFolder = async (
  placeHolder: string
): Promise<WorkspaceFolder | undefined> => {
  const folders = workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    void window.showErrorMessage("Shadcn Labs: open a project folder first.");
    return;
  }
  return folders.length === 1
    ? folders[0]
    : await window.showWorkspaceFolderPick({ placeHolder });
};

/** Same code path as a toolbar install request, so behavior is identical. */
export const installItem = async (
  host: BridgeHost,
  root: string,
  ref: string
): Promise<{ command: string }> =>
  (await handleBridgeRequest(
    { handlers: host, root },
    { ref, type: "install" }
  )) as {
    command: string;
  };

type EntryPick = QuickPickItem & { ref?: string };

const toPicks = (entries: CatalogEntry[]): EntryPick[] => {
  const picks: EntryPick[] = [];
  let registry = "";
  for (const { item, ref, registry: source } of entries) {
    if (source.id !== registry) {
      registry = source.id;
      picks.push({ kind: QuickPickItemKind.Separator, label: source.name });
    }
    const type = item.type.replace(/^registry:/u, "");
    picks.push({
      description: ref,
      detail: `${type} · ${source.name}${item.description ? ` — ${item.description}` : ""}`,
      label: item.title ?? item.name,
      ref,
    });
  }
  return picks;
};

export const addItemCommand = async (host: BridgeHost, catalog: Catalog) => {
  const quickPick = window.createQuickPick<EntryPick>();
  quickPick.title = "Add Registry Item";
  quickPick.placeholder = "Loading Shadcn Labs registries…";
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;
  quickPick.busy = true;
  quickPick.show();

  // Populate in the background so the picker (and its busy state) shows at once.
  const populate = async () => {
    const { entries, errors } = await catalog.load();
    quickPick.items = toPicks(entries);
    quickPick.busy = false;
    quickPick.placeholder =
      entries.length > 0
        ? "Search ogimagecn, shadercn, pdfcn, termcn and shadcn-cssinjs"
        : "No registry items could be loaded";
    if (errors.length > 0) {
      void window.showWarningMessage(
        `Shadcn Labs: some registries could not be loaded (${errors.join("; ")}).`
      );
    }
  };
  void populate();

  const picked = Promise.withResolvers<string | null>();
  quickPick.onDidAccept(() => {
    picked.resolve(quickPick.selectedItems[0]?.ref ?? null);
    quickPick.hide();
  });
  quickPick.onDidHide(() => picked.resolve(null));
  const ref = await picked.promise;
  quickPick.dispose();
  if (!ref) {
    return;
  }
  const folder = await pickWorkspaceFolder(`Install ${ref} into…`);
  if (!folder) {
    return;
  }
  const { command } = await installItem(host, folder.uri.fsPath, ref);
  void window.showInformationMessage(`Shadcn Labs: running ${command}`);
};

const RUNNERS: Record<PackageManager, Command> = {
  bun: { args: [], command: "bunx" },
  npm: { args: [], command: "npx" },
  pnpm: { args: ["dlx"], command: "pnpm" },
  yarn: { args: [], command: "npx" },
};

export const setupToolbarCommand = async (host: BridgeHost) => {
  const folder = await pickWorkspaceFolder(
    "Set up the Shadcn Labs toolbar in…"
  );
  if (!folder) {
    return;
  }
  const project = await detectProject(folder.uri.fsPath);
  const runner = RUNNERS[project?.packageManager ?? "npm"];
  const command: Command = {
    args: [...runner.args, "@shadcn-labs/devtools@latest", "init"],
    command: runner.command,
  };
  await host.run(command, project?.root ?? folder.uri.fsPath);
  void window.showInformationMessage(
    `Shadcn Labs: running ${formatCommand(command)}. Restart your dev server when it finishes.`
  );
};
