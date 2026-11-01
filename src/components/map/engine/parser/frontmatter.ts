import { LIMITS } from "../../../../config/constants";
import type { MindMapMeta, ParseError, ParseWarning } from "../../../../types/mindmap";
import type { ConnectorStyle } from "../../../../types/theme";

/** Result of splitting a source file into frontmatter and body. */
export interface FrontmatterSplit {
  raw: string | null;
  body: string;
  bodyStartLine: number;
  errors: ParseError[];
}

/** Parsed metadata plus the raw frontmatter lines that must be preserved. */
export interface MetaParseResult {
  meta: MindMapMeta;
  otherLines: string[];
  extraLines: string[];
  warnings: ParseWarning[];
}

/** Normalizes line endings so all line numbers use one convention. */
export function normalizeSource(source: string): string {
  return source.replace(/\r\n?/g, "\n");
}

/**
 * Splits YAML frontmatter from the Markdown body.
 *
 * @param source Full file content.
 */
export function splitFrontmatter(source: string): FrontmatterSplit {
  const normalized = normalizeSource(source);
  const lines = normalized.split("\n");

  if (lines[0]?.trim() !== "---") {
    return {
      raw: null,
      body: normalized,
      bodyStartLine: 1,
      errors: [],
    };
  }

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) {
    return {
      raw: null,
      body: normalized,
      bodyStartLine: 1,
      errors: [
        {
          line: 1,
          message: "Frontmatter is not closed with a --- line.",
        },
      ],
    };
  }

  return {
    raw: lines.slice(1, end).join("\n"),
    body: lines.slice(end + 1).join("\n"),
    bodyStartLine: end + 2,
    errors: [],
  };
}

