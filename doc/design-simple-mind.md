# Simple Mind — Design

- Status: Approved for implementation
- Version: 0.1
- Date: 2026-11-01
- Related: `doc/prd.md`, `doc/plan-simple-mind.md`

## 1. Context and goals

Simple Mind is an Obsidian plugin that edits a mind map stored as a readable Markdown outline. The
core problem is two-way editing without a fragile synchronization loop: a map operation must update
the source text, and a source edit must rebuild the map.

The design therefore makes the source text the only persistent truth. The map is a structured,
rendered view of that text plus transient UI state. This keeps the file portable, diffable, and
compatible with version control.

## 2. Approach and trade-offs

### 2.1 Rendering approach

Three approaches were considered.

| Approach | Strengths | Costs | Decision |
| --- | --- | --- | --- |
| HTML nodes plus SVG connectors | Direct editing, keyboard support, CSS theming, cheap measurement and keyed updates | Custom layout and connector geometry | Chosen |
| SVG `foreignObject` nodes | Natural rich HTML rendering, proven by markmap | Editing inside SVG is awkward, measurement and culling are harder | Rejected |
| Canvas rendering | Highest ceiling for very large graphs | Selection, editing, accessibility, and theming must be rebuilt | Rejected |

The chosen approach keeps node content in normal DOM. Each node is an absolutely positioned element
inside a single transformed world container. Connectors live in one SVG layer in the same world
container, so panning and zooming only mutate one transform.

### 2.2 Dependencies

The plugin has no runtime dependency beyond the Obsidian API. It does not use mind-elixir-core,
markmap, d3, or markdown-it. The implementation uses TypeScript, DOM APIs, SVG path generation, and
Obsidian utilities such as `parseYaml`, `stringifyYaml`, and `setIcon`.

Development dependencies are limited to the Obsidian sample-plugin toolchain plus a test runner and
DOM test environment.

## 3. File contract

### 3.1 Document shape

A `.mindmap` file has three optional or required parts:

1. Optional YAML frontmatter delimited by `---` lines.
2. Exactly one H1 heading: `# Root label`.
3. A nested unordered list under the H1.

The H1 label is the root node. Every top-level list item is a child of the root. Indentation defines
deeper relationships.

### 3.2 Frontmatter schema

```yaml
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
```

- `version`: format version. v1 only.
- `theme`: id of a built-in or custom theme.
- `layout`: `mindmap`, `tree`, or `org`.
- `direction`: `right` or `left`; used only by `tree`.
- `spacingX`: horizontal gap in CSS pixels; clamped to 8-240.
- `spacingY`: vertical gap in CSS pixels; clamped to 4-120.
- `align`: `center` or `start`; controls parent alignment relative to its child block.
- `compact`: boolean; reduces gaps.
- `maxWidth`: maximum node width; clamped to 120-600.
- Optional per-file style overrides, applied on top of the selected theme:
  - Node: `nodeShape` (`rounded`, `pill`, `underline`, `plain`), `nodeFillColor`, `nodeBorderColor`,
    `nodeBorderWidth` (0-8).
  - Connector: `connectorStyle` (`curve`, `orthogonal`, `straight`), `connectorColor`,
    `lineWidth` (1-6).
  - Text: `fontFamily`, `fontSize` (8-32), `textColor`, `bold`, `italic`, `underline`,
    `textAlign` (`left`, `center`, `right`), `lineHeight` (1-3).

  An override is deleted from the file when the control is reset, so the theme value applies again.
  Themes own complete style designs (colors, fonts, shapes, and connectors); per-file overrides only
  replace the fields the user changes.

Missing values fall back to plugin defaults. Invalid values fall back to the default, produce a
non-blocking notice, and are not written back until the user changes the corresponding setting.

Unknown keys inside `mindmap` and unknown top-level frontmatter keys are preserved when the plugin
updates the `mindmap` block. YAML comments inside the `mindmap` block may be normalized when that block
is rewritten.

### 3.3 Outline grammar

