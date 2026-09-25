import { escapeHtml } from "./html";
import type { OgMeta } from "./meta";

/** The fields each platform reads, with the fallbacks their crawlers use. */
export interface CardFields {
  /** Bare hostname, as every platform shows it. */
  domain: string;
  siteName: string;
  /** Open Graph first (Facebook, LinkedIn, Slack, Discord). */
  og: { title: string; description: string; image: string | null };
  /** X card tags first, then Open Graph. */
  x: {
    card: string;
    title: string;
    description: string;
    image: string | null;
  };
  /** `twitter:card` as authored; Discord uses it to pick the large layout. */
  card: string | null;
}

/** Crawlers show the bare hostname, never the full URL. */
const displayHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return url;
  }
};

/** What Facebook, LinkedIn, Slack and Discord read: og:* first. */
const openGraphFields = (meta: OgMeta): CardFields["og"] => ({
  description:
    meta.og.description ?? meta.twitter.description ?? meta.description ?? "",
  image: meta.og.image?.url ?? meta.twitter.image?.url ?? null,
  title: meta.og.title ?? meta.twitter.title ?? meta.title ?? "",
});

export const resolveCard = (meta: OgMeta, pageUrl: string): CardFields => {
  const domain = displayHost(
    meta.og.url?.url ?? meta.canonical?.url ?? pageUrl
  );
  const og = openGraphFields(meta);
  return {
    card: meta.twitter.card,
    domain,
    og,
    siteName: meta.og.siteName ?? domain,
    x: {
      card: meta.twitter.card ?? "summary",
      description: meta.twitter.description ?? og.description,
      image: meta.twitter.image?.url ?? og.image,
      title: meta.twitter.title ?? og.title,
    },
  };
};

const image = (src: string | null, className: string) =>
  src
    ? `<img class="${className}" src="${escapeHtml(src)}" alt="" decoding="async">`
    : `<div class="${className} slog-noimg">No image</div>`;

const text = (value: string, className: string) =>
  value ? `<span class="${className}">${escapeHtml(value)}</span>` : "";

const renderX = (card: CardFields) => {
  const { x } = card;
  const note =
    card.card === null
      ? "No twitter:card, so X uses <code>summary</code>."
      : `twitter:card = <code>${escapeHtml(x.card)}</code>`;
  if (x.card === "summary_large_image") {
    return `<div class="slog-x">
      <div class="slog-x-media">
        ${image(x.image, "slog-img-wide")}
        ${text(x.title, "slog-x-overlay")}
      </div>
      <span class="slog-muted slog-xs">From ${escapeHtml(card.domain)}</span>
    </div>
    <p class="slog-note">${note}</p>`;
  }
  return `<div class="slog-x-summary">
    ${image(x.image, "slog-img-square")}
    <div class="slog-card-text">
      ${text(card.domain, "slog-muted slog-xs")}
      ${text(x.title, "slog-clamp-1")}
      ${text(x.description, "slog-muted slog-xs slog-clamp-2")}
    </div>
  </div>
  <p class="slog-note">${note}</p>`;
};

const renderLinkedIn = ({
  domain,
  og,
}: CardFields) => `<div class="slog-linkedin">
    ${image(og.image, "slog-img-wide")}
    <div class="slog-card-text">
      ${text(og.title, "slog-strong slog-clamp-2")}
      ${text(domain, "slog-muted slog-xs")}
    </div>
  </div>
  <p class="slog-note">LinkedIn shows no description.</p>`;

const renderSlack = ({ og, siteName }: CardFields) => `<div class="slog-slack">
    ${text(siteName, "slog-strong slog-xs")}
    ${text(og.title, "slog-link")}
    ${text(og.description, "slog-clamp-2")}
    ${image(og.image, "slog-img-wide slog-slack-img")}
  </div>`;

const renderDiscord = ({ card, og, siteName }: CardFields) => {
  const large = card === "summary_large_image";
  return `<div class="slog-discord${large ? "" : " slog-discord-thumb"}">
    <div class="slog-card-text">
      ${text(siteName, "slog-muted slog-xs")}
      ${text(og.title, "slog-link")}
      ${text(og.description, "slog-clamp-3")}
      ${large ? image(og.image, "slog-img-wide") : ""}
    </div>
    ${large ? "" : image(og.image, "slog-img-thumb")}
  </div>
  <p class="slog-note">${
    large
      ? "Large image because twitter:card is <code>summary_large_image</code>."
      : "Thumbnail layout: Discord only shows a large image with <code>summary_large_image</code>."
  }</p>`;
};

const renderFacebook = ({
  domain,
  og,
}: CardFields) => `<div class="slog-facebook">
    ${image(og.image, "slog-img-wide")}
    <div class="slog-card-text">
      ${text(domain.toUpperCase(), "slog-muted slog-xs")}
      ${text(og.title, "slog-strong slog-clamp-2")}
      ${text(og.description, "slog-muted slog-xs slog-clamp-1")}
    </div>
  </div>`;

export type PreviewPlatform =
  | "discord"
  | "facebook"
  | "linkedin"
  | "slack"
  | "x";

/** Display order of the card previews. */
export const PREVIEW_PLATFORMS: {
  id: PreviewPlatform;
  label: string;
  render: (card: CardFields) => string;
}[] = [
  { id: "x", label: "X", render: renderX },
  { id: "linkedin", label: "LinkedIn", render: renderLinkedIn },
  { id: "slack", label: "Slack", render: renderSlack },
  { id: "discord", label: "Discord", render: renderDiscord },
  { id: "facebook", label: "Facebook", render: renderFacebook },
];
