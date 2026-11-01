import type { MindMapMeta } from "../types/mindmap";
import type { SimpleMindSettings } from "../types/settings";

/** Default per-file map settings. */
export const DEFAULT_MINDMAP_META: MindMapMeta = {
  version: 1,
  theme: "obsidian",
  layout: "mindmap",
  direction: "right",
  spacingX: 64,
  spacingY: 18,
  align: "center",
  compact: false,
  maxWidth: 280,
};

/** Default plugin settings. */
export const DEFAULT_SETTINGS: SimpleMindSettings = {
  language: "en",
  defaultTheme: DEFAULT_MINDMAP_META.theme,
  defaultLayout: DEFAULT_MINDMAP_META.layout,
  defaultDirection: DEFAULT_MINDMAP_META.direction,
  defaultSpacingX: DEFAULT_MINDMAP_META.spacingX,
  defaultSpacingY: DEFAULT_MINDMAP_META.spacingY,
  defaultAlign: DEFAULT_MINDMAP_META.align,
  defaultCompact: DEFAULT_MINDMAP_META.compact,
  defaultMaxWidth: DEFAULT_MINDMAP_META.maxWidth,
  defaultFontFamily: "",
  defaultConnectorColor: "",
  defaultLineWidth: 0,
  customThemes: [],
  restoreSourceCursor: true,
};

/**
 * Converts plugin defaults into per-file fallback metadata.
 *
 * @param settings Current plugin settings.
 */
export function metaFromSettings(settings: SimpleMindSettings): MindMapMeta {
  return {
    version: 1,
    theme: settings.defaultTheme,
    layout: settings.defaultLayout,
    direction: settings.defaultDirection,
    spacingX: settings.defaultSpacingX,
    spacingY: settings.defaultSpacingY,
    align: settings.defaultAlign,
    compact: settings.defaultCompact,
    maxWidth: settings.defaultMaxWidth,
  };
}
