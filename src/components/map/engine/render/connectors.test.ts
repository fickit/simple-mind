import { describe, expect, it } from "vitest";
import { CONNECTOR_LEAD } from "../../../../config/constants";
import type { PositionedNode } from "../layout/types";
import { connectorPath } from "./connectors";

function node(id: string, x: number, y: number, width: number, height: number): PositionedNode {
  return {
    node: { id, text: id, children: [], collapsed: false },
    x,
    y,
    width,
    height,
    depth: 1,
    side: "right",
    parentId: "root",
  };
}

describe("connectorPath", () => {
  it("walks out of the parent before branching on horizontal sides", () => {
    const parent = node("p", 0, 0, 100, 40);
    const child = node("c", 160, 80, 100, 40);

    const branchX = 100 + CONNECTOR_LEAD;
    expect(connectorPath(parent, child, "right", "orthogonal")).toBe(
      `M 100 20 H ${branchX} V 100 H 160`,
    );
    expect(connectorPath(parent, child, "right", "curve")).toBe(
      `M 100 20 H ${branchX} C ${branchX} 20 ${branchX} 100 160 100`,
    );
  });

  it("walks down from the parent before branching in organization charts", () => {
    const parent = node("p", 0, 0, 100, 40);
    const child = node("c", 60, 100, 100, 40);

    const branchY = 40 + CONNECTOR_LEAD;
    expect(connectorPath(parent, child, "down", "orthogonal")).toBe(
      `M 50 40 V ${branchY} H 110 V 100`,
    );
    expect(connectorPath(parent, child, "down", "curve")).toBe(
      `M 50 40 V ${branchY} C 50 ${branchY} 110 ${branchY} 110 100`,
    );
  });
});
