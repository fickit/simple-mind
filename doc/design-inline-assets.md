# Simple Mind — Inline Assets Design

- Status: Approved for implementation
- Version: 0.1
- Date: 2026-11-27
- Related: `doc/plan-inline-assets.md`, `doc/design-simple-mind.md`

## 1. Goal

Let a node reference vault notes and images with the syntax Obsidian already uses, and render those
references inside the map:

- `[[Note]]`, `[[Note|alias]]`, and `[[Note#Heading]]` render as inline note links.
- `![[photo.png]]`, `![[photo.png|300]]`, `![alt](https://…)`, and `![](attachments/photo.png)`
  render as inline thumbnails.
- Typing `[[` or `![[` in the inline editor opens a filtered file search that inserts the link.

The source text stays the only persistent truth. No new frontmatter or `<!-- sm:{} -->` fields are
introduced, so the file keeps round-tripping through the normal Markdown editor and other tools.

## 2. Scope

### In scope

- Parsing and rendering note links and images inside node labels, in both the live map and the hidden
  measurer, from one shared renderer.
- Resolving vault targets against the open `.mindmap` file, opening notes in a new tab, and showing
  Obsidian's native page preview on hover.
- A lightweight in-view lightbox for image clicks.
- Image sizing: default height cap of 140 px with proportional width, `|width` override, and the
  file's maximum node width as the hard cap.
- Inline autocomplete for notes and images while editing.
- Missing and failed assets rendered as explicit placeholders.

### Out of scope

- Embedding a whole note (`![[Note]]` transclusion), headings, blocks, PDFs, audio, video, or
  iframes.
- Cropping, zooming, or resizing images after insertion.
- Automatic linking by matching node text to note names.
- A sidebar image or note picker; the editor autocomplete is the only insertion path.

## 3. Syntax

| Source | Renders as |
| --- | --- |
| `[[Note]]` | Inline link showing `Note` |
| `[[Note\|alias]]` | Inline link showing `alias` |
| `[[Note#Heading]]` | Inline link that opens the note at the heading |
| `![[photo.png]]` | Thumbnail capped at 140 px high |
| `![[photo.png\|300]]` | Thumbnail 300 px wide (capped by the node max width) |
| `![alt](https://example.com/a.png)` | External thumbnail, alt text kept |
| `![](attachments/a.png)` | Vault-relative thumbnail |

Parsing order is embed, wikilink, image, then the existing Markdown link. Backslash escaping stays
unchanged, so `\[[Note]]` is literal text.

Only `http` and `https` are accepted for external images; `javascript:`, `file:`, `data:`, and other
schemes are never turned into a source. Vault targets are resolved through Obsidian's link resolver,
so they cannot escape the vault.

## 4. Architecture

```
node label ──► inlineMarkdown.renderInlineMarkdown(text, doc, options)
                     │
                     ├── [[target|alias]] ──► <a data-link> ──► host.openNote / host.previewNote
                     ├── ![[target|width]] ──► host.imageSource ──► ImageSizeCache ──► <img>
                     └── ![alt](url) ────────► external or vault source ─────────────► <img>
```

### 4.1 Shared renderer

`inlineMarkdown.ts` stays DOM-only and dependency-free. It receives an options object:

- `host?: InlineResourceHost` — resolves notes and vault images, opens and previews notes.
- `images?: InlineImageSizes` — returns cached natural sizes and requests a load.
- `maxWidth?: number` — the file's node width cap.
- `onImageReady?: () => void` — called once per completed image load.

The live renderer and the hidden measurer both call this function, so the map and the layout agree
on every image box.

### 4.2 Resource host

`InlineResourceHost` is the only Obsidian-aware seam:

```ts
interface InlineResourceHost {
  noteExists(target: string): boolean;
  imageSource(target: string): string | null;
  openNote(target: string): void;
  previewNote(event: PointerEvent, anchor: HTMLElement, target: string): void;
  suggest(kind: "link" | "image", query: string, limit: number): InlineSuggestion[];
}
```

