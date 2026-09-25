import {
  addTarget,
  formatCommand,
  shadcnAddCommand,
} from "@shadcn-labs/devtools-core";
import type { ToolbarContext } from "@shadcn-labs/devtools-plugin-api";

import type { OgCheck, OgImageFacts, OgSeverity } from "./audit";
import { auditOg, formatBytes } from "./audit";
import { escapeHtml, injectStyle, inlineCode } from "./html";
import { ICONS } from "./icons";
import { measureImage } from "./measure";
import type { OgMeta } from "./meta";
import { collectMeta } from "./meta";
import type { PreviewPlatform } from "./previews";
import { PREVIEW_PLATFORMS, resolveCard } from "./previews";
import { OG_PANEL_CSS } from "./styles";

const QUICK_START_REF = "@ogimagecn/simple";
const DOCS_URL = "https://ogimagecn.com";
const HEAD_DEBOUNCE_MS = 150;
const NO_BRIDGE_HINT =
  "Opening files needs the Shadcn Labs VS Code extension or `npx @shadcn-labs/devtools bridge`.";

const SEVERITY_LABEL: Record<OgSeverity, [string, string]> = {
  error: ["error", "errors"],
  info: ["info", "info"],
  warning: ["warning", "warnings"],
};

const renderSummary = (checks: OgCheck[], measuring: boolean) => {
  const counts: Record<OgSeverity, number> = { error: 0, info: 0, warning: 0 };
  for (const check of checks) {
    counts[check.severity] += 1;
  }
  const badges = (["error", "warning", "info"] as const)
    .filter((severity) => counts[severity] > 0)
    .map((severity) => {
      const [one, many] = SEVERITY_LABEL[severity];
      return `<span class="slog-badge"><span class="slog-${severity}">${ICONS[severity]}</span>${counts[severity]} ${counts[severity] === 1 ? one : many}</span>`;
    });
  if (counts.error === 0 && counts.warning === 0 && !measuring) {
    badges.unshift(
      `<span class="slog-badge"><span class="slog-success">${ICONS.check}</span>Ready to share</span>`
    );
  }
  if (measuring) {
    badges.push(`<span class="slog-badge slog-muted">Measuring image…</span>`);
  }
  return badges.join("");
};

const renderChecks = (checks: OgCheck[], measuring: boolean) => {
  if (checks.length === 0) {
    return `<li><span class="slog-success">${ICONS.check}</span><span>${
      measuring ? "Tags look good; measuring the image…" : "All checks passed."
    }</span></li>`;
  }
  return checks
    .map(
      (check) =>
        `<li data-check="${check.id}"><span class="slog-${check.severity}" title="${check.severity}">${ICONS[check.severity]}</span><span>${inlineCode(check.message)}</span></li>`
    )
    .join("");
};

const renderImage = (meta: OgMeta, facts: OgImageFacts | undefined) => {
  const url = meta.og.image?.url;
  if (!url) {
    return `<div class="slog-frame">No og:image on this page</div>`;
  }
  let details = `<span>Measuring…</span>`;
  let frame = `<img src="${escapeHtml(url)}" alt="${escapeHtml(meta.og.imageAlt ?? "")}" decoding="async">`;
  if (facts?.error) {
    details = `<span class="slog-error">Failed to load: ${escapeHtml(facts.error)}</span>`;
    frame = "Image failed to load";
  } else if (facts) {
    details = [
      `${facts.width}×${facts.height}`,
      facts.bytes === undefined
        ? "size unknown (no CORS)"
        : formatBytes(facts.bytes),
      facts.contentType,
    ]
      .filter(Boolean)
      .map((part) => `<span>${escapeHtml(part ?? "")}</span>`)
      .join("");
  }
  return `<div class="slog-frame">${frame}</div>
    <div class="slog-facts"><span title="${escapeHtml(url)}">${escapeHtml(meta.og.image?.raw ?? url)}</span></div>
    <div class="slog-facts">${details}</div>`;
};

