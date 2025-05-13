/******************************************************
 * TYPES
 ******************************************************/
import type { Wireframe } from "../../../interfaces/artboard";

type Point = {
  x: number;
  y: number;
};

/**
 * @param start - starting point
 * @param end - ending point
 * @param obstacles - array of Wireframe obstacles
 * @param firstBendDirection - "horizontal" or "vertical".
 *    - "horizontal": we first try bending horizontally, i.e. (start.x, end.y)
 *    - "vertical":   we first try bending vertically,   i.e. (end.x, start.y)
 */
export function findOrthogonalPath(
  start: Point,
  end: Point,
  obstacles: Wireframe[],
  firstBendDirection: "horizontal" | "vertical" = "horizontal"
): Point[] {
  // 1) Direct check
  if (canConnect(start, end, obstacles)) {
    return [start, end];
  }

  // 2) Single-bend attempts, in an order decided by `firstBendDirection`
  let bendFirst: Point;
  let bendSecond: Point;

  if (firstBendDirection === "horizontal") {
    // We'll try the horizontal bend first = (start.x, end.y)
    bendFirst = { x: start.x, y: end.y };
    // Then the vertical bend second = (end.x, start.y)
    bendSecond = { x: end.x, y: start.y };
  } else {
    // If "vertical", do the vertical bend first, then horizontal
    bendFirst = { x: end.x, y: start.y };
    bendSecond = { x: start.x, y: end.y };
  }

  // Check bendFirst
  if (
    canConnect(start, bendFirst, obstacles) &&
    canConnect(bendFirst, end, obstacles)
  ) {
    return [start, bendFirst, end];
  }
  // Check bendSecond
  if (
    canConnect(start, bendSecond, obstacles) &&
    canConnect(bendSecond, end, obstacles)
  ) {
    return [start, bendSecond, end];
  }

  // 3) Try each obstacle corner as a potential single bend
  const cornerCandidates = obstacles.flatMap(getCorners);
  for (const c of cornerCandidates) {
    if (canConnect(start, c, obstacles) && canConnect(c, end, obstacles)) {
      return [start, c, end];
    }
  }

  // 4) No path found with these naive attempts
  return [];
}

/**
 * Return the 4 corners of a rectangle: top-left, top-right, bottom-left, bottom-right.
 */
function getCorners(rect: Wireframe): Point[] {
  return [
    { x: rect.xOffset, y: rect.yOffset },
    { x: rect.xOffset + rect.width, y: rect.yOffset },
    { x: rect.xOffset, y: rect.yOffset + rect.height },
    { x: rect.xOffset + rect.width, y: rect.yOffset + rect.height },
  ];
}

/**
 * Determines if two points can be connected horizontally or vertically
 * without intersecting an obstacle.
 * This check ensures:
 * 1) The line is strictly horizontal or vertical.
 * 2) The line does not pass through any of the obstacle rectangles.
 */
function canConnect(a: Point, b: Point, obstacles: Wireframe[]): boolean {
  // Must be horizontal or vertical
  if (a.x !== b.x && a.y !== b.y) {
    return false;
  }

  // Compute bounding box of the line (for convenience)
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);

  // Check against each obstacle
  for (const rect of obstacles) {
    if (a.y === b.y) {
      // Horizontal line
      const y = a.y;
      if (y > rect.yOffset && y < rect.yOffset + rect.height) {
        // Overlapping in Y dimension, now check X overlap
        if (rect.xOffset < maxX && rect.xOffset + rect.width > minX) {
          return false;
        }
      }
    } else {
      // Vertical line
      const x = a.x;
      if (x > rect.xOffset && x < rect.xOffset + rect.width) {
        // Overlapping in X dimension, check Y overlap
        if (rect.yOffset < maxY && rect.yOffset + rect.height > minY) {
          return false;
        }
      }
    }
  }

  // If we get here, no obstacle blocked the line
  return true;
}
