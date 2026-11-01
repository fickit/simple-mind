import { describe, expect, it } from "vitest";
import { DEFAULT_MINDMAP_META } from "../../../config/defaults";
import type { MindMapMeta } from "../../../types/mindmap";
import { applyMetaOverrides, type MapStyleDefaults } from "./overrides";
import { PAPER_THEME } from "./presets";

const META: MindMapMeta = {
  ...DEFAULT_MINDMAP_META,
  connectorStyle: "straight",
};

const DEFAULTS: MapStyleDefaults = {
  defaultFontFamily: "Georgia, serif",
  defaultConnectorColor: "#123456",
  defaultLineWidth: 5,
};

describe("applyMetaOverrides", () => {
  it("applies the file connector shape and global defaults to both variants", () => {
    const theme = applyMetaOverrides(PAPER_THEME, META, DEFAULTS);

    for (const variant of ["light", "dark"] as const) {
      const tokens = theme[variant];
      const base = PAPER_THEME[variant];
      expect(tokens.branch.style).toBe("straight");
      expect(tokens.branch.lineWidth).toBe(5);
      expect(tokens.branch.overrideColor).toBe("#123456");
      expect(tokens.typography.family).toBe("Georgia, serif");
      expect(tokens.typography.size).toBe(base.typography.size);
      expect(tokens.node.background).toBe(base.node.background);
    }
  });

  it("keeps theme values when the global defaults are empty", () => {
    const theme = applyMetaOverrides(PAPER_THEME, DEFAULT_MINDMAP_META, {
      defaultFontFamily: "",
      defaultConnectorColor: "",
      defaultLineWidth: 0,
    });

    expect(theme.light.branch.style).toBe(PAPER_THEME.light.branch.style);
    expect(theme.light.branch.lineWidth).toBe(PAPER_THEME.light.branch.lineWidth);
    expect(theme.light.branch.overrideColor).toBeUndefined();
    expect(theme.light.typography.family).toBe(PAPER_THEME.light.typography.family);
    expect(theme.light.typography.size).toBe(PAPER_THEME.light.typography.size);
  });
});
