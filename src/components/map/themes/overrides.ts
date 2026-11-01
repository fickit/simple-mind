import type { MindMapMeta } from "../../../types/mindmap";
import type { ThemeDefinition, ThemeTokens } from "../../../types/theme";

/** Applies per-file style overrides to one theme variant. */
function applyOverrides(tokens: ThemeTokens, meta: MindMapMeta): ThemeTokens {
  return {
    ...tokens,
    node: {
      ...tokens.node,
      shape: meta.nodeShape ?? tokens.node.shape,
      background: meta.nodeFillColor ?? tokens.node.background,
      border: meta.nodeBorderColor ?? tokens.node.border,
      borderWidth: meta.nodeBorderWidth ?? tokens.node.borderWidth,
      text: meta.textColor ?? tokens.node.text,
    },
    root: {
      ...tokens.root,
      shape: meta.nodeShape ?? tokens.root.shape,
      background: meta.nodeFillColor ?? tokens.root.background,
      border: meta.nodeBorderColor ?? tokens.root.border,
      borderWidth: meta.nodeBorderWidth ?? tokens.root.borderWidth,
      text: meta.textColor ?? tokens.root.text,
    },
    branch: {
      ...tokens.branch,
      style: meta.connectorStyle ?? tokens.branch.style,
      lineWidth: meta.lineWidth ?? tokens.branch.lineWidth,
      overrideColor: meta.connectorColor ?? tokens.branch.overrideColor,
    },
    typography: {
      ...tokens.typography,
      family: meta.fontFamily ?? tokens.typography.family,
      size: meta.fontSize ?? tokens.typography.size,
      weight: meta.bold === undefined ? tokens.typography.weight : meta.bold ? 600 : 400,
      fontStyle:
        meta.italic === undefined ? tokens.typography.fontStyle : meta.italic ? "italic" : "normal",
      textAlign: meta.textAlign ?? tokens.typography.textAlign,
      textDecoration:
        meta.underline === undefined
          ? tokens.typography.textDecoration
          : meta.underline
            ? "underline"
            : "none",
      lineHeight: meta.lineHeight ?? tokens.typography.lineHeight,
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