- The parser accepts `-`, `*`, and `+` as unordered list markers. The serializer emits `-`.
- The canonical indentation is two spaces per level. Tabs are treated as two spaces for parsing.
- An indentation increase creates a child of the previous item. An equal indentation creates a
  sibling. A decrease must return to a previously seen indentation level; otherwise it is a parse
  error.
- A list item label must be non-empty after trimming.
- Labels are single-line. Block content is not supported.
- Blank lines are ignored and are not preserved by the serializer.
- The first non-blank line after frontmatter must be the H1 root. A second H1, an H2-H6, an ordered
  list, a paragraph, a table, a code fence, an image-only block, or any other unsupported line is a
  parse error with a line number.
- Labels are stored and edited as raw inline Markdown. The serializer preserves the raw label text.

Example:

```markdown
# Root
- **Bold** child
- Child with `code` and [link](https://example.com)
  - Grandchild
```

### 3.4 Parse result and failure behavior

```ts
interface ParseError {
  line: number;
  message: string;
}

interface ParseResult {
  document: MindMapDocument | null;
  errors: ParseError[];
}
```

When `errors.length > 0`:

- The map view shows a banner with the first error and a count.
- The map is rendered in a read-only state if a partial document can be built; otherwise the canvas is
  empty.
- Map editing and serialization are disabled.
- The Source action remains available so the user can repair the file.

This prevents a map operation from overwriting unsupported content.

### 3.5 Serialization

Serialization writes the root as `# <label>`, then walks the tree with two spaces per depth and `- `
markers. It preserves the frontmatter block and rewrites only the `mindmap` key when metadata changes.
The body is normalized: blank lines are removed, list markers become `-`, and indentation becomes two
spaces.

Source-to-map-to-source is structurally lossless for the supported subset. Formatting such as blank
lines, list marker style, and indentation width is normalized. This is documented for users.

## 4. Data model and interfaces

```ts
type LayoutKind = 'mindmap' | 'tree' | 'org';
type TreeDirection = 'right' | 'left';
type NodeAlignment = 'center' | 'start';

interface MindMapMeta {
  version: 1;
  theme: string;
  layout: LayoutKind;
  direction: TreeDirection;
  spacingX: number;
  spacingY: number;
  align: NodeAlignment;
  compact: boolean;
  maxWidth: number;
  nodeShape?: NodeShape;
  nodeFillColor?: string;
  nodeBorderColor?: string;
  nodeBorderWidth?: number;
  connectorStyle?: ConnectorStyle;
  connectorColor?: string;
  lineWidth?: number;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: TextAlign;
  lineHeight?: number;
}

interface MindNode {
  id: string;
  text: string;
  children: MindNode[];
  collapsed: boolean;
}

interface MindMapDocument {
  root: MindNode;
  meta: MindMapMeta;
  source: SourceText;
}

interface SourceText {
  frontmatterRaw: string | null;
  frontmatter: Record<string, unknown> | null;
  body: string;
}
```

`id` is a runtime identifier assigned during parsing. It is stable for the lifetime of a parsed
document and across map commands. A source edit reparses the document and assigns new identifiers;
collapse state and selection are transient UI state and may reset after a source edit.

`collapsed` is not serialized. It is runtime UI state. A source edit or reload resets it.

## 5. Module architecture and data flow

```
file text
  -> SourceParser        (frontmatter, outline, validation)
  -> MindMapDocument     (tree, meta, source)
  -> NodeMeasurer        (label and padding sizes)
  -> LayoutEngine        (positions, bounds, edge anchors)
  -> Renderer            (HTML nodes, SVG edges, world transform)
  <- Interaction         (selection, edit, drag, clipboard)
  <- CommandController   (mutations, history, validation)
  -> Serializer          (body and frontmatter)
  -> TextFileView        (requestSave)
```

The parser and serializer are pure functions over strings and documents. The layout engine is pure
for injected measurements. The renderer and interaction modules receive a host interface so they can
be tested in a real DOM without Obsidian.

