export type Box = { left: number; top: number; width: number; height: number };
export type Guide = { axis: "x" | "y"; pos: number };

type Snap = { dx: number; dy: number; guides: Guide[] };

function best(
  edges: number[],
  targets: number[],
  threshold: number,
): { delta: number; pos: number } | null {
  let found: { delta: number; pos: number } | null = null;
  for (const e of edges) {
    for (const t of targets) {
      const d = t - e;
      if (Math.abs(d) <= threshold && (!found || Math.abs(d) < Math.abs(found.delta))) {
        found = { delta: d, pos: t };
      }
    }
  }
  return found;
}

/** Snap a moving box to the canvas edges/center and to other objects. */
export function computeSnap(
  box: Box,
  others: Box[],
  canvas: { width: number; height: number },
  threshold: number,
): Snap {
  const xs = [0, canvas.width / 2, canvas.width];
  const ys = [0, canvas.height / 2, canvas.height];
  for (const o of others) {
    xs.push(o.left, o.left + o.width / 2, o.left + o.width);
    ys.push(o.top, o.top + o.height / 2, o.top + o.height);
  }
  const sx = best([box.left, box.left + box.width / 2, box.left + box.width], xs, threshold);
  const sy = best([box.top, box.top + box.height / 2, box.top + box.height], ys, threshold);
  const guides: Guide[] = [];
  if (sx) guides.push({ axis: "x", pos: sx.pos });
  if (sy) guides.push({ axis: "y", pos: sy.pos });
  return { dx: sx?.delta ?? 0, dy: sy?.delta ?? 0, guides };
}
