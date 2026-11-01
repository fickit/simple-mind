import type { ConnectorStyle, NodeShape, ThemeDefinition, ThemeTokens } from "../../../types/theme";

interface TokenInput {
  canvas: string;
  surface: string;
  text: string;
  border: string;
  accent: string;
  accentText: string;
  palette: string[];
  fontFamily?: string;
  nodeShape?: NodeShape;
  connector?: ConnectorStyle;
}

/** Builds a complete token set from a compact palette description. */
function buildTokens(input: TokenInput): ThemeTokens {
  return {
    canvasBackground: input.canvas,
    node: {
      background: input.surface,
      text: input.text,
      border: input.border,
      borderWidth: 1,
      radius: 8,
      paddingX: 10,
      paddingY: 6,
      shadow: "0 1px 3px rgba(0, 0, 0, 0.14)",
      shape: input.nodeShape ?? "rounded",
    },
    root: {
      background: input.accent,
      text: input.accentText,
      border: "transparent",
      borderWidth: 0,
      radius: 12,
      shadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
      shape: input.nodeShape ?? "rounded",
    },
    branch: {
      palette: input.palette,
      lineWidth: 2,
      opacity: 0.85,
      style: input.connector ?? "curve",
    },
    typography: {
      family: input.fontFamily ?? "var(--font-text)",
      size: 14,
      weight: 400,
      lineHeight: 1.4,
    },
    selection: {
      outline: input.accent,
      background: input.surface,
    },
    collapse: {
      background: input.canvas,
      text: input.text,
    },
  };
}

/** Obsidian-native tokens that inherit the active light/dark CSS variables. */
function obsidianTokens(): ThemeTokens {
  return buildTokens({
    canvas: "transparent",
    surface: "var(--background-secondary)",
    text: "var(--text-normal)",
    border: "var(--background-modifier-border)",
    accent: "var(--interactive-accent)",
    accentText: "var(--text-on-accent)",
    palette: [
      "var(--color-blue)",
      "var(--color-green)",
      "var(--color-orange)",
      "var(--color-purple)",
      "var(--color-cyan)",
      "var(--color-pink)",
      "var(--color-yellow)",
      "var(--color-red)",
    ],
  });
}

/** Obsidian native theme; both variants inherit Obsidian's CSS variables. */
export const OBSIDIAN_THEME: ThemeDefinition = {
  id: "obsidian",
  name: "Obsidian Native",
  builtIn: true,
  light: obsidianTokens(),
  dark: obsidianTokens(),
};

/**
 * Creates an editable Obsidian-style theme with concrete light and dark colors.
 *
 * The built-in theme resolves through Obsidian CSS variables, so copying it
 * needs explicit variants for the theme editor.
 *
 * @param id Custom theme id.
 * @param name Theme name.
 */
export function createObsidianCustomTheme(id: string, name: string): ThemeDefinition {
  return {
    id,
    name,
    builtIn: false,
    light: buildTokens({
      canvas: "#ffffff",
      surface: "#f5f6f8",
      text: "#2e2e2e",
      border: "#d9dde3",
      accent: "#4c6ef5",
      accentText: "#ffffff",
      palette: [
        "#4c6ef5",
        "#2f9e44",
        "#e8590c",
        "#7048e8",
        "#0b7285",
        "#d6336c",
        "#e67700",
        "#c92a2a",
      ],
    }),
    dark: buildTokens({
      canvas: "#1e1e1e",
      surface: "#2a2a2a",
      text: "#e6e6e6",
      border: "#3f3f3f",
      accent: "#6b8afd",
      accentText: "#ffffff",
      palette: [
        "#8ba4ff",
        "#69db7c",
        "#ffa94d",
        "#b197fc",
        "#66d9e8",
        "#faa2c1",
        "#ffd43b",
        "#ff8787",
      ],
    }),
  };
}

