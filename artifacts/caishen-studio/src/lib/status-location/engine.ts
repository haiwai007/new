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
    throw new Error("原图资源未完整加载，无法确认定位");
  }
  return { base, canvas: result.canvas };
}
const hex = (rgb: number[]) =>
  "#" +
  rgb
    .map((n) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
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
export async function testStatusLocation(
  doc: TemplateDoc,
  draft: StatusLocation,
): Promise<LocationTestResult> {
  const issues = locationGeometryErrors(draft);
  if (issues.length) throw new Error(issues[0]);
  const { canvas, base } = await locationSnapshot(doc);
  const liveSource = [
    base.canvas.backgroundImage,
    ...base.layers
      .filter((l) => l.visible && l.type === "image")
      .map((l) => (l.type === "image" ? l.src : null)),
  ].some((src) => src?.kind === "url" && /^https?:/i.test(src.url));
  if (liveSource) {
    canvas.width = canvas.height = 0;
    throw new Error(
      "请先将外部图片保存为本地素材，再确认状态栏定位，避免远程图片变化导致定位失效",
    );
  }
  let output: HTMLCanvasElement | undefined;
  try {
    const W = canvas.width,
      H = canvas.height,
      ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const l: StatusLocation = {
      ...structuredClone(draft),
      state: "pending",
      fills: [],
      sourceKey: locationSourceKey(base, draft.bounds),
      testKey: "",
    };
    for (const role of LOCATION_ROLES) {
      const rect = l[role];
      if (!rect) continue;
      const x = Math.max(0, Math.floor(rect.x * W)),
        y = Math.max(0, Math.floor(rect.y * H)),
        w = Math.max(1, Math.min(W - x, Math.ceil(rect.width * W))),
        h = Math.max(1, Math.min(H - y, Math.ceil(rect.height * H)));
      if (role === "time" || role === "system") {
        const inkData = ctx.getImageData(x, y, w, h).data,
          bg = analyseStrip(inkData);
        if (!bg) throw new Error("原图中没有完整的时间或系统图标");
        const color = rgb(bg.background);
        let ink = 0;
        for (let i = 0; i < inkData.length; i += 4)
          if (
            inkData[i + 3] >= 128 &&
            distance([inkData[i], inkData[i + 1], inkData[i + 2]], color) > 45
          )
            ink++;
        if (ink < Math.max(3, w * h * 0.004))
          throw new Error(
            "所选时间或系统区域只有空白，不能在原状态栏上方另加一套。请重新框选原内容；没有原状态栏时请选择顶部新增",
          );
      }
      if (l.background === "solid") {
        l.fills.push({ role, top: l.color, bottom: l.color });
        continue;
      }
      const pixels = ctx.getImageData(x, y, w, h).data;
      const rows: number[][] = [];
      let near = 0,
        total = 0;
      for (let yy = 0; yy < h; yy++) {
        const row = pixels.slice(yy * w * 4, (yy + 1) * w * 4),
          sample = analyseStrip(row);
        if (!sample) throw new Error("定位区域没有可见背景");
        const color = rgb(sample.background);
        rows.push(color);
        for (let i = 0; i < row.length; i += 4) {
          if (row[i + 3] < 128) continue;
          total++;
          if (distance([row[i], row[i + 1], row[i + 2]], color) < 30) near++;
        }
      }
      const top = rows[0],
        bottom = rows[rows.length - 1];
      let residual = 0;
      for (let yy = 0; yy < h; yy++) {
        const t = h > 1 ? yy / (h - 1) : 0;
        residual += distance(
          rows[yy],
          top.map((v, i) => v + (bottom[i] - v) * t),
        );
      }
      if (near / Math.max(1, total) < 0.55 || residual / h > 23)
        throw new Error(
          "背景较复杂，无法可靠清除旧内容。请调整区域、修复背景，或明确选择手动纯色后重新测试",
        );
      l.fills.push({
        role,
        top: hex(top),
        bottom: distance(top, bottom) < 12 ? hex(top) : hex(bottom),
      });
    }
    // Foreground crossing a boundary indicates a clipped old clock/icon.
    if (l.background === "auto") {
      const r = l.bounds;
      const x = Math.floor(r.x * W),
        y = Math.floor(r.y * H),
        w = Math.max(1, Math.floor(r.width * W)),
        h = Math.max(1, Math.floor(r.height * H));
      const data = ctx.getImageData(
          x,
          y,
          Math.min(w, W - x),
          Math.min(h, H - y),
        ).data,
        sample = analyseStrip(data);
      if (sample?.uniform) {
        const bg = rgb(sample.background);
        let uncovered = 0;
        for (let yy = 0; yy < h; yy++)
          for (let xx = 0; xx < w; xx++) {
            const i = (yy * w + xx) * 4;
            if (distance([data[i], data[i + 1], data[i + 2]], bg) < 65)
              continue;
            const pixel = {
              x: (x + xx) / W,
              y: (y + yy) / H,
              width: 1 / W,
              height: 1 / H,
            };
            const assigned =
              LOCATION_ROLES.some(
                (role) => l[role] && contains(l[role]!, pixel),
              ) || l.protected.some((p) => contains(p, pixel));
            if (!assigned) uncovered++;
          }
        if (uncovered > Math.max(10, w * h * 0.006))
          throw new Error(
            "外框内仍有未指定的旧内容，请调整时间／图标框，或为标题和按钮添加保护区",
          );
      }
    }
    l.state = "confirmed";
    l.testKey = locationTestKey(l);
    const settings = naturalPhoneSettings();
    settings.groupId = "phone_locate0001";
    settings.time = "12:34";
    settings.battery = 76;
    settings.showHomeIndicator = false;
    if (l.apps) {
      settings.appIcons = [
        {
          id: "app_locate0001",
          kind: "builtin",
          builtinId: "wechat",
          name: "微信",
          visible: true,
        },
      ];
    }
    const next = applyPhoneLayers({ ...base, statusLocation: l }, settings);
    const rendered = await renderDoc(next, {
      multiplier: canvas.width / base.canvas.width,
    });
    output = rendered.canvas;
    if (output.width !== W || output.height !== H)
      throw new Error("替换结果改变了图片尺寸，无法确认");
    const before = ctx.getImageData(0, 0, W, H).data,
      after = output.getContext("2d")!.getImageData(0, 0, W, H).data;
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
        const allowed =
          LOCATION_ROLES.some((role) => l[role] && contains(l[role]!, pixel)) &&
          !l.protected.some((p) => contains(p, pixel));
        if (!allowed) outside++;
      }
    if (outside)
      throw new Error(
        `检测到 ${outside} 个边界外像素变化，已阻止确认，请调整定位边界`,
      );
    if (!changed) throw new Error("没有生成可验证的替换效果，请检查区域");
    return {
      location: l,
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
