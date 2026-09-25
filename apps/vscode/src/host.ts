import type { BridgeHost } from "@shadcn-labs/devtools-bridge/server";
import { formatCommand } from "@shadcn-labs/devtools-core";
import type { Disposable, Terminal } from "vscode";
import { Uri, window } from "vscode";

export type EditorHost = BridgeHost & Disposable;

/**
 * Editor-side effects shared by the bridge, the Registries view and commands:
 * one reusable "Shadcn Labs" terminal per cwd, and opening files.
 */
export const createEditorHost = (): EditorHost => {
  const terminals = new Map<string, Terminal>();
  const onClose = window.onDidCloseTerminal((closed) => {
    for (const [cwd, terminal] of terminals) {
      if (terminal === closed) {
        terminals.delete(cwd);
      }
    }
  });

  return {
    dispose() {
      onClose.dispose();
      terminals.clear();
    },
    async openFile(file) {
      await window.showTextDocument(Uri.file(file), { preview: false });
    },
    // `command.args` are validated tokens (core `parseItemRef`), safe to join.
    run(command, cwd) {
      let terminal = terminals.get(cwd);
      if (!terminal || terminal.exitStatus !== undefined) {
        terminal = window.createTerminal({ cwd, name: "Shadcn Labs" });
        terminals.set(cwd, terminal);
      }
      terminal.show();
      terminal.sendText(formatCommand(command));
      return Promise.resolve();
    },
  };
};
