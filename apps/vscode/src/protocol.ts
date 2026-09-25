import type { NotifyTone, ProjectInfo } from "@shadcn-labs/devtools-plugin-api";

/** postMessage protocol between the Registries webview and the extension. */

export type HostRequest =
  | { method: "copy"; text: string }
  | { method: "install"; ref: string }
  | { method: "notify"; message: string; tone?: NotifyTone }
  | { method: "openExternal"; url: string };

export type WebviewMessage =
  | { type: "ready" }
  | { type: "request"; id: number; request: HostRequest };

export type ExtensionMessage =
  | { type: "init"; canInstall: boolean; project: ProjectInfo | null }
  | { type: "response"; id: number; ok: true; result: unknown }
  | { type: "response"; id: number; ok: false; error: string };

const MAX_TEXT = 100_000;
const MAX_NOTIFY = 1000;
const TONES: Record<NotifyTone, true> = {
  error: true,
  info: true,
  success: true,
};

const isString = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

const parseRequest = (raw: unknown): HostRequest | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const r = raw as Record<string, unknown>;
  switch (r.method) {
    case "copy": {
      return isString(r.text, MAX_TEXT)
        ? { method: "copy", text: r.text }
        : null;
    }
    case "install": {
      return isString(r.ref, 200) ? { method: "install", ref: r.ref } : null;
    }
    case "notify": {
      if (!isString(r.message, MAX_NOTIFY)) {
        return null;
      }
      if (r.tone === undefined) {
        return { message: r.message, method: "notify" };
      }
      return typeof r.tone === "string" && Object.hasOwn(TONES, r.tone)
        ? { message: r.message, method: "notify", tone: r.tone as NotifyTone }
        : null;
    }
    case "openExternal": {
      if (!isString(r.url, 2048)) {
        return null;
      }
      try {
        const { protocol } = new URL(r.url);
        return protocol === "http:" || protocol === "https:"
          ? { method: "openExternal", url: r.url }
          : null;
      } catch {
        return null;
      }
    }
    default: {
      return null;
    }
  }
};

/** Validate an untrusted message from the webview; `null` when malformed. */
export const parseWebviewMessage = (raw: unknown): WebviewMessage | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const m = raw as Record<string, unknown>;
  if (m.type === "ready") {
    return { type: "ready" };
  }
  if (m.type !== "request" || !Number.isSafeInteger(m.id)) {
    return null;
  }
  const request = parseRequest(m.request);
  return request ? { id: m.id as number, request, type: "request" } : null;
};
