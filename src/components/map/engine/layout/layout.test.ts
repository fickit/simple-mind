import { describe, expect, it } from "vitest";
import { CONNECTOR_CLEARANCE } from "../../../../config/constants";
import { DEFAULT_MINDMAP_META } from "../../../../config/defaults";
import type { MindMapMeta, MindNode } from "../../../../types/mindmap";
import { layoutDocument } from "./layout";
import type { LayoutResult, NodeMeasurer } from "./types";

function node(id: string, text: string, children: MindNode[] = []): MindNode {
  return { id, text, children, collapsed: false };
}

const measure: NodeMeasurer = (item) => ({
  width: 20 + item.text.length * 10,
  height: 30,
});

function find(result: LayoutResult, id: string) {
  const positioned = result.nodes.find((item) => item.node.id === id);
  if (!positioned) throw new Error(`Missing node ${id}`);
  return positioned;
}

function meta(overrides: Partial<MindMapMeta> = {}): MindMapMeta {
  return { ...DEFAULT_MINDMAP_META, ...overrides };
}

describe("layoutDocument", () => {
  it("lays out a right-facing tree with the root centered", () => {
    const root = node("r", "R", [node("a", "A"), node("b", "B"), node("c", "C")]);
    const result = layoutDocument(root, meta({ layout: "tree" }), measure);
    const rootPosition = find(result, "r");
    const a = find(result, "a");
    const b = find(result, "b");
    const c = find(result, "c");

    expect(rootPosition.y + rootPosition.height / 2).toBeCloseTo(0);
    expect(a.x).toBe(rootPosition.x + rootPosition.width + 64);
    expect(a.y).toBeCloseTo(-63);
    expect(b.y).toBeCloseTo(-15);
    expect(c.y).toBeCloseTo(33);
    expect(result.edges).toHaveLength(3);
  });

  it("lays out a left-facing tree", () => {
    const root = node("r", "R", [node("a", "A")]);
    const result = layoutDocument(root, meta({ layout: "tree", direction: "left" }), measure);
    const rootPosition = find(result, "r");
    const a = find(result, "a");

    expect(a.x + a.width).toBe(rootPosition.x - 64);
    expect(a.side).toBe("left");
  });

  it("splits a mind map across both sides", () => {
    const root = node("r", "R", [node("a", "A"), node("b", "B"), node("c", "C"), node("d", "D")]);
    const result = layoutDocument(root, meta({ layout: "mindmap" }), measure);
    const rootPosition = find(result, "r");

    expect(find(result, "a").side).toBe("left");
    expect(find(result, "b").side).toBe("right");
    expect(find(result, "c").side).toBe("left");
    expect(find(result, "d").side).toBe("right");
    expect(find(result, "a").x + find(result, "a").width).toBe(rootPosition.x - 64);
    expect(find(result, "b").x).toBe(rootPosition.x + rootPosition.width + 64);
  });

  it("honors explicit root-child sides in the mind map", () => {
    const root = node("r", "R", [
      { ...node("a", "A"), side: "right" },
      { ...node("b", "B"), side: "left" },
      node("c", "C"),
    ]);
    const result = layoutDocument(root, meta({ layout: "mindmap" }), measure);
    const rootPosition = find(result, "r");

    expect(find(result, "a").side).toBe("right");
    expect(find(result, "b").side).toBe("left");
    expect(find(result, "c").side).toBe("left");
    expect(find(result, "a").x).toBe(rootPosition.x + rootPosition.width + 64);
    expect(find(result, "b").x + find(result, "b").width).toBe(rootPosition.x - 64);
  });

  it("lays out an organization chart downward", () => {
    const root = node("r", "R", [node("a", "A"), node("b", "B")]);
    const result = layoutDocument(root, meta({ layout: "org" }), measure);
    const rootPosition = find(result, "r");
    const a = find(result, "a");
    const b = find(result, "b");

    expect(rootPosition.x + rootPosition.width / 2).toBeCloseTo(0);
    expect(a.y).toBe(rootPosition.y + rootPosition.height + CONNECTOR_CLEARANCE);
    expect(b.y).toBe(a.y);
    expect(a.x).toBeLessThan(b.x);
    expect(a.side).toBe("down");
    expect(result.edges.every((edge) => edge.side === "down")).toBe(true);
  });

  it("omits children of collapsed single-sided nodes", () => {
    const root = node("r", "R", [node("a", "A", [node("a1", "A1")])]);
    root.collapsed = true;
    const result = layoutDocument(root, meta({ layout: "tree" }), measure);

    expect(result.nodes.map((item) => item.node.id)).toEqual(["r"]);
    expect(result.edges).toEqual([]);
  });

  it("hides only the collapsed side of a mind-map root", () => {
    const root = node("r", "R", [node("a", "A"), node("b", "B")]);
    root.collapsedLeft = true;
    const result = layoutDocument(root, meta({ layout: "mindmap" }), measure);

    expect(result.nodes.map((item) => item.node.id)).toEqual(["r", "b"]);
    expect(result.edges).toEqual([{ parentId: "r", childId: "b", side: "right" }]);
  });

  it("keeps parent-child gaps clear of node controls", () => {
    const root = node("r", "R", [node("a", "A")]);
    const tree = layoutDocument(root, meta({ layout: "tree", spacingX: 8 }), measure);
    const org = layoutDocument(root, meta({ layout: "org", spacingY: 4 }), measure);
    const treeRoot = find(tree, "r");
    const orgRoot = find(org, "r");

    expect(find(tree, "a").x - (treeRoot.x + treeRoot.width)).toBe(CONNECTOR_CLEARANCE);
    expect(find(org, "a").y - (orgRoot.y + orgRoot.height)).toBe(CONNECTOR_CLEARANCE);
  });

  it("supports start alignment", () => {
    const root = node("r", "R", [node("a", "A"), node("b", "B")]);
    const result = layoutDocument(root, meta({ layout: "tree", align: "start" }), measure);
    const rootPosition = find(result, "r");
    const a = find(result, "a");

    expect(a.y).toBe(rootPosition.y);
  });

  it("computes bounds over all visible nodes", () => {
    const root = node("r", "R", [node("a", "A"), node("b", "B")]);
    const result = layoutDocument(root, meta(), measure);

    expect(result.bounds.width).toBeGreaterThan(0);
    expect(result.bounds.height).toBeGreaterThan(0);
    expect(result.bounds.x1).toBeLessThanOrEqual(find(result, "a").x);
    expect(result.bounds.y2).toBeGreaterThanOrEqual(find(result, "b").y);
  });
});
