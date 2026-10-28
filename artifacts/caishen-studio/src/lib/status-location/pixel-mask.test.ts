import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { defaultStatusLocation } from "./model";
import { locationPixelMask, restoreOutsideLocation } from "./pixel-mask";

describe.each([400, 720, 1179])(
  "strict status pixel mask at %i output pixels",
  (width) => {
    it("preserves original RGBA in gaps, fractional edges and protected pixels", () => {
      const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
      const l = defaultStatusLocation(doc);
      l.layout = "manual";
      l.bounds = { x: 0, y: 0.01, width: 1, height: 0.08 };
      l.time = { x: 0.03127, y: 0.02073, width: 0.13459, height: 0.03519 };
      l.apps = null;
      l.system = { x: 0.71237, y: 0.02073, width: 0.25129, height: 0.03519 };
      l.protected = [
        { x: l.time.x + l.time.width, y: 0.02, width: 0.05, height: 0.04 },
      ];
      doc.statusLocation = l;
      const height = width * 2;
      const mask = locationPixelMask(doc, width, height);
      const before = new Uint8ClampedArray(mask.width * mask.height * 4);
      for (let i = 0; i < before.length; i++) before[i] = (i * 13 + 37) % 239;
      const after = new Uint8ClampedArray(before.length).fill(255);
      restoreOutsideLocation(before, after, mask);
      let changed = 0,
        protectedPixels = 0;
      for (let yy = 0; yy < mask.height; yy++)
        for (let xx = 0; xx < mask.width; xx++) {
          const x = mask.x + xx,
            y = mask.y + yy,
            i = (yy * mask.width + xx) * 4;
          const cx = (x + 0.5) / width,
            cy = (y + 0.5) / height;
          const allowed = [l.time, l.system].some(
            (r) =>
              cx >= r.x &&
              cx <= r.x + r.width &&
              cy >= r.y &&
              cy <= r.y + r.height,
          );
          const protectedPixel = l.protected.some(
            (r) =>
              (x + 1) / width > r.x &&
              x / width < r.x + r.width &&
              (y + 1) / height > r.y &&
              y / height < r.y + r.height,
          );
          if (!allowed || protectedPixel) {
            expect(Array.from(after.subarray(i, i + 4))).toEqual(
              Array.from(before.subarray(i, i + 4)),
            );
            if (protectedPixel) protectedPixels++;
          } else {
            expect(Array.from(after.subarray(i, i + 4))).toEqual([
              255, 255, 255, 255,
            ]);
            changed++;
          }
        }
      expect(changed).toBeGreaterThan(0);
      expect(protectedPixels).toBeGreaterThan(0);
    });
  },
);
