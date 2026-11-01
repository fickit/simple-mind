import { describe, expect, it } from "vitest";
import { DEFAULT_MINDMAP_META } from "../../../config/defaults";
import type { MindMapMeta } from "../../../types/mindmap";
import { applyMetaOverrides } from "./overrides";
import { PAPER_THEME } from "./presets";

const META: MindMapMeta = {
  ...DEFAULT_MINDMAP_META,
  nodeShape: "pill",
  connectorStyle: "straight",
  fontFamily: "Georgia, serif",
  fontSize: 18,
  lineWidth: 4,
};

describe("applyMetaOverrides", () => {
  it("applies per-file style overrides to both variants", () => {
    const theme = applyMetaOverrides(PAPER_THEME, META);

    for (const tokens of [theme.light, theme.dark]) {
      expect(tokens.node.shape).toBe("pill");
      expect(tokens.root.shape).toBe("pill");
      expect(tokens.branch.style).toBe("straight");
      expect(tokens.branch.lineWidth).toBe(4);
      expect(tokens.typography.family).toBe("Georgia, serif");
      expect(tokens.typography.size).toBe(18);
    }
  });

  it("keeps theme values when overrides are absent", () => {
    const theme = applyMetaOverrides(PAPER_THEME, DEFAULT_MINDMAP_META);

    expect(theme.light.node.shape).toBe(PAPER_THEME.light.node.shape);
    expect(theme.light.branch.style).toBe(PAPER_THEME.light.branch.style);
    expect(theme.light.typography.size).toBe(PAPER_THEME.light.typography.size);
  });
});
