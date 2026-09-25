import type { OgMeta } from "./meta";

export type OgSeverity = "error" | "info" | "warning";

export interface OgCheck {
  id: string;
  severity: OgSeverity;
  message: string;
}

/** What the browser measured about the og:image. */
export interface OgImageFacts {
  width: number;
  height: number;
  bytes?: number;
  contentType?: string;
  error?: string;
}

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
/** Facebook's and LinkedIn's recommended 1.91:1, with a 3% tolerance. */
const TARGET_RATIO = 1.91;
const RATIO_TOLERANCE = 0.03;
/** X rejects card images over 5 MB. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TITLE = 60;
const MAX_DESCRIPTION = 160;
const LOCAL_HOSTS = new Set(["0.0.0.0", "127.0.0.1", "[::1]", "localhost"]);

const SEVERITY_ORDER: Record<OgSeverity, number> = {
  error: 0,
  info: 2,
  warning: 1,
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

type Size = Pick<OgImageFacts, "height" | "width">;

const check = (id: string, severity: OgSeverity, message: string): OgCheck => ({
  id,
  message,
  severity,
});

const sizeChecks = ({ height, width }: Size): OgCheck[] => {
  const checks: OgCheck[] = [];
  if (width !== OG_IMAGE_WIDTH || height !== OG_IMAGE_HEIGHT) {
    checks.push(
      check(
        "og-image-size",
        "warning",
        `og:image is ${width}×${height}; ${OG_IMAGE_WIDTH}×${OG_IMAGE_HEIGHT} is the size every platform expects.`
      )
    );
  }
  const ratio = width / height;
  if (Math.abs(ratio - TARGET_RATIO) / TARGET_RATIO > RATIO_TOLERANCE) {
    checks.push(
      check(
        "og-image-ratio",
        "warning",
        `og:image aspect ratio is ${ratio.toFixed(2)}:1; platforms crop anything far from 1.91:1.`
      )
    );
  }
  return checks;
};

/** The og:image tag itself and what the browser measured. */
const imageChecks = (
  meta: OgMeta,
  image: OgImageFacts | undefined,
  measured: Size | null
): OgCheck[] => {
  const ogImage = meta.og.image;
  if (!ogImage) {
    return [
      check(
        "og-image-missing",
        "error",
        "Missing og:image. Shared links will render without a picture."
      ),
    ];
  }
  const checks: OgCheck[] = [];
  if (ogImage.relative) {
    checks.push(
      check(
        "og-image-relative",
        "error",
        `og:image "${ogImage.raw}" is not an absolute URL. Crawlers do not resolve relative URLs; in Next.js set \`metadataBase\` in the root layout.`
      )
    );
  }
  if (image?.error) {
    checks.push(
      check("og-image-load", "error", `og:image failed to load: ${image.error}`)
    );
  }
  const type = image?.contentType ?? meta.og.imageType ?? "";
  const pathname = ogImage.url ? new URL(ogImage.url).pathname : ogImage.raw;
  if (type.includes("svg") || pathname.toLowerCase().endsWith(".svg")) {
    checks.push(
      check(
        "og-image-svg",
        "error",
        "og:image is an SVG, which X, Facebook and LinkedIn do not render. Serve a PNG or JPEG."
      )
    );
  }
  if (measured) {
    checks.push(...sizeChecks(measured));
  }
  if (image?.bytes !== undefined && image.bytes > MAX_IMAGE_BYTES) {
    checks.push(
      check(
        "og-image-bytes",
        "error",
        `og:image is ${formatBytes(image.bytes)}; X drops card images over 5 MB.`
      )
    );
  }
  return checks;
};

const titleChecks = (meta: OgMeta): OgCheck[] => {
  if (meta.og.title) {
    return meta.og.title.length > MAX_TITLE
      ? [
          check(
            "og-title-length",
            "warning",
            `og:title is ${meta.og.title.length} characters; most platforms truncate after ${MAX_TITLE}.`
          ),
        ]
      : [];
  }
  return [
    meta.title
      ? check(
          "og-title-missing",
          "warning",
          `Missing og:title; platforms fall back to <title> "${meta.title}".`
        )
      : check(
          "og-title-missing",
          "error",
          "Missing og:title and <title>. Cards will have no headline."
        ),
  ];
};

const descriptionChecks = (meta: OgMeta): OgCheck[] => {
  if (meta.og.description) {
    return meta.og.description.length > MAX_DESCRIPTION
      ? [
          check(
            "og-description-length",
            "warning",
            `og:description is ${meta.og.description.length} characters; keep it under ${MAX_DESCRIPTION} to avoid truncation.`
          ),
        ]
      : [];
  }
  return [
    check(
      "og-description-missing",
      "warning",
      meta.description
        ? "Missing og:description; some platforms fall back to the meta description, others show none."
        : "Missing og:description. Cards will have no summary."
    ),
  ];
};

const cardChecks = (meta: OgMeta, measured: Size | null): OgCheck[] => {
  if (!meta.twitter.card) {
    return [
      check(
        "twitter-card-missing",
        "warning",
        "Missing twitter:card; X falls back to `summary` and shrinks the image to a small square."
      ),
    ];
  }
  const large =
    measured &&
    measured.width >= 600 &&
    measured.width / measured.height >= 1.5;
  if (meta.twitter.card !== "summary" || !measured || !large) {
    return [];
  }
  return [
    check(
      "twitter-card-summary",
      "info",
      `twitter:card is \`summary\` but the image is ${measured.width}×${measured.height}; use \`summary_large_image\` to show it full width on X.`
    ),
  ];
};

/** Nice-to-haves: alt text, og:url and a production-ready image origin. */
const hintChecks = (meta: OgMeta): OgCheck[] => {
  const checks: OgCheck[] = [];
  if (meta.og.image && !meta.og.imageAlt) {
    checks.push(
      check(
        "og-image-alt-missing",
        "info",
        "Missing og:image:alt. Screen readers announce shared images by it."
      )
    );
  }
  if (!meta.og.url) {
    checks.push(
      check(
        "og-url-missing",
        "info",
        "Missing og:url. Platforms use it to merge shares of the same page."
      )
    );
  }
  const imageHost = meta.og.image?.url
    ? new URL(meta.og.image.url).hostname
    : null;
  if (imageHost && LOCAL_HOSTS.has(imageHost)) {
    checks.push(
      check(
        "og-image-localhost",
        "info",
        `og:image points at ${imageHost}. Expected in development; make sure production sets \`metadataBase\` to the public origin.`
      )
    );
  }
  return checks;
};

/**
 * Audit Open Graph and X card tags against what the major link-preview
 * crawlers accept. Errors come first, then warnings, then info.
 */
export const auditOg = (meta: OgMeta, image?: OgImageFacts): OgCheck[] => {
  const measured =
    image && !image.error && image.width > 0 && image.height > 0 ? image : null;
  return [
    ...imageChecks(meta, image, measured),
    ...titleChecks(meta),
    ...descriptionChecks(meta),
    ...cardChecks(meta, measured),
    ...hintChecks(meta),
  ].toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
};
