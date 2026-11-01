# Themes

## Purpose

Defines theme tokens, applies them as scoped CSS variables, and provides built-in presets.

## Why it exists

Nodes and connectors need one source of visual truth. Scoped variables keep the map independent from
Obsidian's global styles and make light/dark switching and custom themes deterministic.

## Files

- `applyTheme.ts`: compiles a token set into `--sm-*` variables.
- `presets.ts`: eight built-in themes with light and dark variants, plus fallback resolution.

## Built-in themes

Obsidian Native, Paper, Graphite, Nord, Solarized, Forest, Ocean, and Sakura.

## Call flow

`MapCanvas` resolves the selected theme from the file frontmatter, applies it to its root, and passes
the tokens to `MapRenderer` for measurement and connector styling. Obsidian's `css-change` event
reapplies the active light or dark variant.