export const PAPER_THEME: ThemeDefinition = {
  id: "paper",
  name: "Paper",
  builtIn: true,
  light: buildTokens({
    canvas: "#f6f1e7",
    surface: "#fffaf0",
    text: "#3b3226",
    border: "#e2d6c3",
    accent: "#9a6b3f",
    accentText: "#fffaf0",
    palette: [
      "#8c5e3c",
      "#b07d4f",
      "#6f7d4e",
      "#a65d57",
      "#4d6d7c",
      "#8b6f9e",
      "#c08a3e",
      "#7a6a5a",
    ],
    fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
  }),
  dark: buildTokens({
    canvas: "#1f1c18",
    surface: "#2a2620",
    text: "#e8dfd0",
    border: "#4a4238",
    accent: "#c99a6a",
    accentText: "#1f1c18",
    palette: [
      "#d2a679",
      "#c98f5f",
      "#a8b77e",
      "#d18b83",
      "#83a6b5",
      "#b39ac7",
      "#dfb56a",
      "#b0a090",
    ],
    fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
  }),
};

export const GRAPHITE_THEME: ThemeDefinition = {
  id: "graphite",
  name: "Graphite",
  builtIn: true,
  light: buildTokens({
    canvas: "#f5f5f5",
    surface: "#ffffff",
    text: "#222222",
    border: "#d0d0d0",
    accent: "#3b3b3b",
    accentText: "#ffffff",
    palette: [
      "#4a4a4a",
      "#6a6a6a",
      "#8a8a8a",
      "#5c5c5c",
      "#a0a0a0",
      "#777777",
      "#999999",
      "#b0b0b0",
    ],
    connector: "straight",
  }),
  dark: buildTokens({
    canvas: "#181818",
    surface: "#242424",
    text: "#eeeeee",
    border: "#3a3a3a",
    accent: "#d0d0d0",
    accentText: "#111111",
    palette: [
      "#d0d0d0",
      "#b0b0b0",
      "#909090",
      "#c0c0c0",
      "#a0a0a0",
      "#e0e0e0",
      "#808080",
      "#b8b8b8",
    ],
    connector: "straight",
  }),
};

export const NORD_THEME: ThemeDefinition = {
  id: "nord",
  name: "Nord",
  builtIn: true,
  light: buildTokens({
    canvas: "#eceff4",
    surface: "#ffffff",
    text: "#2e3440",
    border: "#d8dee9",
    accent: "#5e81ac",
    accentText: "#eceff4",
    palette: [
      "#5e81ac",
      "#81a1c1",
      "#88c0d0",
      "#8fbcbb",
      "#a3be8c",
      "#ebcb8b",
      "#d08770",
      "#b48ead",
    ],
    nodeShape: "pill",
  }),
  dark: buildTokens({
    canvas: "#2e3440",
    surface: "#3b4252",
    text: "#eceff4",
    border: "#4c566a",
    accent: "#88c0d0",
    accentText: "#2e3440",
    palette: [
      "#88c0d0",
      "#81a1c1",
      "#8fbcbb",
      "#a3be8c",
      "#ebcb8b",
      "#d08770",
      "#b48ead",
      "#5e81ac",
    ],
    nodeShape: "pill",
  }),
};

export const SOLARIZED_THEME: ThemeDefinition = {
  id: "solarized",
  name: "Solarized",
  builtIn: true,
  light: buildTokens({
    canvas: "#fdf6e3",
    surface: "#eee8d5",
    text: "#657b83",
    border: "#d5cdb6",
    accent: "#268bd2",
    accentText: "#fdf6e3",
    palette: [
      "#268bd2",
      "#2aa198",
      "#859900",
      "#b58900",
      "#cb4b16",
      "#d33682",
      "#6c71c4",
      "#586e75",
    ],
    connector: "orthogonal",
  }),
  dark: buildTokens({
    canvas: "#002b36",
    surface: "#073642",
    text: "#93a1a1",
    border: "#0f4a57",
    accent: "#2aa198",
    accentText: "#002b36",
    palette: [
      "#2aa198",
      "#268bd2",
      "#859900",
      "#b58900",
      "#cb4b16",
      "#d33682",
      "#6c71c4",
      "#93a1a1",
    ],
    connector: "orthogonal",
  }),
};

