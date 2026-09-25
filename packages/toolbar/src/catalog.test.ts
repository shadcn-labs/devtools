// @vitest-environment happy-dom
import type { RegistrySource } from "@shadcn-labs/devtools-core";
import { LABS_REGISTRIES } from "@shadcn-labs/devtools-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = LABS_REGISTRIES[0] as RegistrySource;

const serveIndex = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            items: [{ name: "blog", type: "registry:component" }],
          }),
        ok: true,
        status: 200,
      })
    )
  );

// The cache keeps an in-memory copy at module scope, so each test imports a
// fresh module instance; the first test also re-imports to simulate a reload.
describe("registry index cache", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    sessionStorage.clear();
  });

  it("serves an index for 10 minutes, including after a page reload", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    serveIndex();
    const { fetchAndCacheIndex, INDEX_TTL_MS } = await import("./catalog");
    await fetchAndCacheIndex(source, new AbortController().signal);

    // A fresh module instance only has sessionStorage to go on.
    vi.resetModules();
    const reloaded = await import("./catalog");
    vi.setSystemTime(1_000_000 + INDEX_TTL_MS - 1);
    expect(reloaded.readCachedIndex(source)?.map((e) => e.ref)).toStrictEqual([
      "@ogimagecn/blog",
    ]);
    vi.setSystemTime(1_000_000 + INDEX_TTL_MS);
    expect(reloaded.readCachedIndex(source)).toBeNull();
  });

  it("treats corrupt stored entries as a miss", async () => {
    sessionStorage.setItem(`shadcn-labs-devtools:registry:${source.id}`, "{");
    const { readCachedIndex } = await import("./catalog");
    expect(readCachedIndex(source)).toBeNull();
  });
});
