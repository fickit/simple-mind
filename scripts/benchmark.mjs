import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(root, "doc", "benchmark-simple-mind.md");
const manualMarker = "<!-- manual-results -->";
const sizes = [100, 500, 1000];
const runs = 3;

/** Builds a balanced synthetic outline with the requested number of nodes. */
function buildSource(nodeCount) {
  const lines = ["# Root"];
  const branches = 8;
  let index = 1;

  while (index < nodeCount) {
    lines.push(`- ${label(index)}`);
    index += 1;
    const perBranch = Math.max(1, Math.floor((nodeCount - branches) / branches));
    for (let child = 0; child < perBranch && index < nodeCount; child += 1) {
      lines.push(`  - ${label(index)}`);
      index += 1;
      if (index % 3 === 0 && index < nodeCount) {
        lines.push(`    - ${label(index)}`);
        index += 1;
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

/** Returns a stable synthetic label. */
function label(index) {
  return `Node ${index} ${((index * 2654435761) % 977).toString(36)}`;
}

/** Publishes the browser globals the renderer expects. */
function installGlobals(dom) {
  const view = dom.window;
  globalThis.window = view;
  globalThis.document = view.document;
  globalThis.HTMLElement = view.HTMLElement;
  globalThis.Element = view.Element;
  globalThis.Node = view.Node;
  globalThis.getComputedStyle = view.getComputedStyle.bind(view);
  globalThis.requestAnimationFrame = view.requestAnimationFrame.bind(view);
  globalThis.cancelAnimationFrame = view.cancelAnimationFrame.bind(view);
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/** Renders one markdown table row. */
function row(result) {
  const ms = (value) => `${value.toFixed(1)} ms`;
  const paths = `${ms(result.paths)} (${Math.round(result.pathChars / 1000)}k chars)`;
  return `| ${result.nodes} | ${ms(result.parse)} | ${ms(result.layout)} | ${paths} | ${ms(result.render)} | ${ms(result.edit)} | ${ms(result.serialize)} |`;
}

/** Builds the benchmark document. */
function renderDocument(results) {
  const header = `# Benchmark report

Regenerate with \`node scripts/benchmark.mjs\`. Stages run ${runs} times and the median is kept.
Parse, layout, and paths run in Node with synthetic node sizes; the two render columns are the
jsdom DOM-mount cost of the keyed update, so they measure our JavaScript work rather than browser
layout and paint.

| Nodes | Parse | Layout | Paths | First render | Incremental render | Serialize |
| --- | --- | --- | --- | --- | --- | --- |
${results.map(row).join("\n")}

Environment: Node ${process.version}, ${process.platform}.

## Budgets

- A single edit stays under 100 ms on desktop. The incremental render column is the closest
  automated proxy for it.
- First render of 1,000 nodes stays within one interaction of the initial fit.
`;

  const manual = `## Real browser check

Measured in Chromium through the plugin canvas at 1,000 nodes; the numbers below are the recorded
run, not a generated value.
`;

  return `${header}\n${manualMarker}\n${manual}`;
}

const workDir = path.join(root, ".tmp-bench");
const outfile = path.join(workDir, "entry.mjs");

try {
  await mkdir(workDir, { recursive: true });
  await build({
    entryPoints: [path.join(root, "scripts", "benchmark-entry.ts")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "node22",
    outfile,
    logLevel: "warning",
  });

  const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', {
    pretendToBeVisual: true,
  });
  installGlobals(dom);

  const entry = await import(pathToFileURL(outfile).href);
  const host = dom.window.document.getElementById("host");
  const results = sizes.map((size) => entry.runStages(buildSource(size), host));
  const generated = renderDocument(results);
  const split = generated.indexOf(manualMarker);
  const previous = await readFile(docPath, "utf8").catch(() => "");
  const previousSplit = previous.indexOf(manualMarker);
  const manual = previousSplit === -1 ? generated.slice(split) : previous.slice(previousSplit);

  await writeFile(docPath, `${generated.slice(0, split)}${manual}`);
  console.log(`${generated.slice(0, split)}${manual}`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
