// Pure-JS image inpainting ("fill in" pixels hidden behind old text).
//
// Two passes over the masked pixels:
// 1. Onion-peel fill: walk inward from the mask border (BFS) and set each pixel
//    to the weighted mean of its already-known neighbours.
// 2. Gauss–Seidel relaxation of the Laplace equation, which smooths the fill
//    into the surrounding colors (exact for flat colors, near-exact for linear
//    gradients).
// It cannot invent texture or objects, so photos with detail come out blurred
// inside the repaired area. That limitation is shown to the user.

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

const N8: [number, number, number][] = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, 0.7], [1, -1, 0.7], [-1, 1, 0.7], [1, 1, 0.7],
];

/** Fill `mask`ed pixels (1 = repair) in place. Returns the number of pixels filled. */
export function inpaint(img: Pixels, mask: Uint8Array, opts: { iterations?: number } = {}): number {
  const { width: w, height: h } = img;
  // Work in floats: rounding to 8 bits on every relaxation step stalls convergence.
  const data = Float32Array.from(img.data);
  if (mask.length !== w * h) throw new Error("mask size mismatch");
  // 0 = known, 1 = unknown, 2 = queued
  const state = new Uint8Array(w * h);
  const holes: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (mask[i]) {
      state[i] = 1;
      holes.push(i);
    }
  }
  if (holes.length === 0 || holes.length === w * h) return 0;

  const queue = new Int32Array(holes.length);
  let head = 0;
  let tail = 0;
  const enqueueNeighbours = (i: number) => {
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of N8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (state[n] === 1) {
        state[n] = 2;
        queue[tail++] = n;
      }
    }
  };
  for (let i = 0; i < w * h; i++) if (state[i] === 0 && mask[i] === 0) {
    // Only border pixels of the hole matter, but checking every known pixel is O(n) and simple.
    const x = i % w;
    const y = (i - x) / w;
    if ((x > 0 && state[i - 1] === 1) || (x < w - 1 && state[i + 1] === 1) || (y > 0 && state[i - w] === 1) || (y < h - 1 && state[i + w] === 1)) {
      enqueueNeighbours(i);
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i - x) / w;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let wt = 0;
    for (const [dx, dy, k] of N8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (state[n] !== 0) continue;
      const o = n * 4;
      r += data[o] * k;
      g += data[o + 1] * k;
      b += data[o + 2] * k;
      a += data[o + 3] * k;
      wt += k;
    }
    const o = i * 4;
    if (wt > 0) {
      data[o] = r / wt;
      data[o + 1] = g / wt;
      data[o + 2] = b / wt;
      data[o + 3] = a / wt;
    }
    state[i] = 0;
    enqueueNeighbours(i);
  }

  // Keep total work bounded for big holes (~40M neighbour reads).
  const iterations = opts.iterations ?? Math.max(20, Math.min(200, Math.floor(4e7 / (holes.length * 4))));
  for (let it = 0; it < iterations; it++) {
    for (const i of holes) {
      const x = i % w;
      const y = (i - x) / w;
      let n = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const add = (j: number) => {
        const o = j * 4;
        r += data[o];
        g += data[o + 1];
        b += data[o + 2];
        a += data[o + 3];
        n += 1;
      };
      if (x > 0) add(i - 1);
      if (x < w - 1) add(i + 1);
      if (y > 0) add(i - w);
      if (y < h - 1) add(i + w);
      const o = i * 4;
      data[o] = r / n;
      data[o + 1] = g / n;
      data[o + 2] = b / n;
      data[o + 3] = a / n;
    }
  }
  for (const i of holes) for (let k = 0; k < 4; k++) img.data[i * 4 + k] = data[i * 4 + k];
  return holes.length;
}

/** Clamp a rect to image bounds with integer edges; null if empty. */
export function clampRect(r: Rect, w: number, h: number): Rect | null {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(w, Math.ceil(r.x + r.width));
  const y1 = Math.min(h, Math.ceil(r.y + r.height));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};

export type RepairCluster = { crop: Rect; holes: Rect[] };

/**
 * Group repair regions into crops that each include a margin of surrounding
 * pixels (the colors the fill is computed from). Regions whose margins overlap
 * are processed together so a fill never reads another region's old pixels.
 */
export function planClusters(regions: Rect[], w: number, h: number): RepairCluster[] {
  const holes = regions.map((r) => clampRect(r, w, h)).filter((r): r is Rect => r !== null);
  const margin = (r: Rect) => Math.max(6, Math.round(Math.min(r.width, r.height) * 0.5));
  let clusters: RepairCluster[] = holes.map((r) => ({
    crop: clampRect({ x: r.x - margin(r), y: r.y - margin(r), width: r.width + margin(r) * 2, height: r.height + margin(r) * 2 }, w, h)!,
    holes: [r],
  }));
  let merged = true;
  while (merged) {
    merged = false;
    const next: RepairCluster[] = [];
    for (const c of clusters) {
      const hit = next.find((n) => intersects(n.crop, c.crop));
      if (hit) {
        hit.crop = union(hit.crop, c.crop);
        hit.holes.push(...c.holes);
        merged = true;
      } else next.push({ crop: c.crop, holes: [...c.holes] });
    }
    clusters = next;
  }
  return clusters;
}

/** Build the hole mask for a cluster, in crop-local coordinates. */
export function clusterMask(c: RepairCluster): Uint8Array {
  const { crop } = c;
  const mask = new Uint8Array(crop.width * crop.height);
  for (const r of c.holes) {
    for (let y = r.y - crop.y; y < r.y - crop.y + r.height; y++) {
      mask.fill(1, y * crop.width + (r.x - crop.x), y * crop.width + (r.x - crop.x) + r.width);
    }
  }
  return mask;
}
