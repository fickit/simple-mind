# Interaction

## Purpose

Implements map editing commands and the inline label editor.

## Why it exists

The renderer should not own document mutations. Keeping commands and text editing in this module lets
every change pass through one validation, serialization, and history path.

## Files

- `MapController.ts`: add, rename, delete, move, collapse, copy, paste, undo, and redo over a
  document.
- `DragController.ts`: pointer dragging, drop-position resolution, target highlighting, and
  hover-to-expand for collapsed drop targets.
- `InlineEditor.ts`: single-line input overlay with Enter, Tab, Escape, blur, and IME composition
  handling. It mirrors the node's computed styles, grows with content up to `maxWidth`, wraps into more
  height, and hides the underlying node while open so the old label cannot show through. Every resize
  reports its live rectangle to the canvas. Enter commits and starts a sibling editor; Tab commits and
  starts a child editor; Shift+Enter/Shift+Tab commit only. New nodes start as empty single-line
  editors with no placeholder.

## Call flow

`MapCanvas` forwards keyboard and toolbar actions to `MapController`. Inline commits become
controller commands, which serialize the document and notify the view to save. While the editor is
open, `MapCanvas` throttles live rectangles with `requestAnimationFrame`; `MapRenderer` reflows the
tree with the editor size so children move and connectors follow. `DragController` reports drops to
`MapCanvas`, which calls `MapController.moveNode`. Collapse remains runtime-only and does not change
source.
