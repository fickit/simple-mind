# i18n

## Purpose

Holds English and Chinese UI dictionaries and the active-language resolver.

## Why it exists

All user-facing strings must support both languages without scattering literals through the engine.
Keeping the dictionaries typed guarantees that every English key has a Chinese translation.

## Files

- `en.ts`: English messages and the `MessageKey` union.
- `zh.ts`: Chinese messages, typed against every English key.
- `index.ts`: active language, `setLanguage`, `getLanguage`, and `t`.

## Call flow

The plugin sets the language from settings on load and when the user switches it. Toolbars, commands,
notices, settings, and the theme editor call `t(key, params)`.
