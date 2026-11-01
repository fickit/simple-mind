import { describe, expect, it } from "vitest";
import { BUILT_IN_THEMES, getBuiltInTheme, OBSIDIAN_THEME } from "./presets";

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
        expect(["curve", "orthogonal", "straight"]).toContain(tokens.branch.style);
      }
    }
  });

  it("falls back to the native theme for unknown ids", () => {
    expect(getBuiltInTheme("missing")).toBe(OBSIDIAN_THEME);
    expect(getBuiltInTheme("nord").id).toBe("nord");
  });
});
