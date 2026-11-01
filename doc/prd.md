# Simple Mind — Product Requirements Document

- Status: Approved for implementation
- Version: 0.1
- Date: 2026-11-01
- Product: Simple Mind (`simple-mind`)
- Platform: Obsidian desktop

## 1. Overview

Simple Mind is an Obsidian plugin for editing mind maps stored as readable Markdown outline files.
Each map is a `.mindmap` file. The map view and the native Obsidian Markdown editor live in the same
tab and can be switched without leaving the file.

The plugin is an independent implementation. It borrows architectural ideas from mind-elixir-core
(editable DOM nodes plus an SVG connector layer, CSS-variable themes, command-based history) and
markmap (Markdown outline semantics, stable node keys, foldable trees, variable-size layout), but it
does not copy their source code and does not depend on them at runtime.

## 2. Goals

1. Keep the map and its source in one file and one tab, with an explicit Map / Source toggle.
2. Make structural editing direct: add, edit, delete, collapse, reorder, and reparent nodes in the map,
   then write the change back to the Markdown outline.
3. Provide a theme system with eight built-in themes, automatic light/dark switching that follows
   Obsidian, and a UI editor for custom themes.
4. Stay responsive at a target size of 1,000 nodes per map.
5. Ship as a clean, English-first, dependency-light Obsidian community plugin.

## 3. Non-goals for v1

- Mobile support. The manifest is desktop-only until the interaction model is tested on touch devices.
- Per-node styling. Themes are global and may be overridden per file.
- Block-level Markdown inside nodes: images, tables, code blocks, and multi-line content.
- Node summaries, arbitrary cross-node links, and multi-selection.
- Export to PNG, SVG, or standalone HTML.
- Search across maps or integration with Obsidian's backlink graph.
- Persisting collapse state across reloads.

## 4. Target users

- Obsidian users who plan and structure knowledge as outlines and want a visual overview.
- Users who prefer a plain-text, version-control-friendly source over an opaque JSON canvas.
- Users who want theme continuity with their Obsidian light/dark setup.

## 5. Functional requirements

### 5.1 File entry and source format

- The plugin registers the `.mindmap` extension and opens those files in the map view by default.
- A file contains optional YAML frontmatter followed by exactly one H1 root and a nested unordered
  list.
- Node labels are single-line basic inline Markdown: bold, italic, strikethrough, inline code, and
  standard links.
- Unknown frontmatter keys are preserved. The plugin owns only the `mindmap` key.
- Invalid source produces a line-numbered error. Map editing is disabled until the source is valid, so
  a map edit cannot silently destroy unsupported Markdown.

Example:

