import { once } from "node:events";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import path from "node:path";

import type { Command } from "@shadcn-labs/devtools-core";
import {
  addTarget,
  formatCommand,
  parseItemRef,
  shadcnAddCommand,
} from "@shadcn-labs/devtools-core";
import {
  detectProject,
  ensureRegistries,
  resolveOgImageSource,
} from "@shadcn-labs/devtools-core/node";
import type {
  BridgeHealth,
  BridgeRequest,
  BridgeResponseMap,
} from "@shadcn-labs/devtools-plugin-api";
import { BRIDGE_HEADER, BRIDGE_PORTS } from "@shadcn-labs/devtools-plugin-api";

export interface BridgeHost {
  /** Run a command with `cwd` (VS Code: integrated terminal; CLI: child process). */
  run: (command: Command, cwd: string) => Promise<void>;
  /** Reveal a file in the editor. */
  openFile: (file: string) => Promise<void>;
}

export interface BridgeServerOptions {
  /** Workspace folder the host serves. */
  root: string;
  host: BridgeHealth["host"];
  version: string;
  handlers: BridgeHost;
  /** Extra allowed page origins beyond localhost (e.g. `http://app.test:3000`). */
  allowedOrigins?: readonly string[];
  ports?: readonly number[];
}

export interface BridgeServer {
  port: number;
  close: () => Promise<void>;
}

const MAX_BODY_BYTES = 16 * 1024;

export const isAllowedOrigin = (
  origin: string | undefined,
  extra: readonly string[] = []
): boolean => {
  // Non-browser clients send no Origin and cannot be driven cross-site.
  if (origin === undefined) {
    return true;
  }
  if (extra.includes(origin)) {
    return true;
  }
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") {
      return false;
    }
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
};

const readBody = async (req: IncomingMessage): Promise<string> => {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      req.destroy();
      throw new Error("Body too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
};

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

export const handleBridgeRequest = async (
  options: Pick<BridgeServerOptions, "root" | "handlers">,
  req: BridgeRequest
): Promise<BridgeResponseMap[BridgeRequest["type"]]> => {
  switch (req.type) {
    case "install": {
      const parsed = parseItemRef(String(req.ref));
      if (!parsed) {
        throw new Error(`Not a Shadcn Labs registry item: ${String(req.ref)}`);
      }
      const project = await detectProject(options.root);
      if (!project) {
        throw new Error("No package.json found in the workspace.");
      }
      let { registries } = project;
      if (project.hasComponentsJson) {
        const result = await ensureRegistries(project.root, [parsed.registry]);
        if (result.status === "updated") {
          registries = {
            ...registries,
            [parsed.registry.scope]: "configured",
          };
        }
      }
      const command = shadcnAddCommand(
        [addTarget(req.ref, registries)],
        project.packageManager
      );
      await options.handlers.run(command, project.root);
      return { command: formatCommand(command) };
    }
    case "open-og-source": {
      if (typeof req.pathname !== "string" || !req.pathname.startsWith("/")) {
        throw new Error("pathname must be an absolute path");
      }
      const imagePathname =
        typeof req.imagePathname === "string" &&
        req.imagePathname.startsWith("/")
          ? req.imagePathname
          : undefined;
      const file = await resolveOgImageSource(
        options.root,
        req.pathname,
        imagePathname
      );
      if (file) {
        await options.handlers.openFile(file);
      }
      return { file: file ? path.relative(options.root, file) : null };
    }
    default: {
      throw new Error(
        `Unknown request type: ${String((req as { type: unknown }).type)}`
      );
    }
  }
};

/** Resolves false when the port is taken; rethrows any other listen error. */
const listen = async (server: Server, port: number): Promise<boolean> => {
  server.listen(port, "127.0.0.1");
  try {
    // `once` rejects when the emitter fires "error" first.
    await once(server, "listening");
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      return false;
    }
    throw error;
  }
};

/** Bind the first free bridge port on 127.0.0.1 and serve toolbar requests. */
export const startBridgeServer = async (
  options: BridgeServerOptions
): Promise<BridgeServer> => {
  const health: BridgeHealth = {
    app: "shadcn-labs-devtools",
    host: options.host,
    root: options.root,
    version: options.version,
  };

  const server = createServer(async (req, res) => {
    const { origin } = req.headers;
    if (!isAllowedOrigin(origin, options.allowedOrigins)) {
      send(res, 403, { error: "Origin not allowed" });
      return;
    }
    if (origin) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-headers": `content-type, ${BRIDGE_HEADER}`,
        "access-control-allow-methods": "GET, POST",
        "access-control-allow-private-network": "true",
        "access-control-max-age": "600",
      });
      res.end();
      return;
    }
    // A custom header cannot be sent cross-origin without a preflight, which
    // the origin check above already gates.
    if (req.headers[BRIDGE_HEADER] !== "1") {
      send(res, 400, { error: `Missing ${BRIDGE_HEADER} header` });
      return;
    }
    try {
      if (req.method === "GET" && req.url === "/health") {
        send(res, 200, health);
        return;
      }
      if (req.method === "POST" && req.url === "/request") {
        const body = JSON.parse(await readBody(req)) as BridgeRequest;
        send(res, 200, await handleBridgeRequest(options, body));
        return;
      }
      send(res, 404, { error: "Not found" });
    } catch (error) {
      send(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  for (const port of options.ports ?? BRIDGE_PORTS) {
    // oxlint-disable-next-line no-await-in-loop -- ports are tried in order; the first free one wins.
    if (await listen(server, port)) {
      return {
        close: async () => {
          const closed = once(server, "close");
          server.close();
          server.closeAllConnections();
          await closed;
        },
        port,
      };
    }
  }
  throw new Error(
    `All bridge ports are busy (${(options.ports ?? BRIDGE_PORTS).join(", ")}).`
  );
};
