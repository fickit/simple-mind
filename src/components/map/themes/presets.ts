import type { ThemeDefinition, ThemeTokens } from "../../../types/theme";

/** Obsidian-native tokens that inherit the active light/dark CSS variables. */
function obsidianTokens(): ThemeTokens {
  return {
    canvasBackground: "transparent",
    node: {
      background: "var(--background-secondary)",
      text: "var(--text-normal)",
      border: "var(--background-modifier-border)",
      borderWidth: 1,
      radius: 8,
      paddingX: 10,
      paddingY: 6,
      shadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
      shape: "rounded",
    },
    root: {
      background: "var(--interactive-accent)",
      text: "var(--text-on-accent)",
      border: "transparent",
      borderWidth: 0,
      radius: 10,
      shadow: "0 2px 8px rgba(0, 0, 0, 0.18)",
      shape: "rounded",
    },
    branch: {
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
      lineWidth: 2,
      opacity: 0.8,
      style: "curve",
    },
    typography: {
      family: "var(--font-text)",
      size: 14,
      weight: 400,
      lineHeight: 1.4,
    },
    selection: {
      outline: "var(--interactive-accent)",
      background: "var(--background-modifier-hover)",
    },
    collapse: {
      background: "var(--background-primary)",
      text: "var(--text-muted)",
    },
  };
}

/** Obsidian native theme; both variants inherit Obsidian's CSS variables. */
export const OBSIDIAN_THEME: ThemeDefinition = {
  id: "obsidian",
  name: "Obsidian Native",
  builtIn: true,
  light: obsidianTokens(),
  dark: obsidianTokens(),
};

/** Built-in themes available to the view. */
export const BUILT_IN_THEMES: ThemeDefinition[] = [OBSIDIAN_THEME];

/**
 * Resolves a built-in theme id, falling back to the native theme.
 *
 * @param id Theme id from frontmatter or settings.
 */
export function getBuiltInTheme(id: string): ThemeDefinition {
  return BUILT_IN_THEMES.find((theme) => theme.id === id) ?? OBSIDIAN_THEME;
}
