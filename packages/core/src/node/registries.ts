import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RegistrySource } from "../registries";
import { registryItemTemplate } from "../registries";

export type EnsureRegistriesResult =
  | { status: "missing-components-json" }
  | { status: "unchanged" }
  | { status: "updated"; added: string[] };

const detectIndent = (text: string): string =>
  /^(?<indent>[ \t]+)"/mu.exec(text)?.groups?.indent ?? "  ";

/**
 * Add `registries` entries for the given sources to components.json. Never
 * overwrites an existing alias (users may point it at a mirror).
 */
export const ensureRegistries = async (
  root: string,
  sources: readonly RegistrySource[]
): Promise<EnsureRegistriesResult> => {
  const file = path.join(root, "components.json");
  let text: string;
  try {
    text = await readFile(file, "utf-8");
  } catch {
    return { status: "missing-components-json" };
  }
  const config = JSON.parse(text) as { registries?: Record<string, string> };
  const registries = { ...config.registries };
  const added: string[] = [];
  for (const source of sources) {
    if (!(source.scope in registries)) {
      registries[source.scope] = registryItemTemplate(source);
      added.push(source.scope);
    }
  }
  if (added.length === 0) {
    return { status: "unchanged" };
  }
  config.registries = registries;
  const trailing = text.endsWith("\n") ? "\n" : "";
  await writeFile(
    file,
    JSON.stringify(config, null, detectIndent(text)) + trailing
  );
  return { added, status: "updated" };
};
