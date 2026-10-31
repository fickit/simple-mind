# Components

## Purpose

Holds UI components that are mounted inside pages. The map canvas and the settings UI will live here;
the source component currently owns the native editor switch helpers.

## Why it exists

Page classes should only compose layout and lifecycle. Keeping components separate prevents the view
class from growing into the parser, renderer, and settings UI at the same time.

## Subdirectories

- `source/`: helpers for switching between the map view and Obsidian's native Markdown editor.

## Call flow

`pages/MindMapView` uses `components/source/SourceSwitch` to save the current file and change the
leaf's view type. Later phases add `map/` and `settings/` here.
