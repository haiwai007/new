import { z } from "zod";
export const SYSTEM_STYLE_IDS = [
  "auto",
  "ios17",
  "ios18",
  "ios26",
  "oneui6",
  "oneui7",
  "harmony4",
  "harmony5",
  "hyperos1",
  "hyperos2",
  "iosclassic",
  "pixel14",
  "pixel15",
  "magic8",
  "magic9",
  "coloros14",
  "coloros15",
  "originos4",
  "originos5",
  "realme5",
  "realme6",
] as const;
export const FUSION_LOCKS = [
  "color",
  "background",
  "coverage",
  "geometry",
] as const;
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const fusionAnalysisSchema = z.object({
  sourceKey: z.string().min(1).max(100),
  width: z.number().int().positive().max(8000),
  height: z.number().int().positive().max(8000),
  kind: z.enum(["flat", "gradient", "complex"]),
  top: hex,
  bottom: hex,
  lightIcons: z.boolean(),
  contrast: z.number().min(1).max(21),
  suspectedOldBar: z.boolean(),
  suggestedCover: z.number().min(0).max(0.25),
  confidence: z.enum(["high", "medium", "low"]),
  contentTopRatio: z.number().min(0).max(0.25).optional(),
  geometry: z
    .object({
      barRatio: z.number().positive().max(0.25),
      glyphRatio: z.number().positive().max(0.1),
      centerRatio: z.number().positive().max(0.2),
    })
    .optional(),
  bands: z
    .array(
      z.object({
        color: hex,
        uniformity: z.number().min(0).max(1),
        noise: z.number().min(0).max(1),
      }),
    )
    .min(4)
    .max(32),
});
export type FusionAnalysis = z.infer<typeof fusionAnalysisSchema>;
export const fusionSchema = z.object({
  enabled: z.boolean().default(false),
  background: z.enum(["auto", "flat", "preserve"]).default("auto"),
  handling: z.enum(["manual", "auto"]).default("manual"),
  locks: z.array(z.enum(FUSION_LOCKS)).max(4).default([]),
  analysis: fusionAnalysisSchema.nullable().default(null),
});
