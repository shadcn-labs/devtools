import { describe, expect, it } from "vitest";

import type { CatalogEntry } from "./items";
import {
  addTarget,
  formatCommand,
  parseItemRef,
  searchCatalog,
  shadcnAddCommand,
} from "./items";
import type { RegistrySource } from "./registries";
import { findRegistry } from "./registries";

const registry = (scope: string): RegistrySource => {
  const source = findRegistry(scope);
  if (!source) {
    throw new Error(`Unknown registry ${scope}`);
  }
  return source;
};

describe(parseItemRef, () => {
  it("accepts nested names from Labs registries", () => {
    expect(parseItemRef("@termcn/ink/spinner")?.name).toBe("ink/spinner");
    expect(parseItemRef("@ogimagecn/blog")?.registry.id).toBe("ogimagecn");
  });

  it.each([
    "@shadcn/button",
    "@ogimagecn/blog;rm -rf ~",
    "@ogimagecn/$(whoami)",
    "@ogimagecn/../x",
    "@ogimagecn/",
    "ogimagecn/blog",
  ])("rejects %s", (ref) => {
    expect(parseItemRef(ref)).toBeNull();
  });
});

describe(addTarget, () => {
  it("uses the alias only when the registry is configured", () => {
    expect(addTarget("@ogimagecn/blog", { "@ogimagecn": "x" })).toBe(
      "@ogimagecn/blog"
    );
    expect(addTarget("@ogimagecn/blog", {})).toBe(
      "https://ogimagecn.com/r/blog.json"
    );
  });
});

describe(shadcnAddCommand, () => {
  it("uses each package manager's runner", () => {
    expect(formatCommand(shadcnAddCommand(["a"], "pnpm"))).toBe(
      "pnpm dlx shadcn@latest add a"
    );
    expect(formatCommand(shadcnAddCommand(["a"], "yarn"))).toBe(
      "npx shadcn@latest add a"
    );
    expect(formatCommand(shadcnAddCommand(["a"], "bun"))).toBe(
      "bunx --bun shadcn@latest add a"
    );
  });
});

const entry = (
  source: RegistrySource,
  name: string,
  title?: string,
  description?: string
): CatalogEntry => ({
  item: { description, name, title, type: "registry:ui" },
  ref: `${source.scope}/${name}`,
  registry: source,
});

describe(searchCatalog, () => {
  const og = registry("@ogimagecn");
  const entries = [
    entry(og, "blog", "Blog", "An article image"),
    entry(registry("@termcn"), "ink/spinner", "Spinner"),
    entry(og, "changelog", "Changelog", "Release notes with a version pill"),
  ];

  it("ranks name hits above description hits and requires every token", () => {
    expect(searchCatalog(entries, "spin").map((e) => e.ref)).toStrictEqual([
      "@termcn/ink/spinner",
    ]);
    expect(searchCatalog(entries, "version").map((e) => e.ref)).toStrictEqual([
      "@ogimagecn/changelog",
    ]);
    expect(searchCatalog(entries, "blog article")[0]?.ref).toBe(
      "@ogimagecn/blog"
    );
    expect(searchCatalog(entries, "blog spinner")).toStrictEqual([]);
  });
});
