import { z } from "zod";
import { PHONE_MODELS, phoneModel } from "../phone/models";
import { settingsForModel, statusProfile } from "../phone/profiles";
import { MAX_APP_ICONS } from "../phone/app-icon-catalog";
import {
  phoneAppIconSchema,
  phoneSettingsSchema,
  type PhoneAppIcon,
} from "../phone/schema";
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
  setup?: { mode: "keep" | "overlay" | "prepend"; settings: PhoneSettings };
  models?: {
    enabled: boolean;
    ids: PhoneSettings["modelId"][];
    distribution: "random" | "balanced";
  };
  apps?: {
    mode: "keep" | "none" | "fixed" | "random";
    fixed: PhoneAppIcon[];
    candidates: PhoneAppIcon[];
    min: number;
    max: number;
    order: "list" | "random";
  };
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
  if (!rules || rules.setup?.mode === "keep") return [];
  if (!rules.enabled && !rules.setup) return [];
  const errors: string[] = [];
  if (
    rules.enabled &&
    rules.time.enabled &&
    ![rules.time.start, rules.time.end].every((v) =>
      Number.isFinite(timeValue(v)),
    )
  )
    errors.push("随机时间须为 00:00–23:59");
  if (rules.enabled && rules.date.enabled) {
    if (![rules.date.start, rules.date.end].every(validPhoneDate))
      errors.push("请选择有效的随机日期范围");
    else if (rules.date.start > rules.date.end)
      errors.push("随机日期的结束日期不能早于开始日期");
  }
  if (
    rules.enabled &&
    rules.battery.enabled &&
    (![rules.battery.min, rules.battery.max].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 100,
    ) ||
      rules.battery.min > rules.battery.max)
  )
    errors.push("随机电量须为 0–100 的整数，最小值不能大于最大值");
  if (
    rules.enabled &&
    rules.network.enabled &&
    (!rules.network.options.length ||
      rules.network.options.some((v) => !PHONE_NETWORKS.includes(v)))
  )
    errors.push("请至少选择一种有效的随机网络类型");
  const models = rules.models;
  if (
    models?.enabled &&
    (!models.ids.length ||
      new Set(models.ids).size !== models.ids.length ||
      models.ids.some((id) => !PHONE_MODELS.some((m) => m.id === id)))
  )
    errors.push("请至少选择一个有效且不重复的随机手机型号");
  if (
    rules.setup &&
    !phoneSettingsSchema.safeParse(rules.setup.settings).success
  )
    errors.push("请检查固定状态栏设置");
  const apps = rules.apps;
  if (apps && apps.mode !== "keep" && apps.mode !== "none") {
    const active =
      apps.mode === "random" ? [...apps.fixed, ...apps.candidates] : apps.fixed;
    if (
      active.some((i) => !phoneAppIconSchema.safeParse(i).success) ||
      new Set(active.map(appIconKey)).size !== active.length
    )
      errors.push("固定图标与随机候选不能包含重复或无效的 APP");
    if (apps.fixed.length > MAX_APP_ICONS) errors.push("固定 APP 图标过多");
    if (
      apps.mode === "random" &&
      (!apps.candidates.length ||
        ![apps.min, apps.max].every((n) => Number.isInteger(n) && n >= 0) ||
        apps.min > apps.max ||
        apps.max > apps.candidates.length)
    )
      errors.push("随机 APP 须选择候选，数量区间为不超过候选数的非负整数");
    const total = apps.fixed.length + (apps.mode === "random" ? apps.max : 0);
    const settings = rules.setup?.settings;
    if (settings && total > minimumAppCapacity(rules, settings))
      errors.push(
        `所选型号最多共同容纳 ${minimumAppCapacity(rules, settings)} 个 APP 图标，请调整数量、大小、间距或机型`,
      );
    else if (total > MAX_APP_ICONS)
      errors.push(`最多显示 ${MAX_APP_ICONS} 个 APP 图标`);
  }
  return errors;
}
/** Inclusive integer sampling; the caller supplies the batch's seeded RNG. */
const integer = (min: number, max: number, rng: () => number) =>
  min + Math.floor(rng() * (max - min + 1));
