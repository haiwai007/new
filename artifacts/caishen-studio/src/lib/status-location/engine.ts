import type { TemplateDoc } from "../../types/template";
import { renderDoc } from "../canvas/render";
import {
  applyPhoneLayers,
  removePhoneLayers,
  naturalPhoneSettings,
} from "../phone/layers";
import { analyseTopPixels } from "../phone/fusion";
import { analyseStrip } from "../phone/match";
import {
  defaultStatusLocation,
  locationSourceKey,
  locationTestKey,
} from "./model";
import {
  LOCATION_ROLES,
  contains,
  locationGeometryErrors,
  type LocationRect,
  type StatusLocation,
} from "./schema";
export async function locationSnapshot(doc: TemplateDoc) {
  const base = removePhoneLayers(doc);
  const result = await renderDoc(base, {
    multiplier: Math.min(1, 720 / base.canvas.width),
  });
  if (result.warnings.some((w) => /丢失|加载失败/.test(w))) {
    result.canvas.width = result.canvas.height = 0;
    throw new Error("原图资源未完整加载，暂时无法预览；仍可直接确认保存框选区域");
  }
  return { base, canvas: result.canvas };
}
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const distance = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]));
export async function proposeStatusLocation(
  doc: TemplateDoc,
): Promise<StatusLocation | null> {
  const { canvas, base } = await locationSnapshot(doc);
  try {
    const W = canvas.width,
      H = canvas.height,
      ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const strip = Math.min(H, Math.max(32, Math.round(H * 0.25)));
    if (strip < 32) return null;
    const data = ctx.getImageData(0, 0, W, strip).data;
    const analysis = analyseTopPixels(data, W, strip, {
      width: base.canvas.width,
      height: base.canvas.height,
      sourceKey: "candidate",
    });
    const g = analysis.geometry;
    if (!g) return null;
    const y = Math.max(0, g.centerRatio - g.glyphRatio * 0.95),
      bottom = Math.min(
        1,
        g.centerRatio + g.glyphRatio * 0.95,
        analysis.contentTopRatio ?? 1,
      );
    if (bottom - y < g.glyphRatio) return null;
    const location = defaultStatusLocation(base);
    location.origin = "auto";
    location.bounds = { x: 0, y, width: 1, height: bottom - y };
    const top = Math.floor(y * H),
      end = Math.ceil(bottom * H),
      bg = rgb(analysis.top);
    const ink = (x: number, yy: number) => {
      const i = (yy * W + x) * 4;
      return (
        data[i + 3] >= 128 &&
        distance([data[i], data[i + 1], data[i + 2]], bg) > 50
      );
    };
    const fit = (left: number, right: number): LocationRect | null => {
      let x0 = W,
        y0 = H,
        x1 = 0,
        y1 = 0;
      for (let yy = top; yy < end; yy++)
        for (
          let x = Math.max(0, Math.floor(left));
          x < Math.min(W, Math.ceil(right));
          x++
        )
          if (ink(x, yy)) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x + 1);
            y0 = Math.min(y0, yy);
            y1 = Math.max(y1, yy + 1);
          }
      if (x0 >= x1) return null;
      return {
        x: Math.max(0, x0 - 1) / W,
        y: Math.max(top, y0 - 1) / H,
        width: (Math.min(W, x1 + 1) - Math.max(0, x0 - 1)) / W,
        height: (Math.min(end, y1 + 1) - Math.max(top, y0 - 1)) / H,
      };
    };
    const groups: { start: number; end: number }[] = [];
    let start = -1;
    for (let x = Math.floor(W * 0.015); x < W * 0.29; x++) {
      let hit = false;
      for (let yy = top; yy < end; yy++)
        if (ink(x, yy)) {
          hit = true;
          break;
        }
      if (hit && start < 0) start = x;
      if (!hit && start >= 0) {
        groups.push({ start, end: x });
        start = -1;
      }
    }
    const glyph = g.glyphRatio * H;
    const digits: typeof groups = [];
    for (const group of groups) {
      if (
        digits.length >= 3 &&
        (group.start - digits[digits.length - 1].end > glyph * 0.6 ||
          group.end - group.start > glyph * 1.1)
      )
        break;
      if (group.end - group.start <= glyph * 1.1) digits.push(group);
      if (digits.length === 5) break;
    }
    if (digits.length < 3) return null;
    const time = fit(digits[0].start, digits[digits.length - 1].end),
      system = fit(W * 0.55, W * 0.995);
    if (!time || !system) return null;
    location.time = time;
    location.system = system;
    const appX = time.x + time.width + 0.005,
      appEnd = Math.min(0.44, system.x - 0.02);
    location.apps =
      appEnd > appX + 0.02
        ? { x: appX, y, width: appEnd - appX, height: bottom - y }
        : null;
    const center = fit(W * 0.45, W * 0.55);
    if (center && center.width > 0.035) location.protected = [center];
    if (locationGeometryErrors(location).length) return null;
    return location;
  } finally {
    canvas.width = canvas.height = 0;
  }
}
export type LocationTestResult = {
  location: StatusLocation;
  original: string;
  result: string;
  changed: number;
  outside: number;
};
/** Store exactly the user's selection. Sampling is best effort, never approval. */
export async function confirmStatusLocation(
  doc: TemplateDoc,
  draft: StatusLocation,
): Promise<StatusLocation> {
  const base = removePhoneLayers(doc);
  const location: StatusLocation = {
    ...structuredClone(draft),
    approval: "direct",
    state: "confirmed",
    fills: [],
    sourceKey: locationSourceKey(base, draft.bounds),
    testKey: "",
  };
  let canvas: HTMLCanvasElement | undefined;
  try {
    canvas = (await locationSnapshot(base)).canvas;
  } catch {
    /* Geometry can be saved even if sampling is unavailable. */
  }
  const fallback = /^#[0-9a-f]{6}$/i.test(base.canvas.backgroundColor)
    ? base.canvas.backgroundColor
    : "#ffffff";
  try {
    for (const role of LOCATION_ROLES) {
      const r = location[role];
      if (!r) continue;
      let top = location.background === "solid" ? location.color : fallback,
        bottom = top;
      if (canvas && location.background === "auto") {
        try {
          const x = Math.min(
            canvas.width - 1,
            Math.max(0, Math.floor(r.x * canvas.width)),
          );
          const y = Math.min(
            canvas.height - 1,
            Math.max(0, Math.floor(r.y * canvas.height)),
          );
          const w = Math.max(
            1,
            Math.min(canvas.width - x, Math.ceil(r.width * canvas.width)),
          );
          const h = Math.max(
            1,
            Math.min(canvas.height - y, Math.ceil(r.height * canvas.height)),
          );
          const ctx = canvas.getContext("2d")!;
          top =
            analyseStrip(ctx.getImageData(x, y, w, 1).data)?.background ??
            fallback;
          bottom =
            analyseStrip(ctx.getImageData(x, y + h - 1, w, 1).data)
              ?.background ?? top;
        } catch {
          /* Keep a usable fill; complex/blank/remote images do not block saving. */
        }
      }
      location.fills.push({ role, top, bottom });
    }
  } finally {
    if (canvas) canvas.width = canvas.height = 0;
  }
  location.testKey = locationTestKey(location);
  return location;
}
/** Optional preview only: no pixel threshold, recognition or background veto. */
export async function testStatusLocation(
  doc: TemplateDoc,
  draft: StatusLocation,
): Promise<LocationTestResult> {
  const location = await confirmStatusLocation(doc, draft);
  const { canvas, base } = await locationSnapshot(doc);
  let output: HTMLCanvasElement | undefined;
  try {
    const settings = naturalPhoneSettings();
    settings.groupId = "phone_locate0001";
    settings.time = "12:34";
    settings.battery = 76;
    settings.showHomeIndicator = false;
    if (location.apps)
      settings.appIcons = [
        {
          id: "app_locate0001",
          kind: "builtin",
          builtinId: "wechat",
          name: "微信",
          visible: true,
        },
      ];
    const next = applyPhoneLayers(
      { ...base, statusLocation: location },
      settings,
    );
    output = (
      await renderDoc(next, { multiplier: canvas.width / base.canvas.width })
    ).canvas;
    const W = canvas.width,
      H = canvas.height;
    const before = canvas.getContext("2d")!.getImageData(0, 0, W, H).data;
    const after = output.getContext("2d")!.getImageData(0, 0, W, H).data;
    let changed = 0,
      outside = 0;
    for (let yy = 0; yy < H; yy++)
      for (let xx = 0; xx < W; xx++) {
        const i = (yy * W + xx) * 4;
        if (![0, 1, 2, 3].some((k) => before[i + k] !== after[i + k])) continue;
        changed++;
        const pixel = {
          x: (xx + 0.5) / W,
          y: (yy + 0.5) / H,
          width: 0,
          height: 0,
        };
        if (
          !LOCATION_ROLES.some(
            (role) => location[role] && contains(location[role]!, pixel),
          ) ||
          location.protected.some((r) => contains(r, pixel))
        )
          outside++;
      }
    return {
      location,
      original: canvas.toDataURL("image/png"),
      result: output.toDataURL("image/png"),
      changed,
      outside,
    };
  } finally {
    canvas.width = canvas.height = 0;
    if (output) output.width = output.height = 0;
  }
}
