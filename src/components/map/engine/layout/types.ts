import type { MindNode } from "../../../../types/mindmap";

/** Rendered size of one node. */
export interface NodeSize {
  width: number;
  height: number;
}

/** Measures a node's rendered size, including padding and borders. */
export type NodeMeasurer = (node: MindNode) => NodeSize;

/** A node after layout. Coordinates are top-left world coordinates. */
export interface PositionedNode {
  node: MindNode;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  side: "left" | "right" | "center" | "down";
  parentId: string | null;
}

/** A parent-child connector with the side used to choose anchors. */
export interface EdgeLayout {
  parentId: string;
  childId: string;
  side: "left" | "right" | "down";
}

/** World-space bounds of a laid-out map. */
export interface LayoutBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

/** Complete layout output consumed by the renderer. */
export interface LayoutResult {
  nodes: PositionedNode[];
  edges: EdgeLayout[];
  bounds: LayoutBounds;
}
