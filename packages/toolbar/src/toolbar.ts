import { connectBridge } from "@shadcn-labs/devtools-bridge/client";
import type {
  BridgeClient,
  DevtoolsPlugin,
  NotifyTone,
  ProjectInfo,
  ToolbarContext,
  ToolbarPanel,
} from "@shadcn-labs/devtools-plugin-api";
import { ogimagecnPlugin } from "@shadcn-labs/devtools-plugin-ogimagecn";

import { copyText, escapeHtml, injectStyle } from "./dom";
import { ICONS, LOGO } from "./icons";
import { holdNavigation, onNavigate } from "./navigation";
import { mountRegistryBrowser } from "./registry-browser";

import { TOOLBAR_CSS } from "./toolbar.css";

export const BUILTIN_PLUGINS: DevtoolsPlugin[] = [ogimagecnPlugin];

export interface MountToolbarOptions {
  /** Project facts from the dev adapter; null enables every plugin. */
  project?: ProjectInfo | null;
  /** Plugins to offer (default `BUILTIN_PLUGINS`); each still passes `detect`. */
  plugins?: DevtoolsPlugin[];
}

const TAG = "shadcn-labs-devtools";
const STATE_KEY = "shadcn-labs-devtools:toolbar";
const REGISTRIES_TAB = "registries";
const TOAST_LIMIT = 3;
/** Shared across bundle copies so a second copy reuses the mounted toolbar. */
const INSTANCE = Symbol.for("shadcn-labs-devtools.toolbar");

interface ToolbarInstance {
  holders: number;
  destroy: () => void;
}

type ToolbarElement = HTMLElement & { [INSTANCE]?: ToolbarInstance };

interface Tab {
  id: string;
  title: string;
  icon: string;
  mount: ToolbarPanel["mount"];
}

interface SavedState {
  open: boolean;
  tab: string;
}

type BridgeState = "connected" | "connecting" | "disconnected" | "idle";

const TOAST_ICONS: Record<NotifyTone, string> = {
  error: ICONS.alert,
  info: ICONS.info,
  success: ICONS.circleCheck,
};

const readState = (): SavedState | null => {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(STATE_KEY) ?? "null"
    ) as Partial<SavedState> | null;
    return value &&
      typeof value.open === "boolean" &&
      typeof value.tab === "string"
      ? { open: value.open, tab: value.tab }
      : null;
  } catch {
    return null;
  }
};

const basename = (path: string) =>
  path.replaceAll("\\", "/").replace(/\/+$/u, "").split("/").pop() ?? path;

const isEnabled = (plugin: DevtoolsPlugin, project: ProjectInfo | null) => {
  if (!plugin.toolbar) {
    return false;
  }
  if (!project) {
    return true;
  }
  try {
    return plugin.detect(project);
  } catch (error) {
    console.warn(`[shadcn-labs-devtools] ${plugin.id}.detect failed`, error);
    return false;
  }
};

