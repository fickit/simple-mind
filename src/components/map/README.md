# Map

## Purpose

Holds the map canvas component and the framework-independent map engine.

## Why it exists

The Obsidian page should only mount and unmount a map. All parsing, layout, rendering, theming, and
editing stay inside this directory so they can be tested without a live vault.

## Files and subdirectories

- `MapCanvas.ts`: canvas component that wires the document to the renderer, the floating menu, the
  style panel, node add/collapse actions, inline resources, and the image lightbox.
- `engine/`: parser, layout, renderer, interaction, history, and model utilities. Inline labels use
  `engine/render/inlineMarkdown.ts` for note links and images, `engine/render/imageSizes.ts` for
  natural sizes, and `engine/interaction/inlineSuggest.ts` for `[[` / `![[` autocomplete.
- `themes/`: theme tokens, presets, per-file style overrides, and validation helpers.

## Call flow

`pages/MindMapView` creates a `MapCanvas`, passes parsed documents and the inline resource host into
it, and asks it for serialized source when saving. The canvas owns the engine lifecycle and DOM.
