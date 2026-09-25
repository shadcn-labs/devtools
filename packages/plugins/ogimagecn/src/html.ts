const ENTITIES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

export const escapeHtml = (value: string): string =>
  value.replaceAll(/["&'<>]/gu, (char) => ENTITIES[char] ?? char);

/** Escape, then render `code` spans the way check messages are authored. */
export const inlineCode = (value: string): string =>
  escapeHtml(value).replaceAll(/`(?<code>[^`]+)`/gu, "<code>$<code></code>");

/**
 * Add a stylesheet to `container`, carrying the page's CSP nonce when it
 * publishes one (`<meta property="csp-nonce">`, the convention Vite uses).
 */
export const injectStyle = (container: HTMLElement, css: string) => {
  const doc = container.ownerDocument;
  const style = doc.createElement("style");
  const nonce = doc.querySelector<HTMLMetaElement>(
    "meta[property=csp-nonce]"
  )?.nonce;
  if (nonce) {
    style.nonce = nonce;
  }
  style.textContent = css;
  container.prepend(style);
  return style;
};
