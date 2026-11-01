// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../config/defaults";
import { MapCanvas } from "./MapCanvas";
import { PAPER_THEME } from "./themes/presets";

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
});

function createCanvas(
  source: string,
  settings = DEFAULT_SETTINGS,
): {
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
  const canvas = new MapCanvas(host, { onSource, onChange, onNotice, settings });
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

function pressKey(target: Element | null, key: string, init: KeyboardEventInit = {}): void {
  target?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
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

    const input = host.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor");
    expect(input).not.toBeNull();
    input!.value = "New child";
    input!.dispatchEvent(new FocusEvent("blur"));

    expect(onChange).toHaveBeenCalledOnce();
    expect(canvas.getSource()).toContain("- A\n  - New child");
    expect(host.querySelectorAll(".simple-mind-node")).toHaveLength(3);

    canvas.destroy();
    host.remove();
  });

  it("starts an empty single-line editor without a placeholder", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    selectNode(host, "n2");
    clickButton(host, "+ Child");

    const input = host.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor");
    expect(input?.value).toBe("");
    expect(input?.placeholder).toBe("");
    expect(input?.style.width).toBe("120px");
    expect(Number.parseFloat(input?.style.height ?? "0")).toBeLessThanOrEqual(33);

    canvas.destroy();
    host.remove();
  });

  it("commits on Enter and immediately starts a sibling editor", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n");
    selectNode(host, "n2");
    clickButton(host, "+ Child");

    const input = host.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor");
    input!.value = "First";
    pressKey(input, "Enter");

    expect(onChange).toHaveBeenCalledOnce();
    expect(canvas.getSource()).toContain("- A\n  - First");
    const nextInput = host.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor");
    expect(nextInput).not.toBeNull();
    expect(nextInput?.value).toBe("");
    expect(document.activeElement).toBe(nextInput);

    canvas.destroy();
    host.remove();
  });

  it("commits on Tab and immediately starts a child editor", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n");
    selectNode(host, "n2");
    clickButton(host, "+ Child");

    const input = host.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor");
    input!.value = "Parent";
    pressKey(input, "Tab");

    expect(onChange).toHaveBeenCalledOnce();
    expect(canvas.getSource()).toContain("- A\n  - Parent");
    const nextInput = host.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor");
    expect(nextInput).not.toBeNull();
    expect(nextInput?.value).toBe("");
    expect(document.activeElement).toBe(nextInput);

    canvas.destroy();
    host.remove();
  });

  it("renames a node through double-click editing", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n");
    const node = host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n2"]');
    node?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    const input = host.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor");
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

  it("copies and pastes a subtree with keyboard shortcuts", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n  - A1\n- B\n");
    const canvasEl = host.querySelector(".simple-mind-canvas");

    selectNode(host, "n2");
    pressKey(canvasEl, "c", { ctrlKey: true });
    selectNode(host, "n4");
    pressKey(canvasEl, "v", { ctrlKey: true });

    expect(onChange).toHaveBeenCalledOnce();
    expect(canvas.getSource()).toContain("- B\n  - A\n    - A1");

    canvas.destroy();
    host.remove();
  });

  it("cuts a subtree and pastes it under another node", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n  - A1\n- B\n");
    const canvasEl = host.querySelector(".simple-mind-canvas");

    selectNode(host, "n2");
    pressKey(canvasEl, "x", { ctrlKey: true });
    expect(canvas.getSource()).not.toContain("- A\n  - A1");
    selectNode(host, "n4");
    pressKey(canvasEl, "v", { ctrlKey: true });

    expect(canvas.getSource()).toContain("- B\n  - A\n    - A1");
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

  it("applies the theme selected in frontmatter", () => {
    const { host, canvas } = createCanvas("---\nmindmap:\n  theme: nord\n---\n# Root\n- A\n");

    expect(host.querySelector(".simple-mind-map")?.getAttribute("data-simple-mind-theme")).toBe(
      "nord",
    );

    canvas.destroy();
    host.remove();
  });

  it("switches theme from the sidebar and writes frontmatter", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n");
    const select = host.querySelector<HTMLSelectElement>(".simple-mind-sidebar-theme");

    expect(select).not.toBeNull();
    select!.value = "nord";
    select!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(canvas.getSource()).toContain("theme: nord");
    expect(host.querySelector(".simple-mind-map")?.getAttribute("data-simple-mind-theme")).toBe(
      "nord",
    );

    canvas.destroy();
    host.remove();
  });

  it("writes per-file layout and node-shape overrides from the sidebar", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n");
    const layout = host.querySelector<HTMLSelectElement>(".simple-mind-sidebar-layout")!;
    const shape = host.querySelector<HTMLSelectElement>(".simple-mind-sidebar-node-shape")!;

    layout.value = "org";
    layout.dispatchEvent(new Event("change", { bubbles: true }));
    shape.value = "pill";
    shape.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(canvas.getSource()).toContain("layout: org");
    expect(canvas.getSource()).toContain("nodeShape: pill");
    expect(host.querySelector(".simple-mind-node.shape-pill")).not.toBeNull();

    canvas.destroy();
    host.remove();
  });

  it("refreshes the light and dark variants of a custom theme", () => {
    const settings = { ...DEFAULT_SETTINGS, defaultTheme: PAPER_THEME.id };
    const { host, canvas } = createCanvas("# Root\n- A\n", settings);
    const root = host.querySelector<HTMLElement>(".simple-mind-map");

    document.body.classList.add("theme-dark");
    canvas.refreshTheme();
    expect(root?.style.getPropertyValue("--sm-canvas-bg")).toBe(PAPER_THEME.dark.canvasBackground);

    document.body.classList.remove("theme-dark");
    canvas.refreshTheme();
    expect(root?.style.getPropertyValue("--sm-canvas-bg")).toBe(PAPER_THEME.light.canvasBackground);

    canvas.destroy();
    host.remove();
  });

  it("does not collapse a node on Space", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n  - A1\n- B\n");
    selectNode(host, "n2");
    pressKey(host.querySelector(".simple-mind-canvas"), " ");

    expect(host.querySelectorAll(".simple-mind-node")).toHaveLength(4);

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
