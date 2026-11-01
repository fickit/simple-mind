# Interaction

## Purpose

Implements map editing commands and the inline label editor.

## Why it exists

The renderer should not own document mutations. Keeping commands and text editing in this module lets
every change pass through one validation, serialization, and history path.

## Files

- `MapController.ts`: add, rename, delete, move, collapse, undo, and redo over a document.
- `InlineEditor.ts`: single-line input overlay with Enter, Escape, blur, and IME composition handling.
  It mirrors the node's computed styles, grows with content up to `maxWidth`, wraps into more height,
  and hides the underlying node while open so the old label cannot show through. Every resize reports
  its live rectangle to the canvas.

## Call flow

`MapCanvas` forwards keyboard and toolbar actions to `MapController`. Inline commits become
controller commands, which serialize the document and notify the view to save. While the editor is
open, `MapCanvas` throttles live rectangles with `requestAnimationFrame`; `MapRenderer` reflows the
tree with the editor size so children move and connectors follow. Collapse remains runtime-only and
does not change source.
