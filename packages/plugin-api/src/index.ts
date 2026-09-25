/**
 * The only contract between Shadcn Labs devtools surfaces (toolbar, IDE
 * extension, CLI) and project plugins. Keep it small and semver it strictly.
 */

export type Framework =
  | "astro"
  | "next"
  | "react-router"
  | "tanstack-start"
  | "unknown"
  | "vite";

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

/** Serializable facts about the user's project, gathered on the Node side. */
export interface ProjectInfo {
  /** Absolute path of the project root (directory holding package.json). */
  root: string;
  framework: Framework;
  packageManager: PackageManager;
  /** Names from dependencies + devDependencies. */
  dependencies: string[];
  /** `registries` map from components.json (empty when absent). */
  registries: Record<string, string>;
  hasComponentsJson: boolean;
}

// ---------------------------------------------------------------------------
// Bridge protocol (toolbar -> IDE / CLI host over localhost HTTP)
// ---------------------------------------------------------------------------

export const BRIDGE_PORTS = [
  5747, 5748, 5749, 5750, 5751, 5752, 5753, 5754, 5755, 5756,
] as const;

/** Custom header every bridge request must carry; forces a CORS preflight. */
export const BRIDGE_HEADER = "x-shadcn-labs-devtools";

export interface BridgeHealth {
  app: "shadcn-labs-devtools";
  host: "cli" | "vscode";
  root: string;
  version: string;
}

export type BridgeRequest =
  /** Run `shadcn add <ref>` in the host (terminal). `ref` is `@scope/name`. */
  | { type: "install"; ref: string }
  /**
   * Open the source file that renders the OG image for a page. `pathname` is
   * the page path; `imagePathname` is the og:image path when same-origin.
   */
  | { type: "open-og-source"; pathname: string; imagePathname?: string };

export interface BridgeResponseMap {
  install: { command: string };
  "open-og-source": { file: string | null };
}

export type BridgeResponse<T extends BridgeRequest> =
  BridgeResponseMap[T["type"]];

export interface BridgeClient {
  health: BridgeHealth;
  request: <T extends BridgeRequest>(req: T) => Promise<BridgeResponse<T>>;
}

// ---------------------------------------------------------------------------
// Toolbar plugins
// ---------------------------------------------------------------------------

export type NotifyTone = "error" | "info" | "success";

export interface ToolbarContext {
  /** Null when the adapter could not provide project facts. */
  project: ProjectInfo | null;
  /** Null when no IDE/CLI bridge is reachable. */
  bridge: BridgeClient | null;
  /** Copy to the clipboard, with a fallback for insecure (LAN) origins. */
  copy: (text: string) => Promise<void>;
  notify: (message: string, tone?: NotifyTone) => void;
  /** Fires after client-side navigation (pushState/replaceState/popstate). */
  onNavigate: (listener: () => void) => () => void;
}

export interface ToolbarPanel {
  title: string;
  /** Inline SVG markup, 16x16, `currentColor`. */
  icon: string;
  /**
   * Render into `container` (inside the toolbar's shadow root). Return a
   * cleanup function; it runs when the panel closes.
   */
  mount: (
    container: HTMLElement,
    ctx: ToolbarContext
  ) => (() => void) | undefined;
}

export interface DevtoolsPlugin {
  /** Stable id, e.g. `ogimagecn`. */
  id: string;
  name: string;
  /** Registry scope this plugin belongs to, e.g. `@ogimagecn`. */
  scope?: `@${string}`;
  /** Pure: decide from project facts whether the plugin applies. */
  detect: (project: ProjectInfo) => boolean;
  toolbar?: ToolbarPanel;
}

export const definePlugin = (plugin: DevtoolsPlugin): DevtoolsPlugin => plugin;
