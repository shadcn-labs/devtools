import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Command } from "@shadcn-labs/devtools-core";
import type { BridgeClient } from "@shadcn-labs/devtools-plugin-api";
import { BRIDGE_HEADER } from "@shadcn-labs/devtools-plugin-api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { connectBridge, pickHost } from "./client";
import type { BridgeServer } from "./server";
import { isAllowedOrigin, startBridgeServer } from "./server";

const PORTS = [15_747, 15_748];

const host = (root: string) => ({
  health: {
    app: "shadcn-labs-devtools" as const,
    host: "vscode" as const,
    root,
    version: "0",
  },
});

describe(isAllowedOrigin, () => {
  it.each([
    "http://localhost:3000",
    "http://app.localhost:5173",
    "http://127.0.0.1:8080",
  ])("allows %s", (origin) => {
    expect(isAllowedOrigin(origin)).toBeTruthy();
  });

  it.each(["https://evil.example", "http://localhost.evil.example"])(
    "refuses %s",
    (origin) => {
      expect(isAllowedOrigin(origin)).toBeFalsy();
    }
  );

  it("allows configured extra origins", () => {
    expect(
      isAllowedOrigin("http://app.test", ["http://app.test"])
    ).toBeTruthy();
  });
});

describe(pickHost, () => {
  it("prefers the deepest workspace containing the project", () => {
    const hosts = [host("/w"), host("/w/apps/web"), host("/other")];
    expect(pickHost(hosts, "/w/apps/web")?.health.root).toBe("/w/apps/web");
    expect(pickHost(hosts, "/w/packages/ui")?.health.root).toBe("/w");
    expect(pickHost(hosts, "/elsewhere")).toBeNull();
    expect(pickHost([host("/a/b")], "/a/bc")).toBeNull();
  });

  it("only guesses without a root when unambiguous", () => {
    expect(pickHost([host("/a")], null)?.health.root).toBe("/a");
    expect(pickHost([host("/a"), host("/b")], null)).toBeNull();
  });
});

describe("bridge server", () => {
  let root: string;
  let server: BridgeServer;
  const ran: { command: Command; cwd: string }[] = [];
  const opened: string[] = [];

  const connect = async (): Promise<BridgeClient> => {
    const bridge = await connectBridge({ ports: PORTS, root });
    if (!bridge) {
      throw new Error("bridge not found");
    }
    return bridge;
  };

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bridge-"));
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ packageManager: "pnpm@10.0.0" })
    );
    await writeFile(
      path.join(root, "components.json"),
      `${JSON.stringify({ style: "new-york" }, null, 2)}\n`
    );
    ran.length = 0;
    opened.length = 0;
    server = await startBridgeServer({
      handlers: {
        openFile: (file) => {
          opened.push(file);
          return Promise.resolve();
        },
        run: (command, cwd) => {
          ran.push({ command, cwd });
          return Promise.resolve();
        },
      },
      host: "cli",
      ports: PORTS,
      root,
      version: "test",
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(root, { force: true, recursive: true });
  });

  it("installs through the alias after registering it in components.json", async () => {
    const bridge = await connect();
    const res = await bridge.request({
      ref: "@ogimagecn/blog",
      type: "install",
    });
    expect(res.command).toBe("pnpm dlx shadcn@latest add @ogimagecn/blog");
    expect(ran[0]?.cwd).toBe(root);
    const config = JSON.parse(
      await readFile(path.join(root, "components.json"), "utf-8")
    );
    expect(config.registries).toStrictEqual({
      "@ogimagecn": "https://ogimagecn.com/r/{name}.json",
    });
  });

  it("rejects refs outside Labs registries without running anything", async () => {
    const bridge = await connect();
    await expect(
      bridge.request({ ref: "@ogimagecn/x;touch pwned", type: "install" })
    ).rejects.toThrow(/Not a Shadcn Labs/u);
    expect(ran).toStrictEqual([]);
  });

  it("refuses foreign origins and requests without the bridge header", async () => {
    const foreign = await fetch(`http://127.0.0.1:${server.port}/request`, {
      body: JSON.stringify({ ref: "@ogimagecn/blog", type: "install" }),
      headers: { [BRIDGE_HEADER]: "1", origin: "https://evil.example" },
      method: "POST",
    });
    expect(foreign.status).toBe(403);
    const headerless = await fetch(`http://127.0.0.1:${server.port}/health`);
    expect(headerless.status).toBe(400);
    expect(ran).toStrictEqual([]);
  });

  it("opens the resolved OG source and reports it relative to the root", async () => {
    await mkdir(path.join(root, "app"), { recursive: true });
    await writeFile(path.join(root, "app/page.tsx"), "");
    await writeFile(path.join(root, "app/opengraph-image.tsx"), "");
    const bridge = await connect();
    const res = await bridge.request({ pathname: "/", type: "open-og-source" });
    expect(res.file).toBe(path.join("app", "opengraph-image.tsx"));
    expect(opened).toStrictEqual([path.join(root, "app/opengraph-image.tsx")]);
  });
});
