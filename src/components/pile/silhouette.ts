import * as THREE from "three";

const GRID = 72;
const ALPHA = 40;

export type EmojiBody = {
  geometry: THREE.BufferGeometry;
  hulls: Float32Array[];
};

type Pt = { x: number; y: number };

const N8: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

function buildMask(image: ImageData) {
  const { width, height, data } = image;
  const mask = new Uint8Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy++) {
    const y0 = Math.floor((gy * height) / GRID);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / GRID));
    for (let gx = 0; gx < GRID; gx++) {
      const x0 = Math.floor((gx * width) / GRID);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / GRID));
      let solid = 0;
      for (let y = y0; y < y1 && !solid; y++) {
        for (let x = x0; x < x1; x++) {
          if ((data[(y * width + x) * 4 + 3] ?? 0) > ALPHA) {
            solid = 1;
            break;
          }
        }
      }
      mask[gy * GRID + gx] = solid;
    }
  }
  return mask;
}

function traceContours(mask: Uint8Array) {
  const w = GRID;
  const h = GRID;
  const visited = new Uint8Array(w * h);
  const contours: Pt[][] = [];
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y) || visited[y * w + x] || solid(x - 1, y)) continue;
      const contour: Pt[] = [];
      let cx = x;
      let cy = y;
      let bx = x - 1;
      let by = y;
      const sx = x;
      const sy = y;
      let guard = 0;
      do {
        contour.push({ x: cx, y: cy });
        let startDir = 0;
        for (let k = 0; k < 8; k++) {
          const n = N8[k]!;
          if (cx + n[0] === bx && cy + n[1] === by) {
            startDir = (k + 1) % 8;
            break;
          }
        }
        let found = false;
        let nx = cx;
        let ny = cy;
        let nbx = bx;
        let nby = by;
        for (let k = 0; k < 8; k++) {
          const dir = (startDir + k) % 8;
          const step = N8[dir]!;
          const qx = cx + step[0];
          const qy = cy + step[1];
          if (!solid(qx, qy)) continue;
          const prev = N8[(dir + 7) % 8]!;
          nx = qx;
          ny = qy;
          nbx = cx + prev[0];
          nby = cy + prev[1];
          found = true;
          break;
        }
        if (!found) break;
        bx = nbx;
        by = nby;
        cx = nx;
        cy = ny;
        guard++;
      } while (!(cx === sx && cy === sy) && guard < w * h);
      for (const p of contour) visited[p.y * w + p.x] = 1;
      if (contour.length >= 8) contours.push(contour);
    }
  }
  return contours;
}

function signedArea(pts: Pt[]) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function inside(pt: Pt, ring: Pt[]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) {
      hit = !hit;
    }
  }
  return hit;
}

function centroid(pts: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

function distToSeg(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function rdpOpen(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  let maxD = 0;
  let idx = 0;
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSeg(pts[i]!, a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a, b];
  const left = rdpOpen(pts.slice(0, idx + 1), eps);
  const right = rdpOpen(pts.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

function rdpClosed(pts: Pt[], eps: number) {
  if (pts.length < 8) return pts;
  let far = 1;
  let maxD = 0;
  const origin = pts[0]!;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i]!.x - origin.x, pts[i]!.y - origin.y);
    if (d > maxD) {
      maxD = d;
      far = i;
    }
  }
  const first = rdpOpen(pts.slice(0, far + 1), eps);
  const second = rdpOpen(pts.slice(far).concat(origin), eps);
  const ring = first.slice(0, -1).concat(second.slice(0, -1));
  return ring.length >= 3 ? ring : pts;
}

function relax(pts: Pt[]) {
  let cur = pts;
  for (let t = 0; t < 2; t++) {
    cur = cur.map((p, i) => {
      const a = cur[(i - 1 + cur.length) % cur.length]!;
      const b = cur[(i + 1) % cur.length]!;
      return { x: p.x * 0.5 + (a.x + b.x) * 0.25, y: p.y * 0.5 + (a.y + b.y) * 0.25 };
    });
  }
  return rdpClosed(cur, 0.85);
}

function dedupe(pts: Pt[]) {
  const out: Pt[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(prev.x - p.x, prev.y - p.y) < 1e-4) continue;
    out.push(p);
  }
  if (out.length > 2) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-4) out.pop();
  }
  return out;
}

