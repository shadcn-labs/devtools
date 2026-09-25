import type { CatalogEntry } from "@shadcn-labs/devtools-core";
import {
  addTarget,
  formatCommand,
  LABS_REGISTRIES,
  searchCatalog,
  shadcnAddCommand,
} from "@shadcn-labs/devtools-core";
import type { NotifyTone, ProjectInfo } from "@shadcn-labs/devtools-plugin-api";

import { fetchAndCacheIndex, readCachedIndex } from "./catalog";
import { escapeHtml, injectStyle } from "./dom";
import { ICONS } from "./icons";

import { REGISTRY_BROWSER_CSS } from "./registry-browser.css";

export interface RegistryBrowserHost {
  project: ProjectInfo | null;
  /** Present when the host can run installs; absent → copy-only UI. */
  install?: (ref: string) => Promise<{ command: string }>;
  copy: (text: string) => Promise<void>;
  openExternal: (url: string) => void;
  notify: (message: string, tone?: NotifyTone) => void;
}

type IndexState =
  | { status: "error"; message: string }
  | { status: "loading" }
  | { status: "ready"; entries: CatalogEntry[] };

const PAGE_SIZE = 40;
const SEARCH_DEBOUNCE_MS = 120;
const COPIED_MS = 1200;
const ALL = "all";

let mounts = 0;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const setButtonContent = (button: HTMLElement | null, html: string) => {
  if (button) {
    button.innerHTML = html;
  }
};

