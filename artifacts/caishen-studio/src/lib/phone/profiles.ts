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
  signal: "bars" | "triangle";
  wifi: "arc" | "fan";
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
    label: "小米 HyperOS",
    fontSize: 13,
    weight: "normal",
    radius: 5,
    gap: 4,
    inset: 15,
  },
  harmony: {
    ...base,
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
    label: "ColorOS（OPPO / 一加国行）",
    fontSize: 13,
    weight: "normal",
    radius: 3,
    gap: 4,
    inset: 16,
  },
  originos: {
    ...base,
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
  return {
    ...base,
    ...(variant ?? {}),
    battery:
      variant?.id === "oneui6"
        ? "vertical"
        : variant?.id === "oneui7"
          ? "horizontal"
          : base.battery,
  };
}
export function systemStyleLabel(settings: PhoneSettings) {
  return (
    resolvedStyle(settings)?.label ?? statusProfile(settings.modelId).label
  );
}
/** Apply model typography and icon defaults, retaining content, theme and stable layer IDs. */
export function settingsForModel(
  settings: PhoneSettings,
  modelId: PhoneSettings["modelId"],
): PhoneSettings {
  const system = phoneModel(modelId).system;
  const styleId = compatibleStyle(settings.styleId, system, modelId)
    ? settings.styleId
    : "auto";
  const profile = effectiveProfile({ ...settings, modelId, styleId });
  return {
    ...settings,
    modelId,
    styleId,
    timeWeight: profile.weight,
    batteryStyle: profile.batteryStyle,
    scale: settings.fusion?.locks.includes("geometry") ? settings.scale : 100,
    offsetY: settings.fusion?.locks.includes("geometry") ? settings.offsetY : 0,
    insetX: settings.fusion?.locks.includes("geometry") ? settings.insetX : 0,
    showHomeIndicator:
      phoneModel(modelId).style !== "classic" && settings.showHomeIndicator,
  };
}
