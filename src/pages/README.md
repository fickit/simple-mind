# Pages

## Purpose

Holds Obsidian view classes. A view owns a workspace leaf, the file binding, and the top-level DOM for
one page.

## Why it exists

Obsidian view lifecycle and file loading are separate concerns from the map engine. Keeping them in
`pages` lets the engine stay independent of Obsidian and keeps view switching logic in one place.

## Files

- `MindMapView.ts`: `TextFileView` for `.mindmap` files. The current implementation is the native
  editor feasibility spike; it is replaced by the map canvas in the view phase.

## Call flow

Obsidian creates `MindMapView` through `plugin.registerView`. The view loads data through
`TextFileView`, exposes `getViewData` for saving, and delegates source switching to
`components/source/SourceSwitch`.
