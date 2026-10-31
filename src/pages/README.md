# Pages

## Purpose

Holds Obsidian view classes. A view owns a workspace leaf, the file binding, and the top-level DOM for
one page.

## Why it exists

Obsidian view lifecycle and file loading are separate concerns from the map engine. Keeping them in
`pages` lets the engine stay independent of Obsidian and keeps view switching logic in one place.

## Files

- `MindMapView.ts`: `TextFileView` for `.mindmap` files; it mounts `MapCanvas`, passes parsed source
  into it, and switches the same leaf to the native editor.

## Call flow

Obsidian creates `MindMapView` through `plugin.registerView`. The view loads data through
`TextFileView`, mounts `MapCanvas`, exposes `getViewData` for saving, and delegates source switching to
`components/source/SourceSwitch`.
