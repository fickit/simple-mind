# Map Engine

## Purpose

Contains the framework-independent map engine: parsing, layout, rendering, interaction, and history.

## Why it exists

Obsidian owns the view lifecycle, but the map itself must be testable without Obsidian. Keeping the
engine inside `components/map` lets the view mount it and keeps Obsidian-specific code in `api/` and
`pages/`.

## Subdirectories

- `parser/`: `.mindmap` source parsing and serialization.
- `history/`: bounded source snapshots for undo/redo.
- `layout/`: measurement-driven positions and connector geometry.
- `render/`: HTML node and SVG edge rendering.
- `interaction/`: selection, editing, keyboard, and pointer input.
- `model/`: tree utilities shared by the engine.

## Call flow

Source text enters through `parser/`, becomes a `MindMapDocument`, is measured and positioned by
`layout/`, and is mounted by `render/`. `interaction/` mutates the document and triggers serialization
and history.