### 5.1 Module responsibilities

| Module | Responsibility |
| --- | --- |
| `config` | Constants, defaults, i18n dictionaries, built-in theme presets |
| `pages/MindMapView` | Obsidian `TextFileView` lifecycle, map/source switching, file save/load |
| `components/map/MapCanvas` | Hosts the world layer, toolbar, error banner, and engine wiring |
| `engine/parser` | Frontmatter, outline grammar, validation, serialization |
| `engine/model` | Document and node types, tree utilities, validation |
| `engine/layout` | Measurement abstraction, three layout modes, edge geometry |
| `engine/render` | Keyed node/edge views, world transform, pan/zoom, culling hook |
| `engine/interaction` | Selection, inline editor, keyboard, drag/drop, clipboard |
| `engine/history` | Bounded source snapshots, undo/redo |
| `themes` | Token resolution, CSS variable mapping, custom theme validation |
| `components/settings` | Settings tab, theme editor, import/export |
| `components/source` | Native editor switching helpers and cursor/scroll restoration |
| `api/obsidian` | Vault, workspace, file, and theme adapters |

## 6. Layout engine

### 6.1 Measurement

The renderer asks a measurer for the rendered size of a label plus the active theme's padding and
border. The measurer uses a hidden DOM element with the same typography and `max-width` as a node,
and an `inline-block` inner element so short labels shrink to fit.

Cache key: label text, typography signature, max width, padding, border width, and shape. Theme or
font changes invalidate the whole cache. Label edits invalidate one entry.

### 6.2 Tree preparation

The layout engine receives a measured, collapse-aware tree. A collapsed node keeps its own size but
does not contribute its children to layout. The layout result contains only visible nodes.

### 6.3 Block layout

For horizontal layouts (`mindmap`, `tree`):

- Compute each subtree block height as
  `max(nodeHeight, sum(childBlockHeights) + spacingY * (childCount - 1))`.
- Place children in a vertical column. Child blocks are stacked with `spacingY`.
- Place the parent at `parentX`, and align its center to the child block center when
  `align = center`, or to the block start when `align = start`.
- Place children at `parentX + parentWidth + spacingX` for right-facing layout, mirrored for
  left-facing layout.

For the vertical layout (`org`):

- Compute each subtree block width symmetrically.
- Place children in a horizontal row with `spacingX`.
- Place the parent above the child block with `spacingY`.

For `mindmap`, the root's children are split into left and right groups. Iterate in source order and
assign each child to the side with the smaller accumulated block height. This preserves order within
each side while balancing the two wings.

Positioned nodes use top-left coordinates. The root's center is placed at world origin `(0, 0)`, so
negative coordinates are valid. The layout result includes a bounding rectangle over all visible
nodes and connector extents.

### 6.4 Connector geometry

Each node exposes four anchors: left, right, top, and bottom center. The parent anchor and child anchor
depend on layout and side:

- Mind map: horizontal anchors on the correct side.
- Tree: right/left anchors.
- Org: bottom parent anchor to top child anchors.

The theme selects a connector style:

- `curve`: cubic Bezier with horizontal control points.
- `orthogonal`: rounded elbow with a midpoint turn.
- `straight`: a straight line.

For org layout, the default is `orthogonal`; for mind map and tree, the default is `curve`.

### 6.5 Parameters

- `spacingX`: horizontal gap.
- `spacingY`: vertical gap.
- `align`: parent alignment relative to its child block.
- `compact`: multiply gaps by 0.6 and reduce the root's outer margin.
- `maxWidth`: node wrapping width.

## 7. Renderer

### 7.1 DOM structure

```html
<div class="simple-mind-view">
  <div class="simple-mind-toolbar">...</div>
  <div class="simple-mind-canvas" tabindex="0" role="tree">
    <div class="simple-mind-world">
      <svg class="simple-mind-edges" aria-hidden="true"></svg>
      <div class="simple-mind-nodes"></div>
      <textarea class="simple-mind-inline-editor"></textarea>
    </div>
  </div>
  <div class="simple-mind-error" hidden></div>
</div>
```

