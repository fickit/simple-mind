# Simple Mind — Inline Assets Plan

- Status: Complete (manual test-vault pass pending)
- Version: 0.1
- Date: 2026-11-27
- Related: `doc/design-inline-assets.md`, `doc/plan-simple-mind.md`

Legend: `√` done, `x` rejected, `-` not done.

## 1. Types and syntax

- `√` Add `src/types/inline.ts`: resource host, suggestion, and natural image size types.
- `√` Extend `inlineMarkdown.ts` with `![[…]]`, `[[…]]`, and `![alt](…)` support behind an options
  object; keep the existing emphasis, code, escape, and external-link behavior.
- `√` Parse the `|width` suffix, clamp against `maxWidth`, and reject non-http(s) external sources.
- `√` Render missing vault images and unresolved notes with explicit classes and names.
- `√` Cover every syntax row, aliases, escaping, unsafe schemes, and mixed text with tests.

## 2. Image sizes and measurement

- `√` Add `imageSizes.ts` with a natural-size cache, deduplicated loads, failure caching, and a
  ready callback.
- `√` Pass the host, cache, width cap, and ready callback through `DomNodeMeasurer` and the live node
  renderer so both produce the same box.
- `√` Invalidate the measurement and rendered-label caches when an image resolves, then redraw once.
- `√` Test cache hits, deduplication, failures, and both sizing rules.

## 3. Renderer and interactions

- `√` Add renderer options for the resource host and image opening; delegate link clicks, hover
  previews, and image clicks from the node handler.
- `√` Select the node before opening a link or image; keep external Markdown links untouched.
- `√` Stop images from starting a drag or a double-click edit.
- `√` Add the view-local lightbox with backdrop, close button, and Escape handling.
- `√` Handle Enter on a focused note link before the canvas keyboard shortcuts.
- `√` Test link delegation, image delegation, unresolved styling, and lightbox open/close.

## 4. Autocomplete

- `√` Add pure trigger matching for `[[` and `![[` before the caret, including closed and newline
  cases.
- `√` Extend `InlineEditor` with a suggestion popup: filtered list, arrow keys, Enter/Tab insertion,
  Escape dismissal, mouse selection, and caret placement.
- `√` Style the popup inside the map world.
- `√` Test matching, filtering, insertion, and Escape.

## 5. Obsidian adapter and view wiring

- `√` Add `api/obsidian/inlineResources.ts` implementing the host with link resolution, resource
  URLs, new-tab opening, hover preview, and fuzzy file search.
- `√` Filter image suggestions by extension and generate links through `fileToLinktext`.
- `√` Create the host in `MindMapView` with a live source-path getter and pass it to `MapCanvas`.
- `√` Unit-test the pure link/image helpers.

## 6. Chrome, docs, and release

- `√` Add English and Chinese strings for missing assets, unresolved links, the lightbox, and the
  suggestion list.
- `√` Add map styles for links, thumbnails, placeholders, the popup, and the lightbox.
- `√` Update both READMEs with syntax examples, the feature list, and the external-image network
  note.
- `√` Update `doc/design-simple-mind.md`, `doc/prd.md`, and the project plan ledger.
- `√` Bump to 1.1.0, run typecheck, lint, tests, and the production build, then commit.
- `√` Adapt image-only nodes: drop the card, round and gap the pictures, and keep the node exactly as
  large as the image group.
- `√` Fix autocomplete navigation so ArrowUp/ArrowDown keep the active row and hover highlights it.
- `-` Manual test-vault pass: autocomplete, hover preview, new-tab opening, vault and external
  images, missing assets, lightbox, and culling.
