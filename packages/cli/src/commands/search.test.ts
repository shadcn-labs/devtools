import pc from "picocolors";
import { describe, expect, it } from "vitest";

import { formatTable } from "./search";

const plain = pc.createColors(false);

describe(formatTable, () => {
  const rows = [
    { ref: "@termcn/ink/spinner", title: "Spinner", type: "ui" },
    {
      ref: "@ogimagecn/blog",
      title: "Blog post with author and date",
      type: "block",
    },
  ];

  it("cuts only the title so every line fits the width exactly", () => {
    const lines = formatTable(rows, 40, plain);
    expect(lines).toStrictEqual([
      "REF                  TYPE   TITLE",
      "@termcn/ink/spinner  ui     Spinner",
      "@ogimagecn/blog      block  Blog post w…",
    ]);
    expect(Math.max(...lines.map((line) => line.length))).toBe(40);
  });

  it("keeps refs whole when there is no room for titles", () => {
    expect(formatTable(rows, 10, plain)[1]).toBe(
      "@termcn/ink/spinner  ui     "
    );
    expect(formatTable(rows, Number.POSITIVE_INFINITY, plain)[2]).toBe(
      "@ogimagecn/blog      block  Blog post with author and date"
    );
  });
});
