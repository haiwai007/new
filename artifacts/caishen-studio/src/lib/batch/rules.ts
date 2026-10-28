import {defaultCardRule,generateCards,randomCard} from "../parameters/card";
import {dateFormat,dateParts} from "../parameters/date";
import { defaultOrderRule, generateOrders, randomOrder } from "../parameters/order";
import { distributeModels, applyPhoneBatchRules, validatePhoneBatchRules, type PhoneBatchRules } from "./phone-rules";
import { format as formatDate } from "date-fns";
import { applyParamValues, getParamValue, validateParamValue } from "../template/params.ts";
import type { ParamInputType, ParamValue, TemplateDoc, TemplateParameter } from "../../types/template.ts";

export const MAX_BATCH_COUNT = 200;

export const DATE_FORMATS = [
  {id:"yyyy-MM-dd HH:mm:ss",label:"2026-10-25 14:30:25（到秒）",dateOnly:false},
  {id:"yyyy/MM/dd HH:mm:ss",label:"2026/10/25 14:30:25（到秒）",dateOnly:false},
  {id:"yyyy年M月d日 HH:mm:ss",label:"2026年10月25日 14:30:25（到秒）",dateOnly:false},
  {id:"MM-dd HH:mm:ss",label:"10-25 14:30:25（到秒）",dateOnly:false},
  {id:"HH:mm:ss",label:"14:30:25（到秒）",dateOnly:false},
  { id: "yyyy-MM-dd HH:mm", label: "2026-10-25 14:30", dateOnly: false },
  { id: "yyyy-MM-dd", label: "2026-10-25", dateOnly: true },
  { id: "yyyy/MM/dd", label: "2026/10/25", dateOnly: true },
  { id: "yyyy年M月d日", label: "2026年10月25日", dateOnly: true },
  { id: "MM-dd HH:mm", label: "10-25 14:30", dateOnly: false },
  { id: "HH:mm", label: "14:30", dateOnly: false },
] as const;
export type DateFormatId = (typeof DATE_FORMATS)[number]["id"];

export type ParamRule =
  | { mode: "keep" }
  | { mode: "orderRandom"; unique: boolean }
  | { mode: "orderedList"; options: string[]; loop?: boolean }
  | { mode: "fixed"; value: string }
  | { mode: "range"; min: number; max: number; decimals: number; prefix: string; suffix: string; groupThousands?: boolean }
  | { mode: "dateRange"; start: string; end: string; format: DateFormatId }
  | { mode: "list"; options: string[] }
  | { mode: "sequence"; prefix: string; start: number; pad: number; suffix: string };
export type RuleMode = ParamRule["mode"];
export type BatchRules = Record<string, ParamRule>;

export const RULE_MODE_LABEL: Record<RuleMode, string> = {
  keep: "沿用模板",
  orderRandom: "按模板随机",
  orderedList: "按顺序使用",
  fixed: "固定值",
  range: "随机区间",
  dateRange: "随机时间段",
  list: "从候选中随机",
  sequence: "自动编号",
};

const NUMERIC_TYPES: ParamInputType[] = ["fontSize", "width", "height", "x", "y", "rotation", "opacity"];

/** Which rule modes make sense for each parameter type. */
export function modesFor(type: ParamInputType): RuleMode[] {
  if(type === "order"||type === "card") return ["keep","fixed","orderRandom","orderedList"];
  if(type === "image") return ["keep","fixed","list","orderedList"];
  if (type === "text" || type === "multiline") return ["keep", "fixed", "list", "sequence", "range", "dateRange"];
  if (type === "number") return ["keep", "fixed", "range", "list"];
  if (type === "date") return ["keep", "fixed", "dateRange", "list"];
  if (type === "color" || type === "font" || type === "select" || type === "toggle") return ["keep", "fixed", "list"];
  if (NUMERIC_TYPES.includes(type)) return ["keep", "fixed", "range"];
  return ["keep", "fixed"];
}

