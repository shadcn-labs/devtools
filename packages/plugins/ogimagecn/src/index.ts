import { definePlugin } from "@shadcn-labs/devtools-plugin-api";

import { ICONS } from "./icons";
import { mountOgPanel } from "./panel";

export type { OgCheck, OgImageFacts, OgSeverity } from "./audit";
export { auditOg } from "./audit";
export type { MetaUrl, OgMeta } from "./meta";
export { collectMeta } from "./meta";

/** Packages that render or serve OG images; any of them enables the panel. */
const OG_DEPENDENCIES = new Set([
  "next",
  "satori",
  "@vercel/og",
  "@takumi-rs/core",
  "@takumi-rs/image-response",
]);

export const ogimagecnPlugin = definePlugin({
  detect: (project) =>
    "@ogimagecn" in project.registries ||
    project.dependencies.some((name) => OG_DEPENDENCIES.has(name)),
  id: "ogimagecn",
  name: "ogimagecn",
  scope: "@ogimagecn",
  toolbar: {
    icon: ICONS.image,
    mount: mountOgPanel,
    title: "OG Image",
  },
});
