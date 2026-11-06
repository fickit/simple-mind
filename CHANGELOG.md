# Changelog

## 1.0.4 — 2026-11-06

- The map fills the view edge to edge: Obsidian's default view padding is removed and the rounded
  frame is gone, so the canvas meets the tab header and window frame without a margin.

## 1.0.3 — 2026-11-03

- Typing on a selected node edits it: Space appends to the label, any other character replaces it,
  and clearing the label deletes the node.
- The README now focuses on features and usage instead of the development setup.

## 1.0.2 — 2026-11-03

Review helper clean-up.

- Elements are created through Obsidian's global DOM helpers (`createEl`, `createDiv`, `createSpan`,
  `createSvg`, `createFragment`) instead of `document.createElement`.
- The test runner installs a small jsdom shim for those helpers.

## 1.0.1 — 2026-11-03

Review warning clean-up.

- Renamed the chrome font tokens so the stylesheet no longer trips the unsupported-feature check.
- Replaced the deprecated `activeLeaf` lookups with `getActiveViewOfType`.
- Removed the deprecated slider tooltips.
- Destructive buttons keep Obsidian's warning style through the standard `mod-warning` class.

## 1.0.0 — 2026-11-03

First stable release.

### Map and editing

- `.mindmap` files open as an interactive map in the same tab and round-trip to Obsidian's native
  Markdown editor.
- Markdown-outline source: frontmatter holds the theme, layout, spacing, and connector shape, and
  per-node styles are stored inline as `<!-- sm:{...} -->` markers.
- Four layouts: mind map, tree to the right, tree to the left, and organization chart.
- Direct editing: add, rename, delete, collapse, drag to reorganize, copy and paste, and undo/redo.
- Collapse chevrons sit on the connector bundle, add buttons sit between the child lines, collapsed
  groups become count bubbles, and branch sides persist so left and right additions stay put.
- Curved connectors leave the parent in one sweep; orthogonal connectors branch after a short lead.
- Each file remembers its pan, zoom, and selection.

### Style and themes

- One scrolling style panel: theme, layout, and connector shape for the file; shape, fill, border
  color, border width, text color, font size, bold, italic, underline, alignment, and line height
  for the selected node.
- Nine built-in themes with automatic light/dark switching and a custom theme editor with a live
  preview, plus import and export.
- Font family, connector color, and connector thickness live in the plugin settings.
- Frameless icon rows, content-hugging controls, and pictograms for layouts, node shapes, and
  connectors; every control shows the theme's effective value.

### Interface

- A floating menu over the canvas with fit, style, and source actions.
- The style panel folds with an eased transition and the map frame is rounded against Obsidian's pane.
- English and Chinese interface.
- Frame-batched redraws and viewport culling keep large maps responsive.

### Fixes

- Settings use Obsidian's heading settings and no longer rely on `Plugin.settings`, so the plugin
  passes the community review.
- Static inline styles moved into stylesheets, the leaf detach was removed from `onunload`, and the
  unused `builtin-modules` dependency was dropped.
