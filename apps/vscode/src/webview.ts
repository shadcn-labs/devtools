import type { RegistryBrowserHost } from "@shadcn-labs/devtools-toolbar";
import { mountRegistryBrowser } from "@shadcn-labs/devtools-toolbar";

import type { ExtensionMessage, HostRequest, WebviewMessage } from "./protocol";

declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewMessage) => void;
};

const vscode = acquireVsCodeApi();
const container = document.querySelector<HTMLElement>("#root");
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
let nextId = 0;
let unmount: (() => void) | undefined;

/** Post a request to the extension host; returns its id. */
const send = (request: HostRequest): number => {
  nextId += 1;
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- VS Code webview API, not window.postMessage; it takes no targetOrigin.
  vscode.postMessage({ id: nextId, request, type: "request" });
  return nextId;
};

/** RPC to the extension host; settles when the matching response arrives. */
const call = (request: HostRequest): Promise<unknown> => {
  const { promise, reject, resolve } = Promise.withResolvers<unknown>();
  pending.set(send(request), { reject, resolve });
  return promise;
};

const mount = (init: Extract<ExtensionMessage, { type: "init" }>) => {
  if (!container) {
    return;
  }
  unmount?.();
  // notify/openExternal are fire-and-forget: the extension logs failures and
  // responses to untracked ids are ignored below.
  const host: RegistryBrowserHost = {
    async copy(text) {
      await call({ method: "copy", text });
    },
    notify(message, tone) {
      send({ message, method: "notify", tone });
    },
    openExternal(url) {
      send({ method: "openExternal", url });
    },
    project: init.project,
  };
  if (init.canInstall) {
    host.install = async (ref) =>
      (await call({ method: "install", ref })) as { command: string };
  }
  unmount = mountRegistryBrowser(container, host);
};

window.addEventListener("message", (event: MessageEvent<ExtensionMessage>) => {
  const message = event.data;
  if (!message || typeof message !== "object") {
    return;
  }
  if (message.type === "init") {
    mount(message);
    return;
  }
  if (message.type === "response") {
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (message.ok) {
      entry?.resolve(message.result);
    } else {
      entry?.reject(new Error(message.error));
    }
  }
});

// oxlint-disable-next-line unicorn/require-post-message-target-origin -- VS Code webview API, not window.postMessage; it takes no targetOrigin.
vscode.postMessage({ type: "ready" });
