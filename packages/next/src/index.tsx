import { detectProject } from "@shadcn-labs/devtools-core/node";

import { DevtoolsClient } from "./client";

/**
 * Mounts the Shadcn Labs devtools toolbar during `next dev`. Render it once as
 * the last child of `<body>` in the root layout; it renders nothing in
 * production.
 */
export const ShadcnLabsDevtools = async () => {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }
  const project = await detectProject(process.cwd());
  return <DevtoolsClient project={project} />;
};
