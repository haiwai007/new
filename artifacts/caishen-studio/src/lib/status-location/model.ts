import type { TemplateDoc } from "../../types/template";
import {
  LOCATION_ROLES,
  locationGeometryErrors,
  type LocationRect,
  type StatusLocation,
} from "./schema";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, canonical(v)]),
    );
  return value;
}
export function smallHash(value: unknown) {
  const s = JSON.stringify(canonical(value));
  let a = 2166136261,
    b = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 16777619);
    b = Math.imul(b ^ s.charCodeAt(i), 2246822519);
  }
  return `location-1:${s.length}:${a >>> 0}:${b >>> 0}`;
}

const round = (n: number) => Math.round(n * 100000) / 100000;
/** Pixel-relevant normalized data. Titles outside the region and layer names do not invalidate a binding. */
export function locationSourceKey(doc: TemplateDoc, bounds: LocationRect) {
  const W = doc.canvas.width,
    H = doc.canvas.height - (doc.phone?.addedHeight ?? 0),
    offset = doc.phone?.addedHeight ?? 0;
  const relevant = doc.layers
    .filter((l) => {
      if (!l.visible || (l.groupId === doc.phone?.groupId && doc.phone))
        return false;
      const pad =
        (l.type !== "image" && l.shadow
          ? l.shadow.blur * 2 + Math.abs(l.shadow.offsetY)
          : 0) +
        Math.abs(Math.sin((l.rotation * Math.PI) / 180)) * (l.width + l.height);
      return (
        l.x - pad < (bounds.x + bounds.width) * W &&
        l.x + l.width + pad > bounds.x * W &&
        l.y - offset - pad < (bounds.y + bounds.height) * H &&
        l.y - offset + l.height + pad > bounds.y * H
      );
    })
    .map((l) => {
      const {
        id: _id,
        name: _name,
        groupId: _group,
        locked: _locked,
        editable: _editable,
        layout: _layout,
        ...visual
      } = l;
      const result: Record<string, unknown> = {
        ...visual,
        x: round(l.x / W),
        y: round((l.y - offset) / H),
        width: round(l.width / W),
        height: round(l.height / H),
      };
      for (const key of [
        "fontSize",
        "minFontSize",
        "letterSpacing",
        "radius",
        "strokeWidth",
      ]) {
        const v = (l as unknown as Record<string, unknown>)[key];
        if (typeof v === "number") result[key] = round(v / W);
      }
      if (l.type !== "image" && l.shadow)
        result.shadow = {
          ...l.shadow,
          blur: round(l.shadow.blur / W),
          offsetX: round(l.shadow.offsetX / W),
          offsetY: round(l.shadow.offsetY / H),
        };
      return result;
    });
  return smallHash([
    round(H / W),
    doc.canvas.backgroundColor,
    doc.canvas.backgroundImage ??
      (
        doc.layers.find(
          (l) =>
            l.id === `${doc.phone?.groupId}_content_background` &&
            l.type === "image",
        ) as { src?: unknown } | undefined
      )?.src ??
      null,
    doc.source?.originalAssetId,
    relevant,
  ]);
}
export const locationTestKey = (l: StatusLocation) =>
  smallHash([
    l.bounds,
    ...LOCATION_ROLES.map((role) => l[role]),
    l.protected,
    l.background,
    l.color,
    l.fills,
    l.sourceKey,
    ...(l.approval ? [l.approval] : []),
    ...(l.layout ? [l.layout] : []),
    ...(l.backgroundPatch ? [l.backgroundPatch] : []),
    ...(l.sourceFit ? [l.sourceFit] : []),
    ...(l.blendVersion ? [l.blendVersion, l.backgroundQuality] : []),
  ]);
