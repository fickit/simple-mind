# Simple Mind

A Markdown-outline mind map editor for Obsidian.

> Status: early development. The map view, editing interactions, themes, and settings are being built
> against the design in `doc/design-simple-mind.md`.

## What it does

Simple Mind stores a mind map as a readable `.mindmap` file:

```markdown
---
mindmap:
  version: 1
  theme: meadow
  layout: mindmap
  spacingX: 64
  spacingY: 18
  maxWidth: 280
---
# Product plan
- Discovery
  - User interviews
  - Competitive scan
- Delivery
  - Core editor
  - Theme system
```

The file opens as a map. The Source action switches the same tab to Obsidian's native Markdown editor.

## Target features

- Four layouts: mind map, tree to the right, tree to the left, and organization chart.
- Direct editing: add, edit, delete, collapse, drag, copy/paste, undo, and redo.
- Nine built-in themes with automatic light/dark switching and a custom theme editor.
- One style panel that edits the file's theme, layout, and connector shape together with the selected
  node's shape, colors, and text; connector color, thickness, and font family live in settings.
- Hover controls: connector-colored collapse chevrons, hidden-node count bubbles, and side-aware
  floating add buttons.
- English and Chinese UI.
- Desktop-first performance target of 1,000 nodes per map.

## Install for development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build once, or start watch mode:

   ```bash
   npm run build
   npm run dev
   ```

3. Open the `test-vault` folder as an Obsidian vault. It is a local, git-ignored vault, so create the
   folder if it is missing; the build writes the plugin to `test-vault/.obsidian/plugins/simple-mind`.

4. Reload Obsidian after rebuilding. Obsidian does not hot-reload community plugins by default.

## Source rules

- Exactly one H1 root.
- One nested unordered list under the root.
- Node labels are single-line basic inline Markdown.
- Per-node styles live in a trailing `<!-- sm:{...} -->` comment on the node's line.
- Invalid source shows a line-numbered error and locks map editing to prevent data loss.
- Blank lines and list-marker style are normalized when the map writes the file.

## Development commands

```bash
npm run dev        # watch TypeScript and CSS; sync the test vault
npm run build      # production bundle
npm run typecheck  # TypeScript check
npm run lint       # Biome check
npm run test       # unit tests
node scripts/benchmark.mjs  # synthetic performance report
```

## Architecture

- `src/pages`: Obsidian view lifecycle.
- `src/components`: map canvas, settings, source switching, and the map engine.
- `src/types`: shared TypeScript types.
- `src/styles`: CSS source, bundled to `styles.css`.
- `src/api`: Obsidian adapters.
- `src/config`: constants, defaults, and i18n.

The map uses HTML nodes and SVG connectors. Layout, rendering, and editing are implemented locally
without a mind-map runtime dependency.

## Documentation

- `doc/prd.md`
- `doc/design-simple-mind.md`
- `doc/plan-simple-mind.md`
- `doc/benchmark-simple-mind.md`

## License

MIT. Copyright (c) 2026 fickit.
