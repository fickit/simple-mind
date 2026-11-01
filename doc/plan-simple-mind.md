# Simple Mind — Implementation Plan

- Status: Draft
- Version: 0.1
- Date: 2026-11-01
- Related: `doc/prd.md`, `doc/design-simple-mind.md`

Legend: `√` done, `x` rejected, `-` not done.

## Branch and commit policy

- Each top-level module gets its own branch.
- All tasks under a module share that branch.
- Merge the branch once every task in the module is complete and verified.
- One commit per module, only after the module's verification commands pass.
- Commit messages state only what was done in one sentence. No file lists, implementation notes, or
  technical details.
- Run `git status` before every commit and exclude test-vault workspace state, build output, and
  secrets.

Top-level branches:

1. `feat/scaffold`
2. `feat/document`
3. `feat/layout`
4. `feat/render`
5. `feat/interaction`
6. `feat/themes`
7. `feat/view`
8. `feat/settings`
9. `feat/release`

## Phase 0 — Documentation and project scaffold

- `√` Write `doc/prd.md`, `doc/design-simple-mind.md`, and `doc/plan-simple-mind.md` in English.
- `√` Self-review the three documents for placeholders, contradictions, and scope creep.
- `√` Initialize the Git repository and `.gitignore`.
- `√` Add `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `versions.json`, and `LICENSE`.
- `√` Add `manifest.json` with provisional product metadata (`Simple Mind`, desktop-only); final
  author and repository fields are set in Phase 9.
- `√` Add development scripts: `dev`, `build`, `typecheck`, `lint`, and `test`; the benchmark script
  is added in Phase 9 with the core engine.
- `√` Add `test-vault/` with a minimal `.obsidian` configuration and a sample `.mindmap` file.
- `√` Add the root `README.md` and `README.zh-CN.md` skeletons.
- `√` Add `src/config/constants.ts` and `src/config/defaults.ts`.
- `√` Add `src/styles/` base styles and the view root class.
- `√` Verify: `npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- `√` Commit `feat/scaffold`.

Verification:

```bash
npm install
npm run typecheck
npm run build
```

## Phase 1 — Feasibility spike (must pass before view work)

- `√` Register `.mindmap` with the map view type and open it in the test vault.
- `√` Verify the map view opens and loads a file in the test vault.
- `√` Record the concrete failure found during the spike: a private `titleEl` field shadowed
  `ItemView.titleEl` and broke the view header. The field is now `headerTitleEl`.
- `√` Add a file-open fallback and ribbon action so the map view opens even if the extension mapping
  is claimed by Markdown.
- `-` Verify the map view saves through `TextFileView` after an edit.
- `-` Switch the same leaf to the native `markdown` view in source mode.
- `-` Verify the native editor opens the `.mindmap` file and the text is editable.
- `-` Switch back to the map view and verify the saved content is reloaded.
- `-` Verify `Plugin.removeCommand` is available at the chosen `minAppVersion`.
- `√` Commit the view checkpoint on `feat/view`; the temporary preview is replaced by the canvas in
  the core and view phases.

Verification: manual test in `test-vault` with Obsidian.

## Phase 2 — Document: parser, serializer, model, history

Branch: `feat/core`

- `√` Define `MindNode`, `MindMapMeta`, `MindMapDocument`, `SourceText`, `ParseResult`, `ParseError`,
  and `ParseWarning` in `src/types/`.
- `√` Implement a dependency-free frontmatter splitter and `mindmap` block reader that clamps values
  and preserves unknown lines.
- `√` Implement the outline parser with the grammar defined in the design document.
- `√` Implement line-numbered parse errors for unsupported lines, multiple H1s, ordered lists, and
  invalid indentation.
- `√` Implement canonical serialization with two-space indentation and `-` markers.
- `√` Implement frontmatter merge that preserves unknown keys and updates only the `mindmap` block.
- `√` Implement document validation: non-empty labels, single root, enum values, numeric clamps.
- `√` Implement the tree lookup used by the renderer.
- `√` Implement bounded source-snapshot history with undo and redo.
- `-` Implement the full command controller (add, delete, move, edit, paste); deferred to the
  interaction phase.
- `√` Add `README.md` for the parser, history, and model modules.
- `√` Unit tests: parser, serializer, roundtrip, frontmatter, errors, history.
- `√` Verify: `npm run typecheck && npm run test`.
- `√` Commit the core checkpoint after the renderer is wired.

Verification:

```bash
npm run typecheck
npm run test -- parser
```

## Phase 3 — Layout

Branch: `feat/core`

