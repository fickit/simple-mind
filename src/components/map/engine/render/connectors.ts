import type { ConnectorStyle } from "../../../../types/theme";
import type { PositionedNode } from "../layout/types";

interface Point {
  x: number;
  y: number;
}

/** Formats a coordinate for an SVG path. */
function round(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Returns the parent and child anchors for one connector side. */
function anchors(
  parent: PositionedNode,
  child: PositionedNode,
  side: "left" | "right" | "down",
): { source: Point; target: Point } {
  if (side === "down") {
    return {
      source: { x: parent.x + parent.width / 2, y: parent.y + parent.height },
      target: { x: child.x + child.width / 2, y: child.y },
    };
  }

  if (side === "left") {
    return {
      source: { x: parent.x, y: parent.y + parent.height / 2 },
      target: { x: child.x + child.width, y: child.y + child.height / 2 },
    };
  }

  return {
    source: { x: parent.x + parent.width, y: parent.y + parent.height / 2 },
    target: { x: child.x, y: child.y + child.height / 2 },
  };
}

/**
 * Builds an SVG path between a parent and child.
 *
 * @param parent Parent position.
 * @param child Child position.
 * @param side Connector side.
 * @param style Connector geometry.
 */
export function connectorPath(
  parent: PositionedNode,
  child: PositionedNode,
  side: "left" | "right" | "down",
  style: ConnectorStyle,
): string {
  const { source, target } = anchors(parent, child, side);

  if (style === "straight") {
    return `M ${round(source.x)} ${round(source.y)} L ${round(target.x)} ${round(target.y)}`;
  }

  if (style === "orthogonal") {
    if (side === "down") {
      const midY = (source.y + target.y) / 2;
      return `M ${round(source.x)} ${round(source.y)} V ${round(midY)} H ${round(target.x)} V ${round(target.y)}`;
    }
    const midX = (source.x + target.x) / 2;
    return `M ${round(source.x)} ${round(source.y)} H ${round(midX)} V ${round(target.y)} H ${round(target.x)}`;
  }

  if (side === "down") {
    const midY = (source.y + target.y) / 2;
    return `M ${round(source.x)} ${round(source.y)} C ${round(source.x)} ${round(midY)} ${round(target.x)} ${round(midY)} ${round(target.x)} ${round(target.y)}`;
  }

  const midX = (source.x + target.x) / 2;
  return `M ${round(source.x)} ${round(source.y)} C ${round(midX)} ${round(source.y)} ${round(midX)} ${round(target.y)} ${round(target.x)} ${round(target.y)}`;
}
