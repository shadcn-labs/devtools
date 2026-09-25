import { randomUUID } from "node:crypto";

import type { BridgeHost } from "@shadcn-labs/devtools-bridge/server";
import { LABS_REGISTRIES } from "@shadcn-labs/devtools-core";
import { detectProject } from "@shadcn-labs/devtools-core/node";
import type { ProjectInfo } from "@shadcn-labs/devtools-plugin-api";
import type {
  Disposable,
  LogOutputChannel,
  Webview,
  WebviewView,
  WebviewViewProvider,
} from "vscode";
import { Uri, env, window, workspace } from "vscode";

import { installItem } from "./commands";
import type { ExtensionMessage, HostRequest } from "./protocol";
import { parseWebviewMessage } from "./protocol";

export const REGISTRY_VIEW_ID = "shadcnLabs.registry";

export interface RegistryView extends WebviewViewProvider, Disposable {
  /** Reload the webview (drops its in-memory registry cache). */
  refresh: () => void;
}

// Theme contract of the registry browser, mapped onto VS Code theme colors.
const THEME = `:root {
  --sl-background: var(--vscode-sideBar-background);
  --sl-foreground: var(--vscode-foreground);
  --sl-muted: var(--vscode-input-background);
  --sl-muted-foreground: var(--vscode-descriptionForeground);
  --sl-border: var(--vscode-panel-border);
  --sl-primary: var(--vscode-button-background);
  --sl-primary-foreground: var(--vscode-button-foreground);
  --sl-destructive: var(--vscode-errorForeground);
  --sl-warning: var(--vscode-editorWarning-foreground);
  --sl-success: var(--vscode-testing-iconPassed);
  --sl-radius: 4px;
  --sl-font-family: var(--vscode-font-family);
  --sl-font-mono: var(--vscode-editor-font-family);
  --sl-font-size: var(--vscode-font-size);
}
html, body, #root { height: 100%; }
body {
  margin: 0;
  padding: 0;
  background: var(--sl-background);
  color: var(--sl-foreground);
  font-family: var(--sl-font-family);
  font-size: var(--sl-font-size);
}`;

const renderHtml = (webview: Webview, extensionUri: Uri): string => {
  const nonce = randomUUID().replaceAll("-", "");
  const script = webview.asWebviewUri(
    Uri.joinPath(extensionUri, "dist", "webview.js")
  );
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src ${webview.cspSource} 'nonce-${nonce}'`,
    `img-src ${webview.cspSource} https:`,
    `font-src ${webview.cspSource}`,
    `connect-src ${LABS_REGISTRIES.map((source) => source.fetchOrigin).join(" ")}`,
  ].join("; ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta property="csp-nonce" nonce="${nonce}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shadcn Labs Registries</title>
<style nonce="${nonce}">${THEME}</style>
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}" src="${script.toString()}"></script>
</body>
</html>`;
};

/** Project of the active editor's workspace folder, else the first folder. */
const activeFolder = (): Uri | undefined => {
  const document = window.activeTextEditor?.document;
  const folder = document
    ? workspace.getWorkspaceFolder(document.uri)
    : undefined;
  const uri = (folder ?? workspace.workspaceFolders?.[0])?.uri;
  return uri?.scheme === "file" ? uri : undefined;
};

export const createRegistryView = ({
  extensionUri,
  host,
  log,
}: {
  extensionUri: Uri;
  host: BridgeHost;
  log: LogOutputChannel;
}): RegistryView => {
  let view: WebviewView | undefined;
  let folder: string | undefined;
  let project: ProjectInfo | null = null;

  const post = (message: ExtensionMessage) =>
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- vscode.Webview.postMessage, not window.postMessage; it takes no targetOrigin.
    view?.webview.postMessage(message);

  const sendInit = async () => {
    folder = activeFolder()?.fsPath;
    project = folder ? await detectProject(folder) : null;
    await post({ canInstall: project !== null, project, type: "init" });
  };

  const perform = async (request: HostRequest): Promise<unknown> => {
    switch (request.method) {
      case "copy": {
        await env.clipboard.writeText(request.text);
        return null;
      }
      case "install": {
        if (!project) {
          throw new Error(
            "Open a folder with a package.json to install items."
          );
        }
        return installItem(host, project.root, request.ref);
      }
      case "notify": {
        const show =
          request.tone === "error"
            ? window.showErrorMessage
            : window.showInformationMessage;
        void show(request.message);
        return null;
      }
      case "openExternal": {
        return env.openExternal(Uri.parse(request.url, true));
      }
      default: {
        throw new Error("Unknown request");
      }
    }
  };

  const onMessage = async (raw: unknown) => {
    const message = parseWebviewMessage(raw);
    if (!message) {
      log.warn(
        `Ignoring malformed message from the Registries view: ${JSON.stringify(raw)}`
      );
      return;
    }
    if (message.type === "ready") {
      await sendInit();
      return;
    }
    const { id, request } = message;
    try {
      const result = await perform(request);
      await post({ id, ok: true, result, type: "response" });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      log.warn(`Registries view ${request.method} failed: ${text}`);
      await post({ error: text, id, ok: false, type: "response" });
    }
  };

  // Re-target the view when the active editor moves to another folder.
  const onEditor = window.onDidChangeActiveTextEditor(() => {
    if (view && activeFolder()?.fsPath !== folder) {
      void sendInit();
    }
  });
  const onFolders = workspace.onDidChangeWorkspaceFolders(() => {
    if (view) {
      void sendInit();
    }
  });

  return {
    dispose() {
      onEditor.dispose();
      onFolders.dispose();
    },
    refresh() {
      if (view) {
        view.webview.html = renderHtml(view.webview, extensionUri);
      }
    },
    resolveWebviewView(resolved) {
      view = resolved;
      resolved.webview.options = {
        enableScripts: true,
        localResourceRoots: [Uri.joinPath(extensionUri, "dist")],
      };
      resolved.webview.onDidReceiveMessage(onMessage);
      resolved.onDidDispose(() => {
        if (view === resolved) {
          view = undefined;
        }
      });
      resolved.webview.html = renderHtml(resolved.webview, extensionUri);
    },
  };
};
