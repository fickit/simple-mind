# Render

## Purpose

Mounts the map as HTML nodes and SVG connectors, and owns pan, zoom, selection, collapse buttons, and
the hidden label measurement element.

## Why it exists

HTML nodes make editing and theming direct; SVG connectors keep curves crisp. Keeping the renderer
separate from the parser and layout lets each layer be tested on its own.

## Files

- `MapRenderer.ts`: keyed node/edge updates, world transform, fit, pan, zoom, selection, and the
  culling decision for large maps.
- `measure.ts`: hidden DOM measurement with a text/theme cache.
- `inlineMarkdown.ts`: safe inline Markdown rendering.
- `connectors.ts`: curve and orthogonal SVG paths.
- `culling.ts`: pure viewport-to-world math used to pick what stays mounted.
- `icons.ts`: inline SVG icons for the chevrons, add, close, and alignment controls, drawn from a
  stroke path table so no icon dependency is needed.

## Call flow

`MapCanvas` renders a `MindMapDocument`, which calls `layoutDocument`, updates the DOM, and fits the
result. Collapse clicks return to `MapCanvas`, which mutates runtime state and re-renders. Above the
culling threshold, every transform change re-runs the keyed update so panning mounts what it reveals.
