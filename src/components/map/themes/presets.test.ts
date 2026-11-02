import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID } from "../../../config/constants";
import type { ThemeDefinition } from "../../../types/theme";
import {
  BUILT_IN_THEMES,
  createObsidianCustomTheme,
  getBuiltInTheme,
  MEADOW_THEME,
  OBSIDIAN_THEME,
  resolveTheme,
} from "./presets";
import { contrastRatio } from "./theme-utils";

describe("built-in themes", () => {
  it("ships nine unique themes", () => {
    expect(BUILT_IN_THEMES).toHaveLength(9);
    expect(new Set(BUILT_IN_THEMES.map((theme) => theme.id)).size).toBe(9);
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

  it("falls back to the default theme for unknown ids", () => {
    expect(getBuiltInTheme("missing")).toBe(MEADOW_THEME);
    expect(getBuiltInTheme("nord").id).toBe("nord");
    expect(MEADOW_THEME.id).toBe(DEFAULT_THEME_ID);
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

describe("Meadow theme", () => {
  it("keeps node and root label text at WCAG AA", () => {
    for (const tokens of [MEADOW_THEME.light, MEADOW_THEME.dark]) {
      expect(contrastRatio(tokens.node.text, tokens.node.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.root.text, tokens.root.background)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(tokens.collapse.text, tokens.collapse.background),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses small radii and serif labels", () => {
    expect(MEADOW_THEME.light.node.radius).toBe(5);
    expect(MEADOW_THEME.dark.node.radius).toBe(5);
    expect(MEADOW_THEME.light.root.shape).toBe("rounded");
    expect(MEADOW_THEME.light.typography.family).toContain("serif");
  });

  it("keeps cool colors auxiliary rather than primary", () => {
    for (const tokens of [MEADOW_THEME.light, MEADOW_THEME.dark]) {
      const cool = tokens.branch.palette.filter((color) => {
        const red = Number.parseInt(color.slice(1, 3), 16);
        const blue = Number.parseInt(color.slice(5, 7), 16);
        return blue > red + 40;
      });
      expect(cool.length).toBeLessThanOrEqual(2);
    }
  });
});
