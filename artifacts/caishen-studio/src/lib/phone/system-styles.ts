import type { PhoneSystem } from "./models";
import type { SYSTEM_STYLE_IDS } from "./fusion-schema";
export type SystemStyleId = (typeof SYSTEM_STYLE_IDS)[number];
export const SYSTEM_STYLES: {
  id: Exclude<SystemStyleId, "auto">;
  label: string;
  systems: PhoneSystem[];
  fontSize: number;
  weight: "normal" | "bold";
  batteryStyle: "inside" | "outline";
  radius: number;
  gap: number;
  inset: number;
  signal?: "bars" | "triangle" | "rounded" | "thin";
  wifiStroke?: number;
  airplane?: "ios" | "android" | "samsung" | "harmony";
}[] = [
  {
    id: "ios17",
    label: "iOS 17 参考",
    systems: ["ios"],
    fontSize: 17,
    weight: "bold",
    batteryStyle: "inside",
    radius: 3.5,
    gap: 5,
    inset: 26,
  },
  {
    id: "ios18",
    label: "iOS 18 参考",
    systems: ["ios"],
    fontSize: 17,
    weight: "bold",
    batteryStyle: "inside",
    radius: 4,
    gap: 5,
    inset: 26,
  },
  {
    id: "ios26",
    label: "iOS 26 参考",
    systems: ["ios"],
    fontSize: 17,
    weight: "bold",
    batteryStyle: "inside",
    radius: 4.5,
    gap: 5,
    inset: 26,
  },
  {
    id: "oneui6",
    label: "One UI 6 参考",
    systems: ["oneui", "oneui7"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "outline",
    radius: 2,
    gap: 4,
    inset: 18,
  },
  {
    id: "oneui7",
    label: "One UI 7 参考",
    systems: ["oneui", "oneui7"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "inside",
    radius: 6,
    gap: 4,
    inset: 18,
  },
  {
    id: "harmony4",
    label: "HarmonyOS 4 参考",
    systems: ["harmony"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "outline",
    radius: 2,
    gap: 4,
    inset: 16,
  },
  {
    id: "harmony5",
    label: "HarmonyOS 5 参考",
    systems: ["harmony"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "inside",
    radius: 3,
    gap: 4.5,
    inset: 17,
  },
  {
    id: "hyperos1",
    label: "HyperOS 1 参考",
    systems: ["hyperos"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "inside",
    radius: 4,
    gap: 4,
    inset: 16,
  },
  {
    id: "hyperos2",
    label: "HyperOS 2 参考",
    systems: ["hyperos"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "inside",
    radius: 5,
    gap: 4.5,
    inset: 17,
  },
  {
    id: "iosclassic",
    label: "iOS 经典 参考",
    systems: ["classic"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "outline",
    radius: 2,
    gap: 4,
    inset: 16,
    signal: "bars",
    wifiStroke: 2,
    airplane: "ios",
  },
  {
    id: "pixel14",
    label: "Android 14 / Pixel 参考",
    systems: ["pixel"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "outline",
    radius: 1,
    gap: 6,
    inset: 16,
    signal: "triangle",
    wifiStroke: 2,
    airplane: "android",
  },
  {
    id: "pixel15",
    label: "Android 15 / Pixel 参考",
    systems: ["pixel"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "outline",
    radius: 1.5,
    gap: 5.5,
    inset: 17,
    signal: "triangle",
    wifiStroke: 2.2,
    airplane: "android",
  },
  {
    id: "magic8",
    label: "MagicOS 8 参考",
    systems: ["magic"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "outline",
    radius: 2.5,
    gap: 4.5,
    inset: 16,
    signal: "thin",
    wifiStroke: 1.7,
    airplane: "harmony",
  },
  {
    id: "magic9",
    label: "MagicOS 9 参考",
    systems: ["magic"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "inside",
    radius: 4,
    gap: 4,
    inset: 17,
    signal: "thin",
    wifiStroke: 1.8,
    airplane: "harmony",
  },
  {
    id: "coloros14",
    label: "ColorOS 14 参考",
    systems: ["coloros"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "inside",
    radius: 3,
    gap: 4,
    inset: 16,
    signal: "rounded",
    wifiStroke: 1.8,
    airplane: "android",
  },
  {
    id: "coloros15",
    label: "ColorOS 15 参考",
    systems: ["coloros"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "inside",
    radius: 4.5,
    gap: 4.5,
    inset: 17,
    signal: "rounded",
    wifiStroke: 2,
    airplane: "android",
  },
  {
    id: "originos4",
    label: "OriginOS 4 参考",
    systems: ["originos"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "outline",
    radius: 4,
    gap: 5,
    inset: 16,
    signal: "thin",
    wifiStroke: 1.6,
    airplane: "android",
  },
  {
    id: "originos5",
    label: "OriginOS 5 参考",
    systems: ["originos"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "inside",
    radius: 5,
    gap: 4.5,
    inset: 17,
    signal: "thin",
    wifiStroke: 1.8,
    airplane: "android",
  },
  {
    id: "realme5",
    label: "realme UI 5 参考",
    systems: ["realme"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "inside",
    radius: 2,
    gap: 4,
    inset: 16,
    signal: "rounded",
    wifiStroke: 1.8,
    airplane: "android",
  },
  {
    id: "realme6",
    label: "realme UI 6 参考",
    systems: ["realme"],
    fontSize: 13,
    weight: "normal",
    batteryStyle: "inside",
    radius: 4,
    gap: 4.5,
    inset: 17,
    signal: "rounded",
    wifiStroke: 2,
    airplane: "android",
  },
];
export function defaultSystemStyle(
  system: PhoneSystem,
  modelId = "",
): SystemStyleId {
  if (system === "ios" && modelId.startsWith("iphone17")) return "ios26";
  switch (system) {
    case "ios":
      return "ios18";
    case "classic":
      return "iosclassic";
    case "pixel":
      return modelId.startsWith("pixel9") ? "pixel15" : "pixel14";
    case "oneui":
      return "oneui6";
    case "oneui7":
      return "oneui7";
    case "harmony":
      return modelId.startsWith("huaweimate70") ? "harmony5" : "harmony4";
    case "hyperos":
      return /xiaomi15|redmik80/.test(modelId) ? "hyperos2" : "hyperos1";
    case "magic":
      return modelId.startsWith("honormagic7") ? "magic9" : "magic8";
    case "coloros":
      return /oppofindx8|oneplus13/.test(modelId) ? "coloros15" : "coloros14";
    case "originos":
      return /vivox200|iqoo13/.test(modelId) ? "originos5" : "originos4";
    case "realme":
      return modelId === "realmegt7pro" ? "realme6" : "realme5";
  }
}
export function compatibleStyle(
  id: SystemStyleId,
  system: PhoneSystem,
  modelId = "",
) {
  if (modelId.startsWith("iphone17") && (id === "ios17" || id === "ios18"))
    return false;
  if (modelId.startsWith("iphone16") && id === "ios17") return false;
  if (modelId.startsWith("galaxys25") && id === "oneui6") return false;
  if (/xiaomi15|redmik80/.test(modelId) && id === "hyperos1") return false;
  if (modelId.startsWith("honormagic7") && id === "magic8") return false;
  if (/oppofindx8|oneplus13/.test(modelId) && id === "coloros14") return false;
  if (/vivox200|iqoo13/.test(modelId) && id === "originos4") return false;
  if (modelId === "realmegt7pro" && id === "realme5") return false;
  return (
    id === "auto" ||
    SYSTEM_STYLES.some(
      (style) => style.id === id && style.systems.includes(system),
    )
  );
}
