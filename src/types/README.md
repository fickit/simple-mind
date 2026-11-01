# Types

## Purpose

Contains shared TypeScript contracts for the document model, theme tokens, and plugin settings.

## Why it exists

The parser, layout engine, renderer, and settings UI exchange the same structures. A single types
module keeps those contracts consistent and prevents circular imports between implementation files.

## Files

- `mindmap.ts`: layout enums, map metadata (including per-file style overrides), node tree, source
  text, parser errors, and parse results.
- `theme.ts`: node shapes, connector styles, text alignment, theme tokens, and theme definitions.
- `settings.ts`: language and persistent plugin settings.

## Call flow

The parser produces `MindMapDocument`; the layout engine consumes it and produces positioned nodes;
the renderer consumes positions; the settings module persists `SimpleMindSettings`; themes resolve to
`ThemeDefinition`.
