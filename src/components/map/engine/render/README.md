# Render

## Purpose

Mounts the map as HTML nodes and SVG connectors, and owns pan, zoom, selection, collapse buttons, and
the hidden label measurement element.

## Why it exists

HTML nodes make editing and theming direct; SVG connectors keep curves crisp. Keeping the renderer
separate from the parser and layout lets each layer be tested on its own.

## Files

- `MapRenderer.ts`: keyed node/edge updates, world transform, fit, pan, zoom, and selection.
- `measure.ts`: hidden DOM measurement with a text/theme cache.
- `inlineMarkdown.ts`: safe inline Markdown rendering.
- `connectors.ts`: curve and orthogonal SVG paths with a lead before branching.

## Call flow

`MapCanvas` renders a `MindMapDocument`, which calls `layoutDocument`, updates the DOM, and fits the
result. Collapse clicks return to `MapCanvas`, which mutates runtime state and re-renders.
