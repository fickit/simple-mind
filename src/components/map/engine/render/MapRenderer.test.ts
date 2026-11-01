// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { OBSIDIAN_THEME } from "../../themes/presets";
import { parseSource } from "../parser/parser";
import { MapRenderer } from "./MapRenderer";

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
});

describe("MapRenderer live editing", () => {
  it("reflows the tree and connectors with the live editor size", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const renderer = new MapRenderer(host, OBSIDIAN_THEME, false);
    const mapDocument = parseSource("# Root\n- A\n  - A1\n- B\n").document;
    expect(mapDocument).not.toBeNull();

    renderer.render(mapDocument!);
    const childBefore = renderer.getNodePosition("n3");
    const edgesBefore = Array.from(host.querySelectorAll<SVGPathElement>(".simple-mind-edge")).map(
      (path) => path.getAttribute("d"),
    );

    renderer.setEditingNode("n2");
    renderer.setEditingRect("n2", { x: 0, y: 0, width: 400, height: 60 });
    const edited = renderer.getNodePosition("n2");
    const childAfter = renderer.getNodePosition("n3");
    const edgesAfter = Array.from(host.querySelectorAll<SVGPathElement>(".simple-mind-edge")).map(
      (path) => path.getAttribute("d"),
    );

    expect(edited?.width).toBe(400);
    expect(edited?.height).toBe(60);
    expect(childAfter?.x).not.toBe(childBefore?.x);
    expect(edgesAfter).not.toEqual(edgesBefore);

    renderer.destroy();
    host.remove();
  });
});

/** Builds a right-growing chain so nodes spread along one axis. */
function chain(depth: number): string {
  const lines = ["---", "mindmap:", "  layout: tree-right", "---", "# R0"];
  for (let level = 1; level <= depth; level += 1) {
    lines.push(`${"  ".repeat(level - 1)}- R${level}`);
  }
  return `${lines.join("\n")}\n`;
}

describe("MapRenderer culling", () => {
  it("mounts only the viewport plus a margin and remounts on pan", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    host.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 300,
        bottom: 200,
        width: 300,
        height: 200,
        toJSON: () => ({}),
      }) as DOMRect;
    const renderer = new MapRenderer(host, OBSIDIAN_THEME, false, { cullingThreshold: 2 });
    const depth = 24;
    const mapDocument = parseSource(chain(depth)).document;
    expect(mapDocument).not.toBeNull();

    renderer.render(mapDocument!, { fit: false });

    const mounted = () => host.querySelectorAll<HTMLElement>(".simple-mind-node").length;
    expect(mounted()).toBeLessThan(depth + 1);
    expect(renderer.getNodeElement("n1")).not.toBeNull();

    const deep = renderer.getNodePosition("n25")!;
    expect(deep.x).toBeGreaterThan(0);
    renderer.panBy(100 - deep.x, 0);
    expect(mounted()).toBeLessThan(depth + 1);
    expect(renderer.getNodeElement("n1")).toBeNull();
    expect(renderer.getNodeElement("n25")).not.toBeNull();

    renderer.destroy();
    host.remove();
  });

  it("keeps every node mounted below the threshold", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const renderer = new MapRenderer(host, OBSIDIAN_THEME, false, { cullingThreshold: 100 });
    renderer.render(parseSource("# Root\n- A\n- B\n").document!);

    expect(host.querySelectorAll<HTMLElement>(".simple-mind-node")).toHaveLength(3);

    renderer.destroy();
    host.remove();
  });
});