/** Phone layers are managed by dedicated status-bar rules, never general parameter rules. */
export function isLockedParam(doc: TemplateDoc, param: TemplateParameter): boolean {
  return !param.editable || (!!doc.phone && param.layerId.startsWith(`${doc.phone.groupId}_`));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function localInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Display grouping applies to numeric text, never to geometry or order numbers. */
export function usesThousands(
  param: TemplateParameter,
  rule: { groupThousands?: boolean },
): boolean {
  return (
    param.property === "text" &&
    (rule.groupThousands ??
      (param.type === "number" ||
        /金额|价格|余额|费用|收入|支出|amount|price/i.test(param.name)))
  );
}
export function defaultRule(mode: RuleMode, param: TemplateParameter, current: ParamValue): ParamRule {
  const text = typeof current === "string" || typeof current === "number" ? String(current) : "";
  switch (mode) {
    case "orderRandom": return {mode,unique:true};
    case "orderedList": return {mode,options:param.type==="image"?[]:text?[text]:[],loop:param.type==="image"};
    case "keep":
      return { mode };
    case "fixed":
      return { mode, value: param.type === "toggle" ? String(current !== false) : param.type === "image" ? "" : text };
    case "range": {
      const n = Number(text.replace(/[^\d.-]/g, ""));
      const base = Number.isFinite(n) && n > 0 ? n : 100;
      const decimals = param.type === "opacity" ? 2 : param.rules.decimals ?? 0;
      const prefix = /^[¥￥$]/.test(text) ? text[0] : "";
      return { mode, min: param.rules.min ?? Math.floor(base * 0.5), max: param.rules.max ?? Math.ceil(base * 1.5), decimals, prefix, suffix: "" };
    }
    case "dateRange": {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 86_400_000);
      return { mode, start: localInput(start), end: localInput(end), format: param.type === "date" ? dateFormat(param.rules.datePrecision??dateParts(text)?.precision??"date") : "yyyy-MM-dd HH:mm" };
    }
    case "list":
      return {
        mode,
        options: param.type === "toggle" ? ["true", "false"] : param.type === "select" ? [...(param.rules.options ?? [])] : text ? [text] : [],
      };
    case "sequence":
      return { mode, prefix: "A", start: 1, pad: 3, suffix: "" };
  }
}

/** Deterministic RNG so the preview and the export of one "batch" match exactly. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function convertFixed(param: TemplateParameter, raw: string): ParamValue | undefined {
  if (param.type === "toggle") return raw === "true";
  if (param.type === "image") return raw ? { kind: "asset", assetId: raw } : undefined;
  if (param.property !== "text" && param.property !== "fill" && param.property !== "fontFamily") {
    const n = Number(raw);
    return Number.isFinite(n) && raw.trim() !== "" ? n : undefined;
  }
  return raw;
}

/** Value for one parameter on image #index, or undefined to keep the template value. */
export function generateValue(param: TemplateParameter, rule: ParamRule, index: number, rng: () => number): ParamValue | undefined {
  switch (rule.mode) {
    case "orderRandom": return param.type==="card"?generateCards(param.card??defaultCardRule(),1,rng,false)[0]:generateOrders(param.order??defaultOrderRule(),1,rng,false)[0];
    case "orderedList": {
      const options=rule.options.filter(Boolean);
      const value=options[rule.loop?index%options.length:index];
      return value===undefined?undefined:convertFixed(param,value);
    }
    case "keep":
      return undefined;
    case "fixed":
      return convertFixed(param, rule.value);
    case "list": {
      const options = rule.options.filter((o) => o !== "");
      if (options.length === 0) return undefined;
      return convertFixed(param, options[Math.floor(rng() * options.length)]);
    }
    case "range": {
      const lo = Math.min(rule.min, rule.max);
      const hi = Math.max(rule.min, rule.max);
      const decimals = Math.max(0, Math.min(4, Math.floor(rule.decimals)));
      const n = Number((lo + rng() * (hi - lo)).toFixed(decimals));
      const text = n.toFixed(decimals);
      const formatted = usesThousands(param, rule)
        ? text
            .split(".")
            .map((part, i) =>
              i === 0 ? part.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : part,
            )
            .join(".")
        : text;
      return param.property === "text"
        ? `${rule.prefix}${formatted}${rule.suffix}`
        : n;
    }
    case "dateRange": {
      const a = new Date(rule.start).getTime();
      const b = new Date(rule.end).getTime();
      if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
      const t = Math.min(a, b) + rng() * Math.abs(b - a);
      return formatDate(new Date(t), rule.format);
    }
    case "sequence":
      return `${rule.prefix}${String(Math.max(0, Math.floor(rule.start)) + index).padStart(Math.max(0, Math.min(10, rule.pad)), "0")}${rule.suffix}`;
  }
}

