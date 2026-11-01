import { CONNECTOR_LEAD } from "../../../../config/constants";
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

  if (side === "down") {
    const branchY = Math.min(source.y + CONNECTOR_LEAD, target.y - 2);
    if (style === "orthogonal") {
      return `M ${round(source.x)} ${round(source.y)} V ${round(branchY)} H ${round(target.x)} V ${round(target.y)}`;
    }
    return `M ${round(source.x)} ${round(source.y)} V ${round(branchY)} C ${round(source.x)} ${round(branchY)} ${round(target.x)} ${round(branchY)} ${round(target.x)} ${round(target.y)}`;
  }

  const branchX =
    side === "right"
      ? Math.min(source.x + CONNECTOR_LEAD, target.x - 2)
      : Math.max(source.x - CONNECTOR_LEAD, target.x + 2);
  if (style === "orthogonal") {
    return `M ${round(source.x)} ${round(source.y)} H ${round(branchX)} V ${round(target.y)} H ${round(target.x)}`;
  }
  return `M ${round(source.x)} ${round(source.y)} H ${round(branchX)} C ${round(branchX)} ${round(source.y)} ${round(branchX)} ${round(target.y)} ${round(target.x)} ${round(target.y)}`;
}
