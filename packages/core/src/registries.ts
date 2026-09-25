export interface RegistrySource {
  /** Stable id, e.g. `ogimagecn`. */
  id: string;
  /** Namespace used with `shadcn add`, e.g. `@ogimagecn`. */
  scope: `@${string}`;
  name: string;
  description: string;
  /** Canonical origin: docs links and the components.json alias template. */
  homepage: string;
  /**
   * Origin that serves the registry without redirecting. Browsers reject CORS
   * requests whose redirect lacks CORS headers, so fetches must skip the
   * apex -> www hop.
   */
  fetchOrigin: string;
}

/** Every Shadcn Labs registry. Order is display order. */
export const LABS_REGISTRIES: readonly RegistrySource[] = [
  {
    description: "Open Graph image components built on Satori.",
    fetchOrigin: "https://www.ogimagecn.com",
    homepage: "https://ogimagecn.com",
    id: "ogimagecn",
    name: "ogimagecn",
    scope: "@ogimagecn",
  },
  {
    description: "WebGL shader components for shadcn/ui.",
    fetchOrigin: "https://www.shadercn.run",
    homepage: "https://shadercn.run",
    id: "shadercn",
    name: "shadercn",
    scope: "@shadercn",
  },
  {
    description: "PDF documents, blocks and themes for shadcn/ui.",
    fetchOrigin: "https://www.pdfcn.dev",
    homepage: "https://pdfcn.dev",
    id: "pdfcn",
    name: "pdfcn",
    scope: "@pdfcn",
  },
  {
    description: "Terminal UI components for Ink and OpenTUI.",
    fetchOrigin: "https://www.termcn.dev",
    homepage: "https://termcn.dev",
    id: "termcn",
    name: "termcn",
    scope: "@termcn",
  },
  {
    description: "shadcn/ui components for CSS-in-JS libraries.",
    fetchOrigin: "https://www.shadcn-cssinjs.com",
    homepage: "https://shadcn-cssinjs.com",
    id: "shadcn-cssinjs",
    name: "shadcn-cssinjs",
    scope: "@shadcn-cssinjs",
  },
];

export const registryIndexUrl = (source: RegistrySource): string =>
  `${source.fetchOrigin}/r/registry.json`;

/** Value for the `registries` map in components.json. */
export const registryItemTemplate = (source: RegistrySource): string =>
  `${source.homepage}/r/{name}.json`;

export const registryItemUrl = (source: RegistrySource, name: string): string =>
  `${source.homepage}/r/${name}.json`;

export const findRegistry = (scope: string): RegistrySource | undefined =>
  LABS_REGISTRIES.find((source) => source.scope === scope);
