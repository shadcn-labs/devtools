import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  Framework,
  PackageManager,
  ProjectInfo,
} from "@shadcn-labs/devtools-plugin-api";

const readJson = async <T>(file: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(file, "utf-8")) as T;
  } catch {
    return null;
  }
};

const ancestors = function* ancestors(from: string) {
  let dir = path.resolve(from);
  while (true) {
    yield dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      return;
    }
    dir = parent;
  }
};

/** Nearest directory at or above `cwd` that contains package.json. */
export const findProjectRoot = (cwd: string): string | null => {
  for (const dir of ancestors(cwd)) {
    if (existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
  }
  return null;
};

const LOCKFILES: [string, PackageManager][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

interface PackageJson {
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const readPackageManagerField = (dir: string): string | undefined => {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(dir, "package.json"), "utf-8")
    ) as PackageJson;
    return pkg.packageManager?.split("@")[0];
  } catch {
    return undefined;
  }
};

/**
 * Walks up so monorepo packages inherit the workspace lockfile. Synchronous:
 * the walk stops at the first hit and touches a handful of small files.
 */
const detectPackageManager = (root: string): PackageManager => {
  for (const dir of ancestors(root)) {
    const declared = readPackageManagerField(dir);
    if (
      declared === "pnpm" ||
      declared === "yarn" ||
      declared === "bun" ||
      declared === "npm"
    ) {
      return declared;
    }
    for (const [file, pm] of LOCKFILES) {
      if (existsSync(path.join(dir, file))) {
        return pm;
      }
    }
  }
  return "npm";
};

const detectFramework = (deps: Set<string>): Framework => {
  if (deps.has("next")) {
    return "next";
  }
  if (deps.has("astro")) {
    return "astro";
  }
  if (deps.has("@tanstack/react-start")) {
    return "tanstack-start";
  }
  if (deps.has("@react-router/dev")) {
    return "react-router";
  }
  if (deps.has("vite")) {
    return "vite";
  }
  return "unknown";
};

export const detectProject = async (
  cwd: string
): Promise<ProjectInfo | null> => {
  const root = findProjectRoot(cwd);
  if (!root) {
    return null;
  }
  const [pkg, components] = await Promise.all([
    readJson<PackageJson>(path.join(root, "package.json")),
    readJson<{ registries?: Record<string, string> }>(
      path.join(root, "components.json")
    ),
  ]);
  const deps = new Set([
    ...Object.keys(pkg?.dependencies ?? {}),
    ...Object.keys(pkg?.devDependencies ?? {}),
  ]);
  return {
    dependencies: [...deps].toSorted(),
    framework: detectFramework(deps),
    hasComponentsJson: components !== null,
    packageManager: detectPackageManager(root),
    registries: components?.registries ?? {},
    root,
  };
};
