import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIMITS } from "../../../../config/constants";
import { DEFAULT_MINDMAP_META } from "../../../../config/defaults";
import type { MindNode } from "../../../../types/mindmap";
import { parseSource } from "./parser";
import { serializeDocument } from "./serializer";

function fixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );
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
    expect(document!.meta.layout).toBe("tree-left");
    expect(document!.meta.spacingX).toBe(72);
    expect(document!.meta.spacingY).toBe(20);
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

  it("parses and serializes per-node styles and connector shape", () => {
    const source = `---
mindmap:
  connectorStyle: orthogonal
---
# Root <!-- sm:{"textColor":"#aabbcc","bold":true} -->
- A <!-- sm:{"side":"left","shape":"pill","fill":"#ffe8cc","fontSize":16,"textAlign":"left"} -->
  - B
`;
    const result = parseSource(source);
    const document = result.document!;
    const first = document.root.children[0];

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(document.meta.connectorStyle).toBe("orthogonal");
    expect(document.root.text).toBe("Root");
    expect(document.root.style).toEqual({ textColor: "#aabbcc", bold: true });
    expect(first.text).toBe("A");
    expect(first.side).toBe("left");
    expect(first.style).toEqual({
      shape: "pill",
      fill: "#ffe8cc",
      fontSize: 16,
      textAlign: "left",
    });

    const serialized = serializeDocument(document);
    expect(serialized).toContain("connectorStyle: orthogonal");
    expect(serialized).toContain('# Root <!-- sm:{"textColor":"#aabbcc","bold":true} -->');
    expect(serialized).toContain(
      '- A <!-- sm:{"side":"left","shape":"pill","fill":"#ffe8cc","fontSize":16,"textAlign":"left"} -->',
    );

    const second = parseSource(serialized).document!;
    expect(second.meta).toEqual(document.meta);
    expect(second.root.style).toEqual(document.root.style);
    expect(second.root.children[0].style).toEqual(first.style);
    expect(second.root.children[0].side).toBe("left");
  });

  it("clamps and validates node style fields", () => {
    const result = parseSource(
      '# Root\n- A <!-- sm:{"side":"middle","fontSize":99,"lineHeight":"tall","shape":"circle","fill":""} -->\n',
    );
    const node = result.document!.root.children[0];

    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(5);
    expect(node.side).toBeUndefined();
    expect(node.style?.fontSize).toBe(32);
    expect(node.style?.lineHeight).toBeUndefined();
    expect(node.style?.shape).toBeUndefined();
    expect(node.style?.fill).toBeUndefined();
  });

  it("drops a malformed node style marker with a warning", () => {
    const result = parseSource("# Root\n- A <!-- sm:{bad} -->\n- B\n");
    const first = result.document!.root.children[0];

    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(first.text).toBe("A");
    expect(first.style).toBeUndefined();
  });

  it("drops legacy file-level style keys with warnings", () => {
    const result = parseSource(
      '---\nmindmap:\n  nodeShape: pill\n  fontFamily: Georgia\n  connectorColor: "#fff"\n  lineWidth: 3\n  connectorStyle: orthogonal\n---\n# Root\n',
    );
    const record = result.document!.meta as unknown as Record<string, unknown>;

    expect(result.document!.meta.connectorStyle).toBe("orthogonal");
    expect(record.nodeShape).toBeUndefined();
    expect(record.fontFamily).toBeUndefined();
    expect(record.connectorColor).toBeUndefined();
    expect(record.lineWidth).toBeUndefined();
    expect(result.warnings).toHaveLength(4);

    const serialized = serializeDocument(result.document!);
    expect(serialized).not.toContain("nodeShape");
    expect(serialized).not.toContain("fontFamily");
    expect(serialized).not.toContain("connectorColor");
    expect(serialized).not.toContain("lineWidth");
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
      '---\nmindmap:\n  version: 2\n  theme: ""\n  layout: grid\n  spacingX: 999\n  spacingY: nope\n  align: middle\n  maxWidth: 10\n---\n# Root\n',
    );
    const meta = result.document!.meta;

    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThanOrEqual(6);
    expect(meta.layout).toBe("mindmap");
    expect(meta.spacingX).toBe(LIMITS.spacingX.max);
    expect(meta.spacingY).toBe(DEFAULT_MINDMAP_META.spacingY);
    expect(meta.maxWidth).toBe(LIMITS.maxWidth.min);
  });
});
