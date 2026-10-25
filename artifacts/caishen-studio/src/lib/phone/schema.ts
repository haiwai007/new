import { z } from "zod";
import { PHONE_MODELS } from "./models";
export function validPhoneDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 1900 || y > 9999) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}
export const phoneSettingsSchema = z.object({
  groupId: z.string().regex(/^phone_[a-z0-9]{10}$/),
  modelId: z.enum(PHONE_MODELS.map((m) => m.id)),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "时间须为 00:00–23:59"),
  timeFormat: z.enum(["24h", "12h"]),
  date: z.string().refine(validPhoneDate, "日期无效"),
  dateFormat: z.enum(["iso", "chinese", "weekday"]),
  showDate: z.boolean(),
  battery: z.number().int().min(0).max(100),
  charging: z.boolean(),
  showBatteryPercent: z.boolean(),
  signal: z.number().int().min(0).max(4),
  wifi: z.number().int().min(0).max(3),
  network: z.enum(["none", "4G", "5G", "LTE"]),
  airplane: z.boolean(),
  bluetooth: z.boolean(),
  carrier: z.string().max(12),
  showCarrier: z.boolean(),
  theme: z.enum(["dark", "light"]),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  transparent: z.boolean(),
  showCutout: z.boolean(),
  showHomeIndicator: z.boolean(),
});
export type PhoneSettings = z.infer<typeof phoneSettingsSchema>;
