# Styles

## Purpose

Contains the plugin's CSS source. `index.css` imports the style modules and is bundled by esbuild into
the root `styles.css` that Obsidian loads.

## Why it exists

Obsidian requires a single `styles.css` at the plugin root, while the project keeps styles separate
from TypeScript and grouped by responsibility. The build step bridges the two requirements.

## Files

- `index.css`: entry point for CSS bundling.
- `base.css`: view root class and base CSS variables.
- `map.css`: toolbar, canvas, node, connector, measurement, and error banner styles.

## Call flow

`npm run build` or `npm run dev` runs esbuild on `src/styles/index.css`, writes `styles.css`, and copies
it to the test vault plugin directory.
