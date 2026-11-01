import { describe, expect, it } from "vitest";
import {
  CONNECTOR_CLEARANCE,
  CONNECTOR_LEAD,
  NODE_CONTROL_CENTER,
  NODE_CONTROL_EXTENT,
} from "../../../../config/constants";
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
  it("elbows at the collapse control and keeps children past the add control", () => {
    expect(CONNECTOR_LEAD).toBe(NODE_CONTROL_CENTER);
    expect(CONNECTOR_CLEARANCE).toBeGreaterThan(NODE_CONTROL_EXTENT);
  });

  it("elbows at the lead on horizontal sides and curves as one sweep", () => {
    const parent = node("p", 0, 0, 100, 40);
    const child = node("c", 160, 80, 100, 40);

    const branchX = 100 + CONNECTOR_LEAD;
    expect(connectorPath(parent, child, "right", "orthogonal")).toBe(
      `M 100 20 H ${branchX} V 100 H 160`,
    );
    expect(connectorPath(parent, child, "right", "curve")).toBe(
      "M 100 20 C 130 20 130 100 160 100",
    );
  });

  it("elbows downward in organization charts and curves as one sweep", () => {
    const parent = node("p", 0, 0, 100, 40);
    const child = node("c", 60, 100, 100, 40);

    const branchY = 40 + CONNECTOR_LEAD;
    expect(connectorPath(parent, child, "down", "orthogonal")).toBe(
      `M 50 40 V ${branchY} H 110 V 100`,
    );
    expect(connectorPath(parent, child, "down", "curve")).toBe("M 50 40 C 50 70 110 70 110 100");
  });
});
