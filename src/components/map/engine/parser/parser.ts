import { DEFAULT_MINDMAP_META } from "../../../../config/defaults";
import type {
  MindMapDocument,
  MindMapMeta,
  MindNode,
  ParseError,
  ParseResult,
  ParseWarning,
} from "../../../../types/mindmap";
import { parseMeta, splitFrontmatter } from "./frontmatter";

interface Level {
  indent: number;
  node: MindNode;
  parent: MindNode;
}

/** Creates a node with the next deterministic runtime id. */
function createNode(text: string, nextId: () => string): MindNode {
  return {
    id: nextId(),
    text,
    children: [],
    collapsed: false,
  };
}

/**
 * Parses a `.mindmap` outline into a document.
 *
 * Invalid lines are reported with one-based line numbers. A partial document is
 * returned when a root can still be found, so the view can show what it can
 * while keeping editing disabled.
 *
 * @param source Full file content.
 * @param defaults Settings used for keys missing from the file.
 */
export function parseSource(
  source: string,
  defaults: MindMapMeta = DEFAULT_MINDMAP_META,
): ParseResult {
  const cleanSource = source.replace(/^\uFEFF/, "");
  const split = splitFrontmatter(cleanSource);
  const errors: ParseError[] = [...split.errors];
  const warnings: ParseWarning[] = [];

  if (split.errors.length > 0) {
    return { document: null, errors, warnings };
  }

  const metaResult = parseMeta(split.raw, split.raw === null ? 1 : 2, defaults);
  warnings.push(...metaResult.warnings);

  const body = split.body.replace(/\t/g, "  ");
  const lines = body.split("\n");
  let nextIdValue = 1;
  const nextId = () => `n${nextIdValue++}`;

  let root: MindNode | null = null;
  const levels: Level[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const lineNumber = split.bodyStartLine + index;
    const line = rawLine.trimEnd();
    if (line.trim() === "") continue;

    if (root === null) {
      const rootMatch = /^#\s+(.+?)\s*$/.exec(line);
      if (!rootMatch) {
        errors.push({
          line: lineNumber,
          message: "A mind map needs one H1 root, for example: # Root topic.",
        });
        return { document: null, errors, warnings };
      }
      root = createNode(rootMatch[1].trim(), nextId);
      continue;
    }

    if (/^#/.test(line)) {
      errors.push({
        line: lineNumber,
        message: "Only one H1 root is allowed; other headings are not supported.",
      });
      continue;
    }

    const listMatch = /^([-*+])\s+(.*)$/.exec(line.trimStart());
    if (!listMatch) {
      if (/^[-*+]\s*$/.test(line.trimStart())) {
        errors.push({ line: lineNumber, message: "A list item needs a label." });
        continue;
      }
      errors.push({
        line: lineNumber,
        message: /^\d+[.)]\s+/.test(line.trimStart())
          ? "Ordered lists are not supported; use an unordered list."
          : "Unsupported source line; use a nested unordered list.",
      });
      continue;
    }

    const indent = rawLine.length - rawLine.trimStart().length;
    const text = listMatch[2].trim();
    if (text === "") {
      errors.push({ line: lineNumber, message: "A list item needs a label." });
      continue;
    }

    const node = createNode(text, nextId);
    if (!attachNode(root, node, indent, levels, lineNumber, errors)) {
    }
  }

  if (root === null) {
    errors.push({ line: split.bodyStartLine, message: "A mind map needs one H1 root." });
    return { document: null, errors, warnings };
  }

  const document: MindMapDocument = {
    root,
    meta: metaResult.meta,
    source: {
      frontmatterRaw: split.raw,
      frontmatter: split.raw === null ? null : { mindmap: metaResult.meta },
      body: split.body,
      otherFrontmatterLines: metaResult.otherLines,
      mindmapExtraLines: metaResult.extraLines,
    },
  };

  return { document, errors, warnings };
}

/**
 * Attaches a list item to the correct parent using an indentation stack.
 *
 * @param root Document root.
 * @param node Item being attached.
 * @param indent Leading spaces of the item.
 * @param levels Current indentation stack.
 * @param lineNumber Source line for error reporting.
 * @param errors Error collector.
 */
function attachNode(
  root: MindNode,
  node: MindNode,
  indent: number,
  levels: Level[],
  lineNumber: number,
  errors: ParseError[],
): boolean {
  if (levels.length === 0) {
    if (indent !== 0) {
      errors.push({
        line: lineNumber,
        message: "The first list item must start at indentation level zero.",
      });
      return false;
    }
    root.children.push(node);
    levels.push({ indent, node, parent: root });
    return true;
  }

  const last = levels[levels.length - 1];
  if (indent > last.indent) {
    last.node.children.push(node);
    levels.push({ indent, node, parent: last.node });
    return true;
  }

  if (indent === last.indent) {
    last.parent.children.push(node);
    levels[levels.length - 1] = { indent, node, parent: last.parent };
    return true;
  }

  let levelIndex = levels.length - 1;
  while (levelIndex >= 0 && levels[levelIndex].indent > indent) {
    levelIndex -= 1;
  }
  if (levelIndex < 0 || levels[levelIndex].indent !== indent) {
    errors.push({
      line: lineNumber,
      message: "Unexpected indentation; dedent to an existing level.",
    });
    return false;
  }

  const level = levels[levelIndex];
  level.parent.children.push(node);
  levels.length = levelIndex + 1;
  levels[levelIndex] = { indent, node, parent: level.parent };
  return true;
}