- `√` Define the measurement interface and a DOM-based measurer with a cache.
- `√` Implement collapse-aware tree preparation.
- `√` Implement horizontal block layout for `tree` and `mindmap`.
- `√` Implement the mind-map side split with height balancing while preserving order.
- `√` Implement vertical block layout for `org`.
- `√` Implement alignment (`center`, `start`) and compact spacing.
- `√` Implement connector anchors and three path generators: `curve`, `orthogonal`, `straight`.
- `√` Implement bounds calculation over nodes.
- `√` Add `README.md` for the layout module.
- `√` Unit tests with injected measurements for all modes, collapse, spacing, alignment, and bounds.
- `√` Verify: `npm run typecheck && npm run test -- layout`.
- `√` Commit the core checkpoint after the renderer is wired.

Verification:

```bash
npm run typecheck
npm run test -- layout
```

## Phase 4 — Renderer

Branch: `feat/core`

- `√` Implement the DOM structure: view root, toolbar slot, canvas, world, SVG edge layer, node layer,
  inline editor slot, and error banner.
- `√` Implement keyed node views and edge views.
- `√` Implement inline Markdown rendering with DOM APIs and URL validation.
- `√` Implement the measurement cache integration and invalidation on theme/font changes.
- `-` Implement `requestAnimationFrame` batching for layout and render; deferred to the performance
  phase.
- `√` Implement the world transform, pan, wheel, zoom, zoom controls, and fit.
- `-` Implement viewport culling above a threshold; the engine keeps a hook for the performance phase.
- `√` Implement selection classes and accessibility roles.
- `√` Add `README.md` for the renderer module.
- `√` DOM tests: node diff, edge diff, no duplicates, inline Markdown safety, pan/zoom math, culling.
- `√` Visual self-check in a standalone browser demo in light and dark mode.
- `√` Verify: `npm run typecheck && npm run test -- render`.
- `√` Commit the core checkpoint.

Verification:

```bash
npm run typecheck
npm run test -- render
```

## Phase 5 — Interaction and editing

Branch: `feat/core`

- `√` Implement selection, canvas focus, and spatial arrow-key navigation.
- `√` Implement the inline input editor with Enter/Escape/blur behavior and IME composition handling.
- `√` Reflow the tree with the live editor size on animation frames so children move and connectors
  stay attached while typing.
- `√` Implement Tab/Shift+Tab/Enter/Delete/F2 shortcuts; Enter/Tab in the editor commit and continue
  with a sibling/child; Space is reserved for text input and the collapse shortcut is deferred.
- `√` New nodes open as empty single-line editors with a default width and no placeholder.
- `√` Add a two-tab style panel. Style: theme, layout, alignment, compact mode, and connector shape
  for the file; node shape, fill, border color, and border width for the selected node. Text: font
  family and size, text color, bold, italic, underline, alignment, and line height for the selected
  node.
- `√` Keep horizontal gap, vertical gap, and maximum node width in plugin settings. Add global
  defaults for font, connector color, and connector thickness; a thickness of 0 uses the theme.
- `√` Store per-node styles in trailing `<!-- sm:{...} -->` markers, validate and clamp them on parse,
  and preserve them through rename, move, copy, and paste.
- `√` Apply per-node styles in the renderer, measurement cache, inline editor, and stylesheet; show
  the effective color in each color control and let reset remove the override.
- `√` Keep connector shape per file, and disable node/text controls until a node is selected.
- `√` Drop legacy file-level node/text style keys with a warning.
- `√` Refresh maps on Obsidian light/dark changes through `css-change` plus a body-class fallback.
- `√` Implement drag start threshold, reparent, reorder, drop indicators, and hover-to-expand.
- `√` Implement internal clipboard, cut, copy, and paste, plus system-clipboard text fallback.
- `√` Wire add, rename, delete, move, collapse, undo, and redo through `MapController` and history.
- `√` Implement root protection for delete and cut; the root cannot be dragged.
- `√` Implement read-only mode when parse errors exist.
- `√` Add `README.md` for the interaction module.
- `√` DOM tests: editing lifecycle, shortcuts, add/delete, undo, read-only mode, IME guard,
  copy/paste, and drop-position resolution.
- `√` Verify: `npm run typecheck && npm run test -- interaction`.
- `-` Manual test in the test vault: drag every direction, auto-expand, copy/paste, undo/redo.
- `√` Commit the interaction checkpoint after the view save path is wired.

Verification:

```bash
npm run typecheck
npm run test -- interaction
```

Manual: open a sample map in Obsidian and exercise every shortcut.

## Phase 6 — Themes

Branch: `feat/core`

- `√` Define `ThemeTokens`, `ThemeDefinition`, `NodeShape`, and `ConnectorStyle`.
- `√` Implement the eight built-in themes with light and dark variants.
- `√` Implement built-in theme resolution with native-theme fallback and per-file frontmatter
  selection.
- `√` Implement CSS variable compilation scoped to the view root.
- `√` Implement automatic light/dark switching on `workspace.on('css-change')`.
- `√` Implement custom theme validation, clone, rename, delete, import, and export.
- `√` Implement the theme editor modal with light/dark tabs and a live preview.
- `√` Add `README.md` for the theme module.
- `√` Unit tests: built-in theme count, token completeness, fallback behavior, frontmatter selection.
- `√` Verify: `npm run typecheck && npm run test`.
- `-` Manual test: all eight themes and custom theme reload.
- `√` Commit the built-in theme checkpoint.