export type GeneratedItem = { index: number; doc: TemplateDoc; errors: string[]; preservePhone?: boolean };

export function generateItems(template: TemplateDoc, rules: BatchRules, count: number, seed: number, phoneRules?: PhoneBatchRules): GeneratedItem[] {
  const total = Math.max(1, Math.min(MAX_BATCH_COUNT, Math.floor(count) || 1));
  const rng = createRng(seed);
  const assignedModels = distributeModels(phoneRules, total, createRng(seed ^ 0x6f5271));
  const phoneErrors = validatePhoneBatchRules(phoneRules, template);
  const orderValues:Record<string,string[]>={}; const orderErrors:string[]=[];
  for(const p of template.parameters){
    const rule=rules[p.id]??((p.type==="order"||p.type==="card")?{mode:"orderRandom" as const,unique:true}:undefined);
    if(rule?.mode==="orderRandom"&&!isLockedParam(template,p))try{orderValues[p.id]=(p.type==="card"?generateCards(p.card??defaultCardRule(),total,rng,rule.unique):generateOrders(p.order??defaultOrderRule(),total,rng,rule.unique));}catch(e){orderErrors.push(`「${p.name}」${e instanceof Error?e.message:"无法随机单号"}`);}
  }
  return Array.from({ length: total }, (_, index) => {
    const values: Record<string, ParamValue> = {};
    const itemErrors=[...orderErrors];
    for (const param of template.parameters) {
      const rule = rules[param.id]??((param.type==="order"||param.type==="card")?{mode:"orderRandom" as const,unique:true}:undefined);
      if (!rule || isLockedParam(template, param)) continue;
      if(rule.mode==="orderedList"&&!rule.loop&&index>=rule.options.filter(Boolean).length)itemErrors.push(`「${param.name}」列表数量不足，请补充内容或开启循环使用`);
      const value = rule.mode==="orderRandom"?orderValues[param.id]?.[index]:generateValue(param, rule, index, rng);
      if (value !== undefined) values[param.id] = value;
    }
    let doc: TemplateDoc;
    try { doc = applyPhoneBatchRules(applyParamValues(template, values), phoneRules, createRng(seed ^ 0x51f15e ^ Math.imul(index + 1, 0x45d9f3b)), assignedModels[index]); } catch (e) {return {index, doc: template, errors: [e instanceof Error ? e.message : "状态栏生成失败"]};}
    const errors = doc.parameters.filter(p=>p.type!=="order")
      // Text-bound numbers are display content: prefixes, suffixes and masks are
      // allowed here and must not cause an otherwise renderable image to be skipped.
      .map((p) => validateParamValue(p.type === "number" && p.property === "text" ? { ...p, type: "text" } : p, getParamValue(doc, p)))
      .filter((m): m is string => m !== null);
    return { index, doc, errors: [...new Set([...phoneErrors, ...itemErrors, ...errors])], ...(phoneRules?.setup?.mode === "keep" ? {preservePhone: true} : {}) };
  });
}

/** Keep every other preview frozen while avoiding their existing order numbers. */
export function preserveUniqueOrders(replacement:GeneratedItem, items:GeneratedItem[], rules:BatchRules, rng:()=>number):GeneratedItem {
  let doc=replacement.doc;
  for(const p of doc.parameters){
    const rule=rules[p.id]??((p.type==="order"||p.type==="card")?{mode:"orderRandom" as const,unique:true}:undefined);
    if((p.type!=="order"&&p.type!=="card")||rule?.mode!=="orderRandom"||!rule.unique||isLockedParam(doc,p))continue;
    const excluded=items.filter(item=>item.index!==replacement.index).map(item=>String(getParamValue(item.doc,p)??""));
    const value=p.type==="card"?randomCard(p.card??defaultCardRule(),String(getParamValue(items.find(item=>item.index===replacement.index)?.doc??doc,p)??""),excluded,rng):randomOrder(p.order??defaultOrderRule(),String(getParamValue(items.find(item=>item.index===replacement.index)?.doc??doc,p)??""),excluded,rng);
    doc=applyParamValues(doc,{[p.id]:value});
  }
  return {...replacement,doc};
}