/** Open Graph inspector: checks, measured image and platform card previews. */
export const mountOgPanel = (
  container: HTMLElement,
  ctx: ToolbarContext
): (() => void) => {
  const doc = container.ownerDocument;
  const win = doc.defaultView ?? window;
  const style = injectStyle(container, OG_PANEL_CSS);
  const root = doc.createElement("div");
  root.className = "slog";
  root.innerHTML = `
    <header class="slog-header">
      <div class="slog-path"><span class="slog-muted slog-xs">Page</span><code data-el="path"></code></div>
      <button type="button" class="slog-btn" data-action="refresh">${ICONS.refresh}Refresh</button>
    </header>
    <div class="slog-summary" data-el="summary" aria-live="polite"></div>
    <section class="slog-section">
      <h3 class="slog-h">og:image</h3>
      <div class="slog-section" data-el="image"></div>
      <div class="slog-actions">
        <span data-el="source-wrap"><button type="button" class="slog-btn" data-action="open-source">${ICONS.file}Open source</button></span>
        <button type="button" class="slog-btn" data-action="open-image">${ICONS.external}Open image</button>
      </div>
    </section>
    <section class="slog-section">
      <h3 class="slog-h">Checks</h3>
      <ul class="slog-checks" data-el="checks"></ul>
    </section>
    <section class="slog-section">
      <h3 class="slog-h">Previews</h3>
      <div class="slog-tabs" role="tablist" aria-label="Platform">${PREVIEW_PLATFORMS.map(
        (p) =>
          `<button type="button" class="slog-tab" role="tab" data-platform="${p.id}">${p.label}</button>`
      ).join("")}</div>
      <div class="slog-section" data-el="preview" role="tabpanel"></div>
    </section>
    <footer class="slog-quickstart">
      <div><span class="slog-strong">Build OG images with ogimagecn</span><span class="slog-muted slog-xs">Satori components for <code>next/og</code>, installed with shadcn.</span></div>
      <button type="button" class="slog-btn slog-btn-primary" data-action="copy-install">${ICONS.copy}Copy install</button>
      <a class="slog-xs" href="${DOCS_URL}" target="_blank" rel="noopener">ogimagecn.com</a>
    </footer>`;
  container.append(root);

  const el = (name: string) =>
    root.querySelector(`[data-el="${name}"]`) as HTMLElement;
  const sourceButton = root.querySelector(
    '[data-action="open-source"]'
  ) as HTMLButtonElement;
  const imageButton = root.querySelector(
    '[data-action="open-image"]'
  ) as HTMLButtonElement;

  const measured = new Map<string, OgImageFacts>();
  const inflight = new Set<string>();
  let controller = new AbortController();
  let meta = collectMeta(doc);
  let scanKey = "";
  let platform: PreviewPlatform = "x";
  let disposed = false;

  /** Swap broken previews for a placeholder, as the platforms would drop them. */
  const guardImages = (scope: HTMLElement) => {
    for (const img of scope.querySelectorAll("img")) {
      img.addEventListener(
        "error",
        () => {
          const placeholder = doc.createElement("div");
          placeholder.className = `${img.className} slog-noimg`;
          placeholder.textContent = "Image failed to load";
          img.replaceWith(placeholder);
        },
        { once: true }
      );
    }
  };

  const renderPreview = () => {
    for (const tab of root.querySelectorAll<HTMLElement>("[data-platform]")) {
      tab.setAttribute(
        "aria-selected",
        String(tab.dataset.platform === platform)
      );
    }
    const entry =
      PREVIEW_PLATFORMS.find((p) => p.id === platform) ?? PREVIEW_PLATFORMS[0];
    el("preview").innerHTML = entry
      ? entry.render(resolveCard(meta, win.location.href))
      : "";
    guardImages(el("preview"));
  };

  const render = () => {
    if (disposed) {
      return;
    }
    const imageUrl = meta.og.image?.url;
    const facts = imageUrl ? measured.get(imageUrl) : undefined;
    const measuring = Boolean(imageUrl) && !facts;
    const checks = auditOg(meta, facts);
    el("path").textContent = win.location.pathname;
    el("path").title = win.location.href;
    el("summary").innerHTML = renderSummary(checks, measuring);
    el("image").innerHTML = renderImage(meta, facts);
    guardImages(el("image"));
    el("checks").innerHTML = renderChecks(checks, measuring);
    imageButton.disabled = !imageUrl;
    sourceButton.disabled = !ctx.bridge;
    el("source-wrap").title = ctx.bridge
      ? ""
      : NO_BRIDGE_HINT.replaceAll("`", "");
    renderPreview();
  };

  const measure = async (url: string) => {
    if (measured.has(url) || inflight.has(url)) {
      return;
    }
    const { signal } = controller;
    inflight.add(url);
    try {
      const facts = await measureImage(url, signal);
      if (signal.aborted) {
        return;
      }
      inflight.delete(url);
      measured.set(url, facts);
      render();
    } catch {
      // Aborted by Refresh or unmount; the next scan measures again.
    }
  };

  const scan = (force: boolean) => {
    const next = collectMeta(doc);
    const key = `${win.location.href}\n${JSON.stringify(next)}`;
    if (!force && key === scanKey) {
      return;
    }
    scanKey = key;
    meta = next;
    if (meta.og.image?.url) {
      measure(meta.og.image.url);
    }
    render();
  };

  const openSource = async (bridge: NonNullable<ToolbarContext["bridge"]>) => {
    let imagePathname: string | undefined;
    if (meta.og.image?.url) {
      const url = new URL(meta.og.image.url);
      if (url.origin === win.location.origin) {
        imagePathname = url.pathname + url.search;
      }
    }
    sourceButton.disabled = true;
    try {
      const { file } = await bridge.request({
        imagePathname,
        pathname: win.location.pathname,
        type: "open-og-source",
      });
      if (file) {
        ctx.notify(`Opened ${file}`, "success");
      } else {
        ctx.notify("No OG image source found for this route", "info");
      }
    } catch (error) {
      ctx.notify(
        error instanceof Error ? error.message : String(error),
        "error"
      );
    } finally {
      sourceButton.disabled = !ctx.bridge;
    }
  };

  const copyInstall = async () => {
    const command = formatCommand(
      shadcnAddCommand(
        [addTarget(QUICK_START_REF, ctx.project?.registries ?? {})],
        ctx.project?.packageManager ?? "npm"
      )
    );
    try {
      await ctx.copy(command);
      ctx.notify(`Copied: ${command}`, "success");
    } catch {
      ctx.notify(`Copy failed. Run: ${command}`, "error");
    }
  };

  const onClick = async (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const tab = target.closest<HTMLElement>("[data-platform]");
    if (tab?.dataset.platform) {
      platform = tab.dataset.platform as PreviewPlatform;
      renderPreview();
      return;
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "refresh") {
      controller.abort();
      controller = new AbortController();
      measured.clear();
      inflight.clear();
      scan(true);
    } else if (action === "open-image" && meta.og.image?.url) {
      win.open(meta.og.image.url, "_blank", "noopener");
    } else if (action === "open-source" && ctx.bridge) {
      await openSource(ctx.bridge);
    } else if (action === "copy-install") {
      await copyInstall();
    }
  };

  let debounce: number | undefined;
  const observer = new MutationObserver(() => {
    win.clearTimeout(debounce);
    debounce = win.setTimeout(() => scan(false), HEAD_DEBOUNCE_MS);
  });
  observer.observe(doc.head, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  const offNavigate = ctx.onNavigate(() => scan(false));
  root.addEventListener("click", onClick);
  scan(true);

  return () => {
    disposed = true;
    controller.abort();
    win.clearTimeout(debounce);
    observer.disconnect();
    offNavigate();
    root.removeEventListener("click", onClick);
    root.remove();
    style.remove();
  };
};
