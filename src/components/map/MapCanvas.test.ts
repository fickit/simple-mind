// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MapCanvas } from "./MapCanvas";

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
});

function createCanvas(source: string): {
  host: HTMLElement;
  canvas: MapCanvas;
  onSource: ReturnType<typeof vi.fn>;
} {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const onSource = vi.fn();
  const canvas = new MapCanvas(host, { onSource });
  canvas.setSource(source);
  return { host, canvas, onSource };
}

describe("MapCanvas", () => {
  it("renders nodes, edges, and branch labels", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n  - A1\n- B\n");

    expect(host.querySelectorAll(".simple-mind-node")).toHaveLength(4);
    expect(host.querySelectorAll(".simple-mind-edge")).toHaveLength(3);
    expect(host.querySelector(".simple-mind-node.is-root")?.textContent).toContain("Root");
    expect(host.querySelector(".simple-mind-node-label")?.textContent).toBe("Root");
    expect(host.querySelector(".simple-mind-map")?.getAttribute("data-simple-mind-theme")).toBe(
      "obsidian",
    );

    canvas.destroy();
    host.remove();
  });

  it("toggles collapse without changing the source", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n- B\n");
    const rootButton = host.querySelector<HTMLButtonElement>(
      '.simple-mind-node[data-node-id="n1"] .simple-mind-collapse',
    );

    expect(rootButton?.hidden).toBe(false);
    rootButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(host.querySelectorAll(".simple-mind-node")).toHaveLength(1);
    expect(host.querySelectorAll(".simple-mind-edge")).toHaveLength(0);
    expect(canvas.getSource()).toBe("# Root\n- A\n- B\n");

    canvas.destroy();
    host.remove();
  });

  it("shows a line-numbered banner for invalid source", () => {
    const { host, canvas } = createCanvas("# Root\nhello\n");
    const banner = host.querySelector<HTMLElement>(".simple-mind-banner");

    expect(banner?.hidden).toBe(false);
    expect(banner?.textContent).toContain("line 2");
    expect(host.querySelectorAll(".simple-mind-node")).toHaveLength(1);

    canvas.destroy();
    host.remove();
  });

  it("clears the canvas when the root is missing", () => {
    const { host, canvas } = createCanvas("hello\n");

    expect(host.querySelectorAll(".simple-mind-node")).toHaveLength(0);
    expect(host.querySelector<HTMLElement>(".simple-mind-banner")?.hidden).toBe(false);

    canvas.destroy();
    host.remove();
  });

  it("invokes the source action from the toolbar", () => {
    const { host, canvas, onSource } = createCanvas("# Root\n");
    const sourceButton = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "Source",
    );

    sourceButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSource).toHaveBeenCalledOnce();

    canvas.destroy();
    host.remove();
  });
});
