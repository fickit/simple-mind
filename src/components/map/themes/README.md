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
- `overrides.ts`: applies per-file node, connector, and text overrides on top of a theme.
- `theme-utils.ts`: clones, validates, and serializes theme definitions for custom theme management.

## Built-in themes

Obsidian Native, Paper, Graphite, Nord, Solarized, Forest, Ocean, and Sakura. Every theme defines a
complete style design—colors, typography, node shape and border, and connector geometry and width.

## Call flow

`MapCanvas` resolves the selected theme from the file frontmatter, applies per-file overrides, applies
the effective tokens to its root, and passes them to `MapRenderer` for measurement and connector
styling. Obsidian's `css-change` event reapplies the active light or dark variant.
