# Source

## Purpose

Owns the transition between the Simple Mind map view and Obsidian's native Markdown source editor.

## Why it exists

Switching view types on a leaf can lose unsaved data. Centralizing the save-then-switch sequence keeps
both directions consistent and gives save failures one place to surface.

## Files

- `SourceSwitch.ts`: `switchToSource` and `switchToMap`, plus the shared save guard.
- `SourceModeGuard.ts`: remembers leaves that intentionally show source mode so the file-open fallback
  does not immediately reopen the map.

## Call flow

`MindMapView` and the plugin command call `switchToSource` or `switchToMap`. The helper saves the
current `TextFileView`, marks or clears the source-mode guard, then calls `leaf.setViewState` with the
target type and file state.
