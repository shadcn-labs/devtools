/** Themed only through the toolbar's `--sl-*` custom properties. */
export const OG_PANEL_CSS = `
.slog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 14px 16px;
  color: var(--sl-foreground);
  font-family: var(--sl-font-family);
  font-size: var(--sl-font-size);
  line-height: 1.45;
}
.slog *, .slog *::before, .slog *::after { box-sizing: border-box; }
.slog code {
  padding: 0 4px;
  border-radius: 4px;
  background: var(--sl-muted);
  font-family: var(--sl-font-mono);
  font-size: 0.92em;
  overflow-wrap: anywhere;
}
.slog a { color: var(--sl-foreground); text-underline-offset: 3px; }
.slog-muted { color: var(--sl-muted-foreground); }
.slog-xs { font-size: 0.85em; }
.slog-strong { font-weight: 600; }
.slog-mono { font-family: var(--sl-font-mono); }
.slog-error { color: var(--sl-destructive); }
.slog-warning { color: var(--sl-warning); }
.slog-info { color: var(--sl-muted-foreground); }
.slog-success { color: var(--sl-success); }
.slog-clamp-1, .slog-clamp-2, .slog-clamp-3 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.slog-clamp-1 { -webkit-line-clamp: 1; }
.slog-clamp-2 { -webkit-line-clamp: 2; }
.slog-clamp-3 { -webkit-line-clamp: 3; }

.slog-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.slog-path { display: flex; flex-direction: column; min-width: 0; }
.slog-path code {
  padding: 0;
  background: none;
  font-size: 1em;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-wrap: normal;
}

.slog-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--sl-border);
  border-radius: calc(var(--sl-radius) - 2px);
  background: var(--sl-background);
  color: var(--sl-foreground);
  font: inherit;
  font-size: 0.92em;
  font-weight: 500;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
}
.slog-btn:hover:not(:disabled) { background: var(--sl-muted); }
.slog-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.slog-btn:focus-visible, .slog-tab:focus-visible {
  outline: 2px solid var(--sl-primary);
  outline-offset: 1px;
}
.slog-btn svg { width: 14px; height: 14px; flex: none; }
.slog-btn-primary {
  border-color: var(--sl-primary);
  background: var(--sl-primary);
  color: var(--sl-primary-foreground);
}
.slog-btn-primary:hover:not(:disabled) { background: var(--sl-primary); opacity: 0.9; }

.slog-summary { display: flex; flex-wrap: wrap; gap: 6px; }
.slog-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px 2px 7px;
  border: 1px solid var(--sl-border);
  border-radius: 999px;
  font-size: 0.85em;
  font-weight: 500;
}
.slog-badge svg { width: 13px; height: 13px; }

.slog-section { display: flex; flex-direction: column; gap: 8px; }
.slog-h {
  margin: 0;
  color: var(--sl-muted-foreground);
  font-size: 0.78em;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.slog-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1200 / 630;
  overflow: hidden;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-muted);
  color: var(--sl-muted-foreground);
}
.slog-frame img { display: block; width: 100%; height: 100%; object-fit: contain; }
.slog-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  color: var(--sl-muted-foreground);
  font-family: var(--sl-font-mono);
  font-size: 0.85em;
}
.slog-facts .slog-error { overflow-wrap: anywhere; }
.slog-actions { display: flex; flex-wrap: wrap; gap: 6px; }

.slog-checks {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  list-style: none;
}
.slog-checks li {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--sl-border);
  overflow-wrap: anywhere;
}
.slog-checks li:first-child { border-top: 0; }
.slog-checks svg { width: 15px; height: 15px; margin-top: 2px; }

.slog-tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--sl-radius);
  background: var(--sl-muted);
}
.slog-tab {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 4px;
  border: 0;
  border-radius: calc(var(--sl-radius) - 3px);
  background: transparent;
  color: var(--sl-muted-foreground);
  font: inherit;
  font-size: 0.9em;
  font-weight: 500;
  cursor: pointer;
}
.slog-tab:hover { color: var(--sl-foreground); }
.slog-tab[aria-selected="true"] {
  background: var(--sl-background);
  color: var(--sl-foreground);
  box-shadow: 0 0 0 1px var(--sl-border);
}

.slog-card-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.slog-img-wide {
  display: block;
  width: 100%;
  aspect-ratio: 1200 / 630;
  object-fit: cover;
  background: var(--sl-muted);
}
.slog-img-square {
  flex: none;
  width: 104px;
  height: 104px;
  object-fit: cover;
  border-right: 1px solid var(--sl-border);
  background: var(--sl-muted);
}
.slog-img-thumb {
  flex: none;
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--sl-background);
}
.slog-noimg {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  color: var(--sl-muted-foreground);
  font-size: 0.8em;
  line-height: 1.3;
  text-align: center;
}
.slog-link { color: var(--sl-primary); font-weight: 600; }
.slog-note { margin: 0; color: var(--sl-muted-foreground); font-size: 0.82em; }

.slog-x { display: flex; flex-direction: column; gap: 4px; }
.slog-x-media {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--sl-border);
  border-radius: 16px;
}
.slog-x-overlay {
  position: absolute;
  bottom: 10px;
  left: 10px;
  max-width: calc(100% - 20px);
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--sl-foreground) 78%, transparent);
  color: var(--sl-background);
  font-size: 0.85em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.slog-x-summary {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--sl-border);
  border-radius: 16px;
}
.slog-x-summary .slog-card-text { justify-content: center; padding: 8px 12px; }

.slog-linkedin { overflow: hidden; border: 1px solid var(--sl-border); border-radius: 4px; }
.slog-facebook { overflow: hidden; border: 1px solid var(--sl-border); border-radius: 8px; }
.slog-linkedin .slog-card-text, .slog-facebook .slog-card-text {
  padding: 8px 12px 10px;
  border-top: 1px solid var(--sl-border);
  background: var(--sl-muted);
}

.slog-slack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 10px;
  border-left: 4px solid var(--sl-border);
}
.slog-slack-img {
  max-width: 360px;
  margin-top: 6px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
}

.slog-discord {
  display: flex;
  gap: 12px;
  padding: 10px 12px 12px;
  border-left: 4px solid var(--sl-muted-foreground);
  border-radius: 4px;
  background: var(--sl-muted);
}
.slog-discord .slog-card-text { flex: 1; gap: 4px; }
.slog-discord .slog-img-wide { margin-top: 6px; border-radius: 4px; }

.slog-quickstart {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px dashed var(--sl-border);
  border-radius: var(--sl-radius);
}
.slog-quickstart > div { display: flex; flex: 1; flex-direction: column; min-width: 180px; }
`;
