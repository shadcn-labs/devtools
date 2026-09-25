import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";

import { collectMeta } from "./meta";

const load = (head: string) => {
  const window = new Window({ url: "https://acme.dev/blog/post?ref=x" });
  window.document.head.innerHTML = head;
  // happy-dom's Document is structurally the DOM one; the types differ.
  return collectMeta(window.document as unknown as Document);
};

describe(collectMeta, () => {
  it("resolves relative URLs against the page and remembers they were relative", () => {
    const meta = load(`
      <meta property="og:image" content="/og.png?title=Hi">
      <meta name="twitter:image" content="https://cdn.acme.dev/card.png">
      <meta property="og:url" content="post">
    `);
    expect(meta.og.image).toStrictEqual({
      raw: "/og.png?title=Hi",
      relative: true,
      url: "https://acme.dev/og.png?title=Hi",
    });
    expect(meta.twitter.image).toMatchObject({ relative: false });
    expect(meta.og.url?.url).toBe("https://acme.dev/blog/post");
  });

  it("honours <base href> and takes the first of duplicated tags", () => {
    const meta = load(`
      <base href="https://static.acme.dev/assets/">
      <meta property="og:image" content="og.png">
      <meta property="og:image" content="second.png">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="auto">
    `);
    expect(meta.og.image?.url).toBe("https://static.acme.dev/assets/og.png");
    expect(meta.og.imageWidth).toBe(1200);
    expect(meta.og.imageHeight).toBeNull();
  });

  it("accepts og:* in name and twitter:* in property", () => {
    const meta = load(`
      <title> Acme blog </title>
      <meta name="og:title" content="Hello">
      <meta property="twitter:card" content="summary_large_image">
    `);
    expect(meta.title).toBe("Acme blog");
    expect(meta.og.title).toBe("Hello");
    expect(meta.twitter.card).toBe("summary_large_image");
  });
});
