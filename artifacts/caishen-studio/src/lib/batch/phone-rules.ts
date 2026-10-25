import { applyPhoneLayers } from "../phone/layers";
import {
  PHONE_NETWORKS,
  validPhoneDate,
  type PhoneSettings,
} from "../phone/schema";
import type { TemplateDoc } from "../../types/template";

export const RANDOM_PHONE_ICONS = [
  ["charging", "充电"],
  ["airplane", "飞行模式"],
  ["bluetooth", "蓝牙"],
  ["location", "定位"],
  ["alarm", "闹钟"],
  ["mute", "静音"],
  ["dnd", "勿扰"],
  ["vpn", "VPN"],
  ["hd", "HD 高清通话"],
  ["dualSim", "双卡信号"],
  ["lowPower", "低电量模式"],
] as const;
export type RandomPhoneIcon = (typeof RANDOM_PHONE_ICONS)[number][0];
export type PhoneBatchRules = {
  enabled: boolean;
  time: { enabled: boolean; start: string; end: string };
  date: { enabled: boolean; start: string; end: string };
  battery: { enabled: boolean; min: number; max: number };
  signal: boolean;
  wifi: boolean;
  network: { enabled: boolean; options: PhoneSettings["network"][] };
  icons: Partial<Record<RandomPhoneIcon, boolean>>;
};
export function defaultPhoneBatchRules(phone?: PhoneSettings): PhoneBatchRules {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    enabled: false,
    time: { enabled: true, start: "08:00", end: "23:59" },
    date: {
      enabled: false,
      start: phone?.date ?? today,
      end: phone?.date ?? today,
    },
    battery: { enabled: true, min: 20, max: 100 },
    signal: false,
    wifi: false,
    network: { enabled: false, options: ["4G", "5G", "LTE"] },
    icons: {},
  };
}
const timeValue = (value: string) =>
  /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
    : NaN;
const dateValue = (value: string) => Date.parse(`${value}T00:00:00Z`);
export function validatePhoneBatchRules(rules?: PhoneBatchRules): string[] {
  if (!rules?.enabled) return [];
  const errors: string[] = [];
  if (
    rules.time.enabled &&
    ![rules.time.start, rules.time.end].every((v) =>
      Number.isFinite(timeValue(v)),
    )
  )
    errors.push("随机时间须为 00:00–23:59");
  if (rules.date.enabled) {
    if (![rules.date.start, rules.date.end].every(validPhoneDate))
      errors.push("请选择有效的随机日期范围");
    else if (rules.date.start > rules.date.end)
      errors.push("随机日期的结束日期不能早于开始日期");
  }
  if (
    rules.battery.enabled &&
    (![rules.battery.min, rules.battery.max].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 100,
    ) ||
      rules.battery.min > rules.battery.max)
  )
    errors.push("随机电量须为 0–100 的整数，最小值不能大于最大值");
  if (
    rules.network.enabled &&
    (!rules.network.options.length ||
      rules.network.options.some((v) => !PHONE_NETWORKS.includes(v)))
  )
    errors.push("请至少选择一种有效的随机网络类型");
  return errors;
}
/** Inclusive integer sampling; the caller supplies the batch's seeded RNG. */
const integer = (min: number, max: number, rng: () => number) =>
  min + Math.floor(rng() * (max - min + 1));
export function applyPhoneBatchRules(
  doc: TemplateDoc,
  rules: PhoneBatchRules | undefined,
  rng: () => number,
): TemplateDoc {
  if (!rules?.enabled || !doc.phone || validatePhoneBatchRules(rules).length)
    return doc;
  const phone = { ...doc.phone };
  if (rules.time.enabled) {
    const start = timeValue(rules.time.start);
    const end = timeValue(rules.time.end);
    // An earlier end means a range crossing midnight, e.g. 23:00–01:00.
    const minutes =
      (start + integer(0, (end - start + 1440) % 1440, rng)) % 1440;
    phone.time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  if (rules.date.enabled) {
    const start = dateValue(rules.date.start);
    const day = integer(
      0,
      Math.round((dateValue(rules.date.end) - start) / 86400000),
      rng,
    );
    phone.date = new Date(start + day * 86400000).toISOString().slice(0, 10);
    phone.showDate = true;
  }
  if (rules.battery.enabled)
    phone.battery = integer(rules.battery.min, rules.battery.max, rng);
  if (rules.signal) phone.signal = integer(0, 4, rng);
  if (rules.wifi) phone.wifi = integer(0, 3, rng);
  if (rules.network.enabled)
    phone.network =
      rules.network.options[integer(0, rules.network.options.length - 1, rng)];
  for (const [key] of RANDOM_PHONE_ICONS)
    if (rules.icons[key]) phone[key] = rng() < 0.5;
  // Preserve manually edited layers when no actual setting changed.
  return Object.keys(phone).some(
    (key) =>
      phone[key as keyof PhoneSettings] !==
      doc.phone![key as keyof PhoneSettings],
  )
    ? applyPhoneLayers(doc, phone)
    : doc;
}
