import type { ThemeDefinition, ThemeTokens } from "../../../types/theme";

/** Returns the token set for the current Obsidian mode. */
export function tokensForMode(theme: ThemeDefinition, dark: boolean): ThemeTokens {
  return dark ? theme.dark : theme.light;
}

/**
 * Applies a theme as scoped CSS variables on a map container.
 *
 * @param root Map container.
 * @param theme Active theme.
 * @param dark Whether Obsidian is in dark mode.
 */
export function applyTheme(root: HTMLElement, theme: ThemeDefinition, dark: boolean): void {
  const tokens = tokensForMode(theme, dark);
  const set = (name: string, value: string | number): void => {
    root.style.setProperty(name, String(value));
  };

  set("--sm-canvas-bg", tokens.canvasBackground);
  set("--sm-node-bg", tokens.node.background);
  set("--sm-node-text", tokens.node.text);
  set("--sm-node-border", tokens.node.border);
  set("--sm-node-border-width", `${tokens.node.borderWidth}px`);
  set("--sm-node-radius", `${tokens.node.radius}px`);
  set("--sm-node-padding-x", `${tokens.node.paddingX}px`);
  set("--sm-node-padding-y", `${tokens.node.paddingY}px`);
  set("--sm-node-shadow", tokens.node.shadow);
  set("--sm-root-bg", tokens.root.background);
  set("--sm-root-text", tokens.root.text);
  set("--sm-root-border", tokens.root.border);
  set("--sm-root-border-width", `${tokens.root.borderWidth}px`);
  set("--sm-root-radius", `${tokens.root.radius}px`);
  set("--sm-root-shadow", tokens.root.shadow);
  set("--sm-edge-width", tokens.branch.lineWidth);
  set("--sm-edge-opacity", tokens.branch.opacity);
  set("--sm-font", tokens.typography.family);
  set("--sm-font-size", `${tokens.typography.size}px`);
  set("--sm-font-weight", tokens.typography.weight);
  set("--sm-font-style", tokens.typography.fontStyle ?? "normal");
  set("--sm-line-height", tokens.typography.lineHeight);
  set("--sm-text-align", tokens.typography.textAlign ?? "center");
  set("--sm-text-decoration", tokens.typography.textDecoration ?? "none");
  set("--sm-selection-outline", tokens.selection.outline);
  set("--sm-selection-bg", tokens.selection.background);
  set("--sm-collapse-bg", tokens.collapse.background);
  set("--sm-collapse-text", tokens.collapse.text);
  root.dataset.simpleMindTheme = theme.id;
  root.dataset.smMode = dark ? "dark" : "light";
}
