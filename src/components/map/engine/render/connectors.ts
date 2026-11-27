import { CONNECTOR_LEAD } from "../../../../config/constants";
import type { ConnectorStyle } from "../../../../types/theme";
import type { PositionedNode } from "../layout/types";

interface Point {
  x: number;
  y: number;
}

/** Extra anchor information for underlined nodes. */
export interface ConnectorOptions {
  parentUnderline?: boolean;
  childUnderline?: boolean;
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
  options: ConnectorOptions = {},
): { source: Point; target: Point } {
  if (side === "down") {
    return {
      source: { x: parent.x + parent.width / 2, y: parent.y + parent.height },
      target: { x: child.x + child.width / 2, y: child.y },
    };
  }

  const parentY = parent.y + (options.parentUnderline ? parent.height : parent.height / 2);
  const childY = child.y + (options.childUnderline ? child.height : child.height / 2);

  if (side === "left") {
    return {
      source: { x: parent.x, y: parentY },
      target: { x: child.x + child.width, y: childY },
    };
  }

  return {
    source: { x: parent.x + parent.width, y: parentY },
    target: { x: child.x, y: childY },
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
  options: ConnectorOptions = {},
): string {
  const { source, target } = anchors(parent, child, side, options);

  if (side === "down") {
    if (style === "orthogonal") {
      const branchY = Math.min(source.y + CONNECTOR_LEAD, target.y - 2);
      return `M ${round(source.x)} ${round(source.y)} V ${round(branchY)} H ${round(target.x)} V ${round(target.y)}`;
    }
    const midY = (source.y + target.y) / 2;
    return `M ${round(source.x)} ${round(source.y)} C ${round(source.x)} ${round(midY)} ${round(target.x)} ${round(midY)} ${round(target.x)} ${round(target.y)}`;
  }

  if (style === "orthogonal") {
    const branchX =
      side === "right"
        ? Math.min(source.x + CONNECTOR_LEAD, target.x - 2)
        : Math.max(source.x - CONNECTOR_LEAD, target.x + 2);
    return `M ${round(source.x)} ${round(source.y)} H ${round(branchX)} V ${round(target.y)} H ${round(target.x)}`;
  }

  const midX = (source.x + target.x) / 2;
  return `M ${round(source.x)} ${round(source.y)} C ${round(midX)} ${round(source.y)} ${round(midX)} ${round(target.y)} ${round(target.x)} ${round(target.y)}`;
}