export function isLocationConfirmed(doc: TemplateDoc) {
  const l = doc.statusLocation;
  if (l && l.layout !== "manual")
    return l.state === "confirmed" && l.testKey === locationTestKey(l);
  return (
    !!l &&
    l.state === "confirmed" &&
    (l.approval === "direct" || !locationGeometryErrors(l).length) &&
    (l.approval === "direct" ||
      l.sourceKey === locationSourceKey(doc, l.bounds)) &&
    l.testKey === locationTestKey(l) &&
    LOCATION_ROLES.every(
      (role) => !l[role] || l.fills.some((f) => f.role === role),
    ) &&
    l.fills.length === LOCATION_ROLES.filter((role) => l[role]).length &&
    new Set(l.fills.map((f) => f.role)).size === l.fills.length &&
    l.fills.every((f) => !!l[f.role])
  );
}
/** Upgrade a confirmed historical slot layout to the selected-model outer-frame renderer. */
export function deviceLocationDoc(doc: TemplateDoc): TemplateDoc {
  const old = doc.statusLocation;
  if (!old || old.layout !== "manual" || !isLocationConfirmed(doc)) return doc;
  const location = { ...old, layout: "device" as const };
  location.testKey = locationTestKey(location);
  return { ...doc, statusLocation: location };
}
export function locationState(doc: TemplateDoc) {
  return doc.statusLocation?.state === "confirmed" && !isLocationConfirmed(doc)
    ? "stale"
    : (doc.statusLocation?.state ?? "unset");
}
export function defaultStatusLocation(doc: TemplateDoc): StatusLocation {
  const h = Math.min(0.2, (doc.canvas.width * 0.07) / doc.canvas.height);
  return {
    version: 1,
    state: "pending",
    origin: "manual",
    bounds: { x: 0, y: 0, width: 1, height: h },
    time: { x: 0.025, y: h * 0.12, width: 0.135, height: h * 0.76 },
    apps: { x: 0.17, y: h * 0.12, width: 0.26, height: h * 0.76 },
    system: { x: 0.6, y: h * 0.12, width: 0.375, height: h * 0.76 },
    date: null,
    carrier: null,
    protected: [],
    background: "auto",
    color: "#ffffff",
    fills: [],
    sourceKey: "",
    testKey: "",
  };
}
export function invalidateLocation(doc: TemplateDoc): TemplateDoc {
  const l = doc.statusLocation;
  if (!l || l.state !== "confirmed" || isLocationConfirmed(doc)) return doc;
  return { ...doc, statusLocation: { ...l, state: "stale", testKey: "" } };
}
/** Trusted asset-ID remapping changes references, not pixels. */
export function rebindLocation(
  doc: TemplateDoc,
  before: TemplateDoc,
): TemplateDoc {
  if (!isLocationConfirmed(before) || !doc.statusLocation)
    return invalidateLocation(doc);
  const l = {
    ...doc.statusLocation,
    sourceKey: locationSourceKey(doc, doc.statusLocation.bounds),
  };
  const result = {
    ...doc,
    statusLocation: { ...l, testKey: locationTestKey(l) },
  };
  if (
    before.phone?.locationKey &&
    before.phone.locationKey === locationRenderKey(before) &&
    result.phone
  )
    return {
      ...result,
      phone: { ...result.phone, locationKey: locationRenderKey(result) },
    };
  return result;
}
export function requireStatusLocation(doc: TemplateDoc): TemplateDoc {
  return doc.statusLocation
    ? doc
    : { ...doc, statusLocation: defaultStatusLocation(doc) };
}
export function locationAppCapacity(
  doc: TemplateDoc,
  scale = 100,
  gapRatio = 0.2,
  iconRatio = 1,
) {
  const l = doc.statusLocation;
  if (l && (l.layout !== "manual" || isLocationConfirmed(doc))) return 8;
  if (l?.approval === "direct") return 8;
  if (!l?.apps) return 0;
  const size = Math.min(
      l.apps.height,
      ((l.time.height * 0.9 * scale) / 100) * iconRatio,
    ),
    gap = size * gapRatio;
  return Math.min(
    8,
    Math.max(
      0,
      Math.floor(
        (l.apps.width * doc.canvas.width + gap * doc.canvas.height) /
          ((size + gap) * doc.canvas.height),
      ),
    ),
  );
}
export const locationStatusLabels = {
  unset: "未设置",
  pending: "待确认",
  confirmed: "已确认",
  stale: "需重新确认",
  skipped: "不设置状态栏",
} as const;

export function locationRenderKey(doc: TemplateDoc) {
  if (!doc.statusLocation || !doc.phone) return "";
  const { locationKey: _stamp, ...settings } = doc.phone;
  const generated = doc.layers
    .filter(
      (l) =>
        l.groupId === doc.phone!.groupId &&
        l.id.startsWith(`${doc.phone!.groupId}_`),
    )
    .map((l) => {
      const {
        name: _name,
        locked: _locked,
        editable: _editable,
        layout: _layout,
        ...visual
      } = l;
      return visual;
    });
  return smallHash([doc.statusLocation.testKey, settings, generated]);
}
