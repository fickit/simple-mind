// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { PositionedNode } from "../layout/types";
import { InlineEditor } from "./InlineEditor";

const position: PositionedNode = {
  node: { id: "n1", text: "A", children: [], collapsed: false },
  x: 10,
  y: 20,
  width: 100,
  height: 30,
  depth: 1,
  side: "right",
  parentId: null,
};

function setup() {
  const world = document.createElement("div");
  document.body.appendChild(world);
  const editor = new InlineEditor(world);
  return { world, editor };
}

describe("InlineEditor", () => {
  it("commits and requests a sibling on Enter", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    editor.open(position, "A", { onCommit, onCancel });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.value = "B";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith("B", "sibling");
    expect(onCancel).not.toHaveBeenCalled();
    expect(editor.isOpen()).toBe(false);
  });

  it("commits and requests a child on Tab", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();

    editor.open(position, "A", { onCommit, onCancel: vi.fn() });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.value = "Child";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith("Child", "child");
  });

  it("commits without a follow-up action on Ctrl/Cmd+Enter", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();

    editor.open(position, "A", { onCommit, onCancel: vi.fn() });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.value = "Only";
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
    );

    expect(onCommit).toHaveBeenCalledWith("Only", "none");
  });

  it("cancels on Escape", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    editor.open(position, "A", { onCommit, onCancel });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
    expect(editor.isOpen()).toBe(false);
  });

  it("commits on blur", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();

    editor.open(position, "A", { onCommit, onCancel: vi.fn() });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.value = "Blurred";
    input.dispatchEvent(new FocusEvent("blur"));

    expect(onCommit).toHaveBeenCalledWith("Blurred", "none");
  });

  it("ignores Enter while composing", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();

    editor.open(position, "A", { onCommit, onCancel: vi.fn() });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.value = "中文";
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onCommit).not.toHaveBeenCalled();

    input.dispatchEvent(new CompositionEvent("compositionend"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith("中文", "sibling");
  });

  it("shows note suggestions and inserts the chosen link", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();
    const suggest = vi.fn(() => [{ label: "Plan", detail: "Plan.md", insert: "Plan" }]);

    editor.open(position, "", { onCommit, onCancel: vi.fn() }, { suggest });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.value = "[[Pl";
    input.setSelectionRange(4, 4);
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(suggest).toHaveBeenCalledWith("link", "Pl");
    expect(world.querySelectorAll(".simple-mind-suggest-item")).toHaveLength(1);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(input.value).toBe("[[Plan]]");
    expect(onCommit).not.toHaveBeenCalled();
    expect(world.querySelector(".simple-mind-suggest")).toBeNull();

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith("[[Plan]]", "sibling");
  });

  it("searches images for an embed trigger", () => {
    const { world, editor } = setup();
    const suggest = vi.fn(() => [{ label: "photo", detail: "photo.png", insert: "photo.png" }]);

    editor.open(position, "", { onCommit: vi.fn(), onCancel: vi.fn() }, { suggest });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.value = "![[ph";
    input.setSelectionRange(5, 5);
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(suggest).toHaveBeenCalledWith("image", "ph");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(input.value).toBe("![[photo.png]]");
  });

  it("closes suggestions with Escape before cancelling", () => {
    const { world, editor } = setup();
    const onCancel = vi.fn();
    const suggest = vi.fn(() => [{ label: "Plan", detail: "Plan.md", insert: "Plan" }]);

    editor.open(position, "", { onCommit: vi.fn(), onCancel }, { suggest });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.value = "[[Pl";
    input.setSelectionRange(4, 4);
    input.dispatchEvent(new Event("input", { bubbles: true }));

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(world.querySelector(".simple-mind-suggest")).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    expect(editor.isOpen()).toBe(true);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it("keeps the active suggestion while moving with arrows", () => {
    const { world, editor } = setup();
    const suggest = vi.fn(() => [
      { label: "Alpha", detail: "Alpha.md", insert: "Alpha" },
      { label: "Beta", detail: "Beta.md", insert: "Beta" },
    ]);

    editor.open(position, "", { onCommit: vi.fn(), onCancel: vi.fn() }, { suggest });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.value = "[[";
    input.setSelectionRange(2, 2);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const rows = Array.from(world.querySelectorAll(".simple-mind-suggest-item"));

    expect(rows[0].classList.contains("is-active")).toBe(true);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowDown", bubbles: true }));
    expect(rows[1].classList.contains("is-active")).toBe(true);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowUp", bubbles: true }));
    expect(rows[0].classList.contains("is-active")).toBe(true);
  });
});

describe("InlineEditor line breaks", () => {
  it("inserts a line break with Shift+Enter and commits with Ctrl+Enter", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();

    editor.open(position, "AB", { onCommit, onCancel: vi.fn() });
    const input = world.querySelector<HTMLTextAreaElement>(".simple-mind-inline-editor")!;
    input.setSelectionRange(1, 1);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }),
    );

    expect(input.value).toBe("A\nB");
    expect(onCommit).not.toHaveBeenCalled();
    expect(editor.isOpen()).toBe(true);

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
    );
    expect(onCommit).toHaveBeenCalledWith("A\nB", "none");
  });
});
