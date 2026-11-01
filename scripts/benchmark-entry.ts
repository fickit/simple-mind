import { layoutDocument } from "../src/components/map/engine/layout/layout";
import type { NodeMeasurer } from "../src/components/map/engine/layout/types";
import { parseSource } from "../src/components/map/engine/parser/parser";
import { serializeDocument } from "../src/components/map/engine/parser/serializer";
import { connectorPath } from "../src/components/map/engine/render/connectors";
import { MapRenderer } from "../src/components/map/engine/render/MapRenderer";
import { OBSIDIAN_THEME } from "../src/components/map/themes/presets";
import type { MindMapDocument } from "../src/types/mindmap";

/** Timings for one benchmark size, in milliseconds. */
export interface StageTimings {
  nodes: number;
  parse: number;
  layout: number;
  paths: number;
  render: number;
  edit: number;
  serialize: number;
  pathChars: number;
}

/** Runs each stage three times and returns the median milliseconds. */
export function runStages(source: string, host: HTMLElement): StageTimings {
  const samples = {
    parse: [] as number[],
    layout: [] as number[],
    paths: [] as number[],
    render: [] as number[],
    edit: [] as number[],
    serialize: [] as number[],
  };
  let nodes = 0;
  let pathChars = 0;

  for (let run = 0; run < 3; run += 1) {
    let started = performance.now();
    const parsed = parseSource(source);
    samples.parse.push(performance.now() - started);
    const document: MindMapDocument | null = parsed.document;
    if (!document) throw new Error("Synthetic source failed to parse.");

    started = performance.now();
    const layout = layoutDocument(document.root, document.meta, measure);
    samples.layout.push(performance.now() - started);
    nodes = layout.nodes.length;

    started = performance.now();
    const characters = buildPaths(layout);
    samples.paths.push(performance.now() - started);
    pathChars = characters;

    started = performance.now();
    const container = host.ownerDocument.createElement("div");
    host.replaceChildren(container);
    const renderer = new MapRenderer(container, OBSIDIAN_THEME, false);
    renderer.render(document, { fit: false });
    samples.render.push(performance.now() - started);

    const edited = parseSource(`${source.trimEnd()}\n- Extra node\n`);
    started = performance.now();
    if (edited.document) renderer.render(edited.document, { fit: false });
    samples.edit.push(performance.now() - started);

    started = performance.now();
    serializeDocument(document);
    samples.serialize.push(performance.now() - started);

    renderer.destroy();
  }

  return {
    nodes,
    parse: median(samples.parse),
    layout: median(samples.layout),
    paths: median(samples.paths),
    render: median(samples.render),
    edit: median(samples.edit),
    serialize: median(samples.serialize),
    pathChars,
  };
}

/** Builds every connector path and returns how many characters were produced. */
function buildPaths(layout: ReturnType<typeof layoutDocument>): number {
  const positions = new Map(layout.nodes.map((node) => [node.node.id, node]));
  let characters = 0;
  for (const edge of layout.edges) {
    const parent = positions.get(edge.parentId);
    const child = positions.get(edge.childId);
    if (!parent || !child) continue;
    characters += connectorPath(parent, child, edge.side, "curve").length;
  }
  return characters;
}

/** Stable synthetic node sizes so layout does not need a browser. */
export const measure: NodeMeasurer = (node) => ({
  width: 24 + node.text.length * 8,
  height: 32,
});

/** Returns the median of a sample set. */
export function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}
