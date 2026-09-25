import type { OgImageFacts } from "./audit";

const LOAD_TIMEOUT_MS = 15_000;

type NaturalSize = { height: number; width: number } | { error: string };

/**
 * Natural size as the browser decodes it. Resolves with an error message on
 * failure; rejects only when `signal` aborts.
 */
const loadNaturalSize = async (
  url: string,
  signal: AbortSignal
): Promise<NaturalSize> => {
  const img = new Image();
  const timeout = AbortSignal.timeout(LOAD_TIMEOUT_MS);
  // Changing `src` rejects the pending decode().
  const cancel = () => {
    img.src = "";
  };
  signal.addEventListener("abort", cancel, { once: true });
  timeout.addEventListener("abort", cancel, { once: true });
  img.decoding = "async";
  img.src = url;
  try {
    await img.decode();
    return { height: img.naturalHeight, width: img.naturalWidth };
  } catch {
    if (signal.aborted) {
      throw signal.reason;
    }
    return {
      error: timeout.aborted
        ? "timed out after 15 s"
        : "the browser could not decode it as an image",
    };
  } finally {
    signal.removeEventListener("abort", cancel);
    timeout.removeEventListener("abort", cancel);
  }
};

interface Transfer {
  bytes?: number;
  contentType?: string;
  status?: number;
}

/**
 * Size and type as served. HEAD first; GET when HEAD is refused or omits the
 * length (streamed responses such as Next's `opengraph-image` in dev). A CORS
 * rejection only means the bytes stay unknown.
 */
const readTransfer = async (
  url: string,
  signal: AbortSignal
): Promise<Transfer> => {
  try {
    const head = await fetch(url, { method: "HEAD", signal });
    const length = head.headers.get("content-length");
    const contentType = head.headers.get("content-type") ?? undefined;
    if (head.ok && length !== null && /^\d+$/u.test(length)) {
      return { bytes: Number(length), contentType, status: head.status };
    }
    const res = await fetch(url, { signal });
    if (!res.ok) {
      return { status: res.status };
    }
    const blob = await res.blob();
    return {
      bytes: blob.size,
      contentType: res.headers.get("content-type") ?? contentType,
      status: res.status,
    };
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    return {};
  }
};

/** Measure an og:image the way a crawler would see it. */
export const measureImage = async (
  url: string,
  signal: AbortSignal
): Promise<OgImageFacts> => {
  const [size, transfer] = await Promise.all([
    loadNaturalSize(url, signal),
    readTransfer(url, signal),
  ]);
  const contentType = transfer.contentType?.split(";")[0]?.trim() || undefined;
  if ("error" in size) {
    let { error } = size;
    if (transfer.status !== undefined && transfer.status >= 400) {
      error = `HTTP ${transfer.status}`;
    } else if (contentType && !contentType.startsWith("image/")) {
      error = `served as ${contentType}, not an image`;
    }
    return { contentType, error, height: 0, width: 0 };
  }
  return {
    bytes: transfer.bytes,
    contentType,
    height: size.height,
    width: size.width,
  };
};