/** Reads a quoted or plain YAML scalar. */
function readScalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Formats a string for the simple YAML block emitted by the plugin. */
function writeScalar(value: string): string {
  if (/^[A-Za-z0-9._:-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

/** Reads a finite number and clamps it into the provided range. */
function readNumber(
  value: string,
  fallback: number,
  min: number,
  max: number,
  line: number,
  name: string,
  warnings: ParseWarning[],
): number {
  const parsed = Number(readScalar(value));
  if (!Number.isFinite(parsed)) {
    warnings.push({ line, message: `${name} must be a number; using ${fallback}.` });
    return fallback;
  }
  const clamped = Math.min(max, Math.max(min, parsed));
  if (clamped !== parsed) {
    warnings.push({
      line,
      message: `${name} must be between ${min} and ${max}; using ${clamped}.`,
    });
  }
  return clamped;
}

/** Reads one of a fixed set of string values. */
function readEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
  line: number,
  name: string,
  warnings: ParseWarning[],
): T {
  const parsed = readScalar(value) as T;
  if (!allowed.includes(parsed)) {
    warnings.push({
      line,
      message: `${name} must be one of ${allowed.join(", ")}; using ${fallback}.`,
    });
    return fallback;
  }
  return parsed;
}

/**
 * Parses the `mindmap` frontmatter block and preserves unknown lines.
 *
 * @param raw Frontmatter content without the surrounding --- lines.
 * @param startLine One-based line number where the frontmatter starts.
 * @param defaults Settings used for keys missing from the file.
 */
export function parseMeta(
  raw: string | null,
  startLine: number,
  defaults: MindMapMeta,
): MetaParseResult {
  const meta: MindMapMeta = { ...defaults };
  const warnings: ParseWarning[] = [];

  if (raw === null || raw.trim() === "") {
    return { meta, otherLines: [], extraLines: [], warnings };
  }

  const lines = normalizeSource(raw).split("\n");
  const blockIndex = lines.findIndex((line) => /^mindmap:\s*(.*?)\s*$/.test(line));
  if (blockIndex < 0) {
    return { meta, otherLines: lines, extraLines: [], warnings };
  }

  const inlineValue = /^mindmap:\s*(.*?)\s*$/.exec(lines[blockIndex])?.[1] ?? "";
  if (inlineValue) {
    warnings.push({
      line: startLine + blockIndex,
      message: "Inline mindmap frontmatter is not supported; using defaults.",
    });
    return { meta, otherLines: lines, extraLines: [], warnings };
  }

  let blockEnd = blockIndex + 1;
  while (blockEnd < lines.length) {
    const line = lines[blockEnd];
    if (line.trim() === "" || /^\s+/.test(line)) {
      blockEnd += 1;
      continue;
    }
    break;
  }

  const extraLines: string[] = [];
  for (let index = blockIndex + 1; index < blockEnd; index += 1) {
    const line = lines[index];
    const lineNumber = startLine + index;
    if (line.trim() === "") continue;

    const match = /^\s+([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(line);
    if (!match) {
      extraLines.push(line);
      continue;
    }

    const [, key, value] = match;
    switch (key) {
      case "version": {
        const version = readScalar(value);
        if (version !== "1") {
          warnings.push({
            line: lineNumber,
            message: `Unsupported mindmap version ${version}; using version 1.`,
          });
        }
        break;
      }
      case "theme": {
        const theme = readScalar(value);
        if (!theme) {
          warnings.push({ line: lineNumber, message: "theme must not be empty." });
        } else {
          meta.theme = theme;
        }
        break;
      }
      case "layout":
        meta.layout = readEnum(
          value,
          ["mindmap", "tree-left", "tree-right", "org"] as const,
          meta.layout,
          lineNumber,
          "layout",
          warnings,
        );
        break;
      case "spacingX":
        meta.spacingX = readNumber(
          value,
          meta.spacingX,
          LIMITS.spacingX.min,
          LIMITS.spacingX.max,
          lineNumber,
          "spacingX",
          warnings,
        );
        break;
      case "spacingY":
        meta.spacingY = readNumber(
          value,
          meta.spacingY,
          LIMITS.spacingY.min,
          LIMITS.spacingY.max,
          lineNumber,
          "spacingY",
          warnings,
        );
        break;
      case "compact":
      case "align":
      case "direction": {
        warnings.push({
          line: lineNumber,
          message: `${key} is no longer supported; this file-level value is ignored.`,
        });
        break;
      }
      case "maxWidth":
        meta.maxWidth = readNumber(
          value,
          meta.maxWidth,
          LIMITS.maxWidth.min,
          LIMITS.maxWidth.max,
          lineNumber,
          "maxWidth",
          warnings,
        );
        break;
      case "connectorStyle": {
        const style = readScalar(value);
        if (["curve", "orthogonal"].includes(style)) {
          meta.connectorStyle = style as ConnectorStyle;
        } else {
          warnings.push({
            line: lineNumber,
            message: "connectorStyle must be curve or orthogonal.",
          });
        }
        break;
      }
      case "nodeShape":
      case "nodeFillColor":
      case "nodeBorderColor":
      case "nodeBorderWidth":
      case "fontFamily":
      case "fontSize":
      case "textColor":
      case "bold":
      case "italic":
      case "underline":
      case "textAlign":
      case "lineHeight": {
        warnings.push({
          line: lineNumber,
          message: `${key} is now stored per node; this file-level value is ignored.`,
        });
        break;
      }
      case "connectorColor":
      case "lineWidth": {
        warnings.push({
          line: lineNumber,
          message: `${key} is now a global setting; this file-level value is ignored.`,
        });
        break;
      }
      default:
        extraLines.push(line);
        break;
    }
  }

  return {
    meta,
    otherLines: [...lines.slice(0, blockIndex), ...lines.slice(blockEnd)],
    extraLines,
    warnings,
  };
}

/**
 * Renders frontmatter with the canonical mindmap block while preserving other lines.
 *
 * @param meta Validated map metadata.
 * @param otherLines Frontmatter lines outside the mindmap block.
 * @param extraLines Unknown lines from inside the mindmap block.
 */
export function renderFrontmatter(
  meta: MindMapMeta,
  otherLines: string[],
  extraLines: string[],
): string {
  const lines = ["---", ...otherLines];
  if (otherLines.length > 0 && otherLines[otherLines.length - 1].trim() !== "") {
    lines.push("");
  }

  const optionalLines = [
    ...(meta.connectorStyle ? [`  connectorStyle: ${meta.connectorStyle}`] : []),
  ];

  lines.push(
    "mindmap:",
    "  version: 1",
    `  theme: ${writeScalar(meta.theme)}`,
    `  layout: ${meta.layout}`,
    `  spacingX: ${meta.spacingX}`,
    `  spacingY: ${meta.spacingY}`,
    `  maxWidth: ${meta.maxWidth}`,
    ...optionalLines,
    ...extraLines,
    "---",
  );

  return lines.join("\n");
}
