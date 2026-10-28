import { renderDeviceLocation } from "./device-layout";
import type { TemplateDoc, Layer, ImageSource } from "../../types/template";
import type { PhoneSettings } from "../phone/schema";
import {
  createShapeLayer,
  createImageLayer,
  createTextLayer,
} from "../template/layers";
import { builtinAppIconSource } from "../phone/app-icon-catalog";
import {
  isLocationConfirmed,
  locationAppCapacity,
  locationRenderKey,
} from "./model";
import { contains, intersects, type LocationRect } from "./schema";
type Helpers = {
  time: (p: PhoneSettings) => string;
  date: (p: PhoneSettings) => string;
  icons: (p: PhoneSettings) => string;
  color: (p: PhoneSettings) => string;
};
const svgSource = (svg: string): ImageSource => ({
  kind: "url",
  url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
});
const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export function renderLocatedPhone(
  base: TemplateDoc,
  raw: PhoneSettings,
  helpers: Helpers,
): TemplateDoc {
  const l = base.statusLocation;
  if (!l || !isLocationConfirmed(base))
    throw new Error(
      "状态栏定位未确认或已失效，请先框选并直接确认保存；也可保留原图或选择顶部新增",
    );
  if (l.layout !== "manual") return renderDeviceLocation(base, raw, helpers);
  const direct = l.approval === "direct";
  if (!direct && raw.showDate && !l.date)
    throw new Error(
      "模板没有日期区域，请在精细定位中添加，或关闭日期／选择顶部新增",
    );
  if (!direct && raw.showCarrier && !l.carrier)
    throw new Error(
      "模板没有运营商区域，请在精细定位中添加，或关闭运营商／选择顶部新增",
    );
  const W = base.canvas.width,
    H = base.canvas.height;
  const box = (r: LocationRect) => ({
    x: r.x * W,
    y: r.y * H,
    width: r.width * W,
    height: r.height * H,
  });
  const autoColor = (role: string) => {
    const f = l.fills.find((f) => f.role === role) ?? l.fills[0];
    if (!f || raw.customColor || raw.fusion.locks.includes("color"))
      return helpers.color(raw);
    return (lum(f.top) + lum(f.bottom)) / 2 > 0.3 ? "#111111" : "#ffffff";
  };
  const phone = {
    ...raw,
    placement: "overlay" as const,
    addedHeight: 0,
    groupId: base.phone?.groupId ?? raw.groupId,
    theme:
      autoColor("system") === "#ffffff"
        ? ("light" as const)
        : ("dark" as const),
  };
  const layers: Layer[] = [];
  const add = (role: string, layer: Layer) =>
    layers.push({
      ...layer,
      id: `${phone.groupId}_${role}`,
      groupId: phone.groupId,
      locked: true,
      editable: false,
      layout: "fixed",
      name: `手机 · ${layer.name}`,
    });
  const b = box(l.bounds);
  // Browsers round fractional intrinsic SVG sizes before Fabric scales the image.
  // An integer raster surface keeps transparent gaps aligned with the source pixels.
  const surface = {
    x: Math.floor(b.x),
    y: Math.floor(b.y),
    width: Math.ceil(b.x + b.width) - Math.floor(b.x),
    height: Math.ceil(b.y + b.height) - Math.floor(b.y),
  };
  let defs = "",
    rects = "";
  for (const [index, fill] of l.fills.entries()) {
    const r = box(l[fill.role]!);
    const id = `fill${index}`;
    if (fill.top !== fill.bottom)
      defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${fill.top}"/><stop offset="1" stop-color="${fill.bottom}"/></linearGradient>`;
    rects += `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${fill.top === fill.bottom ? fill.top : `url(#${id})`}"/>`;
  }
  add(
    "background",
    createImageLayer(
      surface,
      svgSource(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${surface.width}" height="${surface.height}" viewBox="${surface.x} ${surface.y} ${surface.width} ${surface.height}"><defs>${defs}</defs>${rects}</svg>`,
      ),
      { name: "定位区域背景清理", fit: "stretch", autoFocus: false },
    ),
  );
  const text = (role: "time" | "date" | "carrier", content: string) => {
    const r = l[role];
    if (!r) return;
    const q = box(r);
    const original = q.height / (role === "time" ? 0.85 : 1.4);
    const units = [...content].reduce(
      (sum, c) =>
        sum +
        (/[^\x00-\xff]/.test(c)
          ? 1
          : /\d/.test(c)
            ? 0.56
            : c === "M"
              ? 0.86
              : /[AP]/.test(c)
                ? 0.7
                : c === ":" || c === " "
                  ? 0.28
                  : 0.6),
      0,
    );
    const size = Math.min(
      original * Math.min(1, phone.scale / 100),
      q.width / Math.max(1, units * 1.05),
    );
    if (!direct && size < original * 0.55)
      throw new Error(
        `${role === "time" ? "时间" : "附加文字"}放不下，请扩大定位区域或缩短内容`,
      );
    if (role === "time") {
      const escaped = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      add(
        role,
        createImageLayer(
          q,
          svgSource(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${q.width}" height="${q.height}" viewBox="0 0 ${q.width} ${q.height}"><text x="0" y="${q.height * 0.9}" font-family="Arial,sans-serif" font-weight="${phone.timeWeight === "bold" ? 700 : 400}" font-size="${size}" fill="${autoColor(role)}">${escaped}</text></svg>`,
          ),
          { name: "时间", fit: "stretch", autoFocus: false },
        ),
      );
      return;
    }
    add(
      role,
      createTextLayer(q, {
        name: role === "date" ? "日期" : "运营商",
        text: content,
        fontFamily: "Noto Sans SC",
        fontSize: size,
        minFontSize: size,
        fontWeight: "normal",
        fill: autoColor(role),
        wrap: false,
        lineHeight: 1,
        verticalAlign: "middle",
        autoGrow: false,
      }),
    );
  };
  text("time", helpers.time(phone));
  if (phone.showDate) text("date", helpers.date(phone));
  if (phone.showCarrier) text("carrier", phone.carrier);
  const system = box(l.system),
    svg = helpers.icons({ ...phone, customColor: autoColor("system") });
  const nativeWidth = Number(svg.match(/\bwidth="([\d.]+)"/)?.[1] ?? 100);
  const iconHeight = Math.min(system.height, (system.width / nativeWidth) * 20),
    iconWidth = (nativeWidth * iconHeight) / 20;
  add(
    "icons",
    createImageLayer(
      {
        x: system.x + system.width - iconWidth,
        y: system.y + (system.height - iconHeight) / 2,
        width: iconWidth,
        height: iconHeight,
      },
      svgSource(svg),
      { name: "信号、网络与电池", fit: "contain", autoFocus: false },
    ),
  );
  const apps = phone.appIcons.filter((i) => i.visible);
  if (
    !direct &&
    apps.length >
      locationAppCapacity(
        base,
        phone.scale,
        phone.appIconGap / phone.appIconSize,
        phone.appIconSize / 12,
      )
  )
    throw new Error("APP 图标超出模板定位空间，请减少数量或扩大 APP 区域");
  if (l.apps) {
    const q = box(l.apps),
      size = Math.min(
        q.height,
        ...(direct && apps.length
          ? [
              q.width /
                (apps.length +
                  (Math.max(0, apps.length - 1) * phone.appIconGap) /
                    phone.appIconSize),
            ]
          : []),
        (((l.time.height * H * 0.9 * phone.scale) / 100) * phone.appIconSize) /
          12,
      ),
      gap = (size * phone.appIconGap) / phone.appIconSize;
    for (const [index, app] of apps.entries())
      add(
        `app_${app.id}`,
        createImageLayer(
          {
            x: q.x + index * (size + gap),
            y: q.y + (q.height - size) / 2,
            width: size,
            height: size,
          },
          app.kind === "builtin"
            ? builtinAppIconSource(app.builtinId)
            : app.src,
          {
            name: `APP · ${app.name}`,
            fit: "contain",
            autoFocus: false,
            ...(app.kind === "custom" && phone.customAppStyle === "mono"
              ? { tint: autoColor("apps") }
              : {}),
          },
        ),
      );
  }
  if (phone.showHomeIndicator) {
    const s = W / 400;
    add(
      "home",
      createShapeLayer(
        "rect",
        { x: W / 2 - 65 * s, y: H - 12 * s, width: 130 * s, height: 4 * s },
        {
          name: "底部手势条",
          fill: helpers.color(phone),
          strokeWidth: 0,
          radius: 2 * s,
        },
      ),
    );
  }
  for (const layer of layers.filter(
    (layer) => !layer.id.endsWith("_background"),
  )) {
    const rect = {
      x: layer.x / W,
      y: layer.y / H,
      width: layer.width / W,
      height: layer.height / H,
    };
    const role = layer.id.includes("_app_")
      ? "apps"
      : layer.id.endsWith("_icons")
        ? "system"
        : layer.id.endsWith("_time")
          ? "time"
          : layer.id.endsWith("_date")
            ? "date"
            : layer.id.endsWith("_carrier")
              ? "carrier"
              : null;
    if (!direct && role && (!l[role] || !contains(l[role]!, rect)))
      throw new Error("生成内容超出对应定位小区域，请调整数量或尺寸");
    if (!direct && l.protected.some((p) => intersects(rect, p)))
      throw new Error("生成内容与保护区重叠，已阻止替换");
  }
  if (base.layers.length + layers.length > 2000)
    throw new Error("图层数量超过上限");
  // No generated layer may spill out of its authorized source region.
  for (const layer of layers.filter(
    (v) => !v.id.endsWith("_home") && !v.id.endsWith("_background"),
  )) {
    if (
      !direct &&
      (layer.x < b.x - 0.001 ||
        layer.y < b.y - 0.001 ||
        layer.x + layer.width > b.x + b.width + 0.001 ||
        layer.y + layer.height > b.y + b.height + 0.001)
    )
      throw new Error("生成内容超出状态栏定位边界");
  }
  const next = { ...base, phone, layers: [...base.layers, ...layers] };
  return { ...next, phone: { ...phone, locationKey: locationRenderKey(next) } };
}
