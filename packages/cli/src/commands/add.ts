import path from "node:path";
import { parseArgs } from "node:util";

import type { RegistrySource } from "@shadcn-labs/devtools-core";
import {
  addTarget,
  formatCommand,
  LABS_REGISTRIES,
  parseItemRef,
  shadcnAddCommand,
} from "@shadcn-labs/devtools-core";
import {
  detectProject,
  ensureRegistries,
} from "@shadcn-labs/devtools-core/node";
import pc from "picocolors";

import type { CliCommand } from "../output";
import { BIN, CliError, success } from "../output";
import { runCommand } from "../process";

const HELP = `Usage: ${BIN} add <ref...> [options]

Install Shadcn Labs registry items with the shadcn CLI. When components.json
exists, the items' registries are added to its "registries" map first.

Arguments:
  ref           Item as @scope/name, e.g. @ogimagecn/blog or @termcn/ink/spinner
                Scopes: ${LABS_REGISTRIES.map((source) => source.scope).join(", ")}

Options:
  --cwd <dir>   Project directory (default: current directory)
  -h, --help    Show this help`;

export const add: CliCommand = {
  run: async (argv) => {
    const { positionals, values } = parseArgs({
      allowPositionals: true,
      args: argv,
      options: {
        cwd: { type: "string" },
        help: { short: "h", type: "boolean" },
      },
    });
    if (values.help) {
      console.log(HELP);
      return 0;
    }
    if (positionals.length === 0) {
      throw new CliError(`Missing item refs. Usage: ${BIN} add <ref...>`);
    }
    const invalid = positionals.filter((ref) => !parseItemRef(ref));
    if (invalid.length > 0) {
      throw new CliError(
        `Not a Shadcn Labs registry item: ${invalid.join(", ")}
Refs look like @scope/name with scope one of ${LABS_REGISTRIES.map((source) => source.scope).join(", ")}.
Find items with: ${BIN} search <query>`
      );
    }

    const cwd = path.resolve(values.cwd ?? process.cwd());
    const project = await detectProject(cwd);
    if (!project) {
      throw new CliError(`No package.json found in ${cwd} or its parents.`);
    }
    const registries = { ...project.registries };
    if (project.hasComponentsJson) {
      const sources = new Set<RegistrySource>();
      for (const ref of positionals) {
        const parsed = parseItemRef(ref);
        if (parsed) {
          sources.add(parsed.registry);
        }
      }
      const result = await ensureRegistries(project.root, [...sources]);
      if (result.status === "updated") {
        for (const scope of result.added) {
          registries[scope] = "configured";
        }
        success(
          `Added ${result.added.join(", ")} to components.json registries`
        );
      }
    }

    const command = shadcnAddCommand(
      positionals.map((ref) => addTarget(ref, registries)),
      project.packageManager
    );
    console.log(pc.dim(`$ ${formatCommand(command)}`));
    return await runCommand(command, project.root);
  },
  summary: "Install registry items (shadcn add with Labs registries wired up)",
};
