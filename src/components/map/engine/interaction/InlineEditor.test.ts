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
  it("commits on Enter", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    editor.open(position, "A", { onCommit, onCancel });
    const input = world.querySelector<HTMLInputElement>(".simple-mind-inline-editor")!;
    input.value = "B";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith("B");
    expect(onCancel).not.toHaveBeenCalled();
    expect(editor.isOpen()).toBe(false);
  });

  it("cancels on Escape", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    editor.open(position, "A", { onCommit, onCancel });
    const input = world.querySelector<HTMLInputElement>(".simple-mind-inline-editor")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
    expect(editor.isOpen()).toBe(false);
  });

  it("commits on blur", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();

    editor.open(position, "A", { onCommit, onCancel: vi.fn() });
    const input = world.querySelector<HTMLInputElement>(".simple-mind-inline-editor")!;
    input.value = "Blurred";
    input.dispatchEvent(new FocusEvent("blur"));

    expect(onCommit).toHaveBeenCalledWith("Blurred");
  });

  it("ignores Enter while composing", () => {
    const { world, editor } = setup();
    const onCommit = vi.fn();

    editor.open(position, "A", { onCommit, onCancel: vi.fn() });
    const input = world.querySelector<HTMLInputElement>(".simple-mind-inline-editor")!;
    input.value = "中文";
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onCommit).not.toHaveBeenCalled();

    input.dispatchEvent(new CompositionEvent("compositionend"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith("中文");
  });
});
