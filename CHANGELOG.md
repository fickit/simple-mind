# Changelog

## 0.1.1 — 2026-11-03

Community review fixes.

- The settings tab uses Obsidian's heading settings instead of raw heading elements.
- The settings tab reads its own settings type, so it no longer relies on `Plugin.settings`
  (Obsidian 1.13+).
- Static inline styles moved into stylesheets.
- Removed the leaf detach from `onunload`.
- Dropped the unused `builtin-modules` dependency.

## 0.1.0 — 2026-11-02

First release.

- Markdown-outline `.mindmap` files open as a map and round-trip to the native Markdown editor.
- Four layouts: mind map, tree to the right, tree to the left, and organization chart.
- Inline editing, drag to reorganize, collapse with count bubbles, and side-aware add buttons.
- Nine built-in themes with automatic light/dark switching and a custom theme editor.
- One style panel for the file's theme, layout, and connector shape plus the selected node's shape,
  colors, and text; font family, connector color, and thickness live in settings.
- Each file remembers its pan, zoom, and selection.
- English and Chinese UI.
- Frame-batched redraws and viewport culling keep large maps responsive.
