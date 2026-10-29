import { DEVICE_LAYOUTS } from "./device-layouts";
import {
  SYSTEM_STYLES,
  compatibleStyle,
  defaultSystemStyle,
} from "./system-styles";
import { phoneModel, type PhoneSystem } from "./models";
import type { PhoneSettings } from "./schema";

export type StatusProfile = {
  label: string;
  fontSize: number;
  weight: "normal" | "bold";
  signal: "bars" | "triangle" | "rounded" | "thin";
  wifi: "arc" | "fan";
  glyphSource?: "aosp14" | "aosp15";
  wifiStroke: number;
  airplane: "ios" | "android" | "samsung" | "harmony";
  battery: "horizontal" | "vertical";
  radius: number;
  batteryStyle: "inside" | "outline";
  gap: number;
  inset: number;
  wifiFirst: boolean;
};
const base: StatusProfile = {
  label: "iOS",
  fontSize: 17,
  weight: "bold",
  signal: "bars",
  wifi: "arc",
  wifiStroke: 2.2,
  airplane: "ios",
  battery: "horizontal",
  radius: 3,
  batteryStyle: "inside",
  gap: 5,
  inset: 14,
  wifiFirst: false,
};
/** Brand system references, not a promise of pixel parity across OS versions or themes. */
export const STATUS_PROFILES: Record<PhoneSystem, StatusProfile> = {
  ios: base,
  classic: {
    ...base,
    label: "iOS 经典状态栏",
    fontSize: 13,
    batteryStyle: "outline",
    inset: 16,
  },
  pixel: {
    ...base,
    airplane: "android",
    label: "Pixel / 原生 Android",
    fontSize: 13,
    weight: "normal",
    signal: "triangle",
    wifi: "fan",
    battery: "vertical",
    radius: 1,
    batteryStyle: "outline",
    gap: 6,
    inset: 16,
    wifiFirst: true,
  },
  oneui: {
    ...base,
    airplane: "samsung",
    signal: "rounded",
    wifiStroke: 1.8,
    label: "Samsung One UI 6",
    fontSize: 13,
    weight: "normal",
    battery: "vertical",
    radius: 2,
    batteryStyle: "outline",
    gap: 4,
    inset: 16,
    wifiFirst: true,
  },
  oneui7: {
    ...base,
    airplane: "samsung",
    signal: "rounded",
    wifiStroke: 2,
    label: "Samsung One UI 7",
    fontSize: 13,
    weight: "normal",
    battery: "horizontal",
    radius: 6,
    batteryStyle: "inside",
    gap: 4,
    inset: 16,
    wifiFirst: true,
  },
  hyperos: {
    ...base,
    airplane: "android",
    signal: "rounded",
    wifiStroke: 1.8,
    label: "小米 HyperOS",
    fontSize: 13,
    weight: "normal",
    radius: 5,
    gap: 4,
    inset: 15,
  },
  harmony: {
    ...base,
    airplane: "harmony",
    signal: "thin",
    wifiStroke: 1.8,
    label: "华为 HarmonyOS",
    fontSize: 13,
    weight: "normal",
    radius: 1.5,
    batteryStyle: "outline",
    gap: 4,
    inset: 16,
  },
  magic: {
    ...base,
    airplane: "harmony",
    signal: "thin",
    wifiStroke: 1.7,
    label: "荣耀 MagicOS",
    fontSize: 13,
    weight: "normal",
    radius: 3,
    batteryStyle: "outline",
    gap: 4.5,
    inset: 16,
  },
  coloros: {
    ...base,
    airplane: "android",
    signal: "rounded",
    wifiStroke: 1.8,
    label: "ColorOS（OPPO / 一加国行）",
    fontSize: 13,
    weight: "normal",
    radius: 3,
    gap: 4,
    inset: 16,
  },
  originos: {
    ...base,
    airplane: "android",
    signal: "thin",
    wifiStroke: 1.6,
    label: "OriginOS（vivo / iQOO 国行）",
    fontSize: 13,
    weight: "normal",
    radius: 4,
    batteryStyle: "outline",
    gap: 5,
    inset: 16,
  },
  realme: {
    ...base,
    airplane: "android",
    signal: "rounded",
    wifiStroke: 1.8,
    label: "realme UI",
    fontSize: 13,
    weight: "normal",
    radius: 2,
    gap: 4,
    inset: 16,
  },
};
export function statusProfile(modelId: PhoneSettings["modelId"]) {
  return STATUS_PROFILES[phoneModel(modelId).system];
}
export function resolvedStyle(settings: PhoneSettings) {
  const system = phoneModel(settings.modelId).system;
  const id =
    settings.styleId === "auto"
      ? defaultSystemStyle(system, settings.modelId)
      : settings.styleId;
  return SYSTEM_STYLES.find(
    (style) =>
      style.id === id && compatibleStyle(style.id, system, settings.modelId),
  );
}
export function effectiveProfile(settings: PhoneSettings): StatusProfile {
  const base = statusProfile(settings.modelId);
  if (settings.rendering !== "natural") return base;
  const variant = resolvedStyle(settings);
  const record = DEVICE_LAYOUTS[settings.modelId];
  const deviceLayout = record.versions[variant?.id ?? record.defaultStyle];
  const deviceWeight = deviceLayout?.clockWeight;
  return {
    ...base,
    ...(variant ?? {}),
    ...(deviceLayout?.clockFont ? { fontSize: deviceLayout.clockSize } : {}),
    ...(deviceWeight !== undefined
      ? {
          weight: deviceWeight >= 600 ? ("bold" as const) : ("normal" as const),
        }
      : {}),
    battery:
      variant?.id === "oneui6" || variant?.id === "oneui61"
        ? "vertical"
        : variant?.id === "oneui7" || variant?.id === "oneui8"
          ? "horizontal"
          : base.battery,
  };
}
export function systemStyleLabel(settings: PhoneSettings) {
  return (
    resolvedStyle(settings)?.label ?? statusProfile(settings.modelId).label
  );
}
export function maximumWifiLevel(settings: PhoneSettings) {
  return effectiveProfile(settings).glyphSource ? 4 : 3;
}
/** Apply model typography and icon defaults, retaining content, theme and stable layer IDs. */
export function settingsForModel(
  settings: PhoneSettings,
  modelId: PhoneSettings["modelId"],
): PhoneSettings {
  const system = phoneModel(modelId).system;
  const styleId =
    settings.modelId === modelId &&
    compatibleStyle(settings.styleId, system, modelId)
      ? settings.styleId
      : "auto";
  const profile = effectiveProfile({ ...settings, modelId, styleId });
  return {
    ...settings,
    modelId,
    styleId,
    timeWeight: profile.weight,
    wifi: Math.min(settings.wifi, profile.glyphSource ? 4 : 3),
    batteryStyle: profile.batteryStyle,
    scale: settings.fusion?.locks.includes("geometry") ? settings.scale : 100,
    offsetY: settings.fusion?.locks.includes("geometry") ? settings.offsetY : 0,
    insetX: settings.fusion?.locks.includes("geometry") ? settings.insetX : 0,
    showHomeIndicator:
      phoneModel(modelId).style !== "classic" && settings.showHomeIndicator,
  };
}
