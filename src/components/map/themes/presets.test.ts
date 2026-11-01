import { describe, expect, it } from "vitest";
import type { ThemeDefinition } from "../../../types/theme";
import {
  BUILT_IN_THEMES,
  createObsidianCustomTheme,
  getBuiltInTheme,
  OBSIDIAN_THEME,
  resolveTheme,
} from "./presets";

describe("built-in themes", () => {
  it("ships eight unique themes", () => {
    expect(BUILT_IN_THEMES).toHaveLength(8);
    expect(new Set(BUILT_IN_THEMES.map((theme) => theme.id)).size).toBe(8);
    expect(BUILT_IN_THEMES.every((theme) => theme.name.length > 0)).toBe(true);
  });

  it("provides complete light and dark token sets", () => {
    for (const theme of BUILT_IN_THEMES) {
      for (const tokens of [theme.light, theme.dark]) {
        expect(tokens.branch.palette.length).toBeGreaterThan(0);
        expect(tokens.typography.size).toBeGreaterThan(0);
        expect(["rounded", "pill", "underline", "plain"]).toContain(tokens.node.shape);
        expect(["curve", "orthogonal"]).toContain(tokens.branch.style);
      }
    }
  });

  it("falls back to the native theme for unknown ids", () => {
    expect(getBuiltInTheme("missing")).toBe(OBSIDIAN_THEME);
    expect(getBuiltInTheme("nord").id).toBe("nord");
  });

  it("resolves custom themes before built-ins", () => {
    const custom: ThemeDefinition = {
      ...OBSIDIAN_THEME,
      id: "custom-1",
      name: "Custom",
      builtIn: false,
    };
    expect(resolveTheme("custom-1", [custom])).toBe(custom);
    expect(resolveTheme("nord", [custom]).id).toBe("nord");
  });

  it("creates an editable Obsidian theme with distinct light and dark colors", () => {
    const custom = createObsidianCustomTheme("custom-1", "Custom");

    expect(custom.builtIn).toBe(false);
    expect(custom.light.canvasBackground).not.toBe(custom.dark.canvasBackground);
    expect(custom.light.node.background).not.toBe(custom.dark.node.background);
  });
});
