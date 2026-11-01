import { LIMITS } from "../../../../config/constants";
import type { NodeStyle, ParseWarning } from "../../../../types/mindmap";
import type { NodeShape, TextAlign } from "../../../../types/theme";

const NODE_SHAPES: NodeShape[] = ["rounded", "pill", "underline", "plain"];
const TEXT_ALIGNMENTS: TextAlign[] = ["left", "center", "right"];
const STYLE_PATTERN = /\s*<!--\s*sm:(\{[\s\S]*\})\s*-->\s*$/;

/** Result of separating a node label from its inline style marker. */
export interface ParsedNodeLabel {
  label: string;
  style?: NodeStyle;
}

/** Reads a non-empty string field from a style object. */
function readString(
  record: Record<string, unknown>,
  key: string,
  line: number,
  warnings: ParseWarning[],
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    warnings.push({ line, message: `Node style ${key} must be a non-empty string.` });
    return undefined;
  }
  return value.trim();
}

/** Reads a clamped numeric field from a style object. */
function readNumber(
  record: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  line: number,
  warnings: ParseWarning[],
): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    warnings.push({ line, message: `Node style ${key} must be a number.` });
    return undefined;
  }
  const clamped = Math.min(max, Math.max(min, value));
  if (clamped !== value) {
    warnings.push({
      line,
      message: `Node style ${key} must be between ${min} and ${max}; using ${clamped}.`,
    });
  }
  return clamped;
}

/** Reads a boolean field from a style object. */
function readBoolean(
  record: Record<string, unknown>,
  key: string,
  line: number,
  warnings: ParseWarning[],
): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    warnings.push({ line, message: `Node style ${key} must be true or false.` });
    return undefined;
  }
  return value;
}

/** Reads a fixed-set string field from a style object. */
function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  line: number,
  warnings: ParseWarning[],
): T | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    warnings.push({
      line,
      message: `Node style ${key} must be one of ${allowed.join(", ")}.`,
    });
    return undefined;
  }
  return value as T;
}

/** Parses the JSON payload of one inline style marker. */
function parseNodeStyle(
  raw: string,
  line: number,
  warnings: ParseWarning[],
): NodeStyle | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    warnings.push({ line, message: "Node style is not valid JSON; the marker is ignored." });
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    warnings.push({ line, message: "Node style must be a JSON object; the marker is ignored." });
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const style: NodeStyle = {};
  const shape = readEnum(record, "shape", NODE_SHAPES, line, warnings);
  const fill = readString(record, "fill", line, warnings);
  const borderColor = readString(record, "borderColor", line, warnings);
  const borderWidth = readNumber(
    record,
    "borderWidth",
    LIMITS.nodeBorderWidth.min,
    LIMITS.nodeBorderWidth.max,
    line,
    warnings,
  );
  const fontFamily = readString(record, "fontFamily", line, warnings);
  const fontSize = readNumber(
    record,
    "fontSize",
    LIMITS.fontSize.min,
    LIMITS.fontSize.max,
    line,
    warnings,
  );
  const textColor = readString(record, "textColor", line, warnings);
  const bold = readBoolean(record, "bold", line, warnings);
  const italic = readBoolean(record, "italic", line, warnings);
  const underline = readBoolean(record, "underline", line, warnings);
  const textAlign = readEnum(record, "textAlign", TEXT_ALIGNMENTS, line, warnings);
  const lineHeight = readNumber(
    record,
    "lineHeight",
    LIMITS.lineHeight.min,
    LIMITS.lineHeight.max,
    line,
    warnings,
  );

  if (shape !== undefined) style.shape = shape;
  if (fill !== undefined) style.fill = fill;
  if (borderColor !== undefined) style.borderColor = borderColor;
  if (borderWidth !== undefined) style.borderWidth = borderWidth;
  if (fontFamily !== undefined) style.fontFamily = fontFamily;
  if (fontSize !== undefined) style.fontSize = fontSize;
  if (textColor !== undefined) style.textColor = textColor;
  if (bold !== undefined) style.bold = bold;
  if (italic !== undefined) style.italic = italic;
  if (underline !== undefined) style.underline = underline;
  if (textAlign !== undefined) style.textAlign = textAlign;
  if (lineHeight !== undefined) style.lineHeight = lineHeight;

  return Object.keys(style).length > 0 ? style : undefined;
}

/**
 * Splits a label from a trailing `<!-- sm:{...} -->` style marker.
 *
 * @param text Raw heading or list label.
 * @param line One-based source line for warnings.
 * @param warnings Warning collector.
 */
export function extractNodeLabel(
  text: string,
  line: number,
  warnings: ParseWarning[],
): ParsedNodeLabel {
  const match = STYLE_PATTERN.exec(text);
  if (!match) return { label: text.trim() };

  const label = text.slice(0, match.index).trim();
  const style = parseNodeStyle(match[1], line, warnings);
  return { label, style };
}

/**
 * Serializes a style object into the suffix appended to a node label.
 *
 * @param style Per-node style overrides.
 */
export function serializeNodeStyle(style: NodeStyle | undefined): string {
  if (!style) return "";

  const record: Record<string, unknown> = {};
  if (style.shape !== undefined) record.shape = style.shape;
  if (style.fill !== undefined) record.fill = style.fill;
  if (style.borderColor !== undefined) record.borderColor = style.borderColor;
  if (style.borderWidth !== undefined) record.borderWidth = style.borderWidth;
  if (style.fontFamily !== undefined) record.fontFamily = style.fontFamily;
  if (style.fontSize !== undefined) record.fontSize = style.fontSize;
  if (style.textColor !== undefined) record.textColor = style.textColor;
  if (style.bold !== undefined) record.bold = style.bold;
  if (style.italic !== undefined) record.italic = style.italic;
  if (style.underline !== undefined) record.underline = style.underline;
  if (style.textAlign !== undefined) record.textAlign = style.textAlign;
  if (style.lineHeight !== undefined) record.lineHeight = style.lineHeight;

  const keys = Object.keys(record);
  return keys.length === 0 ? "" : ` <!-- sm:${JSON.stringify(record)} -->`;
}

/** Returns a shallow copy so clipboard nodes do not share style objects. */
export function cloneNodeStyle(style: NodeStyle | undefined): NodeStyle | undefined {
  return style ? { ...style } : undefined;
}
