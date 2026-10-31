# History

## Purpose

Keeps bounded source snapshots for map undo and redo.

## Why it exists

Map commands rewrite the outline. Storing source snapshots makes undo independent from DOM state and
guarantees that restored content goes through the same parser as every other edit.

## Files

- `SourceHistory.ts`: bounded undo/redo stacks over serialized source strings.

## Call flow

The command controller pushes the source before a mutation. Undo returns a source string, the view
reparses it, and the renderer updates from the restored document.
