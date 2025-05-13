interface Point {
  x: number;
  y: number;
}

interface GlobalPathSegmentsProps {
  debugPath: Point[];
  radius?: number; // corner radius, default 20
}

export function GlobalPathSegments({
  debugPath,
  radius = 20,
}: GlobalPathSegmentsProps) {
  if (!debugPath || debugPath.length === 0) return null;
  const simplified = simplifyBends(debugPath, 20);
  // Build the path's "d" attribute with your existing function.
  const d = buildRoundedOrthPath(simplified, radius);

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: 3,
        pointerEvents: "none",
      }}
      width={5000}
      height={5000}
      viewBox="0 0 5000 5000"
      className="z-50"
    >
      {/* Define the arrow marker in <defs> */}
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8" /* X coordinate of the marker’s reference point */
          refY="5" /* Y coordinate of the marker’s reference point */
          markerWidth={8} /* Width of the marker */
          markerHeight={6} /* Height of the marker */
          orient="auto" /* Automatically rotate based on path direction */
        >
          {/* A triangle pointing right (from (0,0) to (10,5) to (0,10)) */}
          <path d="M0,0 L10,5 L0,10 Z" fill="#42A5F5" />
        </marker>
      </defs>

      {/* The path itself uses markerEnd to reference the arrow. */}
      <path
        d={d}
        fill="none"
        stroke="#42A5F5"
        strokeWidth={3}
        markerEnd="url(#arrow)" // <-- attach the arrow marker at path's end
      />
    </svg>
  );
}

/**
 * Same path-building code as before that adds arcs for 90° corners
 * with radius `r`.
 * (Omitted for brevity, but included below for completeness.)
 */
function buildRoundedOrthPath(points: Point[], r: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];

    // If there's another segment after next, we can make a corner arc
    if (i < points.length - 2) {
      const afterNext = points[i + 2];
      const cornerArc = computeCornerArc(current, next, afterNext, r);
      if (!cornerArc) {
        // Not a 90° corner; just a straight line
        d += ` L ${next.x} ${next.y}`;
      } else {
        const { pIn, pOut, largeArcFlag, sweepFlag } = cornerArc;
        d += ` L ${pIn.x} ${pIn.y}`;
        d += ` A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${pOut.x} ${pOut.y}`;
      }
    } else {
      // Last segment; no corner needed
      d += ` L ${next.x} ${next.y}`;
    }
  }
  return d;
}

function computeCornerArc(
  current: Point,
  next: Point,
  afterNext: Point,
  r: number
): {
  pIn: Point;
  pOut: Point;
  largeArcFlag: number;
  sweepFlag: number;
} | null {
  const dx1 = next.x - current.x;
  const dy1 = next.y - current.y;
  const dx2 = afterNext.x - next.x;
  const dy2 = afterNext.y - next.y;

  // Check if we have a 90° corner
  const seg1Horizontal = dy1 === 0 && dx1 !== 0;
  const seg1Vertical = dx1 === 0 && dy1 !== 0;
  const seg2Horizontal = dy2 === 0 && dx2 !== 0;
  const seg2Vertical = dx2 === 0 && dy2 !== 0;

  if (!((seg1Horizontal && seg2Vertical) || (seg1Vertical && seg2Horizontal))) {
    // Not a 90° turn
    return null;
  }

  // pIn is where we start the arc, pOut is where we end the arc
  const pIn: Point = { x: next.x, y: next.y };
  const pOut: Point = { x: next.x, y: next.y };

  // For the first segment
  if (seg1Horizontal) {
    if (dx1 > 0) {
      pIn.x = next.x - r;
    } else {
      pIn.x = next.x + r;
    }
  } else if (seg1Vertical) {
    if (dy1 > 0) {
      pIn.y = next.y - r;
    } else {
      pIn.y = next.y + r;
    }
  }

  // For the second segment
  if (seg2Horizontal) {
    if (dx2 > 0) {
      pOut.x = next.x + r;
    } else {
      pOut.x = next.x - r;
    }
  } else if (seg2Vertical) {
    if (dy2 > 0) {
      pOut.y = next.y + r;
    } else {
      pOut.y = next.y - r;
    }
  }

  // Arc flags
  const largeArcFlag = 0;
  const sweepFlag = computeSweepFlag(dx1, dy1, dx2, dy2);

  return { pIn, pOut, largeArcFlag, sweepFlag };
}

function computeSweepFlag(
  dx1: number,
  dy1: number,
  dx2: number,
  dy2: number
): number {
  const cross = dx1 * dy2 - dy1 * dx2;
  // cross > 0 => corner arcs clockwise
  // cross < 0 => corner arcs counterclockwise
  return cross > 0 ? 1 : 0;
}
interface Point {
  x: number;
  y: number;
}

/**
 * Removes bend points if they lie within `tolerance` of a straight line
 * from the previous to the next point.
 */
function simplifyBends(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points; // nothing to simplify with < 3 points

  const simplified: Point[] = [];
  simplified.push(points[0]); // keep the first point

  for (let i = 1; i < points.length - 1; i++) {
    const prev = simplified[simplified.length - 1]; // last we kept
    const current = points[i];
    const next = points[i + 1];

    // If current is close to the line from prev->next, skip it
    if (!isWithinToleranceOfLine(prev, next, current, tolerance)) {
      // keep this point
      simplified.push(current);
    }
  }

  // always push the last original point
  simplified.push(points[points.length - 1]);
  return simplified;
}

/**
 * Checks if `c` is within `tolerance` distance from the line formed by `a->b`.
 * If yes, it means we can skip the "bend" at c (it's nearly collinear).
 */
function isWithinToleranceOfLine(
  a: Point,
  b: Point,
  c: Point,
  tolerance: number
): boolean {
  // distance from c to line ab
  const dist = pointLineDistance(c, a, b);
  return dist <= tolerance;
}

/**
 * Returns the perpendicular distance of point p to the infinite line through a->b.
 * If a->b is zero-length, returns distance to the point a.
 */
function pointLineDistance(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;

  // If a and b are the same point, fallback to distance from a
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    // degenerate line
    return Math.sqrt(apx * apx + apy * apy);
  }

  // cross product magnitude / length of ab => area / base
  const cross = Math.abs(abx * apy - aby * apx);
  const abLen = Math.sqrt(abLenSq);

  return cross / abLen;
}
