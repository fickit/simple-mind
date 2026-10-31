import { describe, expect, it, vi } from "vitest";
import { parseSource } from "../parser/parser";
import { MapController } from "./MapController";

const BASE = "# Root\n- A\n  - A1\n- B\n";

function setup(source = BASE) {
  const parsed = parseSource(source);
  if (!parsed.document) throw new Error("Fixture did not parse");
  const onChange = vi.fn();
  const controller = new MapController(parsed.document, source, onChange);
  return { controller, document: parsed.document, onChange };
}

describe("MapController", () => {
  it("adds a child and writes canonical source", () => {
    const { controller, document, onChange } = setup();
    const pending = controller.beginAdd("child", document.root.id)!;

    expect(document.root.children).toHaveLength(3);
    expect(controller.getSource()).toBe(BASE);
    expect(onChange).not.toHaveBeenCalled();

    expect(controller.commitAdd(pending.node.id, "New child", pending.previousSource)).toBe(true);
    expect(controller.getSource()).toContain("- New child");
    expect(onChange).toHaveBeenCalledOnce();
    expect(controller.canUndo()).toBe(true);
  });

  it("cancels a pending child without changing source or history", () => {
    const { controller, document, onChange } = setup();
    const pending = controller.beginAdd("child", document.root.id)!;

    controller.cancelAdd(pending.node.id);
    expect(controller.getSource()).toBe(BASE);
    expect(controller.canUndo()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(document.root.children).toHaveLength(2);
  });

  it("removes a new node committed with an empty label", () => {
    const { controller, document, onChange } = setup();
    const pending = controller.beginAdd("child", document.root.id)!;

    expect(controller.commitAdd(pending.node.id, "   ", pending.previousSource)).toBe(false);
    expect(controller.getSource()).toBe(BASE);
    expect(controller.canUndo()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adds a sibling after the selected node", () => {
    const { controller, document } = setup();
    const a = document.root.children[0];
    const pending = controller.beginAdd("sibling", a.id)!;

    controller.commitAdd(pending.node.id, "A2", pending.previousSource);
    expect(controller.getSource()).toContain("- A\n  - A1\n- A2\n- B");
  });

  it("adds a child when the root is selected for a sibling command", () => {
    const { controller, document } = setup();
    const pending = controller.beginAdd("sibling", document.root.id)!;

    controller.commitAdd(pending.node.id, "Last", pending.previousSource);
    expect(controller.getSource()).toContain("- B\n- Last");
  });

  it("renames a node and supports undo and redo", () => {
    const { controller, document } = setup();
    const a = document.root.children[0];

    expect(controller.rename(a.id, "Renamed")).toBe(true);
    expect(controller.getSource()).toContain("- Renamed");
    expect(controller.undo()).toBe(true);
    expect(controller.getSource()).toBe(BASE);
    expect(controller.redo()).toBe(true);
    expect(controller.getSource()).toContain("- Renamed");
  });

  it("rejects empty renames", () => {
    const { controller, document } = setup();
    const a = document.root.children[0];

    expect(controller.rename(a.id, " ")).toBe(false);
    expect(controller.getSource()).toBe(BASE);
  });

  it("deletes a node but protects the root", () => {
    const { controller, document } = setup();
    const a = document.root.children[0];

    expect(controller.deleteNode(document.root.id)).toBeNull();
    expect(controller.deleteNode(a.id)).not.toBeNull();
    expect(controller.getSource()).not.toContain("- A");
    expect(controller.getSource()).toContain("- B");
  });

  it("moves a node under another node", () => {
    const { controller, document } = setup();
    const a = document.root.children[0];
    const b = document.root.children[1];

    expect(controller.moveNode(b.id, a.id, "child")).toBe(true);
    expect(controller.getSource()).toContain("- A\n  - A1\n  - B");
    expect(controller.getSource()).not.toContain("\n- B");
  });

  it("moves a node before a sibling", () => {
    const { controller, document } = setup();
    const a = document.root.children[0];
    const b = document.root.children[1];

    expect(controller.moveNode(b.id, a.id, "before")).toBe(true);
    expect(controller.getSource()).toContain("- B\n- A\n  - A1");
  });

  it("rejects moving a node into its own descendant", () => {
    const { controller, document } = setup();
    const a = document.root.children[0];
    const a1 = a.children[0];

    expect(controller.moveNode(a.id, a1.id, "child")).toBe(false);
    expect(controller.getSource()).toBe(BASE);
  });

  it("toggles collapse without changing source or history", () => {
    const { controller, document, onChange } = setup();
    const a = document.root.children[0];

    expect(controller.toggleCollapse(a.id)).toBe(true);
    expect(a.collapsed).toBe(true);
    expect(controller.getSource()).toBe(BASE);
    expect(controller.canUndo()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("expands a collapsed target when adding a child", () => {
    const { controller, document } = setup();
    const a = document.root.children[0];
    a.collapsed = true;
    const pending = controller.beginAdd("child", a.id)!;

    expect(a.collapsed).toBe(false);
    controller.commitAdd(pending.node.id, "Child", pending.previousSource);
    expect(controller.getSource()).toContain("  - Child");
  });

  it("preserves frontmatter and unknown keys", () => {
    const source =
      "---\naliases:\n  - Plan\nmindmap:\n  theme: paper\n  custom: keep\n---\n# Root\n- A\n";
    const { controller, document } = setup(source);
    const pending = controller.beginAdd("child", document.root.id)!;

    controller.commitAdd(pending.node.id, "New", pending.previousSource);
    expect(controller.getSource()).toContain("aliases:");
    expect(controller.getSource()).toContain("theme: paper");
    expect(controller.getSource()).toContain("custom: keep");
  });
});
