import type {
  BridgeClient,
  BridgeHealth,
  BridgeRequest,
  BridgeResponse,
} from "@shadcn-labs/devtools-plugin-api";
import { BRIDGE_HEADER, BRIDGE_PORTS } from "@shadcn-labs/devtools-plugin-api";

export interface ConnectOptions {
  /** Project root reported by the dev adapter; picks the matching host. */
  root?: string | null;
  ports?: readonly number[];
  timeoutMs?: number;
}

const probe = async (
  port: number,
  timeoutMs: number
): Promise<{ port: number; health: BridgeHealth } | null> => {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { [BRIDGE_HEADER]: "1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return null;
    }
    const health = (await res.json()) as BridgeHealth;
    return health.app === "shadcn-labs-devtools" ? { health, port } : null;
  } catch {
    return null;
  }
};

const normalize = (path: string) =>
  path.replaceAll("\\", "/").replace(/\/+$/u, "");

/**
 * Choose the host whose workspace contains `root`: exact match first, then the
 * deepest ancestor (a monorepo opened at its top level). Without a root, only
 * an unambiguous single host is used.
 */
export const pickHost = <T extends { health: BridgeHealth }>(
  hosts: T[],
  root: string | null | undefined
): T | null => {
  if (!root) {
    return hosts.length === 1 ? (hosts[0] ?? null) : null;
  }
  const target = normalize(root);
  const containing = hosts.filter((h) => {
    const hostRoot = normalize(h.health.root);
    return target === hostRoot || target.startsWith(`${hostRoot}/`);
  });
  return (
    containing.toSorted(
      (a, b) => b.health.root.length - a.health.root.length
    )[0] ?? null
  );
};

export const connectBridge = async (
  options: ConnectOptions = {}
): Promise<BridgeClient | null> => {
  const ports = options.ports ?? BRIDGE_PORTS;
  const probes = await Promise.all(
    ports.map((port) => probe(port, options.timeoutMs ?? 600))
  );
  const found = probes.filter((x) => x !== null);
  const host = pickHost(found, options.root);
  if (!host) {
    return null;
  }
  return {
    health: host.health,
    async request<T extends BridgeRequest>(req: T): Promise<BridgeResponse<T>> {
      const res = await fetch(`http://127.0.0.1:${host.port}/request`, {
        body: JSON.stringify(req),
        headers: { "content-type": "application/json", [BRIDGE_HEADER]: "1" },
        method: "POST",
      });
      const body = (await res.json()) as BridgeResponse<T> | { error: string };
      if (!res.ok || "error" in body) {
        throw new Error(
          "error" in body ? body.error : `Bridge error ${res.status}`
        );
      }
      return body;
    },
  };
};
