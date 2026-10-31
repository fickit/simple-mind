import type { MindMapMeta, MindNode } from "../../../../types/mindmap";
import type {
  EdgeLayout,
  LayoutBounds,
  LayoutResult,
  NodeMeasurer,
  NodeSize,
  PositionedNode,
} from "./types";

interface LayoutContext {
  measure: NodeMeasurer;
  gapX: number;
  gapY: number;
  meta: MindMapMeta;
  sizes: Map<string, NodeSize>;
  heights: Map<string, number>;
  widths: Map<string, number>;
  nodes: PositionedNode[];
  edges: EdgeLayout[];
}

/** Returns a cached rendered size for one node. */
function sizeOf(context: LayoutContext, node: MindNode): NodeSize {
  const cached = context.sizes.get(node.id);
  if (cached) return cached;
  const size = context.measure(node);
  context.sizes.set(node.id, size);
  return size;
}

/** Returns the visible children of a node. */
function visibleChildren(node: MindNode): MindNode[] {
  return node.collapsed ? [] : node.children;
}

/** Computes the vertical block height used by horizontal layouts. */
function blockHeight(context: LayoutContext, node: MindNode): number {
  const cached = context.heights.get(node.id);
  if (cached !== undefined) return cached;

  const size = sizeOf(context, node);
  const children = visibleChildren(node);
  if (children.length === 0) {
    context.heights.set(node.id, size.height);
    return size.height;
  }

  const total =
    children.reduce((sum, child) => sum + blockHeight(context, child), 0) +
    context.gapY * (children.length - 1);
  const height = Math.max(size.height, total);
  context.heights.set(node.id, height);
  return height;
}

/** Computes the horizontal block width used by the organization layout. */
function blockWidth(context: LayoutContext, node: MindNode): number {
  const cached = context.widths.get(node.id);
  if (cached !== undefined) return cached;

  const size = sizeOf(context, node);
  const children = visibleChildren(node);
  if (children.length === 0) {
    context.widths.set(node.id, size.width);
    return size.width;
  }

  const total =
    children.reduce((sum, child) => sum + blockWidth(context, child), 0) +
    context.gapX * (children.length - 1);
  const width = Math.max(size.width, total);
  context.widths.set(node.id, width);
  return width;
}

/** Places a horizontal subtree starting at a vertical block top. */
function placeHorizontal(
  context: LayoutContext,
  node: MindNode,
  side: "left" | "right",
  depth: number,
  x: number,
  blockTop: number,
  parentId: string | null,
): void {
  const size = sizeOf(context, node);
  const height = blockHeight(context, node);
  const children = visibleChildren(node);
  const totalChildrenHeight =
    children.reduce((sum, child) => sum + blockHeight(context, child), 0) +
    context.gapY * Math.max(0, children.length - 1);
  const centerY = blockTop + height / 2;
  const nodeY = context.meta.align === "center" ? centerY - size.height / 2 : blockTop;

  context.nodes.push({
    node,
    x,
    y: nodeY,
    width: size.width,
    height: size.height,
    depth,
    side,
    parentId,
  });

  let childTop = context.meta.align === "center" ? centerY - totalChildrenHeight / 2 : blockTop;
  for (const child of children) {
    const childSize = sizeOf(context, child);
    const childX =
      side === "right" ? x + size.width + context.gapX : x - context.gapX - childSize.width;
    placeHorizontal(context, child, side, depth + 1, childX, childTop, node.id);
    context.edges.push({ parentId: node.id, childId: child.id, side });
    childTop += blockHeight(context, child) + context.gapY;
  }
}

/** Places a vertical subtree starting at a horizontal block left edge. */
function placeVertical(
  context: LayoutContext,
  node: MindNode,
  depth: number,
  blockLeft: number,
  y: number,
  parentId: string | null,
): void {
  const size = sizeOf(context, node);
  const width = blockWidth(context, node);
  const children = visibleChildren(node);
  const totalChildrenWidth =
    children.reduce((sum, child) => sum + blockWidth(context, child), 0) +
    context.gapX * Math.max(0, children.length - 1);
  const centerX = blockLeft + width / 2;
  const nodeX = context.meta.align === "center" ? centerX - size.width / 2 : blockLeft;

  context.nodes.push({
    node,
    x: nodeX,
    y,
    width: size.width,
    height: size.height,
    depth,
    side: "down",
    parentId,
  });

  let childLeft = context.meta.align === "center" ? centerX - totalChildrenWidth / 2 : blockLeft;
  const childY = y + size.height + context.gapY;
  for (const child of children) {
    placeVertical(context, child, depth + 1, childLeft, childY, node.id);
    context.edges.push({ parentId: node.id, childId: child.id, side: "down" });
    childLeft += blockWidth(context, child) + context.gapX;
  }
}

