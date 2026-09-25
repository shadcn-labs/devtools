import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveOgImageSource } from "./og-source";

describe(resolveOgImageSource, () => {
  let root: string;

  const tree = async (files: string[]) => {
    root = await mkdtemp(path.join(tmpdir(), "og-source-"));
    await Promise.all(
      files.map(async (file) => {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await writeFile(path.join(root, file), "");
      })
    );
  };

  const resolve = async (pathname: string, imagePathname?: string) => {
    const file = await resolveOgImageSource(root, pathname, imagePathname);
    return file ? path.relative(root, file) : null;
  };

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it("inherits the nearest ancestor opengraph-image", async () => {
    await tree([
      "app/page.tsx",
      "app/opengraph-image.tsx",
      "app/blog/page.tsx",
      "app/blog/[slug]/page.tsx",
      "app/blog/opengraph-image.tsx",
    ]);
    await expect(resolve("/blog/hello-world")).resolves.toBe(
      "app/blog/opengraph-image.tsx"
    );
    await expect(resolve("/")).resolves.toBe("app/opengraph-image.tsx");
  });

  it("prefers static segments over dynamic ones", async () => {
    await tree([
      "app/blog/[slug]/page.tsx",
      "app/blog/[slug]/opengraph-image.tsx",
      "app/blog/about/page.tsx",
      "app/blog/about/opengraph-image.png",
    ]);
    await expect(resolve("/blog/about")).resolves.toBe(
      "app/blog/about/opengraph-image.png"
    );
    await expect(resolve("/blog/other")).resolves.toBe(
      "app/blog/[slug]/opengraph-image.tsx"
    );
  });

  it("sees through route groups and ignores private folders", async () => {
    await tree([
      "src/app/(marketing)/page.tsx",
      "src/app/(marketing)/opengraph-image.tsx",
      "src/app/_components/opengraph-image.tsx",
      "src/app/(docs)/docs/[[...slug]]/page.tsx",
      "src/app/(docs)/twitter-image.tsx",
    ]);
    await expect(resolve("/")).resolves.toBe(
      "src/app/(marketing)/opengraph-image.tsx"
    );
    await expect(resolve("/docs")).resolves.toBe(
      "src/app/(docs)/twitter-image.tsx"
    );
    await expect(resolve("/docs/a/b")).resolves.toBe(
      "src/app/(docs)/twitter-image.tsx"
    );
  });

  it("resolves a route-handler og:image before page metadata", async () => {
    await tree([
      "app/page.tsx",
      "app/opengraph-image.tsx",
      "app/api/og/route.tsx",
    ]);
    await expect(resolve("/", "/api/og?title=About")).resolves.toBe(
      "app/api/og/route.tsx"
    );
  });

  it("resolves hashed metadata image URLs to their segment file", async () => {
    await tree([
      "app/blog/[slug]/page.tsx",
      "app/blog/[slug]/opengraph-image.tsx",
      "app/opengraph-image.tsx",
    ]);
    await expect(
      resolve("/blog/x", "/blog/x/opengraph-image-1a2b3c")
    ).resolves.toBe("app/blog/[slug]/opengraph-image.tsx");
  });

  it("returns null for unknown routes and non-app-router projects", async () => {
    await tree(["app/page.tsx", "app/opengraph-image.tsx"]);
    await expect(resolve("/missing")).resolves.toBeNull();
    await rm(path.join(root, "app"), { recursive: true });
    await writeFile(path.join(root, "index.html"), "");
    await expect(resolve("/")).resolves.toBeNull();
  });
});