The world layer receives `translate3d(x, y, 0) scale(z)`. Node positions are world coordinates applied
with `translate3d`. The SVG uses a viewBox matching the layout bounds and `overflow: visible`.

### 7.2 Incremental updates

The renderer maintains maps from node id to node element and from child id to edge path. On update:

1. Diff the visible node set by id.
2. Create missing nodes and edges.
3. Update text, classes, and positions for changed nodes.
4. Update connector `d` attributes.
5. Remove nodes and edges no longer visible.

Text is updated only when the raw label changes. Theme changes update CSS variables and invalidate the
measurement cache, then trigger a re-layout.

### 7.3 Pan and zoom

- Pointer drag on empty canvas pans.
- Wheel scroll pans; Ctrl/Cmd+wheel zooms around the pointer.
- Toolbar buttons zoom in, zoom out, and fit.
- Scale is clamped to 0.2-2.5.
- Zoom changes only the world transform, never node layout.

### 7.4 Culling

At or below 1,000 nodes, all visible nodes are mounted. A `cullingThreshold` option exists for larger
maps: above the threshold, only nodes and edges intersecting the viewport plus a margin are mounted.
The interaction layer must still be able to select a node by id and reveal it. Culling is a performance
lever, not a v1 requirement for the target size.

### 7.5 Selection and focus

One node is selected at a time. Selection is a class plus `aria-selected`. The canvas keeps keyboard
focus for navigation. Node content can contain links; a modified click opens the link instead of
selecting the node.

## 8. Interaction and editing

### 8.1 Shortcuts

While the canvas has focus:

- Arrow keys: move selection spatially.
- Tab: add child and start editing.
- Shift+Tab: move selection to the parent.
- Enter: add a sibling after the selected node and start editing.
- Delete/Backspace: delete the selected node, except the root.
- F2 or double-click: edit the selected node.
- Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z: undo/redo map commands.
- Ctrl/Cmd+C/X/V: copy, cut, paste a subtree.
- Escape: clear selection.

While the inline editor is focused:

- Enter: commit and start a sibling editor.
- Tab: commit and start a child editor.
- Shift+Enter or Shift+Tab: commit without starting another node.
- Escape: cancel the edit.
- Blur: commit without starting another node.

Collapse and expand are available from the node badge. The keyboard collapse shortcut is deferred, and
Space is reserved for text input.

### 8.2 Inline editor

The inline editor is a `textarea` positioned inside the world layer at the node's location. Because it
is inside the world layer, it inherits the current zoom transform.

- It uses the raw label text, not the rendered inline Markdown.
- It auto-sizes to the longest content line, capped by `maxWidth`, and grows vertically when the text
  wraps. The editor's live rectangle temporarily replaces the node's measured size, so the tree
  reflows and connectors stay attached while typing.
- A new node opens as an empty single-line editor with a default width of 120px and no placeholder.
- Enter commits and starts a sibling editor; Tab commits and starts a child editor. Shift+Enter and
  Shift+Tab commit only. Escape cancels; blur commits without a follow-up.
- Composition events protect Chinese and other IME input.
- A new empty node is removed if editing is cancelled without committing text.
- Committing an empty label on an existing node keeps the old label and shows a notice.
- Source labels remain single-line. The editor provides soft wrapping; hard newline characters are not
  persisted in v1.

### 8.3 Drag and drop

- Drag starts after a four-pixel movement threshold.
- Drop on a node center: reparent as the last child.
- Drop on a node's top or bottom edge: insert as a sibling before or after.
- Drop on empty canvas: no change.
- Hovering a collapsed target for 500 ms expands it.
- The drag preview and drop indicator are visual only; the change is a single command on drop.
- The root cannot be dragged.

### 8.4 Clipboard

