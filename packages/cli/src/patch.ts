/**
 * Source patches applied by `init`. Pure string transforms: each one either
 * edits in a single unambiguous spot or reports why it will not guess.
 */

export type PatchResult =
  | { status: "patched"; code: string }
  | { status: "already" }
  | { status: "unsupported"; reason: string };

export const NEXT_PACKAGE = "@shadcn-labs/devtools-next";
export const VITE_PACKAGE = "@shadcn-labs/devtools-vite";

/**
 * Top-level static imports (single or multi-line). The lazy clause stops at the
 * first string literal, which in an import declaration is the module specifier.
 */
const IMPORT_PATTERN =
  /^import[\s{*"'][^;]*?(?<quote>["'])(?<specifier>[^"'\r\n]+)\k<quote>(?:\s*(?:with|assert)\s*\{[^}]*\})?[^\S\r\n]*(?<semicolon>;?)/gmu;

const DIRECTIVE_PATTERN =
  /^\s*(?<quote>["'])use [a-z ]+\k<quote>;?[^\S\r\n]*(?:\r?\n|$)/u;

const lineEnding = (source: string) =>
  source.includes("\r\n") ? "\r\n" : "\n";

/** One indentation level, from the first indented non-comment line. */
const indentUnit = (source: string): string => {
  const indent = /^(?<indent>[ \t]+)[^\s*]/mu.exec(source)?.groups?.indent;
  if (!indent) {
    return "  ";
  }
  return indent.startsWith("\t") ? "\t" : indent;
};

/**
 * Ensure `import { name } from "pkg"`: added on its own line after the last
 * import, matching that import's quote and semicolon style.
 */
const ensureImport = (source: string, name: string, pkg: string): string => {
  const imports = [...source.matchAll(IMPORT_PATTERN)];
  if (imports.some((match) => match.groups?.specifier === pkg)) {
    return source;
  }
  const eol = lineEnding(source);
  const last = imports.at(-1);
  if (!last) {
    const directive = DIRECTIVE_PATTERN.exec(source)?.[0] ?? "";
    const rest = source.slice(directive.length);
    const gap = rest.startsWith(eol) ? "" : eol;
    return `${directive}import { ${name} } from "${pkg}";${eol}${gap}${rest}`;
  }
  const { quote = '"', semicolon = ";" } = last.groups ?? {};
  const statement = `import { ${name} } from ${quote}${pkg}${quote}${semicolon}`;
  // After the rest of the import's line, so trailing comments stay put.
  const newline = source.indexOf("\n", last.index + last[0].length);
  let at = newline === -1 ? source.length : newline;
  if (source[at - 1] === "\r") {
    at -= 1;
  }
  return `${source.slice(0, at)}${eol}${statement}${source.slice(at)}`;
};

const NEXT_ELEMENT = "<ShadcnLabsDevtools />";

/**
 * Render `<ShadcnLabsDevtools />` as the last child of `<body>` in a Next.js
 * App Router root layout and import it from `@shadcn-labs/devtools-next`.
 */
export const patchNextLayout = (source: string): PatchResult => {
  if (/<ShadcnLabsDevtools[\s/>]/u.test(source)) {
    return { status: "already" };
  }
  if (
    /^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*(?<quote>["'])use client\k<quote>/u.test(
      source
    )
  ) {
    return {
      reason:
        "the root layout is a Client Component; <ShadcnLabsDevtools /> must be rendered by a Server Component",
      status: "unsupported",
    };
  }
  const bodies = [...source.matchAll(/<\/body\s*>/gu)];
  const [body] = bodies;
  if (!body) {
    return { reason: "no </body> tag found", status: "unsupported" };
  }
  if (bodies.length > 1) {
    return {
      reason: `found ${bodies.length} </body> tags; unclear which one to patch`,
      status: "unsupported",
    };
  }

  const lineStart = source.lastIndexOf("\n", body.index - 1) + 1;
  const beforeTag = source.slice(lineStart, body.index);
  let code: string;
  if (/^[ \t]*$/u.test(beforeTag)) {
    // `</body>` sits on its own line: add a line at the children's indent.
    const previous = source
      .slice(0, lineStart)
      .split(/\r?\n/u)
      .findLast((line) => line.trim() !== "");
    const previousIndent = /^[ \t]*/u.exec(previous ?? "")?.[0] ?? "";
    const indent =
      previousIndent.length > beforeTag.length
        ? previousIndent
        : `${beforeTag}${indentUnit(source)}`;
    code = `${source.slice(0, lineStart)}${indent}${NEXT_ELEMENT}${lineEnding(source)}${source.slice(lineStart)}`;
  } else {
    code = `${source.slice(0, body.index)}${NEXT_ELEMENT}${source.slice(body.index)}`;
  }
  return {
    code: ensureImport(code, "ShadcnLabsDevtools", NEXT_PACKAGE),
    status: "patched",
  };
};

const VITE_CALL = "shadcnLabsDevtools()";

/**
 * Add `shadcnLabsDevtools()` as the first entry of the `plugins: [...]` array
 * in a Vite config and import it from `@shadcn-labs/devtools-vite`.
 */
export const patchViteConfig = (source: string): PatchResult => {
  if (/\bshadcnLabsDevtools\s*\(/u.test(source)) {
    return { status: "already" };
  }
  const arrays = [...source.matchAll(/\bplugins\s*:\s*\[/gu)];
  const [array] = arrays;
  if (!array) {
    return { reason: "no `plugins: [...]` array found", status: "unsupported" };
  }
  if (arrays.length > 1) {
    return {
      reason: `found ${arrays.length} \`plugins: [...]\` arrays; unclear which one belongs to Vite`,
      status: "unsupported",
    };
  }
  if (
    source.search(IMPORT_PATTERN) === -1 &&
    /\b(?:require\s*\(|module\.exports\b)/u.test(source)
  ) {
    return {
      reason: "the config uses CommonJS (require/module.exports)",
      status: "unsupported",
    };
  }

  const open = array.index + array[0].length;
  const rest = source.slice(open);
  const multiline =
    /^[^\S\r\n]*\r?\n(?:[^\S\r\n]*\r?\n)*(?<indent>[^\S\r\n]*)(?<next>\S)/u.exec(
      rest
    );
  let insertion: string;
  if (multiline) {
    const { indent = "", next } = multiline.groups ?? {};
    // Empty multi-line array: indent one level past the `plugins:` line.
    const lineStart = source.lastIndexOf("\n", array.index) + 1;
    const elementIndent =
      next === "]"
        ? `${/^[ \t]*/u.exec(source.slice(lineStart))?.[0] ?? ""}${indentUnit(source)}`
        : indent;
    insertion = `${lineEnding(source)}${elementIndent}${VITE_CALL},`;
  } else {
    insertion = /^\s*\]/u.test(rest) ? VITE_CALL : `${VITE_CALL}, `;
  }
  return {
    code: ensureImport(
      `${source.slice(0, open)}${insertion}${rest}`,
      "shadcnLabsDevtools",
      VITE_PACKAGE
    ),
    status: "patched",
  };
};
