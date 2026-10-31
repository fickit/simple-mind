# Config

## Purpose

Holds values that are shared by multiple modules but must not live inside business logic:
constants, default settings, frontmatter defaults, i18n dictionaries, and built-in theme presets.

## Why it exists

Without this module, numeric limits, file extensions, view ids, and default layout values would be
scattered across the parser, renderer, and settings UI. Keeping them here makes the limits visible in
one place and prevents frontend code from depending on implicit literals.

## Files

- `constants.ts`: plugin id, view type, file extension, canonical indentation, numeric limits, zoom
  and history bounds.
- `defaults.ts`: default per-file map metadata and default plugin settings.

## Call flow

`main.ts` loads settings, the parser applies `DEFAULT_MINDMAP_META`, and the settings UI uses the same
defaults and limits. Theme presets and i18n dictionaries are added in later phases.
