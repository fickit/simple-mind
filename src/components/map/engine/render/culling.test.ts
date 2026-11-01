import { describe, expect, it } from "vitest";
import { intersectsWorldRect, visibleWorldRect } from "./culling";

describe("visibleWorldRect", () => {
  it("maps a screen viewport into world coordinates", () => {
    expect(visibleWorldRect(1000, 500, 2, 100, 50, 0)).toEqual({
      x1: -50,
      y1: -25,
      x2: 450,
      y2: 225,
    });
  });

  it("widens the rectangle by the culling margin", () => {
    expect(visibleWorldRect(1000, 500, 1, 0, 0, 400)).toEqual({
      x1: -400,
      y1: -400,
      x2: 1400,
      y2: 900,
    });
  });
});

describe("intersectsWorldRect", () => {
  it("keeps boxes that overlap the view", () => {
    const view = visibleWorldRect(100, 100, 1, 0, 0, 0);
    expect(intersectsWorldRect({ x: 10, y: 10, width: 20, height: 20 }, view)).toBe(true);
    expect(intersectsWorldRect({ x: 95, y: 95, width: 20, height: 20 }, view)).toBe(true);
  });

  it("drops boxes entirely outside the view", () => {
    const view = visibleWorldRect(100, 100, 1, 0, 0, 0);
    expect(intersectsWorldRect({ x: 120, y: 10, width: 20, height: 20 }, view)).toBe(false);
    expect(intersectsWorldRect({ x: -40, y: 10, width: 20, height: 20 }, view)).toBe(false);
    expect(intersectsWorldRect({ x: 10, y: 400, width: 20, height: 20 }, view)).toBe(false);
  });
});
