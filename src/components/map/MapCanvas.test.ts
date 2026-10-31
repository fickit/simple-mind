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
  onChange: ReturnType<typeof vi.fn>;
  onNotice: ReturnType<typeof vi.fn>;
} {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const onSource = vi.fn();
  const onChange = vi.fn();
  const onNotice = vi.fn();
  const canvas = new MapCanvas(host, { onSource, onChange, onNotice });
  canvas.setSource(source);
  return { host, canvas, onSource, onChange, onNotice };
}

function selectNode(host: HTMLElement, nodeId: string): void {
  const node = host.querySelector<HTMLElement>(`.simple-mind-node[data-node-id="${nodeId}"]`);
  node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function clickButton(host: HTMLElement, label: string): void {
  const button = Array.from(host.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );
  button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function pressKey(target: Element | null, key: string): void {
  target?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
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

  it("adds a child through the inline editor and emits source", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n");
    selectNode(host, "n2");
    clickButton(host, "+ Child");

    const input = host.querySelector<HTMLInputElement>(".simple-mind-inline-editor");
    expect(input).not.toBeNull();
    input!.value = "New child";
    pressKey(input, "Enter");

    expect(onChange).toHaveBeenCalledOnce();
    expect(canvas.getSource()).toContain("- A\n  - New child");
    expect(host.querySelectorAll(".simple-mind-node")).toHaveLength(3);

    canvas.destroy();
    host.remove();
  });

  it("renames a node through double-click editing", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n");
    const node = host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n2"]');
    node?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    const input = host.querySelector<HTMLInputElement>(".simple-mind-inline-editor");
    expect(input?.value).toBe("A");
    input!.value = "Renamed";
    pressKey(input, "Enter");

    expect(onChange).toHaveBeenCalledOnce();
    expect(canvas.getSource()).toContain("- Renamed");
    expect(host.textContent).toContain("Renamed");

    canvas.destroy();
    host.remove();
  });

  it("deletes a node and restores it with undo", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n- B\n");
    selectNode(host, "n2");
    clickButton(host, "Delete");

    expect(canvas.getSource()).not.toContain("- A");
    expect(onChange).toHaveBeenCalledOnce();

    const undoButton = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "Undo",
    );
    expect((undoButton as HTMLButtonElement).disabled).toBe(false);
    undoButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(canvas.getSource()).toContain("- A");
    expect(onChange).toHaveBeenCalledTimes(2);

    canvas.destroy();
    host.remove();
  });

  it("protects the root from deletion with a notice", () => {
    const { host, canvas, onChange, onNotice } = createCanvas("# Root\n- A\n");
    selectNode(host, "n1");
    pressKey(host.querySelector(".simple-mind-canvas"), "Delete");

    expect(onNotice).toHaveBeenCalledWith("The root node cannot be deleted.");
    expect(onChange).not.toHaveBeenCalled();
    expect(canvas.getSource()).toContain("# Root");

    canvas.destroy();
    host.remove();
  });

  it("disables editing when source errors exist", () => {
    const { host, canvas, onChange, onNotice } = createCanvas("# Root\nhello\n");
    selectNode(host, "n1");

    const childButton = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "+ Child",
    ) as HTMLButtonElement;
    expect(childButton.disabled).toBe(true);

    pressKey(host.querySelector(".simple-mind-canvas"), "Tab");
    expect(onNotice).toHaveBeenCalledWith("Fix the source errors before editing.");
    expect(onChange).not.toHaveBeenCalled();

    canvas.destroy();
    host.remove();
  });
});
