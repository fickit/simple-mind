# Styles

## Purpose

Contains the plugin's CSS source. `index.css` imports the style modules and is bundled by esbuild into
the root `styles.css` that Obsidian loads.

## Why it exists

Obsidian requires a single `styles.css` at the plugin root, while the project keeps styles separate
from TypeScript and grouped by responsibility. The build step bridges the two requirements.

## Files

- `index.css`: entry point for CSS bundling.
- `base.css`: the plugin-owned `--smui-*` design tokens for both modes, plus the view and map root.
- `map.css`: floating menu, sidebar, canvas, node, connector, floating control, and error banner styles.
- `settings.css`: the settings tab and theme editor dialog, which reuse the same tokens.

## Call flow

`npm run build` or `npm run dev` runs esbuild on `src/styles/index.css`, writes `styles.css`, and copies
it to the test vault plugin directory.
