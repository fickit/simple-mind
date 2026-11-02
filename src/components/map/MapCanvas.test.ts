// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_MINDMAP_META, DEFAULT_SETTINGS } from "../../config/defaults";
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

/** Lets queued frame draws run. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function clickButton(host: HTMLElement, label: string): void {
  const button = Array.from(host.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );
  button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/** Returns the tiles of the named icon group. */
function tiles(host: HTMLElement, group: string): HTMLButtonElement[] {
  const wrap = host.querySelector<HTMLElement>(`[role="group"][aria-label="${group}"]`)!;
  return Array.from(wrap.querySelectorAll<HTMLButtonElement>(".simple-mind-sidebar-segment-item"));
}

/** Returns a stepper's field with its step and reset buttons. */
function stepper(
  host: HTMLElement,
  field: string,
): {
  input: HTMLInputElement;
  decrease: HTMLButtonElement;
  increase: HTMLButtonElement;
  reset: HTMLButtonElement;
} {
  const input = host.querySelector<HTMLInputElement>(`.simple-mind-sidebar-${field}`)!;
  const wrap = input.closest(".simple-mind-sidebar-stepper")!;
  return {
    input,
    decrease: wrap.querySelector<HTMLButtonElement>('[aria-label="Decrease"]')!,
    increase: wrap.querySelector<HTMLButtonElement>('[aria-label="Increase"]')!,
    reset: wrap.querySelector<HTMLButtonElement>(".simple-mind-sidebar-reset")!,
  };
}

