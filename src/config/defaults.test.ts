import { describe, expect, it } from "vitest";
import type { LayoutKind } from "../types/mindmap";
import { LIMITS } from "./constants";
import { DEFAULT_MINDMAP_META, DEFAULT_SETTINGS, metaFromSettings } from "./defaults";

describe("defaults", () => {
  it("uses the same theme in settings and per-file metadata", () => {
    expect(DEFAULT_MINDMAP_META.theme).toBe(DEFAULT_SETTINGS.defaultTheme);
  });

  it("uses a supported layout", () => {
    const layouts: LayoutKind[] = ["mindmap", "tree-left", "tree-right", "org"];
    expect(layouts).toContain(DEFAULT_MINDMAP_META.layout);
  });

  it("keeps numeric defaults inside their limits", () => {
    expect(DEFAULT_MINDMAP_META.spacingX).toBeGreaterThanOrEqual(LIMITS.spacingX.min);
    expect(DEFAULT_MINDMAP_META.spacingX).toBeLessThanOrEqual(LIMITS.spacingX.max);
    expect(DEFAULT_MINDMAP_META.spacingY).toBeGreaterThanOrEqual(LIMITS.spacingY.min);
    expect(DEFAULT_MINDMAP_META.spacingY).toBeLessThanOrEqual(LIMITS.spacingY.max);
    expect(DEFAULT_MINDMAP_META.maxWidth).toBeGreaterThanOrEqual(LIMITS.maxWidth.min);
    expect(DEFAULT_MINDMAP_META.maxWidth).toBeLessThanOrEqual(LIMITS.maxWidth.max);
  });

  it("keeps global style defaults out of per-file metadata", () => {
    const meta = metaFromSettings({
      ...DEFAULT_SETTINGS,
      defaultFontFamily: "Georgia, serif",
      defaultConnectorColor: "#123456",
      defaultLineWidth: 4,
    });

    expect(meta).toEqual(DEFAULT_MINDMAP_META);
  });
});
