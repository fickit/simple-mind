import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT } from "../../../../config/constants";
import { SourceHistory } from "./SourceHistory";

describe("SourceHistory", () => {
  it("undoes and redoes source snapshots", () => {
    const history = new SourceHistory();
    history.push("a");
    history.push("b");

    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
    expect(history.undo("c")).toBe("b");
    expect(history.undo("b")).toBe("a");
    expect(history.undo("a")).toBeNull();
    expect(history.redo("a")).toBe("b");
    expect(history.redo("b")).toBe("c");
    expect(history.redo("c")).toBeNull();
  });

  it("clears redo when a new mutation is recorded", () => {
    const history = new SourceHistory();
    history.push("a");
    expect(history.undo("b")).toBe("a");
    history.push("c");

    expect(history.canRedo()).toBe(false);
  });

  it("keeps the undo stack bounded", () => {
    const history = new SourceHistory();
    for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
      history.push(`source-${index}`);
    }

    let count = 0;
    let current = "current";
    while (history.undo(current) !== null) {
      current = `undo-${count}`;
      count += 1;
    }
    expect(count).toBe(HISTORY_LIMIT);
  });
});
