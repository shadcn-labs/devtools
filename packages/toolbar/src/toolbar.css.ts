/**
 * Theme defaults for everything rendered inside the toolbar's shadow root.
 * Panels read only these `--sl-*` properties; hosts may override them.
 */
export const TOOLBAR_CSS = `
:host {
  all: initial;
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483646;
  display: block;
  --sl-background: #ffffff;
  --sl-foreground: #09090b;
  --sl-muted: #f4f4f5;
  --sl-muted-foreground: #71717a;
  --sl-border: #e4e4e7;
  --sl-primary: #18181b;
  --sl-primary-foreground: #fafafa;
  --sl-destructive: #dc2626;
  --sl-warning: #b45309;
  --sl-success: #15803d;
  --sl-radius: 8px;
  --sl-font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --sl-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --sl-font-size: 13px;
  --sl-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 12px 32px -8px rgb(0 0 0 / 0.22);
  color-scheme: light;
  color: var(--sl-foreground);
  font-family: var(--sl-font-family);
  font-size: var(--sl-font-size);
  line-height: 1.45;
}
@media (prefers-color-scheme: dark) {
  :host {
    --sl-background: #09090b;
    --sl-foreground: #fafafa;
    --sl-muted: #27272a;
    --sl-muted-foreground: #a1a1aa;
    --sl-border: #27272a;
    --sl-primary: #fafafa;
    --sl-primary-foreground: #18181b;
    --sl-destructive: #f87171;
    --sl-warning: #fbbf24;
    --sl-success: #4ade80;
    --sl-shadow: 0 0 0 1px rgb(255 255 255 / 0.04), 0 12px 32px -8px rgb(0 0 0 / 0.7);
    color-scheme: dark;
  }
}
*, *::before, *::after { box-sizing: border-box; }
svg { flex: none; }
button { font: inherit; }

.sl-launcher {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--sl-primary);
  border-radius: 999px;
  background: var(--sl-primary);
  color: var(--sl-primary-foreground);
  box-shadow: var(--sl-shadow);
  cursor: pointer;
  transition: transform 120ms ease;
}
.sl-launcher:hover { transform: scale(1.06); }
.sl-launcher:active { transform: scale(0.96); }
.sl-launcher svg { width: 17px; height: 17px; }
.sl-launcher[aria-expanded="true"] {
  border-color: var(--sl-border);
  background: var(--sl-background);
  color: var(--sl-foreground);
}
.sl-launcher:focus-visible, .sl-icon-btn:focus-visible, .sl-tab:focus-visible, .sl-link-btn:focus-visible {
  outline: 2px solid var(--sl-primary);
  outline-offset: 2px;
}

.sl-panel {
  position: absolute;
  right: 0;
  bottom: 46px;
  display: flex;
  flex-direction: column;
  width: min(420px, calc(100vw - 32px));
  height: min(560px, calc(100vh - 80px));
  height: min(560px, calc(100dvh - 80px));
  overflow: hidden;
  border: 1px solid var(--sl-border);
  border-radius: calc(var(--sl-radius) + 4px);
  background: var(--sl-background);
  color: var(--sl-foreground);
  box-shadow: var(--sl-shadow);
  transform-origin: bottom right;
  animation: sl-in 140ms ease-out;
}
.sl-panel[hidden] { display: none; }
@keyframes sl-in { from { opacity: 0; transform: translateY(6px) scale(0.98); } }

.sl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 10px 0 14px;
}
.sl-brand { display: flex; align-items: center; gap: 8px; min-width: 0; font-weight: 600; }
.sl-brand svg { width: 16px; height: 16px; }
.sl-brand-sub { color: var(--sl-muted-foreground); font-weight: 400; }
.sl-icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: calc(var(--sl-radius) - 2px);
  background: transparent;
  color: var(--sl-muted-foreground);
  cursor: pointer;
}
.sl-icon-btn:hover { background: var(--sl-muted); color: var(--sl-foreground); }
.sl-icon-btn svg { width: 15px; height: 15px; }

.sl-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 10px 0;
  overflow-x: auto;
  border-bottom: 1px solid var(--sl-border);
  scrollbar-width: none;
}
.sl-tabs::-webkit-scrollbar { display: none; }
.sl-tab {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--sl-muted-foreground);
  font-weight: 500;
  cursor: pointer;
}
.sl-tab svg { width: 15px; height: 15px; }
.sl-tab:hover { color: var(--sl-foreground); }
.sl-tab[aria-selected="true"] { color: var(--sl-foreground); }
.sl-tab[aria-selected="true"]::after {
  position: absolute;
  right: 6px;
  bottom: -1px;
  left: 6px;
  height: 2px;
  border-radius: 2px;
  background: var(--sl-primary);
  content: "";
}

.sl-main { position: relative; display: flex; flex: 1; flex-direction: column; min-height: 0; }
.sl-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.sl-crash { margin: 16px; color: var(--sl-destructive); overflow-wrap: anywhere; }

.sl-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 6px 8px 6px 12px;
  border-top: 1px solid var(--sl-border);
  color: var(--sl-muted-foreground);
  font-size: 0.88em;
}
.sl-status { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.sl-status strong { color: var(--sl-foreground); font-weight: 500; }
.sl-status code {
  padding: 0 3px;
  white-space: nowrap;
  border-radius: 4px;
  background: var(--sl-muted);
  color: var(--sl-foreground);
  font-family: var(--sl-font-mono);
  font-size: 0.95em;
}
.sl-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--sl-muted-foreground);
}
.sl-dot[data-state="connected"] { background: var(--sl-success); }
.sl-dot[data-state="connecting"] { animation: sl-blink 1s ease-in-out infinite; }
@keyframes sl-blink { 50% { opacity: 0.3; } }
.sl-link-btn {
  flex: none;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--sl-border);
  border-radius: calc(var(--sl-radius) - 2px);
  background: var(--sl-background);
  color: var(--sl-foreground);
  font-size: 0.95em;
  font-weight: 500;
  cursor: pointer;
}
.sl-link-btn:hover { background: var(--sl-muted); }

.sl-toasts {
  position: absolute;
  right: 46px;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  width: max-content;
  max-width: min(340px, calc(100vw - 80px));
  pointer-events: none;
}
.sl-main > .sl-toasts {
  right: 8px;
  bottom: 8px;
  left: 8px;
  align-items: stretch;
  width: auto;
  max-width: none;
}
.sl-toast {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 100%;
  padding: 8px 6px 8px 10px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-background);
  color: var(--sl-foreground);
  box-shadow: var(--sl-shadow);
  font-size: 0.92em;
  pointer-events: auto;
  animation: sl-in 140ms ease-out;
}
.sl-toast > svg { width: 15px; height: 15px; margin-top: 1px; }
.sl-toast[data-tone="success"] > svg { color: var(--sl-success); }
.sl-toast[data-tone="error"] > svg { color: var(--sl-destructive); }
.sl-toast[data-tone="info"] > svg { color: var(--sl-muted-foreground); }
.sl-toast-message { flex: 1; min-width: 0; overflow-wrap: anywhere; user-select: text; }
.sl-toast .sl-icon-btn { width: 20px; height: 20px; margin: -1px 0 0; }
.sl-toast .sl-icon-btn svg { width: 13px; height: 13px; }
@media (prefers-reduced-motion: reduce) {
  .sl-panel, .sl-toast, .sl-dot { animation: none; }
  .sl-launcher { transition: none; }
}
`;
