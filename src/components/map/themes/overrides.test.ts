import { describe, expect, it } from "vitest";
import { DEFAULT_MINDMAP_META } from "../../../config/defaults";
import type { MindMapMeta } from "../../../types/mindmap";
import { applyMetaOverrides } from "./overrides";
import { PAPER_THEME } from "./presets";

const META: MindMapMeta = {
  ...DEFAULT_MINDMAP_META,
  nodeShape: "pill",
  nodeFillColor: "#101010",
  nodeBorderColor: "#202020",
  nodeBorderWidth: 3,
  connectorStyle: "straight",
  connectorColor: "#303030",
  fontFamily: "Georgia, serif",
  fontSize: 18,
  lineWidth: 4,
  textColor: "#404040",
  bold: true,
  italic: true,
  underline: true,
  textAlign: "left",
  lineHeight: 2,
};

describe("applyMetaOverrides", () => {
  it("applies per-file style overrides to both variants", () => {
    const theme = applyMetaOverrides(PAPER_THEME, META);

    for (const tokens of [theme.light, theme.dark]) {
      expect(tokens.node.shape).toBe("pill");
      expect(tokens.root.shape).toBe("pill");
      expect(tokens.node.background).toBe("#101010");
      expect(tokens.root.background).toBe("#101010");
      expect(tokens.node.border).toBe("#202020");
      expect(tokens.root.border).toBe("#202020");
      expect(tokens.node.borderWidth).toBe(3);
      expect(tokens.root.borderWidth).toBe(3);
      expect(tokens.node.text).toBe("#404040");
      expect(tokens.root.text).toBe("#404040");
      expect(tokens.branch.style).toBe("straight");
      expect(tokens.branch.lineWidth).toBe(4);
      expect(tokens.branch.overrideColor).toBe("#303030");
      expect(tokens.typography.family).toBe("Georgia, serif");
      expect(tokens.typography.size).toBe(18);
      expect(tokens.typography.weight).toBe(600);
      expect(tokens.typography.fontStyle).toBe("italic");
      expect(tokens.typography.textDecoration).toBe("underline");
      expect(tokens.typography.textAlign).toBe("left");
      expect(tokens.typography.lineHeight).toBe(2);
    }
  });

  it("keeps theme values when overrides are absent", () => {
    const theme = applyMetaOverrides(PAPER_THEME, DEFAULT_MINDMAP_META);

    expect(theme.light.node.shape).toBe(PAPER_THEME.light.node.shape);
    expect(theme.light.node.background).toBe(PAPER_THEME.light.node.background);
    expect(theme.light.node.border).toBe(PAPER_THEME.light.node.border);
    expect(theme.light.node.text).toBe(PAPER_THEME.light.node.text);
    expect(theme.light.branch.style).toBe(PAPER_THEME.light.branch.style);
    expect(theme.light.branch.overrideColor).toBeUndefined();
    expect(theme.light.typography.size).toBe(PAPER_THEME.light.typography.size);
    expect(theme.light.typography.weight).toBe(PAPER_THEME.light.typography.weight);
    expect(theme.light.typography.fontStyle).toBe(PAPER_THEME.light.typography.fontStyle);
    expect(theme.light.typography.textAlign).toBe(PAPER_THEME.light.typography.textAlign);
    expect(theme.light.typography.lineHeight).toBe(PAPER_THEME.light.typography.lineHeight);
  });
});
