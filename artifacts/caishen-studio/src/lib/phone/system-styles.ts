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
];
export function defaultSystemStyle(
  system: PhoneSystem,
  modelId = "",
): SystemStyleId {
  if (system === "ios" && modelId.startsWith("iphone17")) return "ios26";
  return (
    (
      {
        ios: "ios18",
        oneui: "oneui6",
        oneui7: "oneui7",
        harmony: "harmony4",
        hyperos: "hyperos2",
      } as Partial<Record<PhoneSystem, SystemStyleId>>
    )[system] ?? "auto"
  );
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
  return (
    id === "auto" ||
    SYSTEM_STYLES.some(
      (style) => style.id === id && style.systems.includes(system),
    )
  );
}
