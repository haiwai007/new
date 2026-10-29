import type { PhoneSettings } from "./schema";
import { loadImage } from "../canvas/image-cache";
import { smallHash } from "../status-location/model";
const cache = new Map<string, Promise<string | undefined>>();
/** Normalize visible alpha bounds without stretching or removing coloured backgrounds. */
export function normalizeIconCanvas(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d")!;
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let l = c.width,
    t = c.height,
    r = 0,
    b = 0;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (data[(y * c.width + x) * 4 + 3] > 16) {
        l = Math.min(l, x);
        t = Math.min(t, y);
        r = Math.max(r, x + 1);
        b = Math.max(b, y + 1);
      }
  if (r <= l) return;
  const out = document.createElement("canvas");
  out.width = out.height = 128;
  const size = 120 / Math.max(r - l, b - t);
  const target = out.getContext("2d")!;
  target.imageSmoothingQuality = "high";
  target.drawImage(
    c,
    l,
    t,
    r - l,
    b - t,
    (128 - (r - l) * size) / 2,
    (128 - (b - t) * size) / 2,
    (r - l) * size,
    (b - t) * size,
  );
  return out;
}
/** Preserve original asset references; cache only a portable display derivative. */
export async function normalizeCustomAppIcons(
  settings: PhoneSettings,
): Promise<PhoneSettings> {
  const appIcons = await Promise.all(
    settings.appIcons.map(async (icon) => {
      if (icon.kind !== "custom") return icon;
      const key = smallHash(icon.src);
      if (icon.displayKey === key && icon.displaySrc) return icon;
      let pending = cache.get(key);
      if (!pending) {
        pending = (async () => {
          let c: HTMLCanvasElement | undefined,
            out: HTMLCanvasElement | undefined;
          try {
            const image = await loadImage(icon.src);
            c = document.createElement("canvas");
            c.width = c.height = 128;
            const ctx = c.getContext("2d")!;
            const scale =
                128 / Math.max(image.naturalWidth, image.naturalHeight),
              w = image.naturalWidth * scale,
              h = image.naturalHeight * scale;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(image, (128 - w) / 2, (128 - h) / 2, w, h);
            out = normalizeIconCanvas(c);
            return out?.toDataURL("image/png");
          } catch {
            return;
          } finally {
            if (c) c.width = c.height = 0;
            if (out) out.width = out.height = 0;
          }
        })();
        cache.set(key, pending);
        pending.then((value) => {
          if (!value) cache.delete(key);
        });
        if (cache.size > 64) cache.delete(cache.keys().next().value!);
      }
      const displaySrc = await pending;
      return displaySrc ? { ...icon, displaySrc, displayKey: key } : icon;
    }),
  );
  return { ...settings, appIcons };
}