const createToolbar = (
  element: ToolbarElement,
  options: MountToolbarOptions
): ToolbarInstance => {
  const project = options.project ?? null;
  const shadow = element.attachShadow({ mode: "open" });
  injectStyle(shadow, TOOLBAR_CSS);

  const tabs: Tab[] = [
    {
      icon: ICONS.blocks,
      id: REGISTRIES_TAB,
      mount: (container, ctx) => {
        const { bridge } = ctx;
        return mountRegistryBrowser(container, {
          copy: copyText,
          install: bridge
            ? (ref) => bridge.request({ ref, type: "install" })
            : undefined,
          notify: ctx.notify,
          openExternal: (url) => {
            window.open(url, "_blank", "noopener");
          },
          project: ctx.project,
        });
      },
      title: "Registries",
    },
  ];
  for (const plugin of options.plugins ?? BUILTIN_PLUGINS) {
    if (plugin.toolbar && isEnabled(plugin, project)) {
      tabs.push({
        icon: plugin.toolbar.icon,
        id: `plugin:${plugin.id}`,
        mount: plugin.toolbar.mount,
        title: plugin.toolbar.title,
      });
    }
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <section class="sl-panel" role="dialog" aria-label="Shadcn Labs devtools" hidden>
      <header class="sl-header">
        <div class="sl-brand">${LOGO}<span>Shadcn Labs</span><span class="sl-brand-sub">devtools</span></div>
        <button type="button" class="sl-icon-btn" data-action="close" aria-label="Close" title="Close (Esc)">${ICONS.x}</button>
      </header>
      <nav class="sl-tabs" role="tablist" aria-label="Devtools panels">${tabs
        .map(
          (tab) =>
            `<button type="button" class="sl-tab" role="tab" data-tab="${escapeHtml(tab.id)}" aria-selected="false">${tab.icon}<span>${escapeHtml(tab.title)}</span></button>`
        )
        .join("")}</nav>
      <div class="sl-main"><div class="sl-body" role="tabpanel"></div></div>
      <footer class="sl-footer"><span class="sl-dot"></span><span class="sl-status"></span></footer>
    </section>
    <div class="sl-toasts" aria-live="polite"></div>
    <button type="button" class="sl-launcher" aria-label="Shadcn Labs devtools" aria-expanded="false" aria-keyshortcuts="Alt+Shift+L" title="Shadcn Labs devtools (Alt+Shift+L)">${LOGO}</button>`;
  shadow.append(...wrapper.childNodes);

  const panel = shadow.querySelector(".sl-panel") as HTMLElement;
  const main = shadow.querySelector(".sl-main") as HTMLElement;
  const body = shadow.querySelector(".sl-body") as HTMLElement;
  const footer = shadow.querySelector(".sl-footer") as HTMLElement;
  const toasts = shadow.querySelector(".sl-toasts") as HTMLElement;
  const launcher = shadow.querySelector(".sl-launcher") as HTMLButtonElement;

  const saved = readState();
  let open = false;
  let activeTab = tabs.some((tab) => tab.id === saved?.tab)
    ? (saved?.tab ?? REGISTRIES_TAB)
    : REGISTRIES_TAB;
  let cleanupPanel: (() => void) | null = null;
  let bridge: BridgeClient | null = null;
  let bridgeState: BridgeState = "idle";
  let destroyed = false;
  const subscriptions = new Set<() => void>();
  const releaseNavigation = holdNavigation();

  const notify = (message: string, tone: NotifyTone = "info") => {
    if (destroyed) {
      return;
    }
    const toast = document.createElement("div");
    toast.className = "sl-toast";
    toast.dataset.tone = tone;
    toast.setAttribute("role", tone === "error" ? "alert" : "status");
    toast.innerHTML = `${TOAST_ICONS[tone]}<span class="sl-toast-message"></span><button type="button" class="sl-icon-btn" aria-label="Dismiss">${ICONS.x}</button>`;
    (toast.querySelector(".sl-toast-message") as HTMLElement).textContent =
      message;
    const timer = window.setTimeout(
      () => toast.remove(),
      tone === "error" ? 8000 : 4500
    );
    toast.querySelector("button")?.addEventListener("click", () => {
      window.clearTimeout(timer);
      toast.remove();
    });
    toasts.append(toast);
    while (toasts.childElementCount > TOAST_LIMIT) {
      toasts.firstElementChild?.remove();
    }
  };

  const ctx: ToolbarContext = {
    get bridge() {
      return bridge;
    },
    copy: copyText,
    notify,
    onNavigate: (listener) => {
      const off = onNavigate(listener);
      subscriptions.add(off);
      return () => {
        off();
        subscriptions.delete(off);
      };
    },
    project,
  };

  const save = () => {
    try {
      sessionStorage.setItem(
        STATE_KEY,
        JSON.stringify({ open, tab: activeTab })
      );
    } catch {
      // Storage blocked: state simply is not remembered.
    }
  };

  const unmountPanel = () => {
    const cleanup = cleanupPanel;
    cleanupPanel = null;
    try {
      cleanup?.();
    } catch (error) {
      console.error("[shadcn-labs-devtools] panel cleanup failed", error);
    }
    body.replaceChildren();
    body.scrollTop = 0;
  };

  const mountPanel = () => {
    unmountPanel();
    for (const button of shadow.querySelectorAll<HTMLElement>("[data-tab]")) {
      button.setAttribute(
        "aria-selected",
        String(button.dataset.tab === activeTab)
      );
    }
    const tab = tabs.find((t) => t.id === activeTab);
    if (!tab) {
      return;
    }
    try {
      cleanupPanel = tab.mount(body, ctx) ?? null;
    } catch (error) {
      console.error(`[shadcn-labs-devtools] ${tab.id} failed to mount`, error);
      body.innerHTML = `<p class="sl-crash">${escapeHtml(tab.title)} failed to load: ${escapeHtml(
        error instanceof Error ? error.message : String(error)
      )}</p>`;
    }
  };

  const renderFooter = () => {
    const dot = footer.querySelector(".sl-dot") as HTMLElement;
    const status = footer.querySelector(".sl-status") as HTMLElement;
    footer.querySelector("[data-action='retry']")?.remove();
    dot.dataset.state = bridgeState;
    if (bridgeState === "connected" && bridge) {
      const where = bridge.health.host === "vscode" ? "VS Code" : "CLI bridge";
      status.innerHTML = `Connected to ${where} · <strong title="${escapeHtml(bridge.health.root)}">${escapeHtml(basename(bridge.health.root))}</strong>`;
    } else if (bridgeState === "connecting" || bridgeState === "idle") {
      status.textContent = "Looking for VS Code or the CLI bridge…";
    } else {
      status.innerHTML =
        "Not connected. Install the “Shadcn Labs” VS Code extension or run <code>npx @shadcn-labs/devtools bridge</code>.";
    }
    if (bridgeState === "connected" || bridgeState === "disconnected") {
      footer.insertAdjacentHTML(
        "beforeend",
        bridgeState === "connected"
          ? `<button type="button" class="sl-icon-btn" data-action="retry" aria-label="Reconnect" title="Reconnect">${ICONS.refresh}</button>`
          : `<button type="button" class="sl-link-btn" data-action="retry">Retry</button>`
      );
    }
  };

  const connect = async () => {
    if (bridgeState === "connecting") {
      return;
    }
    bridgeState = "connecting";
    renderFooter();
    const next = await connectBridge({ root: project?.root }).catch(() => null);
    if (destroyed) {
      return;
    }
    const changed = (next === null) !== (bridge === null);
    bridge = next;
    bridgeState = next ? "connected" : "disconnected";
    renderFooter();
    // Panels decide install/open affordances at mount time.
    if (changed && open) {
      mountPanel();
    }
  };

  const setOpen = (next: boolean, focus: boolean) => {
    if (next === open) {
      return;
    }
    open = next;
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    // Toasts float over the open panel, or next to the launcher when closed.
    (open ? main : shadow).append(toasts);
    save();
    if (!open) {
      unmountPanel();
      return;
    }
    if (bridgeState === "idle") {
      void connect();
    }
    mountPanel();
    if (!focus) {
      // Restored on page load: never steal focus from the page.
      (shadow.activeElement as HTMLElement | null)?.blur();
    } else if (!shadow.activeElement) {
      (
        shadow.querySelector(
          `[data-tab][aria-selected="true"]`
        ) as HTMLElement | null
      )?.focus();
    }
  };

  const onShadowClick = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.closest(".sl-launcher")) {
      setOpen(!open, true);
      return;
    }
    const tab = target.closest<HTMLElement>("[data-tab]");
    if (tab?.dataset.tab && tab.dataset.tab !== activeTab) {
      activeTab = tab.dataset.tab;
      save();
      mountPanel();
      return;
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "close") {
      setOpen(false, false);
      launcher.focus();
    } else if (action === "retry") {
      void connect();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.code === "KeyL" &&
      event.altKey &&
      event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      setOpen(!open, true);
      return;
    }
    if (event.key !== "Escape" || !open) {
      return;
    }
    const focusInside = event.composedPath().includes(element);
    const nothingFocused =
      document.activeElement === null ||
      document.activeElement === document.body;
    if (focusInside || nothingFocused) {
      setOpen(false, false);
      if (focusInside) {
        launcher.focus();
      }
    }
  };

  shadow.addEventListener("click", onShadowClick);
  window.addEventListener("keydown", onKeyDown, true);
  renderFooter();
  if (saved?.open) {
    setOpen(true, false);
  }

  return {
    destroy: () => {
      destroyed = true;
      unmountPanel();
      for (const off of subscriptions) {
        off();
      }
      subscriptions.clear();
      releaseNavigation();
      window.removeEventListener("keydown", onKeyDown, true);
      shadow.removeEventListener("click", onShadowClick);
      element.remove();
    },
    holders: 1,
  };
};

/**
 * Mount the floating toolbar once per page. Calling again while mounted
 * reuses the existing toolbar; it is removed when every caller has unmounted.
 */
export const mountToolbar = (
  options: MountToolbarOptions = {}
): (() => void) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    // Server render: nothing mounted, nothing to undo.
    // oxlint-disable-next-line no-empty-function -- intentional no-op cleanup.
    return () => {};
  }
  if (!customElements.get(TAG)) {
    customElements.define(TAG, class extends HTMLElement {});
  }
  let element = document.querySelector<ToolbarElement>(TAG);
  let instance = element?.[INSTANCE];
  if (element && instance) {
    instance.holders += 1;
  } else {
    // A leftover without a live instance (e.g. after a hot reload) is stale.
    element?.remove();
    element = document.createElement(TAG) as ToolbarElement;
    (document.body ?? document.documentElement).append(element);
    instance = createToolbar(element, options);
    element[INSTANCE] = instance;
  }
  const held = instance;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    held.holders -= 1;
    if (held.holders === 0) {
      held.destroy();
    }
  };
};
