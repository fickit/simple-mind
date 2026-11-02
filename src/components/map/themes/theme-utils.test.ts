// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { ThemeTokens } from "../../../types/theme";
import { OBSIDIAN_THEME } from "./presets";
import {
  cloneTheme,
  contrastRatio,
  createCustomThemeId,
  isValidTheme,
  themeFromJson,
  toHexColor,
} from "./theme-utils";

describe("theme-utils", () => {
  it("normalizes hex colors", () => {
    expect(toHexColor("#abc")).toBe("#aabbcc");
    expect(toHexColor("rgb(255, 0, 0)")).toBe("#ff0000");
  });

  it("validates theme JSON", () => {
    expect(isValidTheme(OBSIDIAN_THEME)).toBe(true);
    expect(isValidTheme({})).toBe(false);
    expect(themeFromJson("not json")).toBeNull();
  });

  it("imports a theme as a resolved custom copy", () => {
    const imported = themeFromJson(JSON.stringify(OBSIDIAN_THEME));

    expect(imported).not.toBeNull();
    expect(imported?.builtIn).toBe(false);
    expect(imported?.light.canvasBackground).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("clones with a new id and name", () => {
    const cloned = cloneTheme(OBSIDIAN_THEME, "custom-1", "Custom");

    expect(cloned.id).toBe("custom-1");
    expect(cloned.name).toBe("Custom");
    expect(cloned.builtIn).toBe(false);
    expect(createCustomThemeId([cloned])).not.toBe(cloned.id);
  });

  it("fills typography fields on themes saved by earlier versions", () => {
    const legacy = JSON.parse(JSON.stringify(OBSIDIAN_THEME)) as {
      light: { typography: Partial<ThemeTokens["typography"]> };
      dark: { typography: Partial<ThemeTokens["typography"]> };
    };
    for (const tokens of [legacy.light, legacy.dark]) {
      delete tokens.typography.fontStyle;
      delete tokens.typography.textAlign;
      delete tokens.typography.textDecoration;
    }

    const imported = themeFromJson(JSON.stringify(legacy));

    expect(imported?.light.typography.fontStyle).toBe("normal");
    expect(imported?.light.typography.textAlign).toBe("center");
    expect(imported?.light.typography.textDecoration).toBe("none");
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference pairs", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 2);
  });

  it("is symmetric in the two arguments", () => {
    expect(contrastRatio("#5c4033", "#faf6f1")).toBeCloseTo(contrastRatio("#faf6f1", "#5c4033"), 6);
  });

  it("accepts short hex colors", () => {
    expect(toHexColor("#fff")).toBe("#ffffff");
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 0);
  });
});
