import { z } from "zod";
import { PHONE_MODELS } from "./models";
const HEX = /^#[0-9a-fA-F]{6}$/;
export const PHONE_NETWORKS = ["none", "3G", "4G", "4G+", "5G", "5G+", "LTE"] as const;
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
  network: z.enum(PHONE_NETWORKS),
  airplane: z.boolean(),
  bluetooth: z.boolean(),
  carrier: z.string().max(12),
  showCarrier: z.boolean(),
  theme: z.enum(["dark", "light"]),
  backgroundColor: z.string().regex(HEX),
  transparent: z.boolean(),
  showCutout: z.boolean(),
  showHomeIndicator: z.boolean(),
  // Fields below were added later; defaults keep older saved documents valid.
  /** Overrides the dark/light icon colour when set. */
  customColor: z.string().regex(HEX).nullable().default(null),
  /** Text and icon size relative to the model's native size (percent). */
  scale: z.number().int().min(70).max(150).default(100),
  /** Vertical nudge in device points. */
  offsetY: z.number().int().min(-30).max(30).default(0),
  /** Extra horizontal inset in device points. */
  insetX: z.number().int().min(-12).max(30).default(0),
  timeWeight: z.enum(["bold", "normal"]).default("bold"),
  batteryStyle: z.enum(["outline", "inside"]).default("outline"),
  lowPower: z.boolean().default(false),
  hd: z.boolean().default(false),
  dualSim: z.boolean().default(false),
  location: z.boolean().default(false),
  alarm: z.boolean().default(false),
  mute: z.boolean().default(false),
  dnd: z.boolean().default(false),
  vpn: z.boolean().default(false),
});
export type PhoneSettings = z.infer<typeof phoneSettingsSchema>;
