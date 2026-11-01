import { describe, expect, it } from "vitest";
import { resolveDropPosition } from "./DragController";

describe("resolveDropPosition", () => {
  it("uses the top and bottom quarters for reordering", () => {
    const rect = { top: 100, height: 40 };

    expect(resolveDropPosition(105, rect)).toBe("before");
    expect(resolveDropPosition(120, rect)).toBe("child");
    expect(resolveDropPosition(135, rect)).toBe("after");
  });

  it("falls back to child for empty rectangles", () => {
    expect(resolveDropPosition(10, { top: 0, height: 0 })).toBe("child");
  });
});
