import { INDENT_WIDTH, LIST_MARKER } from "../../../../config/constants";
import type { MindMapDocument, MindNode } from "../../../../types/mindmap";
import { renderFrontmatter } from "./frontmatter";
import { serializeNodeMarker } from "./nodeStyle";

/** Returns one safe, single-line label. */
function normalizeLabel(text: string): string {
  const label = text.replace(/\r?\n/g, " ").trim();
  return label === "" ? "Untitled" : label;
}

/** Serializes one label with its optional per-node metadata marker. */
function serializeLabel(node: MindNode): string {
  return `${normalizeLabel(node.text)}${serializeNodeMarker(node.style, node.side)}`;
}

/** Serializes the node tree into a canonical unordered outline. */
function serializeBody(root: MindNode): string {
  const lines = [`# ${serializeLabel(root)}`];

  const walk = (node: MindNode, depth: number): void => {
    for (const child of node.children) {
      lines.push(`${" ".repeat(depth * INDENT_WIDTH)}${LIST_MARKER} ${serializeLabel(child)}`);
      walk(child, depth + 1);
    }
  };

  walk(root, 0);
  return lines.join("\n");
}

/**
 * Serializes a document back to canonical `.mindmap` source.
 *
 * @param document Parsed map document.
 */
export function serializeDocument(document: MindMapDocument): string {
  const frontmatter = renderFrontmatter(
    document.meta,
    document.source.otherFrontmatterLines,
    document.source.mindmapExtraLines,
  );
  const body = serializeBody(document.root);
  return `${frontmatter}\n\n${body}\n`;
}
