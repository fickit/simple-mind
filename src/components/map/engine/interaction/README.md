# Interaction

## Purpose

Implements map editing commands and the inline label editor.

## Why it exists

The renderer should not own document mutations. Keeping commands and text editing in this module lets
every change pass through one validation, serialization, and history path.

## Files

- `MapController.ts`: add, rename, delete, move, collapse, undo, and redo over a document.
- `InlineEditor.ts`: single-line input overlay with Enter, Escape, blur, and IME composition handling.

## Call flow

`MapCanvas` forwards keyboard and toolbar actions to `MapController`. Inline commits become
controller commands, which serialize the document and notify the view to save. The renderer is then
asked to redraw; collapse remains runtime-only and does not change source.
