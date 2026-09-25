export interface MetaUrl {
  /** Value exactly as authored in the attribute. */
  raw: string;
  /** Resolved against `document.baseURI`; null when it cannot be parsed. */
  url: string | null;
  /** True when the authored value was not an absolute http(s) URL. */
  relative: boolean;
}

export interface OgMeta {
  /** `<title>` text. */
  title: string | null;
  /** `<meta name="description">`. */
  description: string | null;
  /** `<link rel="canonical">`. */
  canonical: MetaUrl | null;
  og: {
    title: string | null;
    description: string | null;
    url: MetaUrl | null;
    type: string | null;
    siteName: string | null;
    image: MetaUrl | null;
    imageWidth: number | null;
    imageHeight: number | null;
    imageAlt: string | null;
    imageType: string | null;
  };
  twitter: {
    card: string | null;
    title: string | null;
    description: string | null;
    image: MetaUrl | null;
    site: string | null;
    creator: string | null;
  };
}

const ABSOLUTE_URL = /^https?:\/\//iu;

const clean = (value: string | null | undefined): string | null =>
  value?.trim() || null;

export const toMetaUrl = (
  raw: string | null,
  baseURI: string
): MetaUrl | null => {
  if (!raw) {
    return null;
  }
  let url: string | null = null;
  try {
    url = new URL(raw, baseURI).href;
  } catch {
    url = null;
  }
  return { raw, relative: !ABSOLUTE_URL.test(raw), url };
};

const toSize = (value: string | null): number | null => {
  if (!value || !/^\d+$/u.test(value)) {
    return null;
  }
  const size = Number(value);
  return size > 0 ? size : null;
};

/**
 * Read the tags link-preview crawlers use. The first matching tag wins, as
 * with Facebook's and X's crawlers; `og:*` is accepted in `name` and
 * `twitter:*` in `property` because both forms are common in the wild.
 */
export const collectMeta = (doc: Document): OgMeta => {
  const values = new Map<string, string>();
  for (const el of doc.querySelectorAll("meta[property], meta[name]")) {
    const key = (el.getAttribute("property") ?? el.getAttribute("name") ?? "")
      .trim()
      .toLowerCase();
    const content = clean(el.getAttribute("content"));
    if (key && content !== null && !values.has(key)) {
      values.set(key, content);
    }
  }
  const get = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = values.get(key);
      if (value !== undefined) {
        return value;
      }
    }
    return null;
  };
  const base = doc.baseURI;
  const url = (...keys: string[]) => toMetaUrl(get(...keys), base);

  return {
    canonical: toMetaUrl(
      clean(doc.querySelector("link[rel~='canonical']")?.getAttribute("href")),
      base
    ),
    description: get("description"),
    og: {
      description: get("og:description"),
      image: url("og:image", "og:image:url", "og:image:secure_url"),
      imageAlt: get("og:image:alt"),
      imageHeight: toSize(get("og:image:height")),
      imageType: get("og:image:type"),
      imageWidth: toSize(get("og:image:width")),
      siteName: get("og:site_name"),
      title: get("og:title"),
      type: get("og:type"),
      url: url("og:url"),
    },
    title: clean(doc.title),
    twitter: {
      card: get("twitter:card"),
      creator: get("twitter:creator"),
      description: get("twitter:description"),
      image: url("twitter:image", "twitter:image:src"),
      site: get("twitter:site"),
      title: get("twitter:title"),
    },
  };
};
