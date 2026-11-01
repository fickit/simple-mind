import type { ConnectorStyle, NodeShape, ThemeDefinition, ThemeTokens } from "../../../types/theme";

const NODE_SHAPES: NodeShape[] = ["rounded", "pill", "underline", "plain"];
const CONNECTOR_STYLES: ConnectorStyle[] = ["curve", "orthogonal"];
const CUSTOM_PREFIX = "custom-";

/** Converts rgb()/rgba() or a CSS variable into a hex color for color inputs. */
export function toHexColor(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  const doc = typeof document === "undefined" ? null : document;
  if (!doc) return "#000000";
  const probe = doc.createElement("div");
  probe.style.color = trimmed;
  doc.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  const match = computed.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!match) return "#000000";
  const toHex = (part: string): string =>
    Math.max(0, Math.min(255, Math.round(Number(part))))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

/** Fills typography fields that earlier custom themes did not store. */
function normalizeTypography(tokens: ThemeTokens): ThemeTokens["typography"] {
  const typography = tokens.typography as Partial<ThemeTokens["typography"]>;
  return {
    family: typography.family ?? "var(--font-text)",
    size: typography.size ?? 14,
    weight: typography.weight ?? 400,
    lineHeight: typography.lineHeight ?? 1.4,
    fontStyle: typography.fontStyle ?? "normal",
    textAlign: typography.textAlign ?? "center",
    textDecoration: typography.textDecoration ?? "none",
  };
}

/** Resolves the editable color fields of one token set. */
function resolveTokens(tokens: ThemeTokens): ThemeTokens {
  return {
    ...tokens,
    typography: normalizeTypography(tokens),
    canvasBackground: toHexColor(tokens.canvasBackground),
    node: {
      ...tokens.node,
      background: toHexColor(tokens.node.background),
      text: toHexColor(tokens.node.text),
      border: toHexColor(tokens.node.border),
    },
    root: {
      ...tokens.root,
      background: toHexColor(tokens.root.background),
      text: toHexColor(tokens.root.text),
    },
    branch: {
      ...tokens.branch,
      palette: tokens.branch.palette.map(toHexColor),
    },
    selection: {
      ...tokens.selection,
      outline: toHexColor(tokens.selection.outline),
      background: toHexColor(tokens.selection.background),
    },
    collapse: {
      ...tokens.collapse,
      background: toHexColor(tokens.collapse.background),
      text: toHexColor(tokens.collapse.text),
    },
  };
}

/** Clones a theme and resolves its colors into concrete hex values. */
export function cloneTheme(
  theme: ThemeDefinition,
  id = theme.id,
  name = theme.name,
): ThemeDefinition {
  const clone = JSON.parse(JSON.stringify(theme)) as ThemeDefinition;
  clone.id = id;
  clone.name = name;
  clone.builtIn = false;
  clone.light = resolveTokens(clone.light);
  clone.dark = resolveTokens(clone.dark);
  return clone;
}

/** Creates a unique custom theme id. */
export function createCustomThemeId(existing: ThemeDefinition[]): string {
  let index = Date.now();
  let id = `${CUSTOM_PREFIX}${index}`;
  while (existing.some((theme) => theme.id === id)) {
    index += 1;
    id = `${CUSTOM_PREFIX}${index}`;
  }
  return id;
}

/** Returns true when a value has the expected theme shape. */
export function isValidTheme(value: unknown): value is ThemeDefinition {
  if (!value || typeof value !== "object") return false;
  const theme = value as Partial<ThemeDefinition>;
  return (
    typeof theme.id === "string" &&
    typeof theme.name === "string" &&
    isTokens(theme.light) &&
    isTokens(theme.dark)
  );
}

/** Parses imported theme JSON. */
export function themeFromJson(text: string): ThemeDefinition | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!isValidTheme(value)) return null;
    return {
      ...value,
      builtIn: false,
      light: resolveTokens(value.light),
      dark: resolveTokens(value.dark),
    };
  } catch {
    return null;
  }
}

/** Checks one token set. */
function isTokens(value: unknown): value is ThemeTokens {
  if (!value || typeof value !== "object") return false;
  const tokens = value as Partial<ThemeTokens>;
  return (
    !!tokens.node &&
    !!tokens.root &&
    !!tokens.branch &&
    !!tokens.typography &&
    !!tokens.selection &&
    !!tokens.collapse &&
    typeof tokens.canvasBackground === "string" &&
    Array.isArray(tokens.branch.palette) &&
    tokens.branch.palette.every((color) => typeof color === "string") &&
    NODE_SHAPES.includes(tokens.node.shape) &&
    CONNECTOR_STYLES.includes(tokens.branch.style)
  );
}

export { CUSTOM_PREFIX };