```markdown
---
mindmap:
  version: 1
  theme: obsidian
  layout: mindmap
  direction: right
  spacingX: 64
  spacingY: 18
  align: center
  compact: false
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

### 5.2 Source and map switching

- The map view exposes a Source action.
- Source mode uses the native Obsidian Markdown editor in the same tab.
- The native editor exposes a command and a status-bar action to return to the map.
- Unsaved content is saved before the view type changes.
- Cursor and scroll position are restored when practical. Native editor undo history is not preserved
  across the switch; this limitation is documented.

### 5.3 In-map editing

- Add child, add sibling, edit label, delete node, collapse/expand.
- Drag to reparent or reorder.
- Undo and redo for all map operations.
- Copy, cut, and paste a node subtree.
- Keyboard navigation and shortcuts: Tab, Enter, Shift+Tab, Delete, F2, arrow keys,
  Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+C/X/V.
- Enter commits an inline edit and starts a sibling; Tab commits and starts a child;
  Shift+Enter and Shift+Tab commit without starting another node.
- Collapse and expand are available from the node badge. A keyboard collapse shortcut is deferred, and
  Space is reserved for text input.
- The root node cannot be deleted.
- Empty new nodes are discarded if editing is cancelled.

### 5.4 Layout

- Three modes: mind map (root centered, branches on both sides), tree (all branches left or right),
  and organization chart (root on top, branches downward).
- Adjustable horizontal gap, vertical gap, alignment, compact mode, and maximum node width.
- Global defaults live in settings; each file can override them in frontmatter.
- Collapsed nodes hide their descendants but remain selectable and expandable.

### 5.5 Themes

- Eight built-in themes, each with a light and a dark token set.
- Automatic switching when Obsidian changes between light and dark.
- Custom theme editor covering colors, node shape, connector style, fonts, and light/dark variants.
- Custom themes can be duplicated, renamed, deleted, imported, and exported as JSON.
- A file may select a theme in frontmatter; otherwise the global default applies.

### 5.6 Performance

- Target: 1,000 nodes per map on a desktop machine.
- Incremental node and edge updates; no full DOM rebuild on every edit.
- Node measurement cache keyed by label, typography, max width, and padding.
- Layout and rendering batched with `requestAnimationFrame`.
- Viewport culling is available behind a threshold for larger maps but is not required for the 1,000
  node target.

### 5.7 Settings and language

- Settings: default theme, default layout and parameters, language, and theme management.
- UI language: English and Chinese, manually switchable and centrally managed.
- All source comments, documentation, manifest fields, and default UI strings are English.

### 5.8 Obsidian integration

- Ribbon action and command to create a new mind map.
- Command to toggle between map and source in the same tab.
- Map-only commands for add child, add sibling, delete, edit, collapse, undo, redo, and fit.
- Status-bar action visible when a `.mindmap` file is open in the native editor.
- Settings tab for defaults and themes.

## 6. Non-functional requirements

- Security: no remote code, no telemetry, no network requests. User-authored labels are rendered with
  DOM APIs, never with unsanitized `innerHTML`.
- Data safety: never rewrite source when parsing fails; save before switching views; surface save
  failures with a clear notice.
- Accessibility: tree roles, keyboard-only operation, visible focus, and readable contrast.
- Compatibility: desktop Obsidian with `minAppVersion` set to the minimum version that supports
  `Plugin.removeCommand` (1.7.2).
- Official plugin readiness: English README, MIT license, release assets limited to `main.js`,
  `manifest.json`, and `styles.css`.

## 7. Architecture summary

- Rendering: absolutely positioned HTML nodes plus one SVG connector layer inside a transformed world
  container.
- Layout: recursive variable-size block layout in O(n).
- State: source text is the single source of truth; the map is a structured view over it.
- History: bounded snapshots of serialized source; undo reparses the snapshot.
- Theming: token objects compiled to scoped CSS variables.
- Runtime dependencies: Obsidian API only.

## 8. Feature modules

1. Document: outline parser, serializer, frontmatter merge, validation errors.
2. Layout: measurement abstraction, three layout modes, bounds and connector geometry.
3. Rendering: keyed node/edge views, world transform, pan/zoom, measurement cache, culling hook.
4. Interaction: selection, inline editor, keyboard, drag and drop, clipboard.
5. Themes: token schema, eight presets, theme resolution, custom theme validation.
6. View: `.mindmap` TextFileView, native editor switching, commands, status bar.
7. Settings: defaults, language, theme editor, import/export.
8. Infrastructure: config, i18n, Obsidian adapters, tests, scripts, docs.

## 9. Success criteria

- A `.mindmap` file opens as a map with no manual setup after enabling the plugin.
- Source and map switch in the same tab without data loss.
- Add, edit, delete, collapse, drag, copy/paste, undo, and redo update both the map and the source.
- All eight themes work in light and dark mode, and a custom theme survives a plugin reload.
- A synthetic 1,000-node map opens, lays out, and responds to edits within the performance budget
  recorded by the benchmark script.
- The plugin builds with `npm run build`, passes `npm run typecheck`, and passes the unit test suite.
- The manual checklist in the test vault is completed on desktop.

## 10. Risks

1. Native MarkdownView may not treat `.mindmap` as Markdown or may have poor syntax presentation.
   Mitigation: verify with an early spike before building the full view layer.
2. Switching view types may drop editor history or lose unsaved data. Mitigation: save explicitly,
   restore cursor/scroll, and document the undo limitation.
3. Inline Markdown measurement and wrapping can become a performance hotspot. Mitigation: measure with
   a cache and re-measure only changed labels or theme changes.
4. Custom theme UI can grow beyond v1. Mitigation: fixed token schema and a compact editor with a live
   preview.
5. Drag and drop can conflict with text editing and IME on desktop. Mitigation: separate hit targets,
   a movement threshold, and composition-aware editing.

## 11. Release criteria

- Version 0.1.0, `isDesktopOnly: true`, MIT license.
- `README.md` in English and `README.zh-CN.md` in Chinese.
- `CHANGELOG.md` and `versions.json` present.
- GitHub release contains `main.js`, `manifest.json`, and `styles.css`.
- No secrets, no absolute local paths, and no generated test-vault artifacts in the release bundle.
