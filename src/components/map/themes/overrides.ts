import type { MindMapMeta } from "../../../types/mindmap";
import type { ThemeDefinition, ThemeTokens } from "../../../types/theme";

/** Global style defaults that apply to every map. */
export interface MapStyleDefaults {
  defaultFontFamily: string;
  defaultConnectorColor: string;
  defaultLineWidth: number;
}

/** Applies per-file and global defaults to one theme variant. */
function applyOverrides(
  tokens: ThemeTokens,
  meta: MindMapMeta,
  defaults: MapStyleDefaults,
): ThemeTokens {
  return {
    ...tokens,
    branch: {
      ...tokens.branch,
      style: meta.connectorStyle ?? tokens.branch.style,
      lineWidth:
        defaults.defaultLineWidth > 0 ? defaults.defaultLineWidth : tokens.branch.lineWidth,
      overrideColor: defaults.defaultConnectorColor.trim() || undefined,
    },
    typography: {
      ...tokens.typography,
      family: defaults.defaultFontFamily.trim() || tokens.typography.family,
    },
  };
}

/**
 * Applies the file's connector shape and the global style defaults on top of a theme.
 *
 * @param theme Base theme.
 * @param meta Per-file metadata.
 * @param defaults Global style defaults from plugin settings.
 */
export function applyMetaOverrides(
  theme: ThemeDefinition,
  meta: MindMapMeta,
  defaults: MapStyleDefaults,
): ThemeDefinition {
  return {
    ...theme,
    light: applyOverrides(theme.light, meta, defaults),
    dark: applyOverrides(theme.dark, meta, defaults),
  };
}