/** Registry search/browse UI. Injects its own <style> into `container`. */
export const mountRegistryBrowser = (
  container: HTMLElement,
  host: RegistryBrowserHost
): (() => void) => {
  const doc = container.ownerDocument;
  const win = doc.defaultView ?? window;
  const idPrefix = `slrb-${(mounts += 1)}`;
  const style = injectStyle(container, REGISTRY_BROWSER_CSS);
  const root = doc.createElement("div");
  root.className = "slrb";
  root.innerHTML = `
    <div class="slrb-top">
      <label class="slrb-search">${ICONS.search}<input type="search" placeholder="Search Shadcn Labs registries…" aria-label="Search registries" aria-controls="${idPrefix}-list" autocomplete="off" spellcheck="false"></label>
      <div class="slrb-chips" role="group" aria-label="Filter by registry">
        <button type="button" class="slrb-chip" data-filter="${ALL}" aria-pressed="true">All <span class="slrb-count"></span></button>
        ${LABS_REGISTRIES.map(
          (source) =>
            `<button type="button" class="slrb-chip" data-filter="${source.id}" aria-pressed="false" title="${escapeHtml(source.description)}">${escapeHtml(source.name)} <span class="slrb-count"></span></button>`
        ).join("")}
      </div>
    </div>
    <div class="slrb-errors" role="status"></div>
    <div class="slrb-list" id="${idPrefix}-list" role="listbox" aria-label="Registry items" tabindex="-1"></div>`;
  container.append(root);

  const input = root.querySelector("input") as HTMLInputElement;
  const errors = root.querySelector(".slrb-errors") as HTMLElement;
  const list = root.querySelector(".slrb-list") as HTMLElement;

  const states = new Map<string, IndexState>();
  const installing = new Set<string>();
  const controller = new AbortController();
  let query = "";
  let filter = ALL;
  let limit = PAGE_SIZE;
  let selected = 0;
  let results: CatalogEntry[] = [];
  let searchTimer: number | undefined;
  let disposed = false;

  const commandFor = (ref: string) =>
    formatCommand(
      shadcnAddCommand(
        [addTarget(ref, host.project?.registries ?? {})],
        host.project?.packageManager ?? "npm"
      )
    );

  const renderRow = (entry: CatalogEntry, index: number) => {
    const ref = escapeHtml(entry.ref);
    const busy = installing.has(entry.ref);
    const install = host.install
      ? `<button type="button" class="slrb-btn slrb-primary" data-action="install" data-ref="${ref}" title="Install ${ref}"${busy ? " disabled" : ""}>${busy ? `<span class="slrb-spin">${ICONS.loader}</span>` : ICONS.download}Install</button>`
      : "";
    const description = entry.item.description
      ? `<p class="slrb-desc">${escapeHtml(entry.item.description)}</p>`
      : "";
    return `<div class="slrb-row" role="option" id="${idPrefix}-${index}" data-index="${index}" aria-selected="${index === selected}">
      <div class="slrb-main">
        <div class="slrb-head"><span class="slrb-title">${escapeHtml(entry.item.title ?? entry.item.name)}</span><span class="slrb-badge">${escapeHtml(entry.item.type.replace(/^registry:/u, ""))}</span></div>
        <span class="slrb-ref">${ref}</span>
        ${description}
      </div>
      <div class="slrb-actions">
        ${install}
        <button type="button" class="slrb-icon" data-action="copy" data-ref="${ref}" aria-label="Copy install command for ${ref}" title="Copy install command">${ICONS.copy}</button>
        <button type="button" class="slrb-icon" data-action="open" data-ref="${ref}" aria-label="Open ${escapeHtml(entry.registry.name)}" title="Open ${escapeHtml(entry.registry.homepage)}">${ICONS.external}</button>
      </div>
    </div>`;
  };

  const renderList = () => {
    const loading = [...states.values()].some((s) => s.status === "loading");
    if (results.length === 0) {
      if (loading) {
        list.innerHTML = Array.from(
          { length: 6 },
          () =>
            `<div class="slrb-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>`
        ).join("");
      } else {
        const scope =
          filter === ALL
            ? ""
            : ` in ${LABS_REGISTRIES.find((s) => s.id === filter)?.name ?? filter}`;
        list.innerHTML = `<div class="slrb-empty">${
          query
            ? `No items match “${escapeHtml(query)}”${escapeHtml(scope)}.`
            : `No items${escapeHtml(scope)}.`
        }</div>`;
      }
      input.removeAttribute("aria-activedescendant");
      return;
    }
    const shown = results.slice(0, limit);
    const rest = results.length - shown.length;
    list.innerHTML =
      shown.map(renderRow).join("") +
      (rest > 0
        ? `<button type="button" class="slrb-more" data-action="more">Show ${Math.min(rest, PAGE_SIZE)} more · ${rest} remaining</button>`
        : "");
    input.setAttribute("aria-activedescendant", `${idPrefix}-${selected}`);
  };

  const renderChrome = () => {
    const matches = searchCatalog(
      LABS_REGISTRIES.flatMap((source) => {
        const state = states.get(source.id);
        return state?.status === "ready" ? state.entries : [];
      }),
      query
    );
    const counts = new Map<string, number>();
    for (const entry of matches) {
      counts.set(entry.registry.id, (counts.get(entry.registry.id) ?? 0) + 1);
    }
    results =
      filter === ALL
        ? matches
        : matches.filter((entry) => entry.registry.id === filter);

    const anyLoading = [...states.values()].some((s) => s.status === "loading");
    for (const chip of root.querySelectorAll<HTMLElement>("[data-filter]")) {
      const id = chip.dataset.filter ?? ALL;
      const count = chip.querySelector(".slrb-count") as HTMLElement;
      const status =
        id === ALL
          ? matches.length === 0 && anyLoading && "loading"
          : states.get(id)?.status;
      chip.setAttribute("aria-pressed", String(id === filter));
      if (status === "loading") {
        count.innerHTML = `<span class="slrb-spin">${ICONS.loader}</span>`;
      } else if (status === "error") {
        count.innerHTML = `<span class="slrb-chip-error" title="Failed to load">${ICONS.alert}</span>`;
      } else {
        count.textContent = String(
          id === ALL ? matches.length : (counts.get(id) ?? 0)
        );
      }
    }

    errors.innerHTML = LABS_REGISTRIES.map((source) => {
      const state = states.get(source.id);
      return state?.status === "error"
        ? `<div class="slrb-error">${ICONS.alert}<span>Couldn't load ${escapeHtml(source.name)}: ${escapeHtml(state.message)}</span><button type="button" class="slrb-btn" data-action="retry" data-registry="${source.id}">${ICONS.refresh}Retry</button></div>`
        : "";
    }).join("");
  };

  const update = () => {
    if (disposed) {
      return;
    }
    renderChrome();
    selected = Math.min(selected, Math.max(results.length - 1, 0));
    renderList();
  };

  const load = async (source: (typeof LABS_REGISTRIES)[number]) => {
    states.set(source.id, { status: "loading" });
    try {
      const entries = await fetchAndCacheIndex(source, controller.signal);
      states.set(source.id, { entries, status: "ready" });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      states.set(source.id, {
        message: errorMessage(error),
        status: "error",
      });
    }
    update();
  };

  const select = (index: number) => {
    if (results.length === 0) {
      return;
    }
    selected = Math.max(0, Math.min(index, results.length - 1));
    if (selected >= limit) {
      limit = Math.max(limit + PAGE_SIZE, selected + 1);
      renderList();
    }
    for (const row of list.querySelectorAll<HTMLElement>(".slrb-row")) {
      row.setAttribute(
        "aria-selected",
        String(row.dataset.index === String(selected))
      );
    }
    input.setAttribute("aria-activedescendant", `${idPrefix}-${selected}`);
    list
      .querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  const findButton = (action: string, ref: string) =>
    [
      ...list.querySelectorAll<HTMLButtonElement>(`[data-action="${action}"]`),
    ].find((button) => button.dataset.ref === ref) ?? null;

  const install = async (entry: CatalogEntry) => {
    if (!host.install || installing.has(entry.ref)) {
      return;
    }
    installing.add(entry.ref);
    const button = findButton("install", entry.ref);
    if (button) {
      button.disabled = true;
    }
    setButtonContent(
      button,
      `<span class="slrb-spin">${ICONS.loader}</span>Install`
    );
    try {
      const { command } = await host.install(entry.ref);
      host.notify(`Installing ${entry.ref}: ${command}`, "success");
    } catch (error) {
      host.notify(`Install failed: ${errorMessage(error)}`, "error");
    } finally {
      installing.delete(entry.ref);
      const current = findButton("install", entry.ref);
      if (current) {
        current.disabled = false;
      }
      setButtonContent(current, `${ICONS.download}Install`);
    }
  };

  const copy = async (entry: CatalogEntry) => {
    const command = commandFor(entry.ref);
    try {
      await host.copy(command);
      host.notify(`Copied: ${command}`, "success");
      const button = findButton("copy", entry.ref);
      button?.classList.add("slrb-copied");
      setButtonContent(button, ICONS.check);
      win.setTimeout(() => {
        const current = findButton("copy", entry.ref);
        current?.classList.remove("slrb-copied");
        setButtonContent(current, ICONS.copy);
      }, COPIED_MS);
    } catch (error) {
      host.notify(`Copy failed: ${errorMessage(error)}`, "error");
    }
  };

  const onInput = () => {
    win.clearTimeout(searchTimer);
    searchTimer = win.setTimeout(() => {
      query = input.value.trim();
      limit = PAGE_SIZE;
      selected = 0;
      update();
      list.scrollTop = 0;
    }, SEARCH_DEBOUNCE_MS);
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const chip = target.closest<HTMLElement>("[data-filter]");
    if (chip) {
      filter = chip.dataset.filter ?? ALL;
      limit = PAGE_SIZE;
      selected = 0;
      update();
      list.scrollTop = 0;
      return;
    }
    const button = target.closest<HTMLElement>("[data-action]");
    const action = button?.dataset.action;
    if (action === "more") {
      limit += PAGE_SIZE;
      renderList();
      return;
    }
    if (action === "retry") {
      const source = LABS_REGISTRIES.find(
        (s) => s.id === button?.dataset.registry
      );
      if (source) {
        load(source);
        update();
      }
      return;
    }
    const row = target.closest<HTMLElement>(".slrb-row");
    if (row?.dataset.index) {
      select(Number(row.dataset.index));
    }
    const entry = button?.dataset.ref
      ? results.find((e) => e.ref === button.dataset.ref)
      : undefined;
    if (entry && action === "install") {
      void install(entry);
    } else if (entry && action === "copy") {
      void copy(entry);
    } else if (entry && action === "open") {
      host.openExternal(entry.registry.homepage);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(".slrb-chips")
      ) {
        return;
      }
      event.preventDefault();
      select(selected + (event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    const entry = results[selected];
    if (
      event.key === "Enter" &&
      entry &&
      (event.target === input || event.target === list)
    ) {
      event.preventDefault();
      void (host.install ? install(entry) : copy(entry));
    }
  };

  input.addEventListener("input", onInput);
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);

  for (const source of LABS_REGISTRIES) {
    const cached = readCachedIndex(source);
    if (cached) {
      states.set(source.id, { entries: cached, status: "ready" });
    } else {
      load(source);
    }
  }
  update();
  input.focus({ preventScroll: true });

  return () => {
    disposed = true;
    controller.abort();
    win.clearTimeout(searchTimer);
    input.removeEventListener("input", onInput);
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeyDown);
    root.remove();
    style.remove();
  };
};
