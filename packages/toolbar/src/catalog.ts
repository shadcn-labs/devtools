import type {
  CatalogEntry,
  RegistryItem,
  RegistrySource,
} from "@shadcn-labs/devtools-core";
import { fetchRegistryIndex } from "@shadcn-labs/devtools-core";

export const INDEX_TTL_MS = 10 * 60 * 1000;
const KEY_PREFIX = "shadcn-labs-devtools:registry:";

interface CachedIndex {
  at: number;
  entries: { item: RegistryItem; ref: string }[];
}

/** Survives remounts even where sessionStorage is unavailable. */
const memory = new Map<string, CachedIndex>();

/** Webviews and sandboxed frames may lack sessionStorage or throw on access. */
const session = (): Storage | null => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const isFresh = (cached: CachedIndex | undefined, now: number) =>
  cached !== undefined && now >= cached.at && now - cached.at < INDEX_TTL_MS;

const parse = (raw: string | null | undefined): CachedIndex | undefined => {
  if (!raw) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as Partial<CachedIndex>;
    return typeof value.at === "number" && Array.isArray(value.entries)
      ? (value as CachedIndex)
      : undefined;
  } catch {
    return undefined;
  }
};

/** Entries cached within the last 10 minutes, or null. */
export const readCachedIndex = (
  source: RegistrySource
): CatalogEntry[] | null => {
  const now = Date.now();
  let cached = memory.get(source.id);
  if (!isFresh(cached, now)) {
    try {
      cached = parse(session()?.getItem(KEY_PREFIX + source.id));
    } catch {
      cached = undefined;
    }
  }
  if (!cached || !isFresh(cached, now)) {
    return null;
  }
  memory.set(source.id, cached);
  return cached.entries.map((entry) => ({ ...entry, registry: source }));
};

export const fetchAndCacheIndex = async (
  source: RegistrySource,
  signal: AbortSignal
): Promise<CatalogEntry[]> => {
  const entries = await fetchRegistryIndex(source, { signal });
  const cached: CachedIndex = {
    at: Date.now(),
    entries: entries.map(({ item, ref }) => ({ item, ref })),
  };
  memory.set(source.id, cached);
  try {
    session()?.setItem(KEY_PREFIX + source.id, JSON.stringify(cached));
  } catch {
    // Quota exceeded or storage blocked: the in-memory copy still serves.
  }
  return entries;
};
