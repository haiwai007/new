import type { TemplateDoc } from "../../types/template";
import { isLocationConfirmed, locationRenderKey } from "./model";
import { LOCATION_ROLES, type LocationRect } from "./schema";

type PixelRect = { left: number; top: number; right: number; bottom: number };
export function hasLocationPixelMask(doc: TemplateDoc) {
  return (
    doc.phone?.rendering === "natural" &&
    doc.phone.fusion.enabled &&
    doc.phone.placement === "overlay" &&
    isLocationConfirmed(doc) &&
    doc.phone.locationKey === locationRenderKey(doc)
  );
}
/** Match the validation's pixel-center rule; protected pixels use any overlap. */
export function locationPixelMask(
  doc: TemplateDoc,
  width: number,
  height: number,
) {
  const l = doc.statusLocation!;
  const centers = (r: LocationRect): PixelRect => ({
    left: Math.ceil(r.x * width - 0.5 - 1e-7),
    top: Math.ceil(r.y * height - 0.5 - 1e-7),
    right: Math.floor((r.x + r.width) * width - 0.5 + 1e-7) + 1,
    bottom: Math.floor((r.y + r.height) * height - 0.5 + 1e-7) + 1,
  });
  const allowed = LOCATION_ROLES.flatMap((role) =>
    l[role] ? [centers(l[role]!)] : [],
  );
  const home =
    doc.phone?.showHomeIndicator &&
    doc.layers.find((layer) => layer.id === `${doc.phone!.groupId}_home`);
  if (home)
    allowed.push(
      centers({
        x: home.x / doc.canvas.width,
        y: home.y / doc.canvas.height,
        width: home.width / doc.canvas.width,
        height: home.height / doc.canvas.height,
      }),
    );
  const blocked = l.protected.map((r) => ({
    left: Math.floor(r.x * width + 1e-7),
    top: Math.floor(r.y * height + 1e-7),
    right: Math.ceil((r.x + r.width) * width - 1e-7),
    bottom: Math.ceil((r.y + r.height) * height - 1e-7),
  }));
  // Include the actual SVG raster surface, which can extend a fractional
  // source pixel beyond the logical frame. Scale this surface for 2x/3x exports.
  const background = doc.layers.find(
    (layer) => layer.id === `${doc.phone?.groupId}_background`,
  );
  const tile = (r: LocationRect) => {
    const x = Math.max(0, Math.floor(r.x * width) - 3);
    const y = Math.max(0, Math.floor(r.y * height) - 3);
    const right = Math.min(width, Math.ceil((r.x + r.width) * width) + 3);
    const bottom = Math.min(height, Math.ceil((r.y + r.height) * height) + 3);
    return { x, y, width: right - x, height: bottom - y };
  };
  const frame = background
    ? {
        x: Math.min(l.bounds.x, background.x / doc.canvas.width),
        y: Math.min(l.bounds.y, background.y / doc.canvas.height),
        width:
          Math.max(
            l.bounds.x + l.bounds.width,
            (background.x + background.width) / doc.canvas.width,
          ) - Math.min(l.bounds.x, background.x / doc.canvas.width),
        height:
          Math.max(
            l.bounds.y + l.bounds.height,
            (background.y + background.height) / doc.canvas.height,
          ) - Math.min(l.bounds.y, background.y / doc.canvas.height),
      }
    : l.bounds;
  const main = tile(frame);
  const tiles = [main];
  if (home)
    tiles.push(
      tile({
        x: home.x / doc.canvas.width,
        y: home.y / doc.canvas.height,
        width: home.width / doc.canvas.width,
        height: home.height / doc.canvas.height,
      }),
    );
  return { ...main, allowed, blocked, tiles };
}
export type LocationPixelMask = ReturnType<typeof locationPixelMask>;
const inside = (r: PixelRect, x: number, y: number) =>
  x >= r.left && x < r.right && y >= r.top && y < r.bottom;
/** Preserve the original bytes outside the actual role masks, including gaps. */
export function restoreOutsideLocation(
  before: Uint8ClampedArray,
  after: Uint8ClampedArray,
  mask: LocationPixelMask,
) {
  for (let yy = 0; yy < mask.height; yy++) {
    const y = mask.y + yy;
    for (let xx = 0; xx < mask.width; xx++) {
      const x = mask.x + xx;
      if (
        mask.allowed.some((r) => inside(r, x, y)) &&
        !mask.blocked.some((r) => inside(r, x, y))
      )
        continue;
      const i = (yy * mask.width + xx) * 4;
      after[i] = before[i];
      after[i + 1] = before[i + 1];
      after[i + 2] = before[i + 2];
      after[i + 3] = before[i + 3];
    }
  }
}
