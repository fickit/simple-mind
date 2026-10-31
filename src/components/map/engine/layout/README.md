# Layout

## Purpose

Turns a parsed tree and measured node sizes into world-space positions, connector edges, and bounds.

## Why it exists

Layout is pure and independent from the DOM renderer. Injected measurements keep it testable and make
the three map modes share the same block-placement rules.

## Files

- `types.ts`: node sizes, measurer contract, positioned nodes, edges, and bounds.
- `layout.ts`: horizontal mindmap/tree layout, vertical organization layout, collapse handling,
  side balancing, compact spacing, and alignment.

## Call flow

`MapRenderer` supplies a DOM measurer and calls `layoutDocument`. The returned positions drive the
keyed node elements and SVG paths.