The internal clipboard stores a subtree as tree data and as serialized outline text. Pasting inserts
the subtree as a child of the selected node. If the internal clipboard is empty, the system clipboard
text is parsed as an outline when possible; otherwise it becomes a single node label with newlines
collapsed to spaces.

## 9. History and source synchronization

### 9.1 Command flow

Every map mutation follows the same path:

1. Validate the operation against the document.
2. Apply the mutation to the tree.
3. Serialize the body and, if needed, the `mindmap` frontmatter block.
4. Push the previous source text onto a bounded history stack.
5. Reparse the new source to confirm validity.
6. Update the map incrementally.
7. Call `requestSave()` on the text file view.

The reparse-after-mutation step guarantees that the map never drifts from a source that the parser
would reject.

### 9.2 History

History stores complete source strings, not incremental DOM state. Undo restores a previous source
string, reparses it, and re-renders. The stack is bounded (default 100 entries). Text edits are
coalesced into one history entry per committed edit. This is simple and robust; at 1,000 nodes the
serialized source is small enough for a bounded stack.

### 9.3 View switching and saving

The map view extends `TextFileView`. Before switching to the native editor:

1. If the current view is a `TextFileView`, await `save()`.
2. If saving fails, show a notice and keep the current view.
3. Store the current source cursor and scroll position in memory, keyed by file path.
4. Call `leaf.setViewState({ type: 'markdown', state: { file, mode: 'source' } })`.

Switching back uses a command or the status-bar action. After the map view loads, the plugin restores
the last map pan/zoom and selection if available.

Native editor undo history is not preserved across a view-type switch. This is a documented
limitation of reusing the native editor in the same leaf.

### 9.4 External changes

The view listens for `vault.on('modify')` events for its file. If the map is clean, it reloads the
file through the normal `TextFileView` load path. If an inline edit or drag is in progress, the view
defers the reload until the interaction commits or is cancelled, then shows a notice that the file
changed. Parse errors after an external change enter the same read-only mode as source errors.

## 10. Theme system

### 10.1 Tokens

```ts
type NodeShape = 'rounded' | 'pill' | 'underline' | 'plain';
type ConnectorStyle = 'curve' | 'orthogonal' | 'straight';

interface ThemeTokens {
  canvasBackground: string;
  node: {
    background: string;
    text: string;
    border: string;
    borderWidth: number;
    radius: number;
    paddingX: number;
    paddingY: number;
    shadow: string;
    shape: NodeShape;
  };
  root: {
    background: string;
    text: string;
    border: string;
    borderWidth: number;
    radius: number;
    shadow: string;
    shape: NodeShape;
  };
  branch: {
    palette: string[];
    lineWidth: number;
    opacity: number;
    style: ConnectorStyle;
  };
  typography: {
    family: string;
    size: number;
    weight: number;
    lineHeight: number;
  };
  selection: {
    outline: string;
    background: string;
  };
  collapse: {
    background: string;
    text: string;
  };
}

interface ThemeDefinition {
  id: string;
  name: string;
  builtIn: boolean;
  light: ThemeTokens;
  dark: ThemeTokens;
}
```

Tokens are compiled to CSS custom properties prefixed with `--simple-mind-` and applied to the view
root. Obsidian's global styles are never modified.

### 10.2 Built-in themes

| Id | Name | Character |
| --- | --- | --- |
| `obsidian` | Obsidian Native | Uses Obsidian surface/text/accent variables, transparent canvas |
| `paper` | Paper | Warm paper, ink text, muted palette |
| `graphite` | Graphite | Grayscale, high contrast |
| `nord` | Nord | Cool blue-gray palette |
| `solarized` | Solarized | Solarized light and dark palettes |
| `forest` | Forest | Green and earth tones |
| `ocean` | Ocean | Blue and teal tones |
| `sakura` | Sakura | Plum and pink tones |

Each theme provides both light and dark tokens. The active variant is selected by
`document.body.classList.contains('theme-dark')` and refreshed on `workspace.on('css-change')`.

### 10.3 Custom themes

