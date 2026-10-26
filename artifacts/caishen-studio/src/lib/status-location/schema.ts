import { z } from "zod";
export const locationRectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(
    (r) => r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001,
    "区域超出画布",
  );
export type LocationRect = z.infer<typeof locationRectSchema>;
export const LOCATION_ROLES = [
  "time",
  "apps",
  "system",
  "date",
  "carrier",
] as const;
export type LocationRole = (typeof LOCATION_ROLES)[number];
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const statusLocationSchema = z.object({
  version: z.literal(1),
  state: z.enum(["pending", "confirmed", "stale", "skipped"]),
  origin: z.enum(["auto", "manual"]),
  bounds: locationRectSchema,
  time: locationRectSchema,
  apps: locationRectSchema.nullable(),
  system: locationRectSchema,
  date: locationRectSchema.nullable().default(null),
  carrier: locationRectSchema.nullable().default(null),
  protected: z.array(locationRectSchema).max(16).default([]),
  background: z.enum(["auto", "solid"]).default("auto"),
  color: hex.default("#ffffff"),
  fills: z
    .array(z.object({ role: z.enum(LOCATION_ROLES), top: hex, bottom: hex }))
    .max(5)
    .default([]),
  sourceKey: z.string().max(100).default(""),
  testKey: z.string().max(100).default(""),
});
export type StatusLocation = z.infer<typeof statusLocationSchema>;
export const contains = (a: LocationRect, b: LocationRect) =>
  b.x >= a.x - 1e-7 &&
  b.y >= a.y - 1e-7 &&
  b.x + b.width <= a.x + a.width + 1e-7 &&
  b.y + b.height <= a.y + a.height + 1e-7;
export const intersects = (a: LocationRect, b: LocationRect) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1e-7 &&
  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1e-7;
export function locationGeometryErrors(location: StatusLocation): string[] {
  const errors: string[] = [];
  const roles = LOCATION_ROLES.filter((role) => location[role]);
  for (const role of roles) {
    const rect = location[role]!;
    if (!contains(location.bounds, rect))
      errors.push(`${role} 区域必须位于状态栏外框内`);
    if (location.protected.some((p) => intersects(rect, p)))
      errors.push(`${role} 区域与保护区重叠，请调整边界`);
  }
  for (let i = 0; i < roles.length; i++)
    for (let j = i + 1; j < roles.length; j++)
      if (intersects(location[roles[i]]!, location[roles[j]]!))
        errors.push("时间、APP 和系统区域不能相互重叠");
  return [...new Set(errors)];
}
