import type { NodeStyle } from "../../../types/mindmap";
import type { NodeShape, TextAlign, ThemeTokens } from "../../../types/theme";

/** Resolved visual values for one node after applying its overrides. */
export interface NodeVisual {
  shape: NodeShape;
  background: string;
  text: string;
  border: string;
  borderWidth: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  lineHeight: number;
  textAlign: TextAlign;
  textDecoration: "none" | "underline";
}

/**
 * Resolves the effective visual tokens for one node.
 *
 * @param tokens Active theme tokens.
 * @param style Per-node overrides, if any.
 * @param isRoot Whether the node uses root tokens.
 */
export function nodeVisual(
  tokens: ThemeTokens,
  style: NodeStyle | undefined,
  isRoot: boolean,
): NodeVisual {
  const base = isRoot ? tokens.root : tokens.node;
  const defaultWeight = isRoot ? 600 : tokens.typography.weight;

  return {
    shape: style?.shape ?? base.shape,
    background: style?.fill ?? base.background,
    text: style?.textColor ?? base.text,
    border: style?.borderColor ?? base.border,
    borderWidth: style?.borderWidth ?? base.borderWidth,
    fontFamily: style?.fontFamily ?? tokens.typography.family,
    fontSize: style?.fontSize ?? tokens.typography.size,
    fontWeight: style?.bold === undefined ? defaultWeight : style.bold ? 600 : 400,
    fontStyle:
      style?.italic === undefined
        ? tokens.typography.fontStyle
        : style.italic
          ? "italic"
          : "normal",
    lineHeight: style?.lineHeight ?? tokens.typography.lineHeight,
    textAlign: style?.textAlign ?? tokens.typography.textAlign,
    textDecoration:
      style?.underline === undefined
        ? tokens.typography.textDecoration
        : style.underline
          ? "underline"
          : "none",
  };
}
