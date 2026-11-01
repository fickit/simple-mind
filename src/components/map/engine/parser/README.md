# Parser

## Purpose

Converts `.mindmap` source into a validated document and back into canonical source.

## Why it exists

The source text is the only persistent truth. A dedicated parser and serializer keep the file format,
line-numbered errors, and round-trip behavior independent from rendering and Obsidian view code.

## Files

- `frontmatter.ts`: splits frontmatter, reads the `mindmap` block, clamps values, preserves unknown
  lines, and renders the canonical block.
- `nodeStyle.ts`: reads and writes the inline `<!-- sm:{...} -->` style marker on node lines.
- `parser.ts`: parses the H1 root and nested unordered list into `MindMapDocument`, with warnings and
  errors.
- `serializer.ts`: writes canonical two-space indentation, `-` markers, preserved frontmatter, and
  per-node style markers.
- `__fixtures__/`: paired input and canonical output used by the tests.

## Call flow

`MindMapView.setViewData` calls `parseSource`. The document goes to the layout engine. Map commands
call `serializeDocument`, then the view saves the text through `TextFileView`.