- Built-in themes are read-only. The user can duplicate one into a custom theme.
- Custom themes live in plugin data and have generated ids.
- The editor provides light and dark tabs, color inputs, node shape and connector selects, font
  controls, and a small live preview.
- A theme is a full style design: colors, typography, node shape and border, and connector geometry
  and width all belong to the theme. Per-file overrides are applied on top.
- Import validates schema, clamps numeric values, and rejects unknown or malformed fields.
- Export writes a JSON object containing the theme definition.
- Deleting a theme that is referenced by a file falls back to the global default with a notice.

## 11. Obsidian integration

### 11.1 View types

- `VIEW_TYPE_MAP = 'simple-mind-map'`.
- `MindMapView extends TextFileView`.
- `registerExtensions(['mindmap'], VIEW_TYPE_MAP)` makes the map view the default for `.mindmap`.
- Source mode is the core `markdown` view type with `mode: 'source'`.

### 11.2 Commands

- New mind map.
- Toggle source/map.
- Add child, add sibling, delete node, edit node, toggle collapse.
- Undo, redo, fit to view.
- Open settings.

### 11.2.1 Front-end style sidebar

The map view includes a right-side style panel with two tabs:

- **Style**: theme, layout type, tree direction, parent alignment, compact mode; node shape, fill,
  border color, and border width; connector style, color, and thickness.
- **Text**: font family and size; text color, bold, italic, underline, text alignment, and line
  height.

The panel only exposes settings that belong to one map. Horizontal gap, vertical gap, and maximum
node width live in the plugin settings as defaults. The global default font lives in settings as
well; a font set in the Text tab overrides it for that file.

Every change is written to the file's `mindmap` frontmatter and reprocessed immediately, so existing
maps update without being recreated. Color controls fall back to the effective theme color and expose
a reset action that removes the override. A "Manage themes" action opens the settings tab for custom
theme creation and color editing.

Command names use the i18n dictionary. On language change, commands are removed and re-registered
using the same ids. This requires `minAppVersion: 1.7.2`.

### 11.3 Status bar

A status-bar item is shown when the active file is `.mindmap` in the native Markdown view. Clicking it
switches the same leaf back to the map. The item is hidden in the map view and for other files.

### 11.4 File creation

"New mind map" creates a `.mindmap` file with the default frontmatter and a starter root, then opens it
in the active leaf. The file name is requested through a modal or created from a default name; the
implementation uses a modal with validation.

### 11.5 `.mindmap` and the Obsidian graph

Obsidian indexes Markdown files for links and backlinks. A `.mindmap` file is not part of that index.
The native editor can still edit it. This is a documented consequence of the dedicated extension and
is accepted for v1.

## 12. Internationalization and documentation

- `src/config/i18n/en.ts` and `src/config/i18n/zh.ts` hold dictionaries.
- `t(key, params)` resolves the active language.
- Settings, commands, notices, tooltips, error banners, and theme editor strings use `t()`.
- Code comments, JSDoc, README, manifest, changelog, and design docs are English.
- `README.zh-CN.md` is the Chinese user guide.

## 13. Error handling and boundaries

- Parse errors: line-numbered banner; map editing disabled; source remains editable.
- Save errors: notice with the file path and reason; do not switch views.
- Unknown theme or layout: fall back to defaults, show a notice, keep editing enabled.
- Frontmatter YAML errors: banner; map editing disabled until fixed.
- Empty or unsupported paste: notice; no mutation.
- Root deletion or root drag: rejected with a notice.
- External file changes during editing: defer reload until editing ends.

Only external boundaries are validated: file text, frontmatter, theme JSON import, clipboard text, and
Obsidian view state. Internal calls trust the document invariants.

## 14. Performance plan

### 14.1 Budgets

The benchmark script measures parse, layout, first render, and incremental edit latency for synthetic
trees of 100, 500, and 1,000 nodes. Budgets are recorded in the benchmark output and compared across
changes. The target is interactive response (under 100 ms for a single edit) on a desktop machine; the
exact budget is confirmed by the first benchmark run rather than assumed.

