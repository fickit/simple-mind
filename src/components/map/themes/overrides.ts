import type { MindMapMeta } from "../../../types/mindmap";
import type { ThemeDefinition, ThemeTokens } from "../../../types/theme";

/** Applies per-file style overrides to one theme variant. */
function applyOverrides(tokens: ThemeTokens, meta: MindMapMeta): ThemeTokens {
  const shape = meta.nodeShape ?? tokens.node.shape;
  return {
    ...tokens,
    node: { ...tokens.node, shape },
    root: { ...tokens.root, shape },
    branch: {
      ...tokens.branch,
      style: meta.connectorStyle ?? tokens.branch.style,
      lineWidth: meta.lineWidth ?? tokens.branch.lineWidth,
    },
    typography: {
      ...tokens.typography,
      family: meta.fontFamily ?? tokens.typography.family,
      size: meta.fontSize ?? tokens.typography.size,
    },
  };
}

/**
 * Applies per-file style overrides on top of a theme.
 *
 * @param theme Base theme.
 * @param meta Per-file metadata.
 */
export function applyMetaOverrides(theme: ThemeDefinition, meta: MindMapMeta): ThemeDefinition {
  return {
    ...theme,
    light: applyOverrides(theme.light, meta),
    dark: applyOverrides(theme.dark, meta),
  };
}
