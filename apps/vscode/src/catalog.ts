import type { CatalogEntry } from "@shadcn-labs/devtools-core";
import {
  LABS_REGISTRIES,
  fetchRegistryIndex,
} from "@shadcn-labs/devtools-core";

const TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 15_000;

export interface CatalogResult {
  entries: CatalogEntry[];
  /** `registry name: reason` for every index that could not be loaded. */
  errors: string[];
}

export interface Catalog {
  load: () => Promise<CatalogResult>;
  clear: () => void;
}

/** Registry indexes fetched in the extension host, cached per registry. */
export const createCatalog = (): Catalog => {
  const cache = new Map<string, { at: number; entries: CatalogEntry[] }>();

  return {
    clear() {
      cache.clear();
    },
    async load() {
      const now = Date.now();
      const results = await Promise.allSettled(
        LABS_REGISTRIES.map(async (source) => {
          const hit = cache.get(source.id);
          if (hit && now - hit.at < TTL_MS) {
            return hit.entries;
          }
          const entries = await fetchRegistryIndex(source, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          cache.set(source.id, { at: now, entries });
          return entries;
        })
      );
      const result: CatalogResult = { entries: [], errors: [] };
      for (const [index, settled] of results.entries()) {
        if (settled.status === "fulfilled") {
          result.entries.push(...settled.value);
        } else {
          const name = LABS_REGISTRIES[index]?.name ?? "registry";
          const reason =
            settled.reason instanceof Error
              ? settled.reason.message
              : String(settled.reason);
          result.errors.push(
            reason.startsWith(`${name}:`) ? reason : `${name}: ${reason}`
          );
        }
      }
      return result;
    },
  };
};
