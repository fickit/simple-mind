# Scripts

## Purpose

Developer-only tools that run outside Obsidian: the synthetic performance benchmark.

## Why it exists

The engine layers are pure enough to run without a vault, so latency regressions can be measured from
the command line instead of by hand inside Obsidian. Without this, the budgets in
`doc/benchmark-simple-mind.md` would have no reproducible source.

## Files

- `benchmark.mjs`: builds the entry bundle, installs the jsdom globals the renderer needs, runs each
  size, and rewrites the generated half of `doc/benchmark-simple-mind.md` while preserving the text
  below `<!-- manual-results -->`.
- `benchmark-entry.ts`: the benchmark's only contact with the plugin sources; it times parse, layout,
  connector paths, first render, one incremental edit, and serialize.

## Call flow

`node scripts/benchmark.mjs` bundles `benchmark-entry.ts` with esbuild into the gitignored
`.tmp-bench/`, imports it, calls `runStages` per size, prints the report, writes the document, and
removes the bundle.
