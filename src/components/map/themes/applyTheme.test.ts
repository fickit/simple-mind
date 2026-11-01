// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyTheme } from "./applyTheme";
import { createObsidianCustomTheme } from "./presets";

describe("applyTheme", () => {
  it("applies distinct light and dark token sets", () => {
    const host = document.createElement("div");
    const theme = createObsidianCustomTheme("custom-1", "Custom");

    applyTheme(host, theme, false);
    expect(host.style.getPropertyValue("--sm-canvas-bg")).toBe("#ffffff");

    applyTheme(host, theme, true);
    expect(host.style.getPropertyValue("--sm-canvas-bg")).toBe("#1e1e1e");
  });
});