/** Sets a numeric field and commits it the way a blur would. */
function commitNumber(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
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
      DEFAULT_MINDMAP_META.theme,
    );
    expect(host.querySelector(".simple-mind-map")?.getAttribute("data-sm-mode")).toBe("light");

    canvas.destroy();
    host.remove();
  });

  it("collapses each mind-map root side independently without changing the source", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n- B\n");
    const root = host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n1"]')!;
    const leftControl = root.querySelector<HTMLButtonElement>(
      ".simple-mind-collapse.collapse-left",
    )!;
    const rightControl = root.querySelector<HTMLButtonElement>(
      ".simple-mind-collapse.collapse-right",
    )!;

    leftControl.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(leftControl.textContent).toBe("1");
    expect(leftControl.classList.contains("is-count")).toBe(true);
    expect(root.querySelector(".simple-mind-add.add-left")).toBeNull();
    expect(root.querySelector(".simple-mind-add.add-right")).not.toBeNull();
    expect(host.querySelectorAll(".simple-mind-node")).toHaveLength(2);
    expect(host.querySelector('.simple-mind-node[data-node-id="n2"]')).toBeNull();
    expect(host.querySelectorAll(".simple-mind-edge")).toHaveLength(1);

    rightControl.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rightControl.textContent).toBe("1");
    expect(rightControl.classList.contains("is-count")).toBe(true);
    expect(root.querySelector(".simple-mind-add.add-right")).toBeNull();
    expect(host.querySelectorAll(".simple-mind-node")).toHaveLength(1);
    expect(host.querySelectorAll(".simple-mind-edge")).toHaveLength(0);
    expect(canvas.getSource()).toBe("# Root\n- A\n- B\n");

    leftControl.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(leftControl.dataset.icon).toBe("chevron-right");
    expect(root.querySelector(".simple-mind-add.add-left")).not.toBeNull();
    expect(root.querySelector(".simple-mind-add.add-right")).toBeNull();

    canvas.destroy();
    host.remove();
  });

  it("places add buttons according to the layout and node side", () => {
    const mindmap = createCanvas("# Root\n- A\n- B\n");
    const mindmapRoot = mindmap.host.querySelector<HTMLElement>(
      '.simple-mind-node[data-node-id="n1"]',
    )!;
    const leftBranch = mindmap.host.querySelector<HTMLElement>(
      '.simple-mind-node[data-node-id="n2"]',
    )!;
    const rightBranch = mindmap.host.querySelector<HTMLElement>(
      '.simple-mind-node[data-node-id="n3"]',
    )!;

    expect(mindmapRoot.querySelector(".simple-mind-add.add-left")).not.toBeNull();
    expect(mindmapRoot.querySelector(".simple-mind-add.add-right")).not.toBeNull();
    expect(
      mindmapRoot.querySelector(".simple-mind-add.add-left")?.classList.contains("has-collapse"),
    ).toBe(true);
    expect(
      mindmapRoot.querySelector(".simple-mind-add.add-right")?.classList.contains("has-collapse"),
    ).toBe(true);
    expect(leftBranch.querySelector(".simple-mind-add.add-left")).not.toBeNull();
    expect(leftBranch.querySelector(".simple-mind-add.add-right")).toBeNull();
    expect(
      leftBranch.querySelector(".simple-mind-add.add-left")?.classList.contains("has-collapse"),
    ).toBe(false);
    expect(rightBranch.querySelector(".simple-mind-add.add-right")).not.toBeNull();
    expect(rightBranch.querySelector(".simple-mind-add.add-left")).toBeNull();
    mindmap.canvas.destroy();
    mindmap.host.remove();

    const leftTree = createCanvas("---\nmindmap:\n  layout: tree-left\n---\n# Root\n- A\n");
    const treeRoot = leftTree.host.querySelector<HTMLElement>(
      '.simple-mind-node[data-node-id="n1"]',
    )!;
    expect(treeRoot.querySelector(".simple-mind-add.add-left")).not.toBeNull();
    expect(treeRoot.querySelector(".simple-mind-add.add-right")).toBeNull();
    leftTree.canvas.destroy();
    leftTree.host.remove();

    const org = createCanvas("---\nmindmap:\n  layout: org\n---\n# Root\n- A\n");
    const orgRoot = org.host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n1"]')!;
    expect(orgRoot.querySelector(".simple-mind-add.add-down")).not.toBeNull();
    expect(orgRoot.querySelector(".simple-mind-add.add-left")).toBeNull();
    org.canvas.destroy();
    org.host.remove();
  });

  it("draws chevron icons and a node count when collapsed", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n  - A1\n  - A2\n- B\n");
    const root = host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n1"]')!;
    const branch = host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n2"]')!;
    const rootLeft = root.querySelector<HTMLButtonElement>(".simple-mind-collapse.collapse-left")!;
    const rootRight = root.querySelector<HTMLButtonElement>(
      ".simple-mind-collapse.collapse-right",
    )!;
    const branchCollapse = branch.querySelector<HTMLButtonElement>(".simple-mind-collapse")!;

    expect(rootLeft.dataset.icon).toBe("chevron-right");
    expect(rootRight.dataset.icon).toBe("chevron-left");
    expect(branchCollapse.dataset.icon).toBe("chevron-right");
    expect(branchCollapse.querySelector("svg.simple-mind-icon")).not.toBeNull();
    branchCollapse.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(branchCollapse.textContent).toBe("2");
    expect(branchCollapse.dataset.icon).toBeUndefined();
    expect(branchCollapse.classList.contains("is-count")).toBe(true);
    expect(branchCollapse.dataset.collapsed).toBe("true");
    expect(branch.querySelector(".simple-mind-add")).toBeNull();

    canvas.destroy();
    host.remove();

    const org = createCanvas("---\nmindmap:\n  layout: org\n---\n# Root\n- A\n- B\n");
    const orgRoot = org.host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n1"]')!;
    expect(orgRoot.querySelector<HTMLButtonElement>(".simple-mind-collapse")?.dataset.icon).toBe(
      "chevron-up",
    );
    org.canvas.destroy();
    org.host.remove();
  });

  it("colors node controls with their connector colors", () => {
    const settings = { ...DEFAULT_SETTINGS, defaultTheme: PAPER_THEME.id };
    const { host, canvas } = createCanvas("# Root\n- A\n- B\n", settings);
    const root = host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n1"]')!;
    const leftCollapse = root.querySelector<HTMLButtonElement>(
      ".simple-mind-collapse.collapse-left",
    )!;
    const rightCollapse = root.querySelector<HTMLButtonElement>(
      ".simple-mind-collapse.collapse-right",
    )!;
    const leftAdd = root.querySelector<HTMLButtonElement>(".simple-mind-add.add-left")!;
    const rightAdd = root.querySelector<HTMLButtonElement>(".simple-mind-add.add-right")!;

    expect(leftCollapse.style.getPropertyValue("--sm-control-bg")).toBe(
      PAPER_THEME.light.branch.palette[0],
    );
    expect(rightCollapse.style.getPropertyValue("--sm-control-bg")).toBe(
      PAPER_THEME.light.branch.palette[1],
    );
    expect(leftAdd.style.getPropertyValue("--sm-control-bg")).toBe(
      PAPER_THEME.light.branch.palette[0],
    );
    expect(rightAdd.style.getPropertyValue("--sm-control-bg")).toBe(
      PAPER_THEME.light.branch.palette[1],
    );
    expect(leftCollapse.style.getPropertyValue("--sm-control-text")).toMatch(/^#(111111|ffffff)$/);

    canvas.destroy();
    host.remove();
  });

  it("adds a child on the side of the clicked floating button", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n- B\n");
    const root = host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n1"]')!;

    root
      .querySelector(".simple-mind-add.add-left")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const leftInput = host.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    expect(leftInput).not.toBeNull();
    leftInput.value = "Left child";
    leftInput.dispatchEvent(new FocusEvent("blur"));

    expect(onChange).toHaveBeenCalledOnce();
    expect(canvas.getSource()).toContain('- Left child <!-- sm:{"side":"left"} -->');
    const leftNode = Array.from(host.querySelectorAll<HTMLElement>(".simple-mind-node")).find(
      (element) => element.textContent?.includes("Left child"),
    )!;
    expect(leftNode.classList.contains("side-left")).toBe(true);

    root
      .querySelector(".simple-mind-add.add-right")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const rightInput = host.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    rightInput.value = "Right child";
    rightInput.dispatchEvent(new FocusEvent("blur"));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(canvas.getSource()).toContain('- Right child <!-- sm:{"side":"right"} -->');

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

  it("writes per-file layout and connector-shape overrides from the sidebar", () => {
    const { host, canvas, onChange } = createCanvas("# Root\n- A\n");
    const layoutTiles = tiles(host, "Type");
    const connector = host.querySelector<HTMLSelectElement>(".simple-mind-sidebar-connector")!;

    expect(layoutTiles.map((tile) => tile.dataset.value)).toEqual([
      "mindmap",
      "tree-right",
      "tree-left",
      "org",
    ]);
    expect(layoutTiles[0].dataset.icon).toBe("layout-mindmap");
    expect(layoutTiles[0].classList.contains("is-active")).toBe(true);

    layoutTiles[3].click();
    connector.value = "orthogonal";
    connector.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(canvas.getSource()).toContain("layout: org");
    expect(canvas.getSource()).toContain("connectorStyle: orthogonal");
    expect(layoutTiles[3].classList.contains("is-active")).toBe(true);
    expect(layoutTiles[0].classList.contains("is-active")).toBe(false);

    canvas.destroy();
    host.remove();
  });

  it("keeps node and text controls in one panel with no tabs", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    const paneButtons = Array.from(
      host.querySelectorAll<HTMLButtonElement>(".simple-mind-sidebar-pane button"),
    );

    expect(host.querySelectorAll(".simple-mind-sidebar-pane")).toHaveLength(1);
    expect(host.querySelector(".simple-mind-sidebar-font-family")).toBeNull();
    expect(
      paneButtons.filter((button) => /^(Style|Text)$/.test(button.textContent ?? "")),
    ).toHaveLength(0);
    expect(host.querySelector(".simple-mind-sidebar-node-fill")).not.toBeNull();
    expect(host.querySelector(".simple-mind-sidebar-line-height")).not.toBeNull();

    canvas.destroy();
    host.remove();
  });

  it("keeps gap, node width, and connector color out of the sidebar", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    const labels = Array.from(host.querySelectorAll(".simple-mind-sidebar-row > span")).map(
      (label) => label.textContent,
    );

    expect(labels).not.toContain("Horizontal gap");
    expect(labels).not.toContain("Maximum node width");
    expect(labels).not.toContain("Color");
    expect(labels).not.toContain("Thickness");
    expect(labels).toContain("Shape");

    canvas.destroy();
    host.remove();
  });

  it("requires a selection before editing node and text styles", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    const shapeTiles = tiles(host, "Node shape");
    const fill = host.querySelector<HTMLInputElement>(".simple-mind-sidebar-node-fill")!;
    const width = stepper(host, "node-border-width");
    const hint = host.querySelector<HTMLElement>(".simple-mind-sidebar-hint")!;

    expect(shapeTiles.every((tile) => tile.disabled)).toBe(true);
    expect(fill.disabled).toBe(true);
    expect(width.input.disabled).toBe(true);
    expect(width.reset.disabled).toBe(true);
    expect(hint.hidden).toBe(false);

    selectNode(host, "n2");
    expect(shapeTiles.every((tile) => !tile.disabled)).toBe(true);
    expect(fill.disabled).toBe(false);
    expect(width.input.disabled).toBe(false);
    expect(hint.hidden).toBe(true);

    canvas.destroy();
    host.remove();
  });

  it("shows node shape as pictogram tiles with a reset tile", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    selectNode(host, "n2");
    const shapeTiles = tiles(host, "Node shape");

    expect(shapeTiles.map((tile) => tile.dataset.icon)).toEqual([
      "reset",
      "shape-rounded",
      "shape-pill",
      "shape-underline",
      "shape-plain",
    ]);
    expect(shapeTiles[0].classList.contains("is-active")).toBe(true);

    shapeTiles[2].click();
    expect(canvas.getSource()).toContain('<!-- sm:{"shape":"pill"} -->');
    expect(shapeTiles[2].getAttribute("aria-pressed")).toBe("true");

    shapeTiles[0].click();
    expect(canvas.getSource()).not.toContain("<!-- sm:");
    expect(shapeTiles[0].classList.contains("is-active")).toBe(true);

    canvas.destroy();
    host.remove();
  });

  it("steps numeric style values and returns them to the theme default", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    selectNode(host, "n2");
    const fontSize = stepper(host, "font-size");

    expect(fontSize.input.placeholder).toBe("Default");
    expect(fontSize.input.value).toBe("");

    fontSize.increase.click();
    expect(canvas.getSource()).toContain('<!-- sm:{"fontSize":8} -->');
    fontSize.increase.click();
    expect(fontSize.input.value).toBe("9");
    fontSize.decrease.click();
    expect(fontSize.input.value).toBe("8");

    commitNumber(fontSize.input, "99");
    expect(fontSize.input.value).toBe("32");
    expect(canvas.getSource()).toContain('"fontSize":32');

    expect(fontSize.reset.disabled).toBe(false);
    fontSize.reset.click();
    expect(fontSize.input.value).toBe("");
    expect(fontSize.reset.disabled).toBe(true);
    expect(canvas.getSource()).not.toContain("<!-- sm:");

    canvas.destroy();
    host.remove();
  });

  it("toggles bold, italic, and underline with icon buttons", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    selectNode(host, "n2");
    const bold = host.querySelector<HTMLButtonElement>(
      '.simple-mind-sidebar-toggle[aria-label="Bold"]',
    )!;

    expect(bold.dataset.icon).toBe("bold");
    expect(bold.getAttribute("aria-pressed")).toBe("false");

    bold.click();
    expect(canvas.getSource()).toContain('<!-- sm:{"bold":true} -->');
    expect(bold.classList.contains("is-active")).toBe(true);

    bold.click();
    expect(canvas.getSource()).toContain('<!-- sm:{"bold":false} -->');
    expect(bold.getAttribute("aria-pressed")).toBe("false");

    canvas.destroy();
    host.remove();
  });

  it("shows text alignment as three icon tiles that clear on the second click", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    selectNode(host, "n2");
    const alignTiles = tiles(host, "Text alignment");

    expect(alignTiles.map((tile) => tile.dataset.value)).toEqual(["left", "center", "right"]);
    expect(alignTiles[1].classList.contains("is-active")).toBe(true);
    expect(alignTiles[0].querySelector("svg.simple-mind-icon")).not.toBeNull();

    alignTiles[0].click();
    expect(canvas.getSource()).toContain('- A <!-- sm:{"textAlign":"left"} -->');
    expect(alignTiles[0].getAttribute("aria-pressed")).toBe("true");
    expect(alignTiles[1].getAttribute("aria-pressed")).toBe("false");

    alignTiles[0].click();
    expect(canvas.getSource()).not.toContain("textAlign");
    expect(alignTiles[1].getAttribute("aria-pressed")).toBe("true");

    canvas.destroy();
    host.remove();
  });

  it("writes node and text overrides to the selected node", async () => {
    const { host, canvas } = createCanvas("# Root\n- A\n- B\n");
    selectNode(host, "n2");
    const change = (selector: string, value: string): void => {
      const input = host.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    tiles(host, "Node shape")[2].click();
    change(".simple-mind-sidebar-node-fill", "#112233");
    change(".simple-mind-sidebar-node-border", "#223344");
    change(".simple-mind-sidebar-node-border-width", "3");
    change(".simple-mind-sidebar-font-size", "16");
    change(".simple-mind-sidebar-text-color", "#778899");
    for (const label of ["Bold", "Italic", "Underline"]) {
      host
        .querySelector<HTMLButtonElement>(`.simple-mind-sidebar-toggle[aria-label="${label}"]`)!
        .click();
    }
    tiles(host, "Text alignment")[2].click();
    change(".simple-mind-sidebar-line-height", "1.8");

    const source = canvas.getSource();
    expect(source).toContain(
      '- A <!-- sm:{"shape":"pill","fill":"#112233","borderColor":"#223344","borderWidth":3,"fontSize":16,"textColor":"#778899","bold":true,"italic":true,"underline":true,"textAlign":"right","lineHeight":1.8} -->',
    );
    expect(source).toContain("- B\n");
    expect(source).not.toContain("- B <!-- sm:");

    await nextFrame();
    const node = host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n2"]')!;
    expect(node.classList.contains("shape-pill")).toBe(true);
    expect(node.style.getPropertyValue("--sm-node-bg")).toBe("#112233");
    expect(node.style.getPropertyValue("--sm-node-border")).toBe("#223344");
    expect(node.style.getPropertyValue("--sm-node-border-width")).toBe("3px");
    expect(node.style.getPropertyValue("--sm-font-size")).toBe("16px");
    expect(node.style.fontWeight).toBe("600");
    expect(node.style.getPropertyValue("--sm-font-style")).toBe("italic");
    expect(node.style.getPropertyValue("--sm-line-height")).toBe("1.8");
    expect(node.style.getPropertyValue("--sm-text-align")).toBe("right");
    expect(node.style.getPropertyValue("--sm-text-decoration")).toBe("underline");

    canvas.destroy();
    host.remove();
  });

  it("styles the root through the H1 line", async () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    selectNode(host, "n1");
    const fill = host.querySelector<HTMLInputElement>(".simple-mind-sidebar-node-fill")!;
    fill.value = "#ff0000";
    fill.dispatchEvent(new Event("change", { bubbles: true }));

    expect(canvas.getSource()).toContain('# Root <!-- sm:{"fill":"#ff0000"} -->');
    await nextFrame();
    const root = host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n1"]')!;
    expect(root.style.getPropertyValue("--sm-root-bg")).toBe("#ff0000");

    canvas.destroy();
    host.remove();
  });

  it("draws continuous style input once per frame", async () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    selectNode(host, "n2");
    const renderer = (
      canvas as unknown as { renderer: { render: (doc: unknown, options?: unknown) => void } }
    ).renderer;
    const renderSpy = vi.spyOn(renderer, "render");
    const fill = host.querySelector<HTMLInputElement>(".simple-mind-sidebar-node-fill")!;

    renderSpy.mockClear();
    for (const value of ["#111111", "#222222", "#333333"]) {
      fill.value = value;
      fill.dispatchEvent(new Event("change", { bubbles: true }));
    }

    expect(canvas.getSource()).toContain('<!-- sm:{"fill":"#333333"} -->');
    expect(renderSpy).not.toHaveBeenCalled();

    await nextFrame();
    expect(renderSpy).toHaveBeenCalledTimes(1);
    const node = host.querySelector<HTMLElement>('.simple-mind-node[data-node-id="n2"]')!;
    expect(node.style.getPropertyValue("--sm-node-bg")).toBe("#333333");

    renderSpy.mockRestore();
    canvas.destroy();
    host.remove();
  });

  it("clears a node color override back to the theme value", () => {
    const { host, canvas } = createCanvas("# Root\n- A\n");
    selectNode(host, "n2");
    const input = host.querySelector<HTMLInputElement>(".simple-mind-sidebar-node-fill")!;
    const reset = input.nextElementSibling as HTMLButtonElement;

    expect(reset.disabled).toBe(true);
    input.value = "#112233";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(reset.disabled).toBe(false);
    expect(canvas.getSource()).toContain('<!-- sm:{"fill":"#112233"} -->');

    reset.click();
    expect(reset.disabled).toBe(true);
    expect(canvas.getSource()).not.toContain("<!-- sm:");

    canvas.destroy();
    host.remove();
  });

  it("applies global connector color and thickness", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      defaultConnectorColor: "#445566",
      defaultLineWidth: 4,
    };
    const { host, canvas } = createCanvas("# Root\n- A\n", settings);

    expect(host.querySelector(".simple-mind-edge")?.getAttribute("stroke")).toBe("#445566");
    expect(
      host
        .querySelector<HTMLElement>(".simple-mind-map")
        ?.style.getPropertyValue("--sm-edge-width"),
    ).toBe("4");

    canvas.destroy();
    host.remove();
  });

  it("applies the global default font to maps without a font override", () => {
    const settings = { ...DEFAULT_SETTINGS, defaultFontFamily: "Georgia, serif" };
    const { host, canvas } = createCanvas("# Root\n- A\n", settings);

    expect(
      host.querySelector<HTMLElement>(".simple-mind-map")?.style.getPropertyValue("--sm-font"),
    ).toBe("Georgia, serif");

    canvas.destroy();
    host.remove();
  });

  it("refreshes the light and dark variants of a custom theme", () => {
    const settings = { ...DEFAULT_SETTINGS, defaultTheme: PAPER_THEME.id };
    const { host, canvas } = createCanvas("# Root\n- A\n", settings);
    const root = host.querySelector<HTMLElement>(".simple-mind-map");
    selectNode(host, "n2");
    const fill = host.querySelector<HTMLInputElement>(".simple-mind-sidebar-node-fill")!;

    document.body.classList.add("theme-dark");
    canvas.refreshTheme();
    expect(root?.style.getPropertyValue("--sm-canvas-bg")).toBe(PAPER_THEME.dark.canvasBackground);
    expect(fill.value).toBe(PAPER_THEME.dark.node.background);

    document.body.classList.remove("theme-dark");
    canvas.refreshTheme();
    expect(root?.style.getPropertyValue("--sm-canvas-bg")).toBe(PAPER_THEME.light.canvasBackground);
    expect(fill.value).toBe(PAPER_THEME.light.node.background);

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
