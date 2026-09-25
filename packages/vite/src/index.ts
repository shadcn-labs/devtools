import { fileURLToPath } from "node:url";

import { detectProject } from "@shadcn-labs/devtools-core/node";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:shadcn-labs-devtools";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

export interface ShadcnLabsDevtoolsOptions {
  /** Inject the toolbar during `vite dev` (default `true`). */
  enabled?: boolean;
}

/**
 * Injects the Shadcn Labs devtools toolbar into every HTML page served by
 * `vite dev`. Builds are untouched.
 */
export const shadcnLabsDevtools = (
  options: ShadcnLabsDevtoolsOptions = {}
): Plugin => {
  let root = process.cwd();
  let base = "/";
  return {
    apply: (_config, env) =>
      options.enabled !== false && env.command === "serve",
    configResolved: (config) => {
      ({ base, root } = config);
    },
    load: async (id) => {
      if (id !== RESOLVED_VIRTUAL_ID) {
        return null;
      }
      // Resolved from this package so apps need no direct toolbar dependency
      // (pnpm's strict node_modules); served through Vite's /@fs/ route.
      const toolbar = fileURLToPath(
        import.meta.resolve("@shadcn-labs/devtools-toolbar")
      ).replaceAll("\\", "/");
      const project = await detectProject(root);
      return `import { mountToolbar } from ${JSON.stringify(`/@fs/${toolbar.replace(/^\//u, "")}`)};
mountToolbar({ project: ${JSON.stringify(project)} });
`;
    },
    name: "shadcn-labs-devtools",
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : null),
    transformIndexHtml: () => [
      {
        attrs: { src: `${base}@id/${VIRTUAL_ID}`, type: "module" },
        injectTo: "body",
        tag: "script",
      },
    ],
  };
};
