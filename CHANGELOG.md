# Changelog

## 1.1.1 — 2026-11-28

- Move the drag ghost and editor chrome to CSS classes and Obsidian CSS helpers, clearing the community review error.
- Implement declarative settings so the tab appears in settings search on Obsidian 1.13+; the display renderer stays as the fallback for older versions.
- Attest the release assets with GitHub build provenance.
- Clear the remaining review warnings: unnecessary assertions, the last raw element creation, and the text-decoration CSS lint.

## 1.1.0 — 2026-11-27

- Nodes can link to notes with Obsidian wikilinks: `[[Note]]`, `[[Note|alias]]`, and
  `[[Note#Heading]]`. Links open in a new tab and show Obsidian's page preview on hover.
- Nodes can show images inline with `![[photo.png]]`, `![[photo.png|300]]`, `![alt](https://…)`, and
  vault-relative Markdown images. Thumbnails are capped at 140 px high and open in a lightbox; a node
  made only of images becomes the picture itself with rounded corners.
- Typing `[[` or `![[` while editing opens a fuzzy file search that inserts the link; arrow keys move
  through the list and the mouse can highlight an entry.
- Drag on empty canvas to marquee-select nodes; the box and covered nodes highlight live
  (Ctrl/Cmd/Shift adds). Alt+drag pans the canvas, Ctrl/Cmd+A selects all, drag the root to move the
  whole map, and drag any node—including image nodes—onto another node to reparent it.
- Open any Markdown note as a mind map from the tab's three-dot menu, and open a `.mindmap` in
  source mode the same way. The separate "open as mind map" ribbon icon is gone.
- Line nodes replace the old underline look: the label sits above a branch-colored rule that is the
  node body, uses the connector's color and width, and continues into child branches. Existing
  `underline` markers keep working.
- Nodes, links, and images no longer show redundant hover tooltips; only icon-only controls keep
  their labels. The selection outline on an image-only node follows the picture group instead of the
  old pill shape.
- Missing notes and images render as explicit placeholders instead of breaking the map.

## 1.0.4 — 2026-11-06

- The map fills the view edge to edge: Obsidian's view padding and view header are hidden and the
  rounded frame is gone, so the canvas meets the window frame on every side.

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
