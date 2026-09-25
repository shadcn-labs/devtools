import { spawn } from "node:child_process";
import { once } from "node:events";

import type { Command } from "@shadcn-labs/devtools-core";

const isWindows = process.platform === "win32";

/** Run to completion with inherited stdio; resolves the exit code. */
export const runCommand = async (
  command: Command,
  cwd: string
): Promise<number> => {
  // Package-manager binaries are `.cmd` shims on Windows.
  const child = spawn(command.command, command.args, {
    cwd,
    shell: isWindows,
    stdio: "inherit",
  });
  // `once` rejects when the child fires "error" (e.g. ENOENT) first.
  const [code] = (await once(child, "exit")) as [number | null];
  return code ?? 1;
};

/** Editors whose CLI opens `file[:line]` with `-g`. */
const GOTO_EDITORS: Record<string, true> = {
  code: true,
  "code-insiders": true,
  cursor: true,
  windsurf: true,
};

export interface EditorLaunch {
  command: string;
  args: string[];
  /** Editor variables may carry flags and quoted paths, like `$EDITOR` in git. */
  shell: boolean;
}

/**
 * How to open `file`: `$SHADCN_LABS_EDITOR`, then `$VISUAL`, then `$EDITOR`,
 * then the OS default handler.
 */
export const editorLaunch = (
  file: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
): EditorLaunch => {
  const editor = [env.SHADCN_LABS_EDITOR, env.VISUAL, env.EDITOR]
    .map((value) => value?.trim())
    .find(Boolean);
  if (editor) {
    const executable =
      /^(?:"(?<double>[^"]+)"|'(?<single>[^']+)'|(?<bare>\S+))/u.exec(editor)
        ?.groups ?? {};
    const name =
      (executable.double ?? executable.single ?? executable.bare ?? "")
        .split(/[\\/]/u)
        .at(-1)
        ?.replace(/\.(?:cmd|exe)$/iu, "")
        .toLowerCase() ?? "";
    const quoted =
      platform === "win32" ? `"${file}"` : `'${file.replaceAll("'", `'\\''`)}'`;
    return {
      args: [],
      command: `${editor} ${GOTO_EDITORS[name] ? "-g " : ""}${quoted}`,
      shell: true,
    };
  }
  if (platform === "darwin") {
    return { args: [file], command: "open", shell: false };
  }
  if (platform === "win32") {
    return {
      args: [`/d /s /c start "" "${file}"`],
      command: "cmd.exe",
      shell: false,
    };
  }
  return { args: [file], command: "xdg-open", shell: false };
};

/** Launch the editor without waiting for it to exit (`code --wait`, vim). */
export const openInEditor = async (file: string): Promise<void> => {
  const launch = editorLaunch(file, process.env, process.platform);
  const child = spawn(launch.command, launch.args, {
    shell: launch.shell,
    stdio: "inherit",
    windowsVerbatimArguments: launch.command === "cmd.exe",
  });
  await once(child, "spawn");
};