export const FOREST_THEME: ThemeDefinition = {
  id: "forest",
  name: "Forest",
  builtIn: true,
  light: buildTokens({
    canvas: "#f1f6ee",
    surface: "#ffffff",
    text: "#24352a",
    border: "#cfdec8",
    accent: "#3f7d4f",
    accentText: "#ffffff",
    palette: [
      "#3f7d4f",
      "#6a994e",
      "#a7c957",
      "#bc6c25",
      "#588157",
      "#386641",
      "#dda15e",
      "#7f5539",
    ],
  }),
  dark: buildTokens({
    canvas: "#16211a",
    surface: "#1f2e24",
    text: "#dcebdd",
    border: "#354a3a",
    accent: "#7fc08f",
    accentText: "#16211a",
    palette: [
      "#7fc08f",
      "#a3d9a5",
      "#cfe8a9",
      "#e0a96d",
      "#8fbf9f",
      "#5f9e7f",
      "#f0c987",
      "#b08968",
    ],
  }),
};

export const OCEAN_THEME: ThemeDefinition = {
  id: "ocean",
  name: "Ocean",
  builtIn: true,
  light: buildTokens({
    canvas: "#eef7f9",
    surface: "#ffffff",
    text: "#17333b",
    border: "#c9e1e6",
    accent: "#0b7a8a",
    accentText: "#ffffff",
    palette: [
      "#0b7a8a",
      "#219ebc",
      "#48cae4",
      "#00b4d8",
      "#0077b6",
      "#023e8a",
      "#90e0ef",
      "#5e60ce",
    ],
    nodeShape: "pill",
  }),
  dark: buildTokens({
    canvas: "#0e1d23",
    surface: "#142a32",
    text: "#d7eef3",
    border: "#24444e",
    accent: "#4fc3d4",
    accentText: "#0e1d23",
    palette: [
      "#4fc3d4",
      "#48cae4",
      "#90e0ef",
      "#00b4d8",
      "#0077b6",
      "#5e60ce",
      "#219ebc",
      "#8ecae6",
    ],
    nodeShape: "pill",
  }),
};

export const SAKURA_THEME: ThemeDefinition = {
  id: "sakura",
  name: "Sakura",
  builtIn: true,
  light: buildTokens({
    canvas: "#fdf1f4",
    surface: "#ffffff",
    text: "#402a33",
    border: "#f0d3dc",
    accent: "#b64a6b",
    accentText: "#ffffff",
    palette: [
      "#b64a6b",
      "#d46a8a",
      "#e08fa8",
      "#8f5b7a",
      "#c77d9a",
      "#9d4e6b",
      "#e6a6bb",
      "#7a4b63",
    ],
    nodeShape: "pill",
  }),
  dark: buildTokens({
    canvas: "#24161b",
    surface: "#321f26",
    text: "#f6dfe6",
    border: "#55323d",
    accent: "#e58aa6",
    accentText: "#24161b",
    palette: [
      "#e58aa6",
      "#f0a6bc",
      "#f7c6d4",
      "#c77d9a",
      "#b64a6b",
      "#d46a8a",
      "#e6a6bb",
      "#9d4e6b",
    ],
    nodeShape: "pill",
  }),
};

/** Built-in themes available to the view. */
export const BUILT_IN_THEMES: ThemeDefinition[] = [
  OBSIDIAN_THEME,
  PAPER_THEME,
  GRAPHITE_THEME,
  NORD_THEME,
  SOLARIZED_THEME,
  FOREST_THEME,
  OCEAN_THEME,
  SAKURA_THEME,
];

/**
 * Resolves a built-in theme id, falling back to the native theme.
 *
 * @param id Theme id from frontmatter or settings.
 */
export function getBuiltInTheme(id: string): ThemeDefinition {
  return BUILT_IN_THEMES.find((theme) => theme.id === id) ?? OBSIDIAN_THEME;
}

/**
 * Resolves a built-in or custom theme.
 *
 * @param id Theme id from frontmatter or settings.
 * @param customThemes User themes from plugin settings.
 */
export function resolveTheme(id: string, customThemes: ThemeDefinition[] = []): ThemeDefinition {
  return customThemes.find((theme) => theme.id === id) ?? getBuiltInTheme(id);
}
