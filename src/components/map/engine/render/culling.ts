/** A rectangle in world coordinates. */
export interface WorldRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A box described by its top-left corner and size. */
export interface WorldBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns the world rectangle the viewport shows, widened by a margin.
 *
 * @param width Viewport width in screen pixels.
 * @param height Viewport height in screen pixels.
 * @param scale World scale.
 * @param translateX World x offset in screen pixels.
 * @param translateY World y offset in screen pixels.
 * @param margin World distance kept mounted around the viewport.
 */
export function visibleWorldRect(
  width: number,
  height: number,
  scale: number,
  translateX: number,
  translateY: number,
  margin: number,
): WorldRect {
  return {
    x1: (0 - translateX) / scale - margin,
    y1: (0 - translateY) / scale - margin,
    x2: (width - translateX) / scale + margin,
    y2: (height - translateY) / scale + margin,
  };
}

/** Returns whether a box intersects a world rectangle. */
export function intersectsWorldRect(box: WorldBox, view: WorldRect): boolean {
  return (
    box.x <= view.x2 &&
    box.x + box.width >= view.x1 &&
    box.y <= view.y2 &&
    box.y + box.height >= view.y1
  );
}