The view implements it with `app.metadataCache`, `app.vault.getResourcePath`, `app.workspace
.openLinkText(…, true)`, the `hover-link` workspace event, and `prepareFuzzySearch`. Map tests use a
fake host, so the renderer never imports Obsidian.

### 4.3 Image sizes

`ImageSizeCache` maps a source URL to natural dimensions and deduplicates in-flight loads. An image
without a cached size renders at a 200×120 placeholder and requests a load; on success or failure
the renderer clears its measurement and label caches and redraws once per frame. Failed sources are
cached as failures so they do not retry on every redraw.

Display box:

1. A node whose label contains only images drops its card background, border, shadow, and padding;
   the image group becomes the node, with rounded image corners and a small gap between images.
2. With `|width`: `w = min(width, maxWidth)`, `h = round(w × naturalH / naturalW)`.
3. Without: `h = min(140, naturalH)`, `w = round(naturalW × h / naturalH)`, then scale down to
   `maxWidth` if needed.
4. Unknown dimensions: 200×120 until the load resolves.

### 4.4 Autocomplete

The editor detects an unclosed `[[` or `![[` before the caret and asks the host for suggestions.
The popup lives inside the map world next to the textarea, shows up to eight matches with a label
and path, and supports arrow keys, Enter/Tab to insert, Escape to dismiss, and mouse selection.
Insertion replaces the trigger with `[[name]]` or `![[name]]` and keeps editing. File names come from
`metadataCache.fileToLinktext`, so duplicate basenames get the shortest unique path.

## 5. Interaction

- Note link click opens a **new tab**, keeping the map open; Ctrl/Cmd+click does the same.
- Hovering a note link triggers Obsidian's `hover-link` page preview.
- Image click opens a view-local lightbox; clicking the backdrop, the close button, or Escape closes
  it. No lightbox state is persisted.
- Clicking a link or image still selects its node before acting, so the rest of the map controls stay
  predictable.
- External Markdown links outside the resource syntax keep their current behavior.

## 6. Errors and edge cases

- Missing note: rendered with muted, dashed underline; clicking still goes through Obsidian's normal
  create-on-open flow.
- Missing vault image: a dashed placeholder shows the file name.
- External image failure: the placeholder shows the file name and the broken source stays cached.
- An image inside a node is not draggable and does not start node dragging or double-click editing.
- The layout measurer renders every label, so an image is requested once during layout even when its
  node is off-screen; the size cache then serves every later mount and culling only affects the live
  DOM.
- The settings page and theme editor are unaffected.

## 7. Accessibility and i18n

- Note links expose `role="link"`, `tabindex="0"`, and an `aria-label`; Enter opens them.
- Image lightbox exposes `role="dialog"`, an `aria-label`, and focus handling.
- New strings (missing image, failed image, unresolved note, close image, suggestion list) are added
  in English and Chinese.

## 8. Testing

- Parser tests cover all six syntax rows, aliases, width parsing, escaping, unsafe schemes, missing
  vault targets, and mixed text.
- Image size tests cover cache hits, deduplicated loads, success, failure, and the sizing rules.
- Editor tests cover trigger detection, filtering, keyboard navigation, insertion, and Escape.
- Renderer tests cover link and image delegation, unresolved styling, and invalidation after a load.
- The adapter stays thin; pure helpers (link target, image extension) are unit-tested without
  Obsidian.
- Verification: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, then a manual
  pass in the test vault for autocomplete, hover preview, new-tab opening, image loading, and the
  lightbox.

## 9. Network statement

The plugin itself makes no requests. Note links and vault images are local. External images chosen
by the user are loaded by the renderer's `<img>` element, so the README and the settings copy change
from "no network requests" to "the plugin makes no requests; external images load through Obsidian".
