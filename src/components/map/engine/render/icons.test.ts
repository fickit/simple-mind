// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { iconNames, setIcon, setText } from "./icons";

describe("setIcon", () => {
  it("draws at least one shape for every icon name", () => {
    for (const name of iconNames()) {
      const button = document.createElement("button");
      setIcon(button, name);
      expect(button.querySelector("svg.simple-mind-icon")).not.toBeNull();
      expect(button.querySelector("svg")?.childElementCount).toBeGreaterThan(0);
    }
  });

  it("draws letterforms as text and shapes as paths", () => {
    const bold = document.createElement("button");
    setIcon(bold, "bold");
    expect(bold.querySelector("text")?.textContent).toBe("B");
    expect(bold.querySelector("text")?.getAttribute("font-weight")).toBe("700");

    const shape = document.createElement("button");
    setIcon(shape, "shape-pill");
    expect(shape.querySelector("path")).not.toBeNull();
    expect(shape.querySelector("text")).toBeNull();
  });

  it("draws one hidden svg and skips a repeated call", () => {
    const button = document.createElement("button");

    setIcon(button, "chevron-right");
    const first = button.firstElementChild;
    expect(first?.tagName.toLowerCase()).toBe("svg");
    expect(first?.getAttribute("aria-hidden")).toBe("true");
    expect(button.querySelectorAll("path")).toHaveLength(1);
    expect(button.dataset.icon).toBe("chevron-right");

    setIcon(button, "chevron-right");
    expect(button.firstElementChild).toBe(first);

    setIcon(button, "plus");
    expect(button.querySelectorAll("path")).toHaveLength(2);
    expect(button.firstElementChild).not.toBe(first);
  });
});

describe("setText", () => {
  it("replaces the icon with text for count bubbles", () => {
    const button = document.createElement("button");
    setIcon(button, "close");

    setText(button, "12");
    expect(button.textContent).toBe("12");
    expect(button.firstElementChild).toBeNull();
    expect(button.dataset.icon).toBeUndefined();
  });
});
