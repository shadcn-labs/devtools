import type { PackageManager } from "@shadcn-labs/devtools-plugin-api";

import type { RegistrySource } from "./registries";
import { findRegistry, registryIndexUrl, registryItemUrl } from "./registries";

export interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
  categories?: string[];
  dependencies?: string[];
  registryDependencies?: string[];
}

export interface CatalogEntry {
  registry: RegistrySource;
  item: RegistryItem;
  /** `@scope/name` */
  ref: string;
}

type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface FetchIndexOptions {
  fetch?: FetchLike;
  signal?: AbortSignal;
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];

const toItem = (raw: unknown): RegistryItem | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || typeof r.type !== "string") {
    return null;
  }
  return {
    categories: stringArray(r.categories),
    dependencies: stringArray(r.dependencies),
    description: typeof r.description === "string" ? r.description : undefined,
    name: r.name,
    registryDependencies: stringArray(r.registryDependencies),
    title: typeof r.title === "string" ? r.title : undefined,
    type: r.type,
  };
};

/** Fetch a registry index and return catalog entries (file contents dropped). */
export const fetchRegistryIndex = async (
  source: RegistrySource,
  options: FetchIndexOptions = {}
): Promise<CatalogEntry[]> => {
  const doFetch = options.fetch ?? (globalThis.fetch as FetchLike);
  const res = await doFetch(registryIndexUrl(source), {
    signal: options.signal,
  });
  if (!res.ok) {
    throw new Error(`${source.name}: registry index returned ${res.status}`);
  }
  const body = (await res.json()) as { items?: unknown };
  const items = Array.isArray(body.items) ? body.items : [];
  const entries: CatalogEntry[] = [];
  for (const raw of items) {
    const item = toItem(raw);
    if (item) {
      entries.push({
        item,
        ref: `${source.scope}/${item.name}`,
        registry: source,
      });
    }
  }
  return entries;
};

const REF_PATTERN =
  /^(?<scope>@[a-z0-9][a-z0-9-]*)\/(?<name>[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*)$/u;

/**
 * Parse `@scope/name` and ensure it targets a Shadcn Labs registry. The
 * character set is deliberately narrow: refs end up on a shell command line.
 */
export const parseItemRef = (
  ref: string
): { registry: RegistrySource; name: string } | null => {
  const match = REF_PATTERN.exec(ref);
  if (!match) {
    return null;
  }
  const { scope, name } = match.groups ?? {};
  const registry = scope ? findRegistry(scope) : undefined;
  if (!registry || !name) {
    return null;
  }
  return { name, registry };
};

/**
 * Argument for `shadcn add`: the `@scope/name` alias when the project has the
 * registry configured, otherwise the item's absolute JSON URL (works without
 * any components.json setup).
 */
export const addTarget = (
  ref: string,
  configured: Record<string, string>
): string => {
  const parsed = parseItemRef(ref);
  if (!parsed) {
    throw new Error(`Not a Shadcn Labs registry item: ${ref}`);
  }
  return parsed.registry.scope in configured
    ? ref
    : registryItemUrl(parsed.registry, parsed.name);
};

export interface Command {
  command: string;
  args: string[];
}

const RUNNERS: Record<PackageManager, Command> = {
  bun: { args: ["--bun", "shadcn@latest"], command: "bunx" },
  npm: { args: ["shadcn@latest"], command: "npx" },
  pnpm: { args: ["dlx", "shadcn@latest"], command: "pnpm" },
  // `yarn dlx` does not exist in Yarn 1; npx works for every Yarn version.
  yarn: { args: ["shadcn@latest"], command: "npx" },
};

export const shadcnAddCommand = (
  targets: string[],
  packageManager: PackageManager
): Command => {
  const runner = RUNNERS[packageManager];
  return { args: [...runner.args, "add", ...targets], command: runner.command };
};

export const formatCommand = ({ command, args }: Command): string =>
  [command, ...args].join(" ");

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);

/**
 * Rank entries against a free-text query. Every query token must match
 * somewhere; name hits outrank title hits outrank description hits.
 */
export const searchCatalog = (
  entries: CatalogEntry[],
  query: string
): CatalogEntry[] => {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return entries;
  }
  const scored: { entry: CatalogEntry; score: number }[] = [];
  for (const entry of entries) {
    const name = entry.item.name.toLowerCase();
    const title = (entry.item.title ?? "").toLowerCase();
    const rest = [
      entry.item.description ?? "",
      entry.item.type,
      entry.registry.name,
      ...(entry.item.categories ?? []),
    ]
      .join(" ")
      .toLowerCase();
    let score = 0;
    let matchedAll = true;
    for (const token of tokens) {
      if (name === token) {
        score += 100;
      } else if (name.split(/[/_-]/u).some((part) => part.startsWith(token))) {
        score += 40;
      } else if (name.includes(token)) {
        score += 25;
      } else if (title.includes(token)) {
        score += 15;
      } else if (rest.includes(token)) {
        score += 5;
      } else {
        matchedAll = false;
        break;
      }
    }
    if (matchedAll) {
      scored.push({ entry, score });
    }
  }
  return scored
    .toSorted(
      (a, b) => b.score - a.score || a.entry.ref.localeCompare(b.entry.ref)
    )
    .map((s) => s.entry);
};
