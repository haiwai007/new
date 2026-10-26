import { isLocationConfirmed } from "../status-location/model";
import { renderLocatedPhone } from "../status-location/render";
import { builtinAppIconSource } from "./app-icon-catalog";
import { effectiveProfile } from "./profiles";
import {
  gradientStops,
  phoneGeometry,
  naturalAppCapacity,
  naturalBarRatio,
  regionBackground,
  resolveFusionSettings,
} from "./fusion-metrics";
import type {
  ImageSource,
  Layer,
  TemplateDoc,
  TextLayer,
} from "../../types/template";
import {
  createImageLayer,
  createShapeLayer,
  createTextLayer,
} from "../template/layers";
import { newId } from "../template/ids";
import { phoneModel } from "./models";
import { phoneSettingsSchema, type PhoneSettings } from "./schema";
export function defaultPhoneSettings(): PhoneSettings {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    rendering: "legacy",
    styleId: "auto",
    customAppStyle: "original",
    fusion: {
      enabled: false,
      background: "auto",
      handling: "manual",
      locks: [],
      analysis: null,
    },
    placement: "overlay",
    addedHeight: 0,
    groupId: newId("phone"),
    modelId: "iphone16",
    time: "09:41",
    timeFormat: "24h",
    date,
    dateFormat: "weekday",
    showDate: false,
    battery: 100,
    charging: false,
    showBatteryPercent: true,
    signal: 4,
    wifi: 3,
    network: "5G",
    airplane: false,
    bluetooth: false,
    carrier: "中国移动",
    showCarrier: false,
    theme: "dark",
    backgroundColor: "#ffffff",
    transparent: false,
    showCutout: true,
    showHomeIndicator: true,
    customColor: null,
    coverRatio: 0,
    scale: 100,
    offsetY: 0,
    insetX: 0,
    timeWeight: "bold",
    batteryStyle: "outline",
    lowPower: false,
    hd: false,
    dualSim: false,
    location: false,
    alarm: false,
    mute: false,
    dnd: false,
    vpn: false,
    appIcons: [],
    appIconSize: 12,
    appIconGap: 3,
  };
}
/** New UI presets opt in; old documents parse with legacy rendering and fusion off. */
export function naturalPhoneSettings(): PhoneSettings {
  return {
    ...defaultPhoneSettings(),
    showHomeIndicator: false,
    rendering: "natural",
    fusion: {
      enabled: true,
      background: "auto",
      handling: "manual",
      locks: [],
      analysis: null,
    },
  };
}
export function phoneTime(settings: PhoneSettings): string {
  if (settings.timeFormat === "24h") return settings.time;
  const [hour, minute] = settings.time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}