Verification:

```bash
npm run typecheck
npm run test -- theme
```

## Phase 7 — View integration

Branch: `feat/core`

- `√` Implement `MindMapView extends TextFileView` with `getViewData`, `setViewData`, `clear`, and
  `requestSave` integration.
- `√` Implement parse-error handling and read-only rendering.
- `√` Implement the Source action: save, switch the same leaf to `markdown` source mode.
- `√` Implement the status-bar action and toggle command to return to the map.
- `√` Implement commands: new mind map, toggle, add child, add sibling, delete, edit, undo, redo, fit.
- `-` Implement a filename prompt for new maps; v1 creates a numbered file directly.
- `-` Restore map pan/zoom/selection per file where practical.
- `-` Update the root README architecture section for the final module layout.
- `√` Verify: `npm run typecheck && npm run build`.
- `-` Manual test in `test-vault`: default map, source switch, save/reload, commands, status bar.
- `√` Commit the integration checkpoint.

Verification:

```bash
npm run typecheck
npm run build
```

Manual: complete the source/map switching checklist.

## Phase 8 — Settings and internationalization

Branch: `feat/core`

- `√` Implement the settings schema and persistence.
- `√` Implement the settings tab: general defaults, layout defaults, global font/connector defaults,
  theme management, language.
- `√` Implement English and Chinese dictionaries and `t()`.
- `√` Re-register commands on language change without changing command ids.
- `√` Translate the view, toolbar, notices, commands, settings, and theme editor strings.
- `√` Implement reset-to-defaults.
- `√` Add `README.md` for the settings module.
- `√` Verify: `npm run typecheck && npm run test`.
- `-` Manual test: switch languages, change defaults, create a new file, verify frontmatter, edit and
  import/export custom themes.
- `√` Commit the settings and theme-editor checkpoint.

Verification:

```bash
npm run typecheck
npm run test
```

## Phase 9 — Verification, performance, and release

Branch: `feat/release`

- `-` Add `scripts/benchmark.mjs` to generate 100, 500, and 1,000 node maps and time parse, layout,
  first render, and incremental edit.
- `-` Record benchmark output in `doc/benchmark-simple-mind.md`.
- `-` Complete the manual checklist in `test-vault`.
- `-` Verify parse-error, invalid-frontmatter, unknown-theme, save-failure, and root-protection paths.
- `-` Run the full verification suite.

```bash
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/benchmark.mjs
```

- `-` Update root `README.md`, `README.zh-CN.md`, and `CHANGELOG.md`.
- `-` Set `manifest.json` author name, author URL, repository URL, and funding URL from project owner
  information.
- `-` Set `version: 0.1.0` and update `versions.json`.
- `-` Confirm the release bundle contains only `main.js`, `manifest.json`, and `styles.css`.
- `-` Add the GitHub release workflow if the project owner wants automated releases.
- `-` Commit `feat/release`.

## Phase 10 — Deferred beyond v1 (excluded from this plan)

- `x` Mobile touch layout.
- `x` Multi-selection and batch operations.
- `x` Node summaries and arbitrary cross-node links.
- `x` Per-node styling.
- `x` Export PNG/SVG/HTML.
- `x` `.md` note mode and embedded code-block mode.
- `x` Collapse-state persistence.
- `x` Obsidian backlink integration for `.mindmap`.

## Current status

- Documentation: written and self-reviewed.
- Phase 0 scaffold: complete; verification is green.
- Phase 1 view spike: custom view opens; source switching still needs a manual round-trip check.
- Phase 2 core document: parser, serializer, and history complete; command controller is next.
- Phase 3 layout: complete for mindmap, tree, and org.
- Phase 4 renderer: canvas, themes, pan/zoom, collapse, and inline Markdown complete; visual demo
  passed in light and dark mode. rAF batching and culling remain performance tasks.
- Phase 5 interaction: selection, inline editing, live reflow, add/delete, drag-and-drop, clipboard,
  undo/redo, and source serialization are implemented and tested. The Style/Text panel edits the
  selected node through inline style markers; connector shape stays per file, while connector color
  and thickness are global settings.
- Phase 6 themes: eight built-in themes, per-file selection, automatic light/dark switching, custom
  theme editing, import/export, and live preview are implemented.
- Phase 7 view integration: TextFileView, source switching, status bar, commands, and new-map creation
  are implemented; filename prompt and per-file view-state restore remain.
- Phase 8 settings/i18n: settings tab (including global font and connector defaults), custom theme
  management, language switching, command re-registration, and English/Chinese UI are implemented;
  manual verification remains.
- Next: manual verification in Obsidian, then performance benchmark, README polish, and release assets.
- Test vault: created with a sample map.
- Author metadata: `fickit`; repository URL still pending.