/** Splits root children into two sides by accumulated block height. */
function splitMindMapSides(
  context: LayoutContext,
  children: MindNode[],
): { left: MindNode[]; right: MindNode[] } {
  const left: MindNode[] = [];
  const right: MindNode[] = [];
  let leftHeight = 0;
  let rightHeight = 0;

  for (const child of children) {
    const height = blockHeight(context, child);
    if (leftHeight <= rightHeight) {
      leftHeight += height + (left.length > 0 ? context.gapY : 0);
      left.push(child);
    } else {
      rightHeight += height + (right.length > 0 ? context.gapY : 0);
      right.push(child);
    }
  }

  return { left, right };
}

/** Computes bounds over all positioned nodes. */
function computeBounds(nodes: PositionedNode[]): LayoutBounds {
  if (nodes.length === 0) {
    return { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 };
  }

  let x1 = Number.POSITIVE_INFINITY;
  let y1 = Number.POSITIVE_INFINITY;
  let x2 = Number.NEGATIVE_INFINITY;
  let y2 = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    x1 = Math.min(x1, node.x);
    y1 = Math.min(y1, node.y);
    x2 = Math.max(x2, node.x + node.width);
    y2 = Math.max(y2, node.y + node.height);
  }

  return { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
}

/**
 * Lays out a parsed tree in world coordinates.
 *
 * @param root Document root.
 * @param meta Per-file layout settings.
 * @param measure Rendered-size provider.
 */
export function layoutDocument(
  root: MindNode,
  meta: MindMapMeta,
  measure: NodeMeasurer,
): LayoutResult {
  const compact = meta.compact ? 0.6 : 1;
  const context: LayoutContext = {
    measure,
    gapX: meta.spacingX * compact,
    gapY: meta.spacingY * compact,
    meta,
    sizes: new Map(),
    heights: new Map(),
    widths: new Map(),
    nodes: [],
    edges: [],
  };

  const rootSize = sizeOf(context, root);
  const rootX = -rootSize.width / 2;
  const rootY = -rootSize.height / 2;

  context.nodes.push({
    node: root,
    x: rootX,
    y: rootY,
    width: rootSize.width,
    height: rootSize.height,
    depth: 0,
    side: "center",
    parentId: null,
  });

  if (meta.layout === "org") {
    const children = visibleChildren(root);
    const totalWidth =
      children.reduce((sum, child) => sum + blockWidth(context, child), 0) +
      context.gapX * Math.max(0, children.length - 1);
    let childLeft = meta.align === "center" ? -totalWidth / 2 : rootX;
    const childY = rootY + rootSize.height + context.gapY;

    for (const child of children) {
      placeVertical(context, child, 1, childLeft, childY, root.id);
      context.edges.push({ parentId: root.id, childId: child.id, side: "down" });
      childLeft += blockWidth(context, child) + context.gapX;
    }

    return {
      nodes: context.nodes,
      edges: context.edges,
      bounds: computeBounds(context.nodes),
    };
  }

  const sides: Array<{ side: "left" | "right"; children: MindNode[] }> =
    meta.layout === "mindmap"
      ? (() => {
          const split = splitMindMapSides(context, visibleChildren(root));
          return [
            { side: "left", children: split.left },
            { side: "right", children: split.right },
          ];
        })()
      : [{ side: meta.direction, children: visibleChildren(root) }];

  for (const { side, children } of sides) {
    const totalHeight =
      children.reduce((sum, child) => sum + blockHeight(context, child), 0) +
      context.gapY * Math.max(0, children.length - 1);
    let childTop = meta.align === "center" ? -totalHeight / 2 : rootY;
    const childStartX =
      side === "right" ? rootX + rootSize.width + context.gapX : rootX - context.gapX;

    for (const child of children) {
      const childSize = sizeOf(context, child);
      const childX = side === "right" ? childStartX : childStartX - childSize.width;
      placeHorizontal(context, child, side, 1, childX, childTop, root.id);
      context.edges.push({ parentId: root.id, childId: child.id, side });
      childTop += blockHeight(context, child) + context.gapY;
    }
  }

  return {
    nodes: context.nodes,
    edges: context.edges,
    bounds: computeBounds(context.nodes),
  };
}
