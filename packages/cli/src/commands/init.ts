import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import type { Command } from "@shadcn-labs/devtools-core";
import { formatCommand } from "@shadcn-labs/devtools-core";
import { detectProject } from "@shadcn-labs/devtools-core/node";
import type {
  Framework,
  PackageManager,
  ProjectInfo,
} from "@shadcn-labs/devtools-plugin-api";
import pc from "picocolors";

import type { CliCommand } from "../output";
import { BIN, CliError, indent, step, success, warn } from "../output";
import type { PatchResult } from "../patch";
import {
  NEXT_PACKAGE,
  patchNextLayout,
  patchViteConfig,
  VITE_PACKAGE,
} from "../patch";
import { runCommand } from "../process";

const TOOLBAR_PACKAGE = "@shadcn-labs/devtools-toolbar";
const EXTENSION_ID = "shadcn-labs.shadcn-labs-devtools";

const HELP = `Usage: ${BIN} init [options]

Add the Shadcn Labs devtools toolbar to your app's dev server.

  Next.js (App Router)  installs ${NEXT_PACKAGE} and renders
                        <ShadcnLabsDevtools /> in the root layout
  Vite (SPA)            installs ${VITE_PACKAGE} and adds
                        shadcnLabsDevtools() to vite.config
  Anything else         prints the manual setup steps

Options:
  --cwd <dir>       Project directory (default: current directory)
  --skip-install    Patch files without installing packages
  -h, --help        Show this help`;

const INSTALL_ARGS: Record<PackageManager, string[]> = {
  bun: ["add", "-d"],
  npm: ["i", "-D"],
  pnpm: ["add", "-D"],
  yarn: ["add", "-D"],
};

const FRAMEWORK_LABELS: Record<Framework, string> = {
  astro: "Astro",
  next: "Next.js",
  "react-router": "React Router",
  "tanstack-start": "TanStack Start",
  unknown: "an unrecognized framework",
  vite: "Vite",
};

/** Where a client-only entry lives, per framework. */
const CLIENT_ENTRY_HINTS: Record<Framework, string> = {
  astro: "a <script> in your base layout (e.g. src/layouts/Layout.astro)",
  next: "pages/_app.tsx, inside a useEffect",
  "react-router":
    "app/entry.client.tsx (create it with `npx react-router reveal`)",
  "tanstack-start": "src/client.tsx",
  unknown: "your browser entry module",
  vite: "your browser entry module (e.g. src/main.tsx)",
};

interface Integration {
  /** Adapter package installed as a devDependency. */
  pkg: string;
  /** File to patch; absent when no known file exists. */
  file?: string;
  patch: (source: string) => PatchResult;
  /** Steps that achieve the same result by hand. */
  manual: string;
}

const nextIntegration = (root: string): Integration | null => {
  const file = ["app", "src/app"]
    .flatMap((dir) =>
      ["tsx", "jsx", "ts", "js"].map((ext) =>
        path.join(root, dir, `layout.${ext}`)
      )
    )
    .find((candidate) => existsSync(candidate));
  if (!file) {
    return null;
  }
  return {
    file,
    manual: `In ${path.relative(root, file)}:

  import { ShadcnLabsDevtools } from "${NEXT_PACKAGE}";

  // last child of <body>:
  <ShadcnLabsDevtools />`,
    patch: patchNextLayout,
    pkg: NEXT_PACKAGE,
  };
};

const viteIntegration = (root: string): Integration | null => {
  if (!existsSync(path.join(root, "index.html"))) {
    return null;
  }
  const file = ["ts", "mts", "js", "mjs"]
    .map((ext) => path.join(root, `vite.config.${ext}`))
    .find((candidate) => existsSync(candidate));
  return {
    file,
    manual: `In ${file ? path.relative(root, file) : "vite.config.ts"}:

  import { shadcnLabsDevtools } from "${VITE_PACKAGE}";

  export default defineConfig({
    plugins: [shadcnLabsDevtools(), /* ...your plugins */],
  });`,
    patch: patchViteConfig,
    pkg: VITE_PACKAGE,
  };
};

