# Themes

## Purpose

Defines theme tokens, applies them as scoped CSS variables, and provides built-in presets.

## Why it exists

Nodes and connectors need one source of visual truth. Scoped variables keep the map independent from
Obsidian's global styles and make light/dark switching and custom themes deterministic.

## Files

- `applyTheme.ts`: compiles a token set into `--sm-*` variables, resolves the active light/dark
  variant, and marks the map root with `data-sm-mode` so the chrome can switch palettes.
- `presets.ts`: nine built-in themes with light and dark variants, plus fallback resolution.
- `overrides.ts`: applies the file's connector shape and global font/connector defaults on top of a
  theme.
- `nodeVisual.ts`: resolves one node's effective colors and typography from a theme plus its inline
  style marker.
- `theme-utils.ts`: clones, validates, and serializes theme definitions, and computes WCAG contrast
  ratios for color choices.

## Built-in themes

Meadow (the default), Obsidian Native, Paper, Graphite, Nord, Solarized, Forest, Ocean, and Sakura.
Every theme defines a complete style design—colors, typography, node shape and border, and connector
geometry and width. Meadow is the Natural Organic light palette over a moonlit-forest dark one.

## Call flow

`MapCanvas` resolves the selected theme from the file frontmatter, applies the file's connector shape
and global defaults, and passes the effective tokens to `MapRenderer`. The renderer and measurer call
`nodeVisual` for each node so inline style markers override the theme. Obsidian's `css-change` event
reapplies the active light or dark variant.
