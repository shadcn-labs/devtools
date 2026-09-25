import { once } from "node:events";
import path from "node:path";
import { parseArgs } from "node:util";

import { startBridgeServer } from "@shadcn-labs/devtools-bridge/server";
import { formatCommand } from "@shadcn-labs/devtools-core";
import { findProjectRoot } from "@shadcn-labs/devtools-core/node";
import pc from "picocolors";

import { version } from "../../package.json";
import type { CliCommand } from "../output";
import { BIN, CliError, step, success, warn } from "../output";
import { openInEditor, runCommand } from "../process";

const HELP = `Usage: ${BIN} bridge [options]

Serve the localhost bridge that lets the in-browser toolbar install registry
items and open source files, for editors without the VS Code extension.

Installs run here, one at a time, with this terminal's stdio. Files open in
$SHADCN_LABS_EDITOR, $VISUAL or $EDITOR (code/cursor/windsurf get -g), falling
back to the OS default app.

Options:
  --cwd <dir>              Project directory (default: current directory)
  --allow-origin <origin>  Also accept requests from this page origin
                           (repeatable; localhost is always allowed)
  -h, --help               Show this help`;

export const bridge: CliCommand = {
  run: async (argv) => {
    const { values } = parseArgs({
      args: argv,
      options: {
        "allow-origin": { multiple: true, type: "string" },
        cwd: { type: "string" },
        help: { short: "h", type: "boolean" },
      },
    });
    if (values.help) {
      console.log(HELP);
      return 0;
    }
    const allowedOrigins = values["allow-origin"] ?? [];
    for (const origin of allowedOrigins) {
      if (!URL.canParse(origin) || new URL(origin).origin !== origin) {
        throw new CliError(
          `--allow-origin expects an origin such as http://app.test:3000, got "${origin}".`
        );
      }
    }
    const cwd = path.resolve(values.cwd ?? process.cwd());
    const root = findProjectRoot(cwd) ?? cwd;

    // One command at a time: concurrent `shadcn add` prompts would share stdin.
    let queue: Promise<unknown> = Promise.resolve();
    const server = await startBridgeServer({
      allowedOrigins,
      handlers: {
        openFile: async (file) => {
          step(`Opening ${path.relative(root, file)}`);
          await openInEditor(file);
        },
        run: (command, dir) => {
          const task = queue.then(async () => {
            const line = formatCommand(command);
            step(`${pc.dim(dir)}\n  $ ${line}`);
            const code = await runCommand(command, dir);
            if (code !== 0) {
              warn(`${line} exited with code ${code}`);
              throw new Error(`${line} exited with code ${code}`);
            }
            success(line);
          });
          // The caller gets the failure; the queue only needs to move on.
          queue = task.catch(() => null);
          return task;
        },
      },
      host: "cli",
      root,
      version,
    });

    success(
      `Bridge listening on ${pc.cyan(`http://127.0.0.1:${server.port}`)}`
    );
    console.log(`  root: ${root}`);
    console.log(
      pc.dim("  Keep this running while you use the toolbar. Ctrl+C to stop.")
    );

    const stopped = new AbortController();
    await Promise.race([
      once(process, "SIGINT", { signal: stopped.signal }),
      once(process, "SIGTERM", { signal: stopped.signal }),
    ]);
    // Drops the other listener; its AbortError is absorbed by the race.
    stopped.abort();
    await server.close();
    console.log(pc.dim("Bridge stopped."));
    return 0;
  },
  summary: "Run the toolbar bridge for editors without the extension",
};
