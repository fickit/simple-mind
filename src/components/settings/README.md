# Settings

## Purpose

Owns the plugin settings tab and the custom theme editor.

## Why it exists

Defaults, theme management, language switching, and custom theme editing are user-facing concerns that
should not live in the map engine or the view lifecycle.

## Files

- `SettingsTab.ts`: general defaults, language, built-in/custom theme management, import/export, and
  deletion confirmation.
- `ThemeEditorModal.ts`: light/dark token editing with a live node and connector preview.

## Call flow

`main.ts` registers the settings tab with the plugin as the settings host. Every change persists
through `saveSettings`, then refreshes open map views so defaults and custom themes apply immediately.
A language change also re-registers commands and updates ribbon and status-bar labels.
