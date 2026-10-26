import type { TemplateDoc } from "../../types/template";
import type { PhoneSettings } from "./schema";
import type { FusionAnalysis } from "./fusion-schema";
import { phoneModel } from "./models";
import { effectiveProfile } from "./profiles";
import { luminance } from "./match";
export const rgb = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});
const distance = (a: string, b: string) => {
  const x = rgb(a),
    y = rgb(b);
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
};
export function designKey(base: TemplateDoc): string {
  // Parameters below the top quarter cannot change the sampled status-bar background.
  const source = JSON.stringify([
    base.canvas,
    base.layers.filter((l) => {
      if (!l.visible) return false;
      const a = (l.rotation * Math.PI) / 180;
      const corners = [
        0,
        l.width * Math.sin(a),
        l.height * Math.cos(a),
        l.width * Math.sin(a) + l.height * Math.cos(a),
      ];
      const shadow =
        l.type !== "image" && l.shadow
          ? l.shadow.blur * 2 + Math.abs(l.shadow.offsetY)
          : 0;
      return (
        l.y + Math.min(...corners) - shadow < base.canvas.height * 0.25 &&
        l.y + Math.max(...corners) + shadow > 0
      );
    }),
    base.source,
  ]);
  let a = 2166136261,
    b = 0x9e3779b9;
  for (let i = 0; i < source.length; i++) {
    a = Math.imul(a ^ source.charCodeAt(i), 16777619);
    b = Math.imul(b ^ source.charCodeAt(i), 2246822519);
  }
  return `fusion-2:${source.length}:${a >>> 0}:${b >>> 0}`;
}
export function regionBackground(analysis: FusionAnalysis, ratio: number) {
  const n = Math.max(
    2,
    Math.min(
      analysis.bands.length,
      Math.ceil(
        (analysis.bands.length * Math.min(0.25, Math.max(0.015, ratio))) / 0.25,
      ),
    ),
  );
  const bands = analysis.bands.slice(0, n),
    top = bands[0].color,
    bottom = bands[n - 1].color;
  const flat = bands.every((b) => distance(b.color, top) < 20);
  const a = rgb(top),
    b = rgb(bottom);
  const residual =
    bands.reduce((sum, band, i) => {
      const t = i / (n - 1),
        c = rgb(band.color);
      return (
        sum +
        Math.hypot(
          c.r - (a.r + (b.r - a.r) * t),
          c.g - (a.g + (b.g - a.g) * t),
          c.b - (a.b + (b.b - a.b) * t),
        )
      );
    }, 0) / n;
  const simple = bands.filter((b) => b.uniformity > 0.65).length / n > 0.8;
  return {
    kind:
      flat && simple
        ? ("flat" as const)
        : simple && residual < 18
          ? ("gradient" as const)
          : ("complex" as const),
    top,
    bottom,
  };
}
/** Shared geometry for background coverage, layer layout, and prepended canvas space. */
export function phoneGeometry(
  settings: PhoneSettings,
  canvas: { width: number; height: number },
) {
  const model = phoneModel(settings.modelId);
  const unit = Math.min(
    canvas.width / model.points,
    canvas.height / (model.bar + 40),
  );
  const nativeBar = model.bar * unit;
  const automatic =
    settings.rendering === "natural" &&
    settings.fusion.enabled &&
    !settings.fusion.locks.includes("geometry");
  const measured = automatic ? settings.fusion.analysis?.geometry : undefined;
  // Uncertain screenshots use a compact fallback instead of a large physical safe area.
  const bar = measured
    ? measured.barRatio * canvas.height
    : automatic && settings.fusion.analysis
      ? Math.min(nativeBar, canvas.width * 0.085)
      : nativeBar;
  const glyphScale = measured
    ? (measured.glyphRatio * canvas.height) /
      (effectiveProfile(settings).fontSize * 0.74 * unit)
    : 1;
  const contentScale = automatic
    ? Math.max(
        0.25,
        Math.min(
          1.25,
          glyphScale,
          bar / (effectiveProfile(settings).fontSize * unit * 1.5),
        ),
      )
    : 1;
  return {
    bar,
    contentScale,
    center: measured ? measured.centerRatio * canvas.height : bar / 2,
  };
}
export function naturalBarRatio(
  settings: PhoneSettings,
  canvas: { width: number; height: number },
) {
  return Math.min(
    0.25,
    Math.max(
      phoneGeometry(settings, canvas).bar / canvas.height,
      settings.coverRatio,
    ),
  );
}
export function resolveFusionSettings(
  settings: PhoneSettings,
  canvas: { width: number; height: number },
): PhoneSettings {
  if (settings.rendering !== "natural" || !settings.fusion.enabled)
    return settings;
  const next = { ...settings, fusion: { ...settings.fusion } };
  const data = next.fusion.analysis;
  if (!data) return next;
  const locked = new Set(next.fusion.locks);
  if (data.geometry && !locked.has("coverage") && next.placement === "overlay")
    next.coverRatio = data.geometry.barRatio;
  const region = regionBackground(data, naturalBarRatio(next, canvas));
  if (!locked.has("color")) {
    const light =
      (luminance(rgb(region.top)) + luminance(rgb(region.bottom))) / 2;
    next.theme =
      1.05 / (light + 0.05) > (light + 0.05) / 0.0556 ? "light" : "dark";
    next.customColor = null;
  }
  if (!locked.has("background")) {
    next.backgroundColor = region.top;
    next.transparent =
      next.fusion.background === "preserve" ||
      (next.fusion.background === "auto" && region.kind === "complex");
  }
  if (
    !locked.has("coverage") &&
    next.placement === "overlay" &&
    data.suspectedOldBar &&
    data.confidence === "high" &&
    region.kind !== "complex"
  )
    next.coverRatio = Math.max(next.coverRatio, data.suggestedCover);
  return next;
}
/** Requested-size capacity; natural mode reserves real time width instead of scaling every icon down. */
export function naturalAppCapacity(settings: PhoneSettings): number {
  const model = phoneModel(settings.modelId),
    profile = effectiveProfile(settings);
  const scale = settings.scale / 100;
  const side =
    model.cutout === "none"
      ? model.points * 0.48
      : (model.points - model.cutoutWidth) / 2 - 4;
  const edge = Math.max(1, profile.inset + settings.insetX);
  const timeWidth = (settings.timeFormat === "12h" ? 84 : 46) * scale;
  const remaining = side - edge - timeWidth - 6 * scale;
  return Math.max(
    0,
    Math.min(
      8,
      Math.floor(
        (remaining + settings.appIconGap * scale) /
          ((settings.appIconSize + settings.appIconGap) * scale),
      ),
    ),
  );
}
export function fusionWarnings(settings: PhoneSettings): string[] {
  if (settings.rendering !== "natural" || !settings.fusion.enabled) return [];
  const warnings: string[] = [];
  const data = settings.fusion.analysis;
  if (!data) warnings.push("尚未分析原图，请重新自动适配");
  if (data) {
    const region = regionBackground(data, naturalBarRatio(settings, data));
    if (region.kind === "complex" && settings.placement === "overlay")
      warnings.push(
        data.suspectedOldBar
          ? "复杂背景可能残留旧状态栏；请先修复背景、调整覆盖范围或添加顶部区域"
          : "复杂背景保留原图；请检查图标对比度与原有内容",
      );
    const resolved = resolveFusionSettings(settings, data);
    const foreground = luminance(
      rgb(
        resolved.customColor ??
          (resolved.theme === "light" ? "#ffffff" : "#111111"),
      ),
    );
    const colors =
      !resolved.transparent &&
      (resolved.fusion.background === "flat" ||
        resolved.fusion.locks.includes("background"))
        ? [resolved.backgroundColor]
        : data.bands
            .slice(
              0,
              Math.max(
                2,
                Math.ceil(
                  (data.bands.length * naturalBarRatio(resolved, data)) / 0.25,
                ),
              ),
            )
            .map((b) => b.color);
    const contrast = Math.min(
      ...colors.map((color) => {
        const background = luminance(rgb(color));
        return (
          (Math.max(background, foreground) + 0.05) /
          (Math.min(background, foreground) + 0.05)
        );
      }),
    );
    if (contrast < 4.5)
      warnings.push(
        "当前配色或顶部明暗变化可能影响清晰度，请在局部预览检查图标",
      );
    if (data.confidence === "low")
      warnings.push("图片可能经过裁剪或顶部内容复杂，处理方式需人工确认");
  }
  if (
    phoneModel(settings.modelId).style !== "android" &&
    settings.appIcons.some((i) => i.visible)
  )
    warnings.push("当前 APP 通知布局属于自定义效果，并非 iPhone 默认状态栏");
  if (
    settings.showDate ||
    settings.showCarrier ||
    settings.vpn ||
    settings.hd ||
    settings.dualSim
  )
    warnings.push("附加文字或状态属于自定义效果，请检查参考样式与实际系统差异");
  return warnings;
}

export function gradientStops(
  analysis: FusionAnalysis,
  ratio: number,
  placement: PhoneSettings["placement"],
) {
  const region = regionBackground(analysis, ratio);
  if (placement !== "prepend")
    return { top: region.top, bottom: region.bottom };
  const a = rgb(region.top),
    b = rgb(region.bottom);
  const top =
    "#" +
    [2 * a.r - b.r, 2 * a.g - b.g, 2 * a.b - b.b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  return { top, bottom: region.top };
}
