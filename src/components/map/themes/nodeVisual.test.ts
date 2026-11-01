import { describe, expect, it } from "vitest";
import { nodeVisual } from "./nodeVisual";
import { OBSIDIAN_THEME } from "./presets";

const TOKENS = OBSIDIAN_THEME.light;

describe("nodeVisual", () => {
  it("uses theme values when the node has no style", () => {
    const visual = nodeVisual(TOKENS, undefined, false);

    expect(visual.shape).toBe(TOKENS.node.shape);
    expect(visual.background).toBe(TOKENS.node.background);
    expect(visual.border).toBe(TOKENS.node.border);
    expect(visual.fontFamily).toBe(TOKENS.typography.family);
    expect(visual.fontWeight).toBe(TOKENS.typography.weight);
  });

  it("applies per-node overrides and keeps root weight by default", () => {
    const visual = nodeVisual(
      TOKENS,
      {
        shape: "pill",
        fill: "#101010",
        borderColor: "#202020",
        borderWidth: 3,
        fontFamily: "Georgia",
        fontSize: 18,
        textColor: "#303030",
        bold: false,
        italic: true,
        underline: true,
        textAlign: "left",
        lineHeight: 2,
      },
      true,
    );

    expect(visual.shape).toBe("pill");
    expect(visual.background).toBe("#101010");
    expect(visual.border).toBe("#202020");
    expect(visual.borderWidth).toBe(3);
    expect(visual.fontFamily).toBe("Georgia");
    expect(visual.fontSize).toBe(18);
    expect(visual.text).toBe("#303030");
    expect(visual.fontWeight).toBe(400);
    expect(visual.fontStyle).toBe("italic");
    expect(visual.textDecoration).toBe("underline");
    expect(visual.textAlign).toBe("left");
    expect(visual.lineHeight).toBe(2);
  });

  it("defaults the root to a bold weight", () => {
    expect(nodeVisual(TOKENS, undefined, true).fontWeight).toBe(600);
  });
});
