"use client";

import type { ProjectInfo } from "@shadcn-labs/devtools-plugin-api";
import { useEffect } from "react";

export interface DevtoolsClientProps {
  project: ProjectInfo | null;
}

interface MountSession {
  cancelled: boolean;
  cleanup?: () => void;
}

/** Load the toolbar lazily; skip mounting if the effect was torn down meanwhile. */
const mountDevtools = async (
  project: ProjectInfo | null,
  session: MountSession
) => {
  // Statically false in production bundles, so the toolbar chunk is dropped.
  if (process.env.NODE_ENV === "development") {
    const toolbar = await import("@shadcn-labs/devtools-toolbar");
    if (!session.cancelled) {
      session.cleanup = toolbar.mountToolbar({ project });
    }
  }
};

export const DevtoolsClient = ({ project }: DevtoolsClientProps) => {
  // A refreshed RSC payload deserializes a new `project` object; keying on
  // its JSON keeps router.refresh() from remounting the toolbar.
  const serialized = JSON.stringify(project);
  useEffect(() => {
    const session: MountSession = { cancelled: false };
    void mountDevtools(JSON.parse(serialized) as ProjectInfo | null, session);
    return () => {
      session.cancelled = true;
      session.cleanup?.();
    };
  }, [serialized]);
  return null;
};
