/** Themed only through the `--sl-*` custom properties. */
export const REGISTRY_BROWSER_CSS = `
.slrb {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--sl-foreground);
  font-family: var(--sl-font-family);
  font-size: var(--sl-font-size);
  line-height: 1.45;
}
.slrb *, .slrb *::before, .slrb *::after { box-sizing: border-box; }
.slrb svg { flex: none; }

.slrb-top {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 12px 8px;
  border-bottom: 1px solid var(--sl-border);
}
.slrb-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-background);
  color: var(--sl-muted-foreground);
}
.slrb-search:focus-within {
  border-color: var(--sl-muted-foreground);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sl-muted-foreground) 22%, transparent);
}
.slrb-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--sl-foreground);
  font: inherit;
}
.slrb-search input::placeholder { color: var(--sl-muted-foreground); }
.slrb-search input::-webkit-search-cancel-button { display: none; }

.slrb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.slrb-chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--sl-border);
  border-radius: 999px;
  background: var(--sl-background);
  color: var(--sl-foreground);
  font: inherit;
  font-size: 0.9em;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}
.slrb-chip:hover { background: var(--sl-muted); }
.slrb-chip[aria-pressed="true"] {
  border-color: var(--sl-primary);
  background: var(--sl-primary);
  color: var(--sl-primary-foreground);
}
.slrb-count { opacity: 0.65; font-variant-numeric: tabular-nums; }
.slrb-chip svg { width: 12px; height: 12px; }
.slrb-chip-error { color: var(--sl-destructive); }
.slrb-chip[aria-pressed="true"] .slrb-chip-error { color: inherit; }

.slrb-errors:empty { display: none; }
.slrb-errors { display: flex; flex-direction: column; gap: 6px; padding: 8px 12px 0; }
.slrb-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 10px;
  border: 1px solid color-mix(in srgb, var(--sl-destructive) 40%, var(--sl-border));
  border-radius: var(--sl-radius);
  color: var(--sl-destructive);
  font-size: 0.9em;
}
.slrb-error > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.slrb-error svg { width: 14px; height: 14px; }

.slrb-list {
  flex: 1;
  min-height: 0;
  padding: 4px 6px 8px;
  overflow-y: auto;
  outline: 0;
  overscroll-behavior: contain;
}
.slrb-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  padding: 9px 8px;
  border-radius: var(--sl-radius);
  cursor: default;
}
.slrb-row + .slrb-row { margin-top: 1px; }
.slrb-row:hover { background: color-mix(in srgb, var(--sl-muted) 60%, transparent); }
.slrb-row[aria-selected="true"] { background: var(--sl-muted); }
.slrb-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.slrb-head { display: flex; align-items: center; gap: 6px; min-width: 0; }
.slrb-title {
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.slrb-badge {
  flex: none;
  padding: 0 6px;
  border: 1px solid var(--sl-border);
  border-radius: 999px;
  background: var(--sl-background);
  color: var(--sl-muted-foreground);
  font-size: 0.78em;
  font-weight: 500;
  line-height: 1.6;
}
.slrb-ref {
  overflow: hidden;
  color: var(--sl-muted-foreground);
  font-family: var(--sl-font-mono);
  font-size: 0.85em;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.slrb-desc {
  display: -webkit-box;
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--sl-muted-foreground);
  font-size: 0.92em;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.slrb-actions { display: flex; align-items: flex-start; gap: 4px; }
.slrb-btn, .slrb-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  border: 1px solid var(--sl-border);
  border-radius: calc(var(--sl-radius) - 2px);
  background: var(--sl-background);
  color: var(--sl-foreground);
  font: inherit;
  font-size: 0.9em;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}
.slrb-btn { padding: 0 9px; }
.slrb-icon { width: 28px; padding: 0; }
.slrb-btn svg, .slrb-icon svg { width: 14px; height: 14px; }
.slrb-btn:hover:not(:disabled), .slrb-icon:hover:not(:disabled) { background: var(--sl-muted); }
.slrb-btn:disabled { cursor: progress; opacity: 0.7; }
.slrb-primary {
  border-color: var(--sl-primary);
  background: var(--sl-primary);
  color: var(--sl-primary-foreground);
}
.slrb-primary:hover:not(:disabled) { background: var(--sl-primary); opacity: 0.9; }
.slrb-copied { color: var(--sl-success); }
.slrb-chip:focus-visible, .slrb-btn:focus-visible, .slrb-icon:focus-visible, .slrb-more:focus-visible {
  outline: 2px solid var(--sl-primary);
  outline-offset: 1px;
}

.slrb-spin { animation: slrb-spin 0.8s linear infinite; }
@keyframes slrb-spin { to { transform: rotate(360deg); } }

.slrb-more {
  display: block;
  width: calc(100% - 16px);
  height: 30px;
  margin: 6px 8px 0;
  border: 1px dashed var(--sl-border);
  border-radius: var(--sl-radius);
  background: transparent;
  color: var(--sl-muted-foreground);
  font: inherit;
  font-size: 0.9em;
  cursor: pointer;
}
.slrb-more:hover { background: var(--sl-muted); color: var(--sl-foreground); }

.slrb-empty {
  padding: 32px 16px;
  color: var(--sl-muted-foreground);
  text-align: center;
  overflow-wrap: anywhere;
}
.slrb-skeleton { display: flex; flex-direction: column; gap: 7px; padding: 12px 8px; }
.slrb-skeleton span {
  height: 10px;
  border-radius: 4px;
  background: var(--sl-muted);
  animation: slrb-pulse 1.4s ease-in-out infinite;
}
.slrb-skeleton span:nth-child(1) { width: 38%; height: 12px; }
.slrb-skeleton span:nth-child(2) { width: 55%; }
.slrb-skeleton span:nth-child(3) { width: 88%; }
@keyframes slrb-pulse { 50% { opacity: 0.45; } }
@media (prefers-reduced-motion: reduce) {
  .slrb-spin, .slrb-skeleton span { animation: none; }
}
`;