export function phoneDate(settings: PhoneSettings): string {
  if (settings.dateFormat === "iso") return settings.date;
  const [, month, day] = settings.date.split("-").map(Number);
  const basic = `${month}月${day}日`;
  return settings.dateFormat === "chinese"
    ? basic
    : `${basic} ${["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][new Date(`${settings.date}T00:00:00Z`).getUTCDay()]}`;
}
function svgSource(svg: string): ImageSource {
  return {
    kind: "url",
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  };
}
/** Icon colour: an explicit custom colour wins over the dark/light theme. */
export function phoneColor(settings: PhoneSettings): string {
  return (
    settings.customColor ?? (settings.theme === "dark" ? "#111111" : "#ffffff")
  );
}
type IconPart = { width: number; svg: (color: string) => string };
const DIM = 'opacity=".3"';
function signalBars(level: number, small = false, triangle = false): IconPart {
  if (triangle) {
    const f = level / 4;
    return {
      width: small ? 13 : 17,
      svg: (c) =>
        `<path d="M0 18L16 2V18Z" fill="${c}" ${DIM}/>${level ? `<path d="M${16 * (1 - f)} 18L16 ${18 - 16 * f}V18Z" fill="${c}"/>` : ""}`,
    };
  }
  const k = small ? 0.75 : 1;
  return {
    width: 18.5 * k,
    svg: (c) =>
      [0, 1, 2, 3]
        .map(
          (i) =>
            `<rect x="${i * 5 * k}" y="${18 - (4 + i * 3) * k}" width="${3.5 * k}" height="${(4 + i * 3) * k}" rx=".7" fill="${c}" ${i < level ? "" : DIM}/>`,
        )
        .join(""),
  };
}
function textBadge(label: string, boxed: boolean): IconPart {
  const width = boxed ? label.length * 5.6 + 6 : label.length * 7 + 1;
  return {
    width,
    svg: (c) =>
      boxed
        ? `<rect x=".6" y="4.6" width="${width - 1.2}" height="10.8" rx="2.4" fill="none" stroke="${c}" stroke-width="1.2"/><text x="${width / 2}" y="13" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="bold" fill="${c}">${label}</text>`
        : `<text x="0" y="15" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="${c}">${label}</text>`,
  };
}
const SMALL_ICONS = {
  location: {
    width: 11,
    svg: (c: string) => `<path d="M10.5 4L1 8.5L5.5 9.5L6.5 14Z" fill="${c}"/>`,
  },
  alarm: {
    width: 14,
    svg: (c: string) =>
      `<g fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="11" r="5.4"/><path d="M7 8.2V11L8.8 12.4M1.6 5.2L3.6 3.4M12.4 5.2L10.4 3.4"/></g>`,
  },
  mute: {
    width: 14,
    svg: (c: string) =>
      `<path d="M2.5 14H11.5L10.2 12.2V8.6A3.2 3.2 0 0 0 3.8 8.6V12.2Z" fill="${c}"/><path d="M1.5 4L12.5 17" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  dnd: {
    width: 12,
    svg: (c: string) =>
      `<path d="M8 4A6.5 6.5 0 1 0 12 15A5.2 5.2 0 0 1 8 4Z" fill="${c}"/>`,
  },
  bluetooth: {
    width: 9,
    svg: (c: string) =>
      `<path d="M1 6L8 12.5L4.5 16V3L8 6.5L1 13" fill="none" stroke="${c}" stroke-width="1.3" stroke-linejoin="round"/>`,
  },
} satisfies Record<string, IconPart>;
function androidBatteryPart(
  settings: PhoneSettings,
  color: string,
  battery: number,
): IconPart {
  const profile = effectiveProfile(settings);
  const vertical = profile.battery === "vertical";
  const w = vertical ? 10 : 25,
    h = vertical ? 16 : 12;
  const y = (20 - h) / 2;
  const outside =
    settings.showBatteryPercent && settings.batteryStyle === "outline";
  const prefix = outside ? String(battery).length * 6 + 9 : 0;
  const fill = settings.charging
    ? "#22c55e"
    : settings.lowPower
      ? "#facc15"
      : battery <= 20
        ? "#ef4444"
        : color;
  const contrast =
    settings.theme === "dark" && !settings.customColor ? "#ffffff" : "#111111";
  const label =
    settings.showBatteryPercent && !outside
      ? `<text x="${w / 2}" y="${vertical ? 12.3 : 13.3}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${vertical ? 5.5 : 9}" font-weight="bold" fill="${battery > 55 ? contrast : color}">${battery}</text>`
      : "";
  return {
    width: prefix + w + (vertical ? 2 : 3) + (settings.charging ? 10 : 0),
    svg: () => {
      const percent = outside
        ? `<text x="${prefix - 3}" y="14" text-anchor="end" font-family="Arial,sans-serif" font-size="10.5" fill="${color}">${battery}%</text>`
        : "";
      const innerW = w - 4,
        innerH = h - 4;
      const level = vertical
        ? `<rect x="2" y="${y + 2 + innerH * (1 - battery / 100)}" width="${innerW}" height="${(innerH * battery) / 100}" fill="${fill}"/>`
        : `<rect x="2" y="${y + 2}" width="${(innerW * battery) / 100}" height="${innerH}" rx="${Math.max(0, profile.radius - 1)}" fill="${fill}"/>`;
      const cap = vertical
        ? `<rect x="${w / 2 - 2}" y="${y - 1.5}" width="4" height="1.5" rx=".5" fill="${color}"/>`
        : `<rect x="${w + 1}" y="8" width="1.5" height="4" rx=".5" fill="${color}"/>`;
      const bolt = settings.charging
        ? `<path d="M${w + 8} 3L${w + 3} 11H${w + 7}L${w + 4} 18L${w + 12} 8H${w + 8}Z" fill="${color}"/>`
        : "";
      return `${percent}<g transform="translate(${prefix} 0)"><rect x=".5" y="${y}" width="${w - 1}" height="${h}" rx="${profile.radius}" fill="none" stroke="${color}" stroke-width="1"/>${battery > 0 ? level : ""}${cap}${label}${bolt}</g>`;
    },
  };
}
function batteryPart(
  settings: PhoneSettings,
  color: string,
  battery: number,
): IconPart {
  if (phoneModel(settings.modelId).style === "android")
    return androidBatteryPart(settings, color, battery);
  const level = settings.charging
    ? "#22c55e"
    : settings.lowPower
      ? "#facc15"
      : battery <= 20
        ? "#ef4444"
        : color;
  const contrast =
    settings.theme === "dark" && !settings.customColor ? "#ffffff" : "#111111";
  const bolt = (x: number) =>
    `<path d="M${x + 2} 4L${x - 3} 11H${x + 1}L${x - 1} 17L${x + 5} 9H${x + 1}Z" fill="${color}" stroke="${settings.transparent ? contrast : settings.backgroundColor}" stroke-width=".7"/>`;
  if (settings.batteryStyle === "inside") {
    // iOS 16+ style: percentage drawn inside a filled battery body.
    const fill =
      battery > 0
        ? `<rect x="0" y="3.5" width="${(25 * battery) / 100}" height="13" rx="4" fill="${level}"/>`
        : "";
    const label = settings.showBatteryPercent
      ? `<text x="12.5" y="13.6" text-anchor="middle" font-family="Arial,sans-serif" font-size="9.5" font-weight="bold" fill="${battery > 55 ? contrast : color}">${battery}</text>`
      : "";
    return {
      width: settings.charging ? 34 : 28,
      svg: () =>
        `<rect x="0" y="3.5" width="25" height="13" rx="4" fill="${color}" ${DIM}/>${fill}${label}<rect x="26" y="8" width="1.6" height="4" rx=".8" fill="${color}" ${DIM}/>${settings.charging ? bolt(30) : ""}`,
    };
  }
  const percent = settings.showBatteryPercent
    ? battery.toString().length * 6 + 9
    : 0;
  return {
    width: percent + 26,
    svg: () => {
      let out = "";
      if (percent)
        out += `<text x="${percent - 3}" y="14" text-anchor="end" font-family="Arial,sans-serif" font-size="10.5" fill="${color}">${battery}%</text>`;
      out += `<g transform="translate(${percent} 0)"><rect x=".5" y="4" width="23" height="12" rx="3" fill="none" stroke="${color}" stroke-width="1" opacity=".55"/><rect x="24.5" y="8" width="1.5" height="4" rx=".7" fill="${color}" opacity=".55"/>`;
      if (battery > 0)
        out += `<rect x="2.5" y="6" width="${(19 * battery) / 100}" height="8" rx="1.2" fill="${level}"/>`;
      if (settings.charging) out += bolt(12);
      return out + "</g>";
    },
  };
}
/** Right-hand status icons. Every attribute comes from validated values/constants, never user XML. */
export function statusIcons(settings: PhoneSettings): {
  svg: string;
  width: number;
} {
  const battery = Math.max(
    0,
    Math.min(
      100,
      Number.isFinite(settings.battery) ? Math.round(settings.battery) : 0,
    ),
  );
  const color = phoneColor(settings);
  const profile = effectiveProfile(settings);
  const parts: IconPart[] = [];
  for (const key of ["location", "alarm", "mute", "dnd", "bluetooth"] as const)
    if (settings[key]) parts.push(SMALL_ICONS[key]);
  if (settings.vpn) parts.push(textBadge("VPN", true));
  const cellular: IconPart[] = [];
  if (settings.airplane)
    cellular.push({
      width: 20,
      svg: (c) =>
        `<path d="M1 8L8 9L14 2L17 2L13 9L20 11L20 13L12 12L9 17L7 17L8 11L1 10Z" fill="${c}"/>`,
    });
  else {
    if (settings.hd) cellular.push(textBadge("HD", true));
    cellular.push(
      signalBars(settings.signal, false, profile.signal === "triangle"),
    );
    if (settings.dualSim)
      cellular.push(
        signalBars(
          Math.max(0, settings.signal - 1),
          true,
          profile.signal === "triangle",
        ),
      );
    if (
      settings.wifi === 0 &&
      settings.signal > 0 &&
      settings.network !== "none"
    )
      cellular.push(textBadge(settings.network, false));
  }
  const wifi: IconPart[] =
    settings.wifi > 0
      ? [
          {
            width: 18,
            svg: (c) =>
              profile.wifi === "fan"
                ? `<path d="M0 6Q9 -1 18 6L9 18Z" fill="${c}" ${settings.wifi === 3 ? "" : DIM}/>${settings.wifi < 3 ? `<path d="${settings.wifi === 2 ? "M4 10Q9 6 14 10L9 18Z" : "M7 14Q9 12 11 14L9 18Z"}" fill="${c}"/>` : ""}`
                : `<g fill="none" stroke-width="${phoneModel(settings.modelId).system === "harmony" ? 1.8 : 2.2}" stroke-linecap="round"><path d="M1 7Q9 0 17 7" stroke="${c}" ${settings.wifi >= 3 ? "" : DIM}/><path d="M3.8 10.6Q9 6 14.2 10.6" stroke="${c}" ${settings.wifi >= 2 ? "" : DIM}/><path d="M6.6 14Q9 12 11.4 14" stroke="${c}"/></g><circle cx="9" cy="16.6" r="1.3" fill="${c}"/>`,
          },
        ]
      : [];
  parts.push(
    ...(profile.wifiFirst ? [...wifi, ...cellular] : [...cellular, ...wifi]),
  );
  parts.push(batteryPart(settings, color, battery));
  const gap = profile.gap;
  let x = 0;
  let content = "";
  for (const part of parts) {
    content += `<g transform="translate(${x} 0)">${part.svg(color)}</g>`;
    x += part.width + gap;
  }
  const width = Math.ceil(x - gap + 1);
  return {
    width,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" data-system="${phoneModel(settings.modelId).system}" width="${width}" height="20" viewBox="0 0 ${width} 20">${content}</svg>`,
  };
}
export function statusIconsSvg(settings: PhoneSettings): string {
  return statusIcons(settings).svg;
}
function generatedIds(settings: PhoneSettings) {
  return new Set(
    [
      "background",
      "time",
      "date",
      "carrier",
      "icons",
      "cutout",
      "home",
      "content_background",
    ]
      .map((role) => `${settings.groupId}_${role}`)
      .concat(
        (settings.appIcons ?? []).map(
          (icon) => `${settings.groupId}_app_${icon.id}`,
        ),
      ),
  );
}
export function removePhoneLayers(doc: TemplateDoc): TemplateDoc {
  if (!doc.phone) return doc;
  const ids = generatedIds(doc.phone);
  const { phone: _phone, ...rest } = doc;
  const background = doc.layers.find(
    (l) => l.id === `${doc.phone!.groupId}_content_background`,
  );
  return {
    ...rest,
    canvas: {
      ...doc.canvas,
      height: doc.canvas.height - (doc.phone.addedHeight ?? 0),
      backgroundImage:
        doc.canvas.backgroundImage ??
        (background?.type === "image" ? background.src : null),
    },
    layers: doc.layers
      .filter((l) => !ids.has(l.id))
      .map((l) =>
        doc.phone!.addedHeight ? { ...l, y: l.y - doc.phone!.addedHeight } : l,
      ),
    parameters: doc.parameters.filter((p) => !ids.has(p.layerId)),
  };
}
/** Ordinary vector/text/image layers make canvas, thumbnails, preview and exports identical. */
function renderPhoneLayers(doc: TemplateDoc, raw: PhoneSettings): TemplateDoc {
  const settings = phoneSettingsSchema.parse(raw);
  // Keep the existing namespace, so external parameters bound to phone layers stay valid.
  const phone = {
    ...settings,
    groupId: doc.phone?.groupId ?? settings.groupId,
  };
  const model = phoneModel(phone.modelId);
  const profile = effectiveProfile(phone);
  const W = doc.canvas.width;
  const H = doc.canvas.height;
  const s = Math.min(
    W / model.points,
    H / (model.bar + (phone.showDate ? 24 : 0) + 40),
  );
  const geometry = phoneGeometry(phone, {
    width: W,
    height: H - (phone.addedHeight ?? 0),
  });
  const bounded =
    phone.rendering === "natural" &&
    phone.fusion.enabled &&
    phone.placement === "overlay";
  const bar = phone.rendering === "natural" ? geometry.bar : model.bar * s;
  if (bounded && bar < Math.max(2, W * 0.012))
    throw new Error(
      "顶部没有可确认的安全状态栏区域，已保留原图。请选择顶部新增，或使用包含完整状态栏的模板",
    );
  const extraRows = bounded
    ? Number(phone.showDate) + Number(phone.showCarrier)
    : 0;
  const primaryBar = bar / (1 + extraRows * 0.7);
  const extraRow = primaryBar * 0.7;
  const k =
    ((s * phone.scale * geometry.contentScale) / 100) *
    (bounded ? primaryBar / bar : 1);
  const color = phoneColor(phone);
  const classic = model.style === "classic";
  const android = model.style === "android";
  const cutoutWidth = model.cutoutWidth;
  const cutoutHeight = model.cutoutHeight;
  const layer = <T extends Layer>(role: string, value: T): T => ({
    ...value,
    id: `${phone.groupId}_${role}`,
    name: `手机 · ${value.name}`,
    groupId: phone.groupId,
    locked: true,
    layout: "fixed",
  });
  const text = (
    role: string,
    name: string,
    value: string,
    box: { x: number; y: number; width: number },
    fontSize: number,
    extra: Partial<TextLayer> = {},
  ) => {
    const units = [...value].reduce(
      (n, ch) =>
        n +
        (phone.rendering === "natural" && role === "time"
          ? /\d/.test(ch)
            ? 0.56
            : ch === ":" || ch === " "
              ? 0.28
              : 0.68
          : /[^\x00-\xff]/.test(ch)
            ? 1.1
            : ch === " "
              ? 0.4
              : 0.75),
      0,
    );
    const fittedFont = Math.min(
      fontSize,
      box.width / Math.max(1, units),
      bounded ? bar / 1.4 : Infinity,
    );
    const textY = box.y + (fontSize - fittedFont) * 0.7;

    return layer(
      role,
      createTextLayer(
        {
          ...box,
          y: bounded
            ? Math.max(0, Math.min(textY, bar - fittedFont * 1.4))
            : textY,
          height: fittedFont * 1.4,
        },
        {
          name,
          text: value,
          fontFamily:
            phone.rendering === "natural" && role === "time"
              ? "Arial"
              : "Noto Sans SC",
          fontSize: fittedFont,
          minFontSize: Math.min(12, fittedFont),
          fill: color,
          lineHeight: 1,
          wrap: false,
          fontWeight: "bold",
          verticalAlign: "middle",
          ...extra,
        },
      ),
    );
  };
  // Fit both the image dimensions and the physical cutout exclusion zone.
  const fontSize = Math.min(profile.fontSize * k, primaryBar / 1.6);
  const edge = Math.max(
    s,
    Math.min((profile.inset + phone.insetX) * s, W * 0.2),
  );
  const ear =
    model.style === "ios" ? Math.max(1, (W - cutoutWidth * s) / 2) : 0;
  const leftLimit =
    model.cutout === "none" ? W * 0.48 : W / 2 - (cutoutWidth * s) / 2 - 4 * s;
  const visibleApps = phone.appIcons.filter((icon) => icon.visible);
  const appCount = visibleApps.length;
  const carrierOnExtraRow =
    (android ||
      (classic && appCount > 0) ||
      (phone.rendering === "natural" &&
        phone.fusion.enabled &&
        phone.placement === "prepend")) &&
    phone.showCarrier;
  const leftSpace = Math.max(1, (ear || leftLimit) - edge - 4 * s);
  const appGapRatio = phone.appIconGap / phone.appIconSize;
  const appSize = Math.min(
    phone.appIconSize * k,
    primaryBar * 0.65,
    phone.rendering === "natural"
      ? Infinity
      : (leftSpace * 0.52) /
          Math.max(1, appCount + (appCount - 1) * appGapRatio),
  );
  const appGap = appSize * appGapRatio;
  const appWidth = appCount ? appCount * appSize + (appCount - 1) * appGap : 0;
  const timeBox =
    classic && !appCount
      ? {
          x: W / 2 - Math.min(60 * k, W * 0.25),
          width: Math.min(120 * k, W * 0.5),
        }
      : {
          x: edge,
          width: Math.max(
            0.1,
            Math.min(
              (phone.rendering === "natural"
                ? phone.timeFormat === "12h"
                  ? 84
                  : 46
                : 110) * k,
              leftSpace - appWidth - (appCount ? 4 * s : 0),
            ),
          ),
        };
  const icons = statusIcons(phone);
  const iconsMax = Math.max(1, (ear || leftLimit) - edge - 4 * s);
  const iconsWidth = Math.min(
    icons.width * k,
    iconsMax,
    (primaryBar * 0.65 * icons.width) / 20,
  );
  const iconsHeight = (iconsWidth / icons.width) * 20;
  const iconsRight = W - edge;
  const earStart = W - ear + 4 * s;
  const iconsX = ear
    ? Math.min(
        iconsRight - iconsWidth,
        (earStart + iconsRight - iconsWidth) / 2,
      )
    : iconsRight - iconsWidth;
  const halfHeight = Math.max(fontSize * 0.7, iconsHeight / 2);
  const requestedCy =
    (phone.rendering === "natural"
      ? (geometry.center * (bounded ? primaryBar / bar : 1)) / s
      : classic
        ? 10
        : android
          ? model.bar / 2
          : model.bar - 30) *
      s +
    phone.offsetY * s;
  const cy = Math.max(
    halfHeight,
    Math.min(primaryBar - halfHeight, requestedCy),
  );
  const carrierSize = Math.min(
    (classic ? 11 : android ? 12 : 8) * k,
    bar / 1.6,
  );
  const layers: Layer[] = [
    layer(
      "background",
      createShapeLayer(
        "rect",
        {
          x: 0,
          y: 0,
          width: W,
          height: bounded
            ? bar
            : Math.max(
                H * (phone.placement === "prepend" ? 0 : phone.coverRatio),
                bar +
                  (phone.showDate ? 24 * s : 0) +
                  (carrierOnExtraRow ? 18 * s : 0),
              ),
        },
        {
          name: "状态栏背景",
          fill: phone.backgroundColor,
          strokeWidth: 0,
          visible: !phone.transparent,
        },
      ),
    ),
    text(
      "time",
      "时间",
      phoneTime(phone),
      { ...timeBox, y: cy - fontSize * 0.7 },
      fontSize,
      {
        fontWeight: phone.timeWeight,
        textAlign: ear || classic ? "center" : "left",
      },
    ),
    text(
      "date",
      "日期",
      phoneDate(phone),
      {
        x: edge,
        y: bounded
          ? primaryBar + (phone.showCarrier ? extraRow : 0)
          : bar + (carrierOnExtraRow ? 18 * s : 0),
        width: W - edge * 2,
      },
      Math.min(
        12 * k,
        bounded
          ? extraRow / 1.4
          : phone.rendering === "natural" &&
              phone.fusion.enabled &&
              phone.placement === "prepend"
            ? (24 * s) / 1.4
            : Infinity,
      ),
      { visible: phone.showDate, fontWeight: "normal" },
    ),
    text(
      "carrier",
      "运营商",
      phone.carrier,
      bounded
        ? { x: edge, y: primaryBar, width: Math.max(1, W - edge * 2) }
        : carrierOnExtraRow || android || (classic && appCount > 0)
          ? { x: edge, y: bar, width: Math.max(1, W - edge * 2) }
          : classic
            ? { x: edge, y: cy - carrierSize * 0.7, width: 90 * k }
            : { x: timeBox.x, y: cy + 12 * k, width: timeBox.width },
      Math.min(
        carrierSize,
        bounded
          ? extraRow / 1.4
          : phone.rendering === "natural" &&
              phone.fusion.enabled &&
              phone.placement === "prepend"
            ? (18 * s) / 1.4
            : Infinity,
      ),
      {
        visible: phone.showCarrier,
        fontWeight: "normal",
        textAlign: ear ? "center" : "left",
      },
    ),
    layer(
      "icons",
      createImageLayer(
        {
          x: iconsX,
          y: cy - iconsHeight / 2,
          width: iconsWidth,
          height: iconsHeight,
        },
        svgSource(icons.svg),
        { name: "信号、网络与电池", fit: "contain", lockAspect: true },
      ),
    ),
  ];
  // A generated gradient is self-contained; never blur or fade the original image.
  const analysis = phone.fusion.analysis;
  if (
    phone.rendering === "natural" &&
    phone.fusion.enabled &&
    analysis &&
    phone.fusion.background === "auto" &&
    !phone.fusion.locks.includes("background")
  ) {
    const region = regionBackground(
      analysis,
      naturalBarRatio(phone, { width: W, height: H - phone.addedHeight }),
    );
    if (region.kind === "gradient") {
      const bg = layers[0];
      const stops = gradientStops(
        analysis,
        naturalBarRatio(phone, { width: W, height: H - phone.addedHeight }),
        phone.placement,
      );
      layers[0] = layer(
        "background",
        createImageLayer(
          { x: 0, y: 0, width: W, height: bg.height },
          svgSource(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${bg.height}" viewBox="0 0 ${W} ${bg.height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${stops.top}"/><stop offset="1" stop-color="${stops.bottom}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
          ),
          { name: "融合背景", fit: "stretch" },
        ),
      );
    }
  }
  layers.push(
    layer(
      "cutout",
      createShapeLayer(
        model.cutout === "hole" ? "ellipse" : "rect",
        {
          x: (W - cutoutWidth * s) / 2,
          y:
            model.cutout === "notch"
              ? 0
              : (model.cutout === "island" ? 11 : 6) * s,
          width: cutoutWidth * s,
          height: cutoutHeight * s,
        },
        {
          name: "屏幕开孔",
          fill: "#000000",
          strokeWidth: 0,
          radius: 18 * s,
          visible: phone.showCutout && model.cutout !== "none",
        },
      ),
    ),
  );
  layers.push(
    layer(
      "home",
      createShapeLayer(
        "rect",
        { x: W / 2 - 65 * s, y: H - 12 * s, width: 130 * s, height: 4.5 * s },
        {
          name: "底部手势条",
          fill: color,
          strokeWidth: 0,
          radius: 2.25 * s,
          opacity: 0.9,
          visible: phone.showHomeIndicator && !classic,
        },
      ),
    ),
  );
  for (const app of phone.appIcons) {
    const index = visibleApps.findIndex((item) => item.id === app.id);
    const x =
      index < 0
        ? edge
        : timeBox.x + timeBox.width + 4 * s + index * (appSize + appGap);
    layers.push(
      layer(
        `app_${app.id}`,
        createImageLayer(
          { x, y: cy - appSize / 2, width: appSize, height: appSize },
          app.kind === "builtin"
            ? builtinAppIconSource(app.builtinId, color)
            : app.src,
          {
            name: `APP · ${app.name}`,
            fit: "contain",
            lockAspect: true,
            visible: app.visible,
            ...(app.kind === "custom" && phone.customAppStyle === "mono"
              ? { tint: color }
              : {}),
          },
        ),
      ),
    );
  }
  const old = doc.phone ? generatedIds(doc.phone) : new Set<string>();
  if (doc.layers.filter((l) => !old.has(l.id)).length + layers.length > 2000)
    throw new Error("图层数量超过上限，无法添加手机状态栏");
  return {
    ...doc,
    phone,
    layers: [...doc.layers.filter((l) => !old.has(l.id)), ...layers],
  };
}
/** Add/remove top space reversibly. Reapplying never shifts the content twice. */
export function applyPhoneLayers(
  doc: TemplateDoc,
  raw: PhoneSettings,
): TemplateDoc {
  const parsed = phoneSettingsSchema.parse(raw);
  const base = removePhoneLayers(doc);
  if (
    parsed.placement === "overlay" &&
    base.statusLocation &&
    parsed.rendering === "natural" &&
    parsed.fusion.enabled
  )
    return renderLocatedPhone(
      base,
      { ...parsed, groupId: doc.phone?.groupId ?? parsed.groupId },
      {
        time: phoneTime,
        date: phoneDate,
        icons: statusIconsSvg,
        color: phoneColor,
      },
    );
  const phone = resolveFusionSettings(
    {
      ...parsed,
      groupId: doc.phone?.groupId ?? parsed.groupId,
      addedHeight: 0,
    },
    base.canvas,
  );
  if (
    phone.rendering === "natural" &&
    phone.appIcons.filter((i) => i.visible).length > naturalAppCapacity(phone)
  )
    throw new Error(
      `当前机型最多容纳 ${naturalAppCapacity(phone)} 个 APP 图标，请减少数量或调整大小与间距`,
    );
  if (phone.placement !== "prepend") {
    // Keep parameter bindings to stable generated IDs, including legacy templates.
    return renderPhoneLayers({ ...base, parameters: doc.parameters }, phone);
  }
  const model = phoneModel(phone.modelId);
  const carrierRow =
    phone.showCarrier &&
    (model.style === "android" ||
      (model.style === "classic" && phone.appIcons.some((i) => i.visible)) ||
      (phone.rendering === "natural" && phone.fusion.enabled));
  const scale = Math.min(
    base.canvas.width / model.points,
    base.canvas.height / (40 - (carrierRow ? 18 : 0)),
  );
  const height = Math.ceil(
    (phone.rendering === "natural"
      ? phoneGeometry(phone, base.canvas).bar
      : model.bar * scale) +
      ((phone.showDate ? 24 : 0) + (carrierRow ? 18 : 0)) * scale,
  );
  if (base.canvas.height + height > 8000)
    throw new Error("添加状态栏后高度超过 8000px，请缩小画布或改用覆盖模式");
  phone.addedHeight = height;
  const background = base.canvas.backgroundImage;
  const layers = base.layers.map((l) => ({ ...l, y: l.y + height }));
  if (background)
    layers.unshift({
      ...createImageLayer(
        {
          x: 0,
          y: height,
          width: base.canvas.width,
          height: base.canvas.height,
        },
        background,
        { name: "正文背景", fit: "cover", autoFocus: false },
      ),
      id: `${phone.groupId}_content_background`,
      locked: true,
    });
  return renderPhoneLayers(
    {
      ...base,
      parameters: doc.parameters,
      canvas: {
        ...base.canvas,
        height: base.canvas.height + height,
        backgroundImage: null,
      },
      layers,
    },
    phone,
  );
}

/** Keep supported manual text edits reflected in the phone settings panel. */
export function syncPhoneTextSettings(doc: TemplateDoc): TemplateDoc {
  if (!doc.phone) return doc;
  const phone = { ...doc.phone };
  const content = (role: string) => {
    const layer = doc.layers.find((l) => l.id === `${phone.groupId}_${role}`);
    return layer?.type === "text" ? layer.text.trim() : undefined;
  };
  const time = content("time");
  if (time && time !== phoneTime(phone)) {
    const match = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(time);
    if (match) {
      let hour = Number(match[1]);
      if (match[3]) {
        if (hour < 1 || hour > 12) return doc;
        hour = (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
      }
      if (hour <= 23 && Number(match[2]) <= 59)
        phone.time = `${String(hour).padStart(2, "0")}:${match[2]}`;
    }
  }
  const date = content("date");
  if (date && date !== phoneDate(phone)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) phone.date = date;
    else {
      const match = /^(\d{1,2})月(\d{1,2})日/.exec(date);
      if (match)
        phone.date = `${phone.date.slice(0, 4)}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
    }
  }
  const carrier = content("carrier");
  if (carrier !== undefined && carrier.length <= 12) phone.carrier = carrier;
  if (!phoneSettingsSchema.safeParse(phone).success) return doc;
  return JSON.stringify(phone) === JSON.stringify(doc.phone)
    ? doc
    : { ...doc, phone };
}

/** Resizing repositions generated layers but preserves manual content/style overrides. */
export function refreshPhoneLayers(
  doc: TemplateDoc,
  previous: TemplateDoc = doc,
): TemplateDoc {
  if (!doc.phone || !previous.phone) return doc;
  if (
    doc.statusLocation &&
    doc.phone.rendering === "natural" &&
    doc.phone.placement === "overlay"
  ) {
    const base = removePhoneLayers(doc);
    if (isLocationConfirmed(base))
      return applyPhoneLayers(base, syncPhoneTextSettings(previous).phone!);
    return {
      ...base,
      phone: {
        ...syncPhoneTextSettings(previous).phone!,
        placement: "overlay",
        addedHeight: 0,
      },
    };
  }
  const source = syncPhoneTextSettings(previous);
  const synced = { ...doc, phone: source.phone };
  const baseline = applyPhoneLayers(
    { ...previous, layers: [] },
    previous.phone,
  ).layers;
  const generated = applyPhoneLayers(synced, synced.phone!);
  const geometry = new Set([
    "x",
    "y",
    "width",
    "height",
    "rotation",
    "fontSize",
    "minFontSize",
    "letterSpacing",
    "radius",
    "strokeWidth",
    "shadow",
  ]);
  return {
    ...generated,
    layers: generated.layers.flatMap((layer) => {
      const base = baseline.find((l) => l.id === layer.id);
      if (!base) return [layer];
      const old = previous.layers.find((l) => l.id === layer.id);
      if (!old) return []; // Respect a deliberately removed generated layer.
      const overrides: Record<string, unknown> = {};
      for (const key of Object.keys(old) as (keyof Layer)[]) {
        if (
          !geometry.has(key) &&
          JSON.stringify(old[key]) !== JSON.stringify(base[key])
        )
          overrides[key] = old[key];
      }
      return [{ ...layer, ...overrides } as Layer];
    }),
  };
}
