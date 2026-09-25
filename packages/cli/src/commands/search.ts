import { parseArgs } from "node:util";

import type { CatalogEntry } from "@shadcn-labs/devtools-core";
import {
  fetchRegistryIndex,
  LABS_REGISTRIES,
  registryItemUrl,
  searchCatalog,
} from "@shadcn-labs/devtools-core";
import pc from "picocolors";

import type { CliCommand } from "../output";
import { BIN, CliError, warn } from "../output";

const DEFAULT_LIMIT = 20;
const FETCH_TIMEOUT_MS = 15_000;

const HELP = `Usage: ${BIN} search [query...] [options]

Search every Shadcn Labs registry (or one) by name, title and description.
Without a query, lists all items.

Options:
  -r, --registry <id>   Only search one registry: ${LABS_REGISTRIES.map((source) => source.id).join(", ")}
  -n, --limit <n>       Maximum results (default: ${DEFAULT_LIMIT})
  --json                Print a JSON array of { ref, type, title, description, url }
  -h, --help            Show this help`;

export interface SearchRow {
  ref: string;
  type: string;
  title: string;
}

/**
 * Aligned `ref  type  title` lines. Only the title column shrinks to fit
 * `width`; refs are never cut because they are meant to be copied.
 */
export const formatTable = (
  rows: SearchRow[],
  width: number,
  colors: Pick<typeof pc, "cyan" | "dim"> = pc
): string[] => {
  const refWidth = Math.max(3, ...rows.map((row) => row.ref.length));
  const typeWidth = Math.max(4, ...rows.map((row) => row.type.length));
  const titleWidth = Math.max(0, width - refWidth - typeWidth - 4);
  const fit = (title: string) =>
    title.length <= titleWidth
      ? title
      : `${title.slice(0, Math.max(0, titleWidth - 1))}…`.slice(0, titleWidth);
  return [
    colors.dim(
      `${"REF".padEnd(refWidth)}  ${"TYPE".padEnd(typeWidth)}  ${fit("TITLE")}`
    ),
    ...rows.map(
      (row) =>
        `${colors.cyan(row.ref.padEnd(refWidth))}  ${row.type.padEnd(typeWidth)}  ${fit(row.title)}`
    ),
  ];
};

export const search: CliCommand = {
  run: async (argv) => {
    const { positionals, values } = parseArgs({
      allowPositionals: true,
      args: argv,
      options: {
        help: { short: "h", type: "boolean" },
        json: { type: "boolean" },
        limit: { short: "n", type: "string" },
        registry: { short: "r", type: "string" },
      },
    });
    if (values.help) {
      console.log(HELP);
      return 0;
    }
    const limit =
      values.limit === undefined ? DEFAULT_LIMIT : Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new CliError(
        `--limit must be a positive integer, got "${values.limit}".`
      );
    }
    const sources = values.registry
      ? LABS_REGISTRIES.filter(
          (source) =>
            source.id === values.registry || source.scope === values.registry
        )
      : LABS_REGISTRIES;
    if (sources.length === 0) {
      throw new CliError(
        `Unknown registry "${values.registry}". Choose one of: ${LABS_REGISTRIES.map((source) => source.id).join(", ")}.`
      );
    }

    const settled = await Promise.allSettled(
      sources.map((source) =>
        fetchRegistryIndex(source, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
      )
    );
    const entries: CatalogEntry[] = [];
    for (const [index, result] of settled.entries()) {
      if (result.status === "fulfilled") {
        entries.push(...result.value);
      } else {
        const reason =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        warn(
          `${sources[index]?.name}: could not load the registry index (${reason})`
        );
      }
    }
    if (settled.every((result) => result.status === "rejected")) {
      throw new CliError("No registry could be reached.");
    }

    const query = positionals.join(" ");
    const matches = searchCatalog(entries, query);
    const shown = matches.slice(0, limit);
    if (values.json) {
      const rows = shown.map((entry) => ({
        description: entry.item.description ?? null,
        ref: entry.ref,
        title: entry.item.title ?? null,
        type: entry.item.type,
        url: registryItemUrl(entry.registry, entry.item.name),
      }));
      console.log(JSON.stringify(rows, null, 2));
      return 0;
    }
    if (matches.length === 0) {
      console.log(
        query ? `No items match "${query}".` : "The registries are empty."
      );
      return 0;
    }
    const table = formatTable(
      shown.map((entry) => ({
        ref: entry.ref,
        title: entry.item.title ?? entry.item.description ?? "",
        type: entry.item.type.replace(/^registry:/u, ""),
      })),
      // Undefined when piped; 0 on size-less pseudo-terminals.
      process.stdout.columns || Number.POSITIVE_INFINITY
    );
    console.log(table.join("\n"));
    const more =
      matches.length > shown.length
        ? `Showing ${shown.length} of ${matches.length}; raise --limit for more. `
        : "";
    console.log(pc.dim(`\n${more}Install with: ${BIN} add <ref>`));
    return 0;
  },
  summary: "Search Shadcn Labs registries",
};
