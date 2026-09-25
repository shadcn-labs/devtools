import pc from "picocolors";

export const BIN = "shadcn-labs-devtools";

/** Expected failure: printed without a stack trace; the process exits 1. */
export class CliError extends Error {
  override name = "CliError";
}

export interface CliCommand {
  summary: string;
  /** Parses its own `argv` (everything after the command name). */
  run: (argv: string[]) => Promise<number>;
}

export const success = (message: string) => {
  console.log(`${pc.green("✔")} ${message}`);
};

export const warn = (message: string) => {
  console.warn(`${pc.yellow("!")} ${message}`);
};

export const step = (message: string) => {
  console.log(`${pc.cyan("›")} ${message}`);
};

/** Indent a multi-line block for display under a status line. */
export const indent = (text: string, prefix = "    ") =>
  text
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
