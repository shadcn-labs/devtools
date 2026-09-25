import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const CODE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];
const PAGE_EXTENSIONS = [...CODE_EXTENSIONS, "mdx", "md"];
const METADATA_IMAGE_EXTENSIONS = [
  ...CODE_EXTENSIONS,
  "png",
  "jpg",
  "jpeg",
  "gif",
];
const METADATA_IMAGE_BASES = ["opengraph-image", "twitter-image"] as const;

const findFile = (
  dir: string,
  base: string,
  extensions: string[]
): string | null => {
  for (const ext of extensions) {
    const file = path.join(dir, `${base}.${ext}`);
    if (existsSync(file)) {
      return file;
    }
  }
  return null;
};

const splitPath = (pathname: string): string[] =>
  pathname
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });

const listDirs = async (dir: string): Promise<string[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => !(name.startsWith("_") || name.startsWith("@")));
  } catch {
    return [];
  }
};

const isGroup = (name: string) => name.startsWith("(") && name.endsWith(")");
const isOptionalCatchAll = (name: string) =>
  /^\[\[\.\.\.[^\]]+\]\]$/u.test(name);
const isCatchAll = (name: string) => /^\[\.\.\.[^\]]+\]$/u.test(name);
const isDynamic = (name: string) => /^\[[^.[\]][^[\]]*\]$/u.test(name);

interface Match {
  /** Directories from the app dir down to the leaf, groups included. */
  chain: string[];
  /** Per consumed segment: 0 static, 1 dynamic, 2 catch-all, 3 optional. */
  ranks: number[];
}

/** Lower is more specific; mirrors Next's static > dynamic > catch-all. */
const compareMatches = (a: Match, b: Match): number => {
  const length = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a.ranks[i] ?? -1) - (b.ranks[i] ?? -1);
    if (diff !== 0) {
      return diff;
    }
  }
  return a.chain.length - b.chain.length;
};

/**
 * How directory `name` consumes the next path segment(s): the segments left
 * and the specificity rank added (null for transparent route groups).
 */
const stepInto = (
  name: string,
  segments: string[]
): { rest: string[]; rank: number | null } | null => {
  const [head, ...rest] = segments;
  if (isGroup(name)) {
    return { rank: null, rest: segments };
  }
  if (isOptionalCatchAll(name)) {
    return { rank: 3, rest: [] };
  }
  if (head === undefined) {
    return null;
  }
  if (isCatchAll(name)) {
    return { rank: 2, rest: [] };
  }
  if (isDynamic(name)) {
    return { rank: 1, rest };
  }
  return name === head ? { rank: 0, rest } : null;
};

/** Enumerate every directory chain whose route matches `segments`. */
const collect = async (
  dir: string,
  segments: string[],
  isLeaf: (dir: string) => boolean,
  match: Match,
  out: Match[]
): Promise<void> => {
  if (segments.length === 0 && isLeaf(dir)) {
    out.push(match);
  }
  const children = await listDirs(dir);
  await Promise.all(
    children.map(async (name) => {
      const step = stepInto(name, segments);
      if (!step) {
        return;
      }
      const child = path.join(dir, name);
      await collect(
        child,
        step.rest,
        isLeaf,
        {
          chain: [...match.chain, child],
          ranks: step.rank === null ? match.ranks : [...match.ranks, step.rank],
        },
        out
      );
    })
  );
};

const bestMatch = async (
  appDir: string,
  pathname: string,
  isLeaf: (dir: string) => boolean
): Promise<Match | null> => {
  const out: Match[] = [];
  await collect(
    appDir,
    splitPath(pathname),
    isLeaf,
    { chain: [appDir], ranks: [] },
    out
  );
  return out.toSorted(compareMatches)[0] ?? null;
};

const resolveFromImageUrl = async (
  appDir: string,
  imagePathname: string
): Promise<string | null> => {
  // The og:image path may carry `?title=…` for route handlers like `/api/og`.
  const [imagePath = ""] = imagePathname.split(/[?#]/u);
  const segments = splitPath(imagePath);
  // `/blog/opengraph-image` or `/blog/opengraph-image-abc123` (Next adds a hash).
  const base = /^(?<base>opengraph-image|twitter-image)(?:-\w+)?$/u.exec(
    segments.at(-1) ?? ""
  )?.groups?.base;
  if (base) {
    const match = await bestMatch(
      appDir,
      segments.slice(0, -1).join("/"),
      (dir) => findFile(dir, base, METADATA_IMAGE_EXTENSIONS) !== null
    );
    const leaf = match?.chain.at(-1);
    return leaf ? findFile(leaf, base, METADATA_IMAGE_EXTENSIONS) : null;
  }
  const match = await bestMatch(
    appDir,
    imagePath,
    (dir) => findFile(dir, "route", CODE_EXTENSIONS) !== null
  );
  const leaf = match?.chain.at(-1);
  return leaf ? findFile(leaf, "route", CODE_EXTENSIONS) : null;
};

/**
 * Resolve the file that renders a page's Open Graph image in a Next.js App
 * Router project.
 *
 * 1. `imagePathname` (the og:image path when same-origin) hits a route
 *    handler (`app/api/og/route.tsx`) or a metadata image file
 *    (`app/blog/opengraph-image.tsx`) -> that file.
 * 2. Otherwise the deepest `opengraph-image.*` (then `twitter-image.*`) at or
 *    above the page's segment; metadata images are inherited by child routes.
 */
export const resolveOgImageSource = async (
  root: string,
  pathname: string,
  imagePathname?: string
): Promise<string | null> => {
  const appDir = ["app", "src/app"]
    .map((dir) => path.join(root, dir))
    .find((dir) => existsSync(dir));
  if (!appDir) {
    return null;
  }

  if (imagePathname) {
    const file = await resolveFromImageUrl(appDir, imagePathname);
    if (file) {
      return file;
    }
  }

  const page = await bestMatch(
    appDir,
    pathname,
    (dir) => findFile(dir, "page", PAGE_EXTENSIONS) !== null
  );
  if (!page) {
    return null;
  }
  for (const base of METADATA_IMAGE_BASES) {
    for (const dir of page.chain.toReversed()) {
      const file = findFile(dir, base, METADATA_IMAGE_EXTENSIONS);
      if (file) {
        return file;
      }
    }
  }
  return null;
};
