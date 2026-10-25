import type { ImageSource, Layer, TemplateDoc } from "@/types/template";
import {
  createImageLayer,
  createShapeLayer,
  createTextLayer,
} from "@/lib/template/layers";
import { newId } from "@/lib/template/ids";
import { phoneModel } from "./models";
import { phoneSettingsSchema, type PhoneSettings } from "./schema";
export function defaultPhoneSettings(): PhoneSettings {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
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
/** All SVG attributes come from validated values/constants, never user-provided XML. */
export function statusIconsSvg(settings: PhoneSettings): string {
  const battery = Math.max(
    0,
    Math.min(100, Number.isFinite(settings.battery) ? settings.battery : 0),
  );
  const color = settings.theme === "dark" ? "#111111" : "#ffffff";
  const faded = settings.theme === "dark" ? "#c8c8c8" : "#666666";
  let content = "";
  if (settings.airplane)
    content += `<path d="M2 8L9 9L15 2L18 2L14 9L21 11L21 13L13 12L10 17L8 17L9 11L2 10Z" fill="${color}"/>`;
  else
    for (let i = 0; i < 4; i++)
      content += `<rect x="${i * 5}" y="${14 - i * 3}" width="3.5" height="${4 + i * 3}" rx=".7" fill="${i < settings.signal ? color : faded}"/>`;
  if (settings.wifi > 0) {
    content += `<g transform="translate(24 0)" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M0 6Q9 -1 18 6" stroke="${settings.wifi >= 3 ? color : faded}"/><path d="M3 10Q9 5 15 10" stroke="${settings.wifi >= 2 ? color : faded}"/><path d="M6 14Q9 11.5 12 14" stroke="${color}"/><circle cx="9" cy="17" r="1" fill="${color}" stroke="none"/></g>`;
  } else if (
    !settings.airplane &&
    settings.signal > 0 &&
    settings.network !== "none"
  )
    content += `<text x="23" y="15" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="${color}">${settings.network}</text>`;
  if (settings.bluetooth)
    content += `<path d="M49 4L57 13L53 17L53 1L57 5L49 14" fill="none" stroke="${color}" stroke-width="1.3" stroke-linejoin="round"/>`;
  if (settings.showBatteryPercent)
    content += `<text x="85" y="14" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="${color}">${battery}%</text>`;
  content += `<rect x="88" y="4" width="23" height="12" rx="3" fill="none" stroke="${color}" stroke-width="1"/><rect x="112" y="8" width="1.5" height="4" rx=".7" fill="${color}"/>`;
  if (battery > 0)
    content += `<rect x="90" y="6" width="${(19 * battery) / 100}" height="8" rx="1" fill="${settings.charging ? "#22c55e" : battery <= 20 ? "#ef4444" : color}"/>`;
  if (settings.charging)
    content += `<path d="M101 2L96 10H101L98 18L106 8H101Z" fill="${settings.theme === "dark" ? "#111111" : "#ffffff"}" stroke="${settings.backgroundColor}" stroke-width=".6"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="116" height="20" viewBox="0 0 116 20">${content}</svg>`;
}
function generatedIds(settings: PhoneSettings) {
  return new Set(
    ["background", "time", "date", "carrier", "icons", "cutout", "home"].map(
      (role) => `${settings.groupId}_${role}`,
    ),
  );
}
export function removePhoneLayers(doc: TemplateDoc): TemplateDoc {
  if (!doc.phone) return doc;
  const ids = generatedIds(doc.phone);
  const { phone: _phone, ...rest } = doc;
  return {
    ...rest,
    layers: doc.layers.filter((l) => !ids.has(l.id)),
    parameters: doc.parameters.filter((p) => !ids.has(p.layerId)),
  };
}
/** Ordinary vector/text/image layers make canvas, thumbnails, preview and exports identical. */
export function applyPhoneLayers(
  doc: TemplateDoc,
  raw: PhoneSettings,
): TemplateDoc {
  const settings = phoneSettingsSchema.parse(raw);
  // Keep the existing namespace, so external parameters bound to phone layers stay valid.
  const phone = {
    ...settings,
    groupId: doc.phone?.groupId ?? settings.groupId,
  };
  const model = phoneModel(phone.modelId);
  const W = doc.canvas.width;
  const H = doc.canvas.height;
  const s = Math.min(
    W / model.points,
    H / (model.bar + (phone.showDate ? 24 : 0) + 40),
  );
  const bar = model.bar * s;
  const color = phone.theme === "dark" ? "#111111" : "#ffffff";
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
    x: number,
    y: number,
    width: number,
    fontSize: number,
    visible = true,
  ) =>
    layer(
      role,
      createTextLayer(
        { x, y, width, height: fontSize * 1.4 },
        {
          name,
          text: value,
          fontFamily: "Noto Sans SC",
          fontSize,
          fill: color,
          lineHeight: 1,
          wrap: false,
          fontWeight: "bold",
          visible,
          verticalAlign: "middle",
        },
      ),
    );
  const classic = model.style === "classic";
  const android = model.style === "android";
  const top = android || classic ? 1 * s : (model.bar - 42) * s;
  const fontSize = (android || classic ? 13 : 17) * s;
  const layers: Layer[] = [
    layer(
      "background",
      createShapeLayer(
        "rect",
        { x: 0, y: 0, width: W, height: bar + (phone.showDate ? 24 * s : 0) },
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
      classic ? W / 2 - 36 * s : 18 * s,
      top,
      (classic ? 72 : 96) * s,
      fontSize,
    ),
    text(
      "date",
      "日期",
      phoneDate(phone),
      18 * s,
      bar,
      W - 36 * s,
      12 * s,
      phone.showDate,
    ),
    text(
      "carrier",
      "运营商",
      phone.carrier,
      android ? 76 * s : 18 * s,
      classic || android ? 1 * s : top + 24 * s,
      (android ? 83 : 95) * s,
      (classic ? 11 : 8) * s,
      phone.showCarrier,
    ),
    layer(
      "icons",
      createImageLayer(
        {
          x: W - 14 * s - (model.cutout === "notch" ? 95 : 116) * s,
          y: classic ? 0 : android ? 4 * s : (model.bar - 38) * s,
          width: (model.cutout === "notch" ? 95 : 116) * s,
          height: 20 * s,
        },
        svgSource(statusIconsSvg(phone)),
        { name: "信号、网络与电池", fit: "contain", lockAspect: true },
      ),
    ),
  ];
  const cutoutWidth =
    model.cutout === "island" ? 126 : model.cutout === "notch" ? 160 : 12;
  const cutoutHeight =
    model.cutout === "island" ? 35 : model.cutout === "notch" ? 30 : 12;
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
          visible: phone.showHomeIndicator && !classic,
        },
      ),
    ),
  );
  const old = doc.phone ? generatedIds(doc.phone) : new Set<string>();
  if (doc.layers.filter((l) => !old.has(l.id)).length + layers.length > 2000)
    throw new Error("图层数量超过上限，无法添加手机状态栏");
  return {
    ...doc,
    phone,
    layers: [...doc.layers.filter((l) => !old.has(l.id)), ...layers],
  };
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
