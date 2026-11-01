# Themes

## Purpose

Defines theme tokens, applies them as scoped CSS variables, and provides built-in presets.

## Why it exists

Nodes and connectors need one source of visual truth. Scoped variables keep the map independent from
Obsidian's global styles and make light/dark switching and custom themes deterministic.

## Files

- `applyTheme.ts`: compiles a token set into `--sm-*` variables and resolves the active light/dark
  variant.
- `presets.ts`: eight built-in themes with light and dark variants, plus fallback resolution.
- `overrides.ts`: applies the file's connector shape and global font/connector defaults on top of a
  theme.
- `nodeVisual.ts`: resolves one node's effective colors and typography from a theme plus its inline
  style marker.
- `theme-utils.ts`: clones, validates, and serializes theme definitions for custom theme management.

## Built-in themes

Obsidian Native, Paper, Graphite, Nord, Solarized, Forest, Ocean, and Sakura. Every theme defines a
complete style design—colors, typography, node shape and border, and connector geometry and width.

## Call flow

`MapCanvas` resolves the selected theme from the file frontmatter, applies the file's connector shape
and global defaults, and passes the effective tokens to `MapRenderer`. The renderer and measurer call
`nodeVisual` for each node so inline style markers override the theme. Obsidian's `css-change` event
reapplies the active light or dark variant.
