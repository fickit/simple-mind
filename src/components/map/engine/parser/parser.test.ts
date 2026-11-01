import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIMITS } from "../../../../config/constants";
import { DEFAULT_MINDMAP_META } from "../../../../config/defaults";
import type { MindNode } from "../../../../types/mindmap";
import { parseSource } from "./parser";
import { serializeDocument } from "./serializer";

function fixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
}

function simplify(node: MindNode): { text: string; children: unknown[] } {
  return {
    text: node.text,
    children: node.children.map(simplify),
  };
}

describe("parseSource", () => {
  it("parses the paired fixture and preserves unknown frontmatter", () => {
    const result = parseSource(fixture("basic.input.mindmap"));
    const document = result.document;

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(document).not.toBeNull();
    expect(simplify(document!.root)).toEqual({
      text: "Root",
      children: [
        {
          text: "Alpha",
          children: [
            { text: "Alpha one", children: [] },
            { text: "Alpha two", children: [] },
          ],
        },
        {
          text: "Beta",
          children: [{ text: "Beta one", children: [] }],
        },
      ],
    });
    expect(document!.meta.layout).toBe("tree");
    expect(document!.meta.direction).toBe("left");
    expect(document!.meta.spacingX).toBe(72);
    expect(document!.meta.spacingY).toBe(20);
    expect(document!.meta.align).toBe("start");
    expect(document!.meta.compact).toBe(true);
    expect(document!.meta.maxWidth).toBe(300);
    expect(serializeDocument(document!).trim()).toBe(fixture("basic.expected.mindmap").trim());
  });

  it("round-trips the canonical fixture without structural changes", () => {
    const first = parseSource(fixture("basic.input.mindmap")).document!;
    const second = parseSource(serializeDocument(first)).document!;

    expect(simplify(second.root)).toEqual(simplify(first.root));
    expect(second.meta).toEqual(first.meta);
  });

  it("uses defaults when frontmatter is absent", () => {
    const result = parseSource("# Root\n- A\n  - B\n");

    expect(result.errors).toEqual([]);
    expect(result.document!.meta).toEqual(DEFAULT_MINDMAP_META);
    expect(serializeDocument(result.document!)).toContain("mindmap:");
  });

  it("uses plugin defaults for missing metadata", () => {
    const defaults = {
      ...DEFAULT_MINDMAP_META,
      theme: "nord",
      layout: "org" as const,
      spacingX: 120,
    };
    const result = parseSource("# Root\n- A\n", defaults);

    expect(result.document!.meta).toEqual(defaults);
  });

  it("parses and serializes per-file style overrides", () => {
    const source = `---
mindmap:
  nodeShape: pill
  nodeFillColor: "#fffaf0"
  nodeBorderColor: "#8c5e3c"
  nodeBorderWidth: 3
  connectorStyle: orthogonal
  connectorColor: "#8c5e3c"
  lineWidth: 3
  fontFamily: "Georgia, serif"
  fontSize: 16
  textColor: "#3b3226"
  bold: true
  italic: true
  underline: false
  textAlign: right
  lineHeight: 1.8
---
# Root
- A
`;
    const result = parseSource(source);
    const meta = result.document!.meta;

    expect(meta.nodeShape).toBe("pill");
    expect(meta.nodeFillColor).toBe("#fffaf0");
    expect(meta.nodeBorderColor).toBe("#8c5e3c");
    expect(meta.nodeBorderWidth).toBe(3);
    expect(meta.connectorStyle).toBe("orthogonal");
    expect(meta.connectorColor).toBe("#8c5e3c");
    expect(meta.fontFamily).toBe("Georgia, serif");
    expect(meta.fontSize).toBe(16);
    expect(meta.lineWidth).toBe(3);
    expect(meta.textColor).toBe("#3b3226");
    expect(meta.bold).toBe(true);
    expect(meta.italic).toBe(true);
    expect(meta.underline).toBe(false);
    expect(meta.textAlign).toBe("right");
    expect(meta.lineHeight).toBe(1.8);

    const serialized = serializeDocument(result.document!);
    expect(serialized).toContain("nodeShape: pill");
    expect(serialized).toContain('nodeFillColor: "#fffaf0"');
    expect(serialized).toContain('nodeBorderColor: "#8c5e3c"');
    expect(serialized).toContain("nodeBorderWidth: 3");
    expect(serialized).toContain("connectorStyle: orthogonal");
    expect(serialized).toContain('connectorColor: "#8c5e3c"');
    expect(serialized).toContain("lineWidth: 3");
    expect(serialized).toContain('fontFamily: "Georgia, serif"');
    expect(serialized).toContain("fontSize: 16");
    expect(serialized).toContain('textColor: "#3b3226"');
    expect(serialized).toContain("bold: true");
    expect(serialized).toContain("italic: true");
    expect(serialized).toContain("underline: false");
    expect(serialized).toContain("textAlign: right");
    expect(serialized).toContain("lineHeight: 1.8");
  });

  it("drops invalid optional style values with warnings", () => {
    const result = parseSource(
      "---\nmindmap:\n  nodeBorderWidth: wide\n  lineHeight: tall\n  textAlign: middle\n  bold: yes\n---\n# Root\n",
    );
    const meta = result.document!.meta;

    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(4);
    expect(meta.nodeBorderWidth).toBeUndefined();
    expect(meta.lineHeight).toBeUndefined();
    expect(meta.textAlign).toBeUndefined();
    expect(meta.bold).toBeUndefined();
  });

  it("normalizes CRLF, tabs, and mixed list markers", () => {
    const result = parseSource("# Root\r\n* A\r\n\t- B\r\n+ C\r\n");

    expect(result.errors).toEqual([]);
    expect(result.document!.root.children.map((node) => node.text)).toEqual(["A", "C"]);
    expect(result.document!.root.children[0].children[0].text).toBe("B");
    expect(serializeDocument(result.document!)).toContain("- A\n  - B\n- C");
  });

  it("reports a second heading", () => {
    const result = parseSource("# Root\n# Other\n- A\n");

    expect(result.document).not.toBeNull();
    expect(result.errors).toEqual([
      { line: 2, message: "Only one H1 root is allowed; other headings are not supported." },
    ]);
  });

  it("reports an ordered list", () => {
    const result = parseSource("# Root\n1. A\n");

    expect(result.errors[0]).toEqual({
      line: 2,
      message: "Ordered lists are not supported; use an unordered list.",
    });
  });

  it("reports an unsupported paragraph", () => {
    const result = parseSource("# Root\nhello\n");

    expect(result.errors[0]).toEqual({
      line: 2,
      message: "Unsupported source line; use a nested unordered list.",
    });
  });

  it("rejects an indented first list item", () => {
    const result = parseSource("# Root\n  - A\n");

    expect(result.errors[0].line).toBe(2);
    expect(result.errors[0].message).toContain("first list item");
  });

  it("rejects a dedent to a level that does not exist", () => {
    const result = parseSource("# Root\n- A\n    - B\n  - C\n");

    expect(result.errors[0].line).toBe(4);
    expect(result.errors[0].message).toContain("Unexpected indentation");
  });

  it("rejects an empty list label", () => {
    const result = parseSource("# Root\n- \n");

    expect(result.errors[0]).toEqual({ line: 2, message: "A list item needs a label." });
  });

  it("returns null when the root is missing", () => {
    const result = parseSource("- A\n");

    expect(result.document).toBeNull();
    expect(result.errors[0].line).toBe(1);
  });

  it("returns null for unclosed frontmatter", () => {
    const result = parseSource("---\nmindmap:\n  theme: paper\n# Root\n");

    expect(result.document).toBeNull();
    expect(result.errors[0]).toEqual({
      line: 1,
      message: "Frontmatter is not closed with a --- line.",
    });
  });

  it("falls back with warnings for invalid metadata", () => {
    const result = parseSource(
      '---\nmindmap:\n  version: 2\n  theme: ""\n  layout: grid\n  spacingX: 999\n  spacingY: nope\n  align: middle\n  compact: yes\n  maxWidth: 10\n---\n# Root\n',
    );
    const meta = result.document!.meta;

    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThanOrEqual(6);
    expect(meta.layout).toBe("mindmap");
    expect(meta.spacingX).toBe(LIMITS.spacingX.max);
    expect(meta.spacingY).toBe(DEFAULT_MINDMAP_META.spacingY);
    expect(meta.align).toBe("center");
    expect(meta.compact).toBe(false);
    expect(meta.maxWidth).toBe(LIMITS.maxWidth.min);
  });
});