function forceWinding(pts: Pt[], ccw: boolean) {
  const positive = signedArea(pts) > 0;
  return positive === ccw ? pts : pts.slice().reverse();
}

function toWorld(p: Pt, size: number): Pt {
  return {
    x: ((p.x + 0.5) / GRID - 0.5) * size,
    y: (0.5 - (p.y + 0.5) / GRID) * size,
  };
}

function fallbackBody(size: number, thick: number): EmojiBody {
  const geometry = new THREE.BoxGeometry(size, size, thick);
  geometry.clearGroups();
  geometry.addGroup(0, 24, 1);
  geometry.addGroup(24, 12, 0);
  const s = size / 2;
  const t = thick / 2;
  return {
    geometry,
    hulls: [new Float32Array([-s, -s, -t, s, -s, -t, s, s, -t, -s, s, -t, -s, -s, t, s, -s, t, s, s, t, -s, s, t])],
  };
}

export function buildEmojiBody(image: ImageData, size: number, thick: number): EmojiBody {
  const contours = traceContours(buildMask(image))
    .map(relax)
    .map(dedupe)
    .filter((pts) => pts.length >= 3 && Math.abs(signedArea(pts)) >= 10);
  if (!contours.length) return fallbackBody(size, thick);

  const centers = contours.map(centroid);
  const depth = contours.map((_, i) => {
    const c = centers[i]!;
    let n = 0;
    for (let j = 0; j < contours.length; j++) {
      if (i !== j && Math.abs(signedArea(contours[j]!)) > Math.abs(signedArea(contours[i]!)) && inside(c, contours[j]!)) n++;
    }
    return n;
  });

  const shapes: THREE.Shape[] = [];
  const hulls: Float32Array[] = [];
  for (let i = 0; i < contours.length; i++) {
    if (depth[i]! % 2 === 1) continue;
    const outer = forceWinding(contours[i]!.map((p) => toWorld(p, size)), true);
    const shape = new THREE.Shape();
    shape.moveTo(outer[0]!.x, outer[0]!.y);
    for (let k = 1; k < outer.length; k++) shape.lineTo(outer[k]!.x, outer[k]!.y);
    for (let j = 0; j < contours.length; j++) {
      if (depth[j] !== depth[i]! + 1 || !inside(centers[j]!, contours[i]!)) continue;
      const holePts = forceWinding(contours[j]!.map((p) => toWorld(p, size)), false);
      const hole = new THREE.Path();
      hole.moveTo(holePts[0]!.x, holePts[0]!.y);
      for (let k = 1; k < holePts.length; k++) hole.lineTo(holePts[k]!.x, holePts[k]!.y);
      shape.holes.push(hole);
    }
    shapes.push(shape);
    const flat: number[] = [];
    for (const p of outer) flat.push(p.x, p.y, -thick / 2, p.x, p.y, thick / 2);
    if (flat.length >= 12) hulls.push(new Float32Array(flat));
  }

  if (!shapes.length) return fallbackBody(size, thick);
  try {
    const geometry = new THREE.ExtrudeGeometry(shapes, { depth: thick, bevelEnabled: false, steps: 1, curveSegments: 1 });
    geometry.translate(0, 0, -thick / 2);
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    if (pos && uv) {
      for (let i = 0; i < pos.count; i++) {
        uv.setXY(i, (pos.getX(i) ?? 0) / size + 0.5, (pos.getY(i) ?? 0) / size + 0.5);
      }
    }
    geometry.computeVertexNormals();
    if (!hulls.length) return fallbackBody(size, thick);
    return { geometry, hulls };
  } catch {
    return fallbackBody(size, thick);
  }
}
