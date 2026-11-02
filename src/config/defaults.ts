import type { MindMapMeta } from "../types/mindmap";
import type { SimpleMindSettings } from "../types/settings";
import { DEFAULT_THEME_ID } from "./constants";

/** Default per-file map settings. */
export const DEFAULT_MINDMAP_META: MindMapMeta = {
  version: 1,
  theme: DEFAULT_THEME_ID,
  layout: "mindmap",
  spacingX: 64,
  spacingY: 18,
  maxWidth: 280,
};

/** Default plugin settings. */
export const DEFAULT_SETTINGS: SimpleMindSettings = {
  language: "en",
  defaultTheme: DEFAULT_MINDMAP_META.theme,
  defaultLayout: DEFAULT_MINDMAP_META.layout,
  defaultSpacingX: DEFAULT_MINDMAP_META.spacingX,
  defaultSpacingY: DEFAULT_MINDMAP_META.spacingY,
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
    spacingX: settings.defaultSpacingX,
    spacingY: settings.defaultSpacingY,
    maxWidth: settings.defaultMaxWidth,
  };
}
