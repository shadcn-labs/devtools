#!/usr/bin/env node
import pc from "picocolors";

import { version } from "../package.json";
import { add } from "./commands/add";
import { bridge } from "./commands/bridge";
import { init } from "./commands/init";
import { search } from "./commands/search";
import type { CliCommand } from "./output";
import { BIN, CliError } from "./output";

const COMMANDS: Record<string, CliCommand> = { add, bridge, init, search };

const HELP = `${pc.bold("Shadcn Labs devtools")} ${pc.dim(`v${version}`)}

Usage: ${BIN} <command> [options]

Commands:
${Object.entries(COMMANDS)
  .map(([name, command]) => `  ${name.padEnd(8)}${command.summary}`)
  .join("\n")}

Options:
  -h, --help     Show help (also: ${BIN} <command> --help)
  -v, --version  Show the version

Examples:
  npx @shadcn-labs/devtools init
  npx @shadcn-labs/devtools search spinner
  npx @shadcn-labs/devtools add @ogimagecn/blog`;

const main = async (argv: string[]): Promise<number> => {
  const [name, ...rest] = argv;
  if (
    name === undefined ||
    name === "-h" ||
    name === "--help" ||
    name === "help"
  ) {
    console.log(HELP);
    return 0;
  }
  if (name === "-v" || name === "--version") {
    console.log(version);
    return 0;
  }
  const command = COMMANDS[name];
  if (!command) {
    console.error(`${pc.red("error")} Unknown command "${name}".\n`);
    console.error(HELP);
    return 1;
  }
  try {
    return await command.run(rest);
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`${pc.red("error")} ${error.message}`);
      return 1;
    }
    // node:util parseArgs rejects unknown flags and missing option values.
    if (
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code.startsWith("ERR_PARSE_ARGS")
    ) {
      console.error(`${pc.red("error")} ${error.message}`);
      console.error(`Run "${BIN} ${name} --help" for usage.`);
      return 1;
    }
    throw error;
  }
};

process.exitCode = await main(process.argv.slice(2));
