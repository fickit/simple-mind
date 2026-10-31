# Themes

## Purpose

Defines theme tokens, applies them as scoped CSS variables, and provides built-in presets.

## Why it exists

Nodes and connectors need one source of visual truth. Scoped variables keep the map independent from
Obsidian's global styles and make light/dark switching and custom themes deterministic.

## Files

- `applyTheme.ts`: compiles a token set into `--sm-*` variables.
- `presets.ts`: built-in theme definitions and fallback resolution.

## Call flow

`MapCanvas` applies the active theme to its root and passes the tokens to `MapRenderer` for
measurement and connector styling.
