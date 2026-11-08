/**
 * Projection and outline for the travel map.
 *
 * The outline is a deliberately coarse, stylised silhouette of Vietnam built
 * from real boundary coordinates — enough to read as the country at a glance,
 * not a survey map. Pins are projected from the real coordinates stored on each
 * destination, so a pin's position is always truthful even though the coastline
 * is simplified.
 */

export const MAP_WIDTH = 420;
export const MAP_HEIGHT = 820;

/** Bounds generous enough to keep every pin and the outline inside the frame. */
const BOUNDS = { latMin: 8.2, latMax: 23.6, lngMin: 101.9, lngMax: 110.0 };

const PADDING = 18;

export interface Point {
  x: number;
  y: number;
}

/** Equirectangular projection, corrected for Vietnam's mid-latitude aspect. */
export function project(lat: number, lng: number): Point {
  const { latMin, latMax, lngMin, lngMax } = BOUNDS;
  const usableW = MAP_WIDTH - PADDING * 2;
  const usableH = MAP_HEIGHT - PADDING * 2;

  const x = PADDING + ((lng - lngMin) / (lngMax - lngMin)) * usableW;
  const y = PADDING + ((latMax - lat) / (latMax - latMin)) * usableH;

  return { x: round(x), y: round(y) };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Coarse national boundary, clockwise: down the east coast from the Chinese
 * border to Cà Mau, then back up the western border.
 */
const OUTLINE: Array<[lat: number, lng: number]> = [
  [21.6, 107.9],
  [20.9, 106.8],
  [20.2, 106.5],
  [19.8, 105.9],
  [18.9, 105.8],
  [17.8, 106.6],
  [16.9, 107.2],
  [16.1, 108.3],
  [15.1, 108.9],
  [13.8, 109.3],
  [12.7, 109.4],
  [11.0, 108.3],
  [10.4, 107.1],
  [10.0, 106.7],
  [9.3, 106.2],
  [8.6, 104.9],
  [9.9, 104.8],
  [10.5, 104.5],
  [11.5, 105.8],
  [12.2, 107.5],
  [13.9, 107.5],
  [15.1, 107.3],
  [16.3, 106.5],
  [17.5, 105.6],
  [18.5, 104.8],
  [19.6, 104.0],
  [20.5, 103.2],
  [21.3, 102.3],
  [22.4, 102.3],
  [22.8, 103.3],
  [23.4, 105.3],
  [22.8, 106.6],
  [22.0, 107.4],
];

/**
 * Catmull-Rom → cubic Bézier, so the coarse point list renders as a smooth,
 * closed silhouette rather than a polygon.
 */
function smoothClosedPath(points: Point[], tension = 0.5): string {
  const n = points.length;
  if (n < 3) return '';

  const at = (i: number): Point => points[((i % n) + n) % n]!;
  let d = `M ${at(0).x} ${at(0).y}`;

  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);

    const c1x = round(p1.x + ((p2.x - p0.x) / 6) * tension * 2);
    const c1y = round(p1.y + ((p2.y - p0.y) / 6) * tension * 2);
    const c2x = round(p2.x - ((p3.x - p1.x) / 6) * tension * 2);
    const c2y = round(p2.y - ((p3.y - p1.y) / 6) * tension * 2);

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }

  return `${d} Z`;
}

/** The silhouette path, computed once at module load. */
export const VIETNAM_OUTLINE_PATH = smoothClosedPath(
  OUTLINE.map(([lat, lng]) => project(lat, lng)),
);

/** Pin radius grows with repeat visits, capped so it never dominates. */
export function pinRadius(visits: number): number {
  return Math.min(5 + visits * 1.4, 11);
}
