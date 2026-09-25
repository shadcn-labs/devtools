const ENTITIES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

export const escapeHtml = (value: string): string =>
  value.replaceAll(/["&'<>]/gu, (char) => ENTITIES[char] ?? char);

/**
 * Add a stylesheet to `container`, carrying the page's CSP nonce when it
 * publishes one (`<meta property="csp-nonce">`, the convention Vite uses).
 */
export const injectStyle = (
  container: Element | ShadowRoot,
  css: string
): HTMLStyleElement => {
  const doc = container.ownerDocument ?? document;
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

/**
 * Copy through the async Clipboard API, falling back to a selected textarea
 * where it is missing (insecure origins such as a LAN IP dev server).
 */
export const copyText = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall back below.
  }
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (active instanceof HTMLElement) {
    active.focus({ preventScroll: true });
  }
  if (!copied) {
    throw new Error("Clipboard is not available on this page.");
  }
};