const manualToolbarSetup = (project: ProjectInfo) => {
  const mount =
    project.framework === "next"
      ? `if (process.env.NODE_ENV === "development") import("${TOOLBAR_PACKAGE}").then((m) => m.mountToolbar());`
      : `if (import.meta.env.DEV) import("${TOOLBAR_PACKAGE}").then((m) => m.mountToolbar());`;
  return `1. Install the toolbar:

  ${formatCommand({ args: [...INSTALL_ARGS[project.packageManager], TOOLBAR_PACKAGE], command: project.packageManager })}

2. Mount it from client-only code, ${CLIENT_ENTRY_HINTS[project.framework]}:

  ${mount}`;
};

const install = async (
  project: ProjectInfo,
  pkg: string,
  skip: boolean
): Promise<void> => {
  const command: Command = {
    args: [...INSTALL_ARGS[project.packageManager], pkg],
    command: project.packageManager,
  };
  if (project.dependencies.includes(pkg)) {
    success(`${pkg} is already installed`);
    return;
  }
  if (skip) {
    warn(
      `Skipped installing ${pkg} (--skip-install). Run: ${formatCommand(command)}`
    );
    return;
  }
  step(`Installing ${pkg}`);
  console.log(pc.dim(`$ ${formatCommand(command)}`));
  const code = await runCommand(command, project.root);
  if (code !== 0) {
    throw new CliError(
      `${formatCommand(command)} exited with code ${code}. No files were changed.`
    );
  }
  success(`Installed ${pkg}`);
};

const applyPatch = async (root: string, integration: Integration) => {
  const { file } = integration;
  if (!file) {
    warn("No file to patch was found. Set it up by hand:");
    console.log(`\n${indent(integration.manual)}\n`);
    return;
  }
  const name = path.relative(root, file);
  const result = integration.patch(await readFile(file, "utf-8"));
  switch (result.status) {
    case "patched": {
      await writeFile(file, result.code);
      success(`Updated ${name}`);
      return;
    }
    case "already": {
      success(`${name} is already set up`);
      return;
    }
    case "unsupported": {
      warn(`Could not update ${name} safely: ${result.reason}. Do it by hand:`);
      console.log(`\n${indent(integration.manual)}\n`);
      return;
    }
    default: {
      throw new Error(`Unexpected patch result: ${JSON.stringify(result)}`);
    }
  }
};

const NEXT_STEPS = `${pc.bold("Next steps")}
  • Start your dev server; the toolbar appears in the page corner (toggle: Alt+Shift+L).
  • To install items and open sources from the toolbar, connect a bridge:
      VS Code / Cursor: install the ${pc.cyan(EXTENSION_ID)} extension
      Any editor:       ${pc.cyan("npx @shadcn-labs/devtools bridge")}`;

export const init: CliCommand = {
  run: async (argv) => {
    const { values } = parseArgs({
      args: argv,
      options: {
        cwd: { type: "string" },
        help: { short: "h", type: "boolean" },
        "skip-install": { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(HELP);
      return 0;
    }
    const cwd = path.resolve(values.cwd ?? process.cwd());
    const project = await detectProject(cwd);
    if (!project) {
      throw new CliError(`No package.json found in ${cwd} or its parents.`);
    }
    step(
      `${FRAMEWORK_LABELS[project.framework]} project at ${pc.dim(project.root)} (${project.packageManager})`
    );

    let integration: Integration | null = null;
    if (project.framework === "next") {
      integration = nextIntegration(project.root);
    } else if (project.framework === "vite") {
      integration = viteIntegration(project.root);
    }
    if (integration) {
      await install(project, integration.pkg, values["skip-install"] ?? false);
      await applyPatch(project.root, integration);
    } else {
      warn(
        project.framework === "next"
          ? "No App Router root layout (app/layout or src/app/layout). Set up the Pages Router by hand:"
          : `Automatic setup supports Next.js App Router and Vite SPAs. Set up ${FRAMEWORK_LABELS[project.framework]} by hand:`
      );
      console.log(`\n${indent(manualToolbarSetup(project))}\n`);
    }
    console.log(`\n${NEXT_STEPS}`);
    return 0;
  },
  summary: "Add the devtools toolbar to your app's dev server",
};