export function applyPhoneBatchRules(
  doc: TemplateDoc,
  rules: PhoneBatchRules | undefined,
  rng: () => number,
  assignedModel?: PhoneSettings["modelId"],
): TemplateDoc {
  if (!rules || validatePhoneBatchRules(rules).length) return doc;
  if (rules.setup?.mode === "keep") return doc;
  const source = rules.setup?.settings ?? doc.phone;
  if (!source || (!rules.enabled && !rules.setup)) return doc;
  let phone = { ...source, placement: rules.setup?.mode ?? source.placement };
  if (assignedModel) phone = settingsForModel(phone, assignedModel);
  else if (rules.models?.enabled && rules.models.ids.length)
    phone = settingsForModel(
      phone,
      rules.models.ids[integer(0, rules.models.ids.length - 1, rng)],
    );
  if (rules.enabled && rules.time.enabled) {
    const start = timeValue(rules.time.start);
    const end = timeValue(rules.time.end);
    // An earlier end means a range crossing midnight, e.g. 23:00–01:00.
    const minutes =
      (start + integer(0, (end - start + 1440) % 1440, rng)) % 1440;
    phone.time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  if (rules.enabled && rules.date.enabled) {
    const start = dateValue(rules.date.start);
    const day = integer(
      0,
      Math.round((dateValue(rules.date.end) - start) / 86400000),
      rng,
    );
    phone.date = new Date(start + day * 86400000).toISOString().slice(0, 10);
    phone.showDate = true;
  }
  if (rules.enabled && rules.battery.enabled)
    phone.battery = integer(rules.battery.min, rules.battery.max, rng);
  if (rules.enabled && rules.signal) phone.signal = integer(0, 4, rng);
  if (rules.enabled && rules.wifi) phone.wifi = integer(0, 3, rng);
  if (rules.enabled && rules.network.enabled)
    phone.network =
      rules.network.options[integer(0, rules.network.options.length - 1, rng)];
  for (const [key] of RANDOM_PHONE_ICONS)
    if (rules.enabled && rules.icons[key]) phone[key] = rng() < 0.5;
  const apps = rules.apps;
  if (apps?.mode === "none") phone.appIcons = [];
  if (apps?.mode === "fixed" || apps?.mode === "random") {
    const selected =
      apps.mode === "random"
        ? shuffled(apps.candidates, rng).slice(
            0,
            integer(apps.min, apps.max, rng),
          )
        : [];
    const keys = new Set(selected.map(appIconKey));
    const ordered = apps.candidates.filter((i) => keys.has(appIconKey(i)));
    const all = [...apps.fixed, ...ordered].map((i) => ({
      ...i,
      visible: true,
    }));
    phone.appIcons = apps.order === "random" ? shuffled(all, rng) : all;
  }
  return JSON.stringify(phone) !== JSON.stringify(doc.phone)
    ? applyPhoneLayers(doc, phone)
    : doc;
}

export function appIconKey(icon: PhoneAppIcon): string {
  return icon.kind === "builtin"
    ? `builtin:${icon.builtinId}`
    : icon.src.kind === "asset"
      ? `asset:${icon.src.assetId}`
      : `url:${icon.src.url}`;
}
export function shuffled<T>(values: readonly T[], rng: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = integer(0, i, rng);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
/** Capacity at the requested icon size; never rely on silently shrinking the preview. */
export function appIconCapacity(settings: PhoneSettings): number {
  const model = phoneModel(settings.modelId),
    profile = statusProfile(settings.modelId);
  const left =
    model.cutout === "none"
      ? model.points * 0.48
      : (model.points - model.cutoutWidth) / 2;
  const space =
    Math.max(0, left - Math.max(1, profile.inset + settings.insetX) - 4) * 0.52;
  const scale = settings.scale / 100;
  return Math.max(
    0,
    Math.min(
      MAX_APP_ICONS,
      Math.floor(
        (space + settings.appIconGap * scale) /
          ((settings.appIconSize + settings.appIconGap) * scale),
      ),
    ),
  );
}
export function minimumAppCapacity(
  rules: PhoneBatchRules,
  settings: PhoneSettings,
): number {
  const ids = rules.models?.enabled ? rules.models.ids : [settings.modelId];
  return ids.length
    ? Math.min(
        ...ids.map((id) =>
          appIconCapacity(
            id === settings.modelId && !rules.models?.enabled
              ? settings
              : settingsForModel(settings, id),
          ),
        ),
      )
    : 0;
}
export function distributeModels(
  rules: PhoneBatchRules | undefined,
  count: number,
  rng: () => number,
): (PhoneSettings["modelId"] | undefined)[] {
  if (
    !rules?.models?.enabled ||
    !rules.models.ids.length ||
    rules.setup?.mode === "keep"
  )
    return Array(count).fill(undefined);
  const ids = rules.models.ids;
  if (rules.models.distribution === "random")
    return Array.from(
      { length: count },
      () => ids[integer(0, ids.length - 1, rng)],
    );
  const order = shuffled(ids, rng);
  return shuffled(
    Array.from({ length: count }, (_, i) => order[i % order.length]),
    rng,
  );
}

const appList = z.array(phoneAppIconSchema).max(128);
export const phoneBatchRulesSchema = z.object({
  setup: z
    .object({
      mode: z.enum(["keep", "overlay", "prepend"]),
      settings: phoneSettingsSchema,
    })
    .optional(),
  models: z
    .object({
      enabled: z.boolean(),
      ids: z
        .array(z.enum(PHONE_MODELS.map((m) => m.id)))
        .max(PHONE_MODELS.length),
      distribution: z.enum(["random", "balanced"]),
    })
    .optional(),
  apps: z
    .object({
      mode: z.enum(["keep", "none", "fixed", "random"]),
      fixed: appList,
      candidates: appList,
      min: z.number().int().min(0).max(128),
      max: z.number().int().min(0).max(128),
      order: z.enum(["list", "random"]),
    })
    .optional(),
  enabled: z.boolean(),
  time: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
  date: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
  battery: z.object({ enabled: z.boolean(), min: z.number(), max: z.number() }),
  signal: z.boolean(),
  wifi: z.boolean(),
  network: z.object({
    enabled: z.boolean(),
    options: z.array(z.enum(PHONE_NETWORKS)).max(PHONE_NETWORKS.length),
  }),
  icons: z.object(
    Object.fromEntries(
      RANDOM_PHONE_ICONS.map(([key]) => [key, z.boolean().optional()]),
    ),
  ),
});

export function drawingRules(phone: PhoneSettings): PhoneBatchRules {
  const settings = phoneSettingsSchema.parse(phone);
  return {
    ...defaultPhoneBatchRules(settings),
    setup: { mode: settings.placement, settings },
    models: { enabled: false, ids: [settings.modelId], distribution: "random" },
    apps: {
      mode: "keep",
      fixed: [],
      candidates: [],
      min: 0,
      max: 1,
      order: "list",
    },
  };
}
