import { z } from "zod";
import {
  phoneBatchRulesSchema,
  type PhoneBatchRules,
} from "../batch/phone-rules";
import type { PhoneAppIcon } from "./schema";
export const DRAWING_PRESETS_KEY = "drawingPresets";
export const drawingPresetSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(80),
  createdAt: z.string().refine((s) => Number.isFinite(Date.parse(s))),
  rules: phoneBatchRulesSchema.refine(
    (r) => !!r.setup,
    "作图预设缺少固定手机设置",
  ),
});
export type DrawingPreset = Omit<
  z.infer<typeof drawingPresetSchema>,
  "rules"
> & { rules: PhoneBatchRules };
export function presetIcons(rules: PhoneBatchRules): PhoneAppIcon[] {
  return [
    ...(rules.setup?.settings.appIcons ?? []),
    ...(rules.apps?.fixed ?? []),
    ...(rules.apps?.candidates ?? []),
  ];
}
export function presetAssetIds(presets: DrawingPreset[]): string[] {
  return [
    ...new Set(
      presets
        .flatMap((p) => presetIcons(p.rules))
        .flatMap((i) =>
          i.kind === "custom" && i.src.kind === "asset" ? [i.src.assetId] : [],
        ),
    ),
  ];
}
export function remapPreset(
  preset: DrawingPreset,
  map: Map<string, string>,
): DrawingPreset {
  const icon = (i: PhoneAppIcon): PhoneAppIcon =>
    i.kind === "custom" && i.src.kind === "asset"
      ? {
          ...i,
          src: { ...i.src, assetId: map.get(i.src.assetId) ?? i.src.assetId },
        }
      : i;
  const rules = preset.rules;
  return {
    ...preset,
    rules: {
      ...rules,
      setup: rules.setup
        ? {
            ...rules.setup,
            settings: {
              ...rules.setup.settings,
              appIcons: rules.setup.settings.appIcons.map(icon),
            },
          }
        : undefined,
      apps: rules.apps
        ? {
            ...rules.apps,
            fixed: rules.apps.fixed.map(icon),
            candidates: rules.apps.candidates.map(icon),
          }
        : undefined,
    },
  };
}
export function storedPresets(raw: unknown): DrawingPreset[] {
  return z
    .array(drawingPresetSchema)
    .max(100)
    .parse(raw ?? []) as DrawingPreset[];
}
