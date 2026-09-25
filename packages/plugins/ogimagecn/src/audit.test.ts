import { describe, expect, it } from "vitest";

import type { OgImageFacts } from "./audit";
import { auditOg, MAX_IMAGE_BYTES } from "./audit";
import type { OgMeta } from "./meta";
import { toMetaUrl } from "./meta";

const BASE = "https://acme.dev/blog/post";

const meta = (overrides: {
  og?: Partial<OgMeta["og"]>;
  title?: string | null;
}): OgMeta => ({
  canonical: null,
  description: null,
  og: {
    description: "Everything new this week.",
    image: toMetaUrl("https://acme.dev/og.png", BASE),
    imageAlt: "Acme",
    imageHeight: 630,
    imageType: "image/png",
    imageWidth: 1200,
    siteName: "Acme",
    title: "Hello world",
    type: "article",
    url: toMetaUrl(BASE, BASE),
    ...overrides.og,
  },
  title: overrides.title ?? null,
  twitter: {
    card: "summary_large_image",
    creator: null,
    description: null,
    image: null,
    site: null,
    title: null,
  },
});

const ids = (m: OgMeta, image?: OgImageFacts) =>
  auditOg(m, image).map((check) => check.id);

describe(auditOg, () => {
  it("passes a complete page with a 1200x630 PNG", () => {
    expect(
      auditOg(meta({}), {
        bytes: 80_000,
        contentType: "image/png",
        height: 630,
        width: 1200,
      })
    ).toStrictEqual([]);
  });

  it("tolerates aspect ratios within 3% of 1.91:1", () => {
    // 1200/610 = 1.967 (+2.99%), 1200/647 = 1.855 (-2.90%)
    expect(ids(meta({}), { height: 610, width: 1200 })).toStrictEqual([
      "og-image-size",
    ]);
    expect(ids(meta({}), { height: 647, width: 1200 })).toStrictEqual([
      "og-image-size",
    ]);
    // 1200/609 = 1.970 (+3.16%), 1200/648 = 1.852 (-3.05%)
    expect(ids(meta({}), { height: 609, width: 1200 })).toContain(
      "og-image-ratio"
    );
    expect(ids(meta({}), { height: 648, width: 1200 })).toContain(
      "og-image-ratio"
    );
  });

  it("errors only above X's 5 MB limit, and never on unknown size", () => {
    const image = { height: 630, width: 1200 };
    expect(ids(meta({}), { ...image, bytes: MAX_IMAGE_BYTES })).toStrictEqual(
      []
    );
    expect(
      ids(meta({}), { ...image, bytes: MAX_IMAGE_BYTES + 1 })
    ).toStrictEqual(["og-image-bytes"]);
    expect(ids(meta({}), image)).toStrictEqual([]);
  });

  it("downgrades a missing og:title to a warning when <title> exists", () => {
    const withTitle = auditOg(
      meta({ og: { title: null }, title: "Acme blog" })
    );
    expect(withTitle.find((c) => c.id === "og-title-missing")?.severity).toBe(
      "warning"
    );
    const without = auditOg(meta({ og: { title: null } }));
    expect(without.find((c) => c.id === "og-title-missing")?.severity).toBe(
      "error"
    );
  });

  it("flags a relative og:image even though it resolves", () => {
    const checks = auditOg(
      meta({ og: { image: toMetaUrl("/og.png", BASE) } }),
      {
        height: 630,
        width: 1200,
      }
    );
    expect(checks[0]?.id).toBe("og-image-relative");
    expect(checks[0]?.message).toContain("metadataBase");
  });

  it("reports a failed load without judging dimensions", () => {
    expect(
      ids(meta({}), { error: "HTTP 404", height: 0, width: 0 })
    ).toStrictEqual(["og-image-load"]);
  });
});