### 14.2 Techniques

- No full DOM rebuild on edits.
- Node and edge maps keyed by id.
- Measurement cache with theme/font invalidation.
- `requestAnimationFrame` batching for layout and render.
- One transform for pan/zoom.
- CSS containment on nodes and the world layer.
- Culling above a configurable threshold.
- No Markdown rendering per node during pan/zoom.
- Debounced source saves; immediate in-memory serialization.

## 15. Testing strategy

### 15.1 Unit tests

- Parser: valid outlines, indentation, tabs, CRLF, frontmatter, multiple H1, unsupported lines, empty
  labels, line numbers.
- Serializer: canonical output, roundtrip, frontmatter preservation, unknown keys.
- Inline Markdown: bold, italic, strikethrough, code, links, escapes, and XSS attempts.
- Layout: all three modes, side balancing, collapse, spacing, alignment, variable sizes with injected
  measurements.
- History: undo/redo, coalescing, bounded stack.
- Themes: token resolution, light/dark selection, import validation, unknown theme fallback.
- Renderer: keyed diff, no duplicate nodes, edge updates, culling behavior.
- Commands: add, edit, delete, move, copy/paste, root protection.

### 15.2 Integration and manual tests

- Build into `test-vault/.obsidian/plugins/simple-mind`.
- Open a `.mindmap` file, toggle source, edit both sides, save, reload.
- Verify add/edit/delete/collapse/drag/copy/paste/undo/redo.
- Verify all layouts and layout parameters.
- Verify all eight themes in light and dark mode.
- Create, edit, export, import, and delete a custom theme.
- Verify Chinese IME editing.
- Verify errors: malformed outline, malformed YAML, unknown theme, save failure.
- Verify a 1,000-node synthetic map with the benchmark script.

### 15.3 Verification commands

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `node scripts/benchmark.mjs` (synthetic performance report)

## 16. Directory structure

```
src/
  main.ts
  config/
    constants.ts
    defaults.ts
    i18n/
      en.ts
      zh.ts
    themes/
      presets.ts
  pages/
    MindMapView.ts
  components/
    map/
      MapCanvas.ts
      engine/
        parser/
        layout/
        render/
        interaction/
        history/
        model/
      themes/
    settings/
      SettingsTab.ts
      ThemeEditorModal.ts
    source/
      SourceSwitch.ts
  types/
  styles/
  api/
    obsidian/
```

The five frontend categories required by `AGENTS.md` are `pages`, `components`, `types`, `styles`, and
`api`. `src/config` is an additional infrastructure directory required by the configuration rule.
`src/main.ts` is the Obsidian entry point.

Every module directory gets an English `README.md` describing its purpose, files, and call flow.

## 17. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Native MarkdownView rejects or poorly renders `.mindmap` | Source mode cannot use the native editor | Early spike; if it fails, return to the user with tested fallbacks |
| View switching loses editor state | UX regression | Save before switch; restore cursor and scroll; document undo reset |
| Drag conflicts with text editing and IME | Broken input | Separate drag handle, movement threshold, composition-aware editor |
| Inline Markdown measurement is slow | Lag at 1,000 nodes | Measurement cache, re-measure changed labels only, benchmark |
| Custom theme editor scope grows | Delays release | Fixed token schema; compact editor; no arbitrary CSS editing |
| `.mindmap` is outside Obsidian's Markdown graph | No backlinks | Documented trade-off; future optional `.md` mode is out of scope |
| Source rewrite destroys unsupported content | Data loss | Parse errors disable map editing; reparse after every mutation |

## 18. Out of scope for v1

- Mobile layout and touch gestures.
- Multi-selection and batch operations.
- Node summaries and arbitrary cross-node links.
- Per-node styles and collapse persistence.
- Images, tables, code blocks, and multi-line node content.
- Export to PNG, SVG, or HTML.
- A `.md` note mode or embedded code-block mode.
- Obsidian graph/backlink integration for `.mindmap`.
