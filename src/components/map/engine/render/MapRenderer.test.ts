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
