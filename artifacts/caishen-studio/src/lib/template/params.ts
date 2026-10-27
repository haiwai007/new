import { defaultOrderRule, orderError } from "../parameters/order";
import { RE2JS } from "re2js";
import type {
  BindableProperty,
  ImageSource,
  Layer,
  ParamInputType,
  ParamValue,
  TemplateDoc,
  TemplateParameter,
} from "../../types/template.ts";
import { newId } from "./ids.ts";

// Parameter binding engine. A parameter's *current* value lives on its bound
// layer (so undo/redo and canvas edits stay consistent). The parameter keeps
// the default value and validation rules. Binding uses the stable layer id.

/** Display names are independent of parameter IDs and layer bindings. */
export const MAX_PARAMETER_NAME = 80;
export function parameterNameError(value: string): string | null {
  const name = value.trim();
  if (!name) return "参数名称不能为空";
  if (name.length > MAX_PARAMETER_NAME) return `参数名称最多 ${MAX_PARAMETER_NAME} 个字符`;
  return null;
}
export function renameParameter(doc: TemplateDoc, id: string, raw: string): TemplateDoc {
  const error = parameterNameError(raw);
  if (error) throw new Error(error);
  const name = raw.trim();
  return {...doc, parameters: doc.parameters.map(p => p.id === id ? {...p, name} : p)};
}

export const PARAM_TYPE_LABEL: Record<ParamInputType, string> = {
  text: "单行文本",
  order: "订单号",
  multiline: "多行文本",
  number: "数字",
  date: "日期",
  image: "图片",
  color: "颜色",
  font: "字体",
  fontSize: "字号",
  select: "下拉选项",
  toggle: "显示开关",
  width: "宽度",
  height: "高度",
  x: "X 坐标",
  y: "Y 坐标",
  rotation: "旋转角度",
  opacity: "透明度",
};

export const PROPERTY_FOR_TYPE: Record<ParamInputType, BindableProperty> = {
  text: "text",
  order: "text",
  multiline: "text",
  number: "text",
  date: "text",
  select: "text",
  image: "src",
  color: "fill",
  font: "fontFamily",
  fontSize: "fontSize",
  toggle: "visible",
  width: "width",
  height: "height",
  x: "x",
  y: "y",
  rotation: "rotation",
  opacity: "opacity",
};

const TEXT_ONLY: ParamInputType[] = ["text", "order", "multiline", "number", "date", "select", "font", "fontSize"];

/** Parameters are grouped into sections in the fill-in panel. */
export const DEFAULT_GROUPS = { content: "内容", image: "图片", style: "样式", layout: "布局" } as const;

export function defaultGroupFor(type: ParamInputType): string {
  if (["text", "order", "multiline", "number", "date", "select"].includes(type)) return DEFAULT_GROUPS.content;
  if (type === "image") return DEFAULT_GROUPS.image;
  if (["color", "font", "fontSize", "opacity", "toggle"].includes(type)) return DEFAULT_GROUPS.style;
  return DEFAULT_GROUPS.layout;
}

/** Ready-made format checks offered in the parameter settings. */
export const PATTERN_PRESETS: { id: string; label: string; pattern: string; message: string }[] = [
  { id: "phone", label: "手机号", pattern: "1[3-9]\\d{9}", message: "请输入 11 位手机号" },
  { id: "email", label: "邮箱", pattern: "[^\\s@]+@[^\\s@]+\\.[^\\s@]+", message: "邮箱格式不正确" },
  { id: "url", label: "网址", pattern: "https?://\\S+", message: "网址需以 http:// 或 https:// 开头" },
  { id: "digits", label: "纯数字", pattern: "\\d+", message: "只能输入数字" },
  { id: "price", label: "价格", pattern: "[¥￥$]?\\d+(\\.\\d{1,2})?", message: "价格格式如 ¥19.9" },
];

// RE2 uses a linear-time automaton: untrusted patterns never run in JS's backtracking engine.
// Bounded pattern/input sizes also bound compilation and automaton work.
const patternCache = new Map<string, { test: (value: string) => boolean } | null>();
export const MAX_PATTERN_INPUT = 10000;
export function compilePattern(pattern: string | undefined): { test: (value: string) => boolean } | null {
  if (!pattern || pattern.length > 500) return null;
  if (patternCache.has(pattern)) return patternCache.get(pattern)!;
  let compiled = null;
  try {
    const re = RE2JS.compile(pattern);
    compiled = { test: (value: string) => re.matches(value) };
  } catch { /* Unsupported constructs such as backreferences fail closed. */ }
  if (patternCache.size >= 100) patternCache.delete(patternCache.keys().next().value!);
  patternCache.set(pattern, compiled);
  return compiled;
}

/** Parameter types allowed for a given layer type. */
export function allowedParamTypes(layer: Layer): ParamInputType[] {
  const common: ParamInputType[] = ["toggle", "width", "height", "x", "y", "rotation", "opacity"];
  if (layer.type === "text") return [...TEXT_ONLY, "color", ...common];
  if (layer.type === "image") return ["image", ...common];
  return ["color", ...common];
}

function isImageSource(v: unknown): v is ImageSource {
  return typeof v === "object" && v !== null && "kind" in v;
}

export function getParamValue(doc: TemplateDoc, param: TemplateParameter): ParamValue {
  const layer = doc.layers.find((l) => l.id === param.layerId);
  if (!layer) return null;
  const record = layer as unknown as Record<string, unknown>;
  const v = record[param.property];
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (isImageSource(v)) return v;
  return null;
}

export function validateParamValue(
  param: TemplateParameter,
  value: ParamValue,
): string | null {
  const empty = value === null || value === "";
  if (empty) {
    if (param.required || !param.allowEmpty) return `「${param.name}」不能为空`;
    return null;
  }
  const { rules } = param;
  if(param.type === "order" && typeof value === "string") return orderError(param.order ?? defaultOrderRule(),value);
  if (typeof value === "string") {
    const len = [...value].length;
    if (rules.minLength && len < rules.minLength) {
      return `「${param.name}」至少 ${rules.minLength} 个字符`;
    }
    if (rules.maxLength && len > rules.maxLength) {
      return `「${param.name}」最多 ${rules.maxLength} 个字符`;
    }
    const re = compilePattern(rules.pattern);
    if (rules.pattern && !re) return `「${param.name}」格式规则无效或不受支持，请修改规则（不支持回溯引用和前后查找）`;
    if (rules.pattern && value.length > MAX_PATTERN_INPUT) return `「${param.name}」格式校验最多支持 ${MAX_PATTERN_INPUT} 个字符`;
    if (re && !re.test(value)) {
      return rules.patternMessage ? `「${param.name}」${rules.patternMessage}` : `「${param.name}」格式不正确`;
    }
    if (param.type === "number" && Number.isNaN(Number(value))) {
      return `「${param.name}」必须是数字`;
    }
    if (param.type === "date" && !/^\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?$/.test(value)) {
      return `「${param.name}」日期格式应为 2026-01-31`;
    }
    if (param.type === "select" && rules.options?.length && !rules.options.includes(value)) {
      return `「${param.name}」不在可选值中`;
    }
  }
  const num =
    typeof value === "number" ? value : param.type === "number" ? Number(value) : null;
  if (num !== null && !Number.isNaN(num)) {
    if (rules.min !== undefined && num < rules.min) return `「${param.name}」不能小于 ${rules.min}`;
    if (rules.max !== undefined && num > rules.max) return `「${param.name}」不能大于 ${rules.max}`;
  }
  return null;
}

function coerce(param: TemplateParameter, value: ParamValue): ParamValue {
  if(param.type==="number"&&param.rules.decimals!==undefined&&value!==null&&String(value).trim()!==""&&Number.isFinite(Number(value)))value=Number(value).toFixed(param.rules.decimals);
  switch (param.property) {
    case "text":
    case "fill":
    case "fontFamily":
      return value === null ? "" : String(value);
    case "visible":
      return Boolean(value);
    case "src":
      return isImageSource(value) ? value : null;
    default: {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }
  }
}

export function applyParamValue(
  doc: TemplateDoc,
  param: TemplateParameter,
  value: ParamValue,
): TemplateDoc {
  const coerced = coerce(param, value);
  if (coerced === null && param.property !== "src") return doc;
  const layers = doc.layers.map((l) => {
    if (l.id !== param.layerId && !param.linkedLayerIds?.includes(l.id)) return l;
    // Width/height must stay positive.
    if ((param.property === "width" || param.property === "height") && Number(coerced) <= 0) {
      return l;
    }
    return { ...l, [param.property]: coerced,
      ...(param.property === "src" && l.type === "image" ? {focusX:.5,focusY:.5,cropZoom:1,autoFocus:false,...(param.imageRole?{containScale:1,containAlign:true}:{})}:{}),
    } as Layer;
  });
  return { ...doc, layers };
}

/** Apply many values at once, keyed by parameter id. Unknown ids are ignored. */
export function applyParamValues(
  doc: TemplateDoc,
  values: Record<string, ParamValue>,
): TemplateDoc {
  let next = doc;
  for (const p of doc.parameters) {
    if (p.id in values) next = applyParamValue(next, p, values[p.id]);
  }
  return next;
}

export function resetParamsToDefault(doc: TemplateDoc): TemplateDoc {
  const values: Record<string, ParamValue> = {};
  for (const p of doc.parameters) values[p.id] = p.defaultValue;
  const next=applyParamValues(doc, values);
  return {...next,layers:next.layers.map(l=>{
    const p=doc.parameters.find(p=>(p.layerId===l.id||p.linkedLayerIds?.includes(l.id))&&p.type==="image");
    return l.type==="image"&&p?.imageDefaults?{...l,...p.imageDefaults,radius:l.radius}:l;
  })};
}

export function createParameter(
  doc: TemplateDoc,
  layer: Layer,
  type: ParamInputType,
  name?: string,
): TemplateParameter {
  const base: TemplateParameter = {
    id: newId("param"),
    name: name ?? `${PARAM_TYPE_LABEL[type]} ${doc.parameters.length + 1}`,
    type,
    layerId: layer.id,
    property: PROPERTY_FOR_TYPE[type],
    defaultValue: null,
    required: false,
    editable: true,
    allowEmpty: true,
    rules: type === "opacity" ? { min: 0, max: 1 } : {},
    ...(type === "order" ? {order:defaultOrderRule()}:{}),
    group: defaultGroupFor(type),
    description: "",
    placeholder: "",
  };
  return { ...base, defaultValue: getParamValue(doc, base) };
}

/** Collect every parameter's current value (keyed by parameter id). */
export function collectParamValues(doc: TemplateDoc): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const p of doc.parameters) out[p.id] = getParamValue(doc, p);
  return out;
}

/** All validation errors for the current values, in parameter order. */
export function validateAll(doc: TemplateDoc): { paramId: string; message: string }[] {
  const out: { paramId: string; message: string }[] = [];
  for (const p of doc.parameters) {
    const message = validateParamValue(p, getParamValue(doc, p));
    if (message) out.push({ paramId: p.id, message });
  }
  return out;
}

/** Group parameters by section, keeping first-seen section order. */
export function groupParameters(params: TemplateParameter[]): { group: string; params: TemplateParameter[] }[] {
  const map = new Map<string, TemplateParameter[]>();
  for (const p of params) {
    const key = p.group.trim() || "未分组";
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return [...map.entries()].map(([group, list]) => ({ group, params: list }));
}

/** Move a parameter up/down in the list (order = display order). */
export function moveParameter(doc: TemplateDoc, id: string, delta: -1 | 1): TemplateDoc {
  const idx = doc.parameters.findIndex((p) => p.id === id);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= doc.parameters.length) return doc;
  const parameters = [...doc.parameters];
  [parameters[idx], parameters[target]] = [parameters[target], parameters[idx]];
  return { ...doc, parameters };
}

const DATE_RE = /\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}/;
const NUMBER_RE = /^[\d.,\s￥¥$%+-]+$/;

/**
 * Suggest candidate parameters for text and image layers that are not yet
 * bound. Names are neutral unless the role is clear (largest text = 主标题).
 */
export function suggestParameters(doc: TemplateDoc): TemplateParameter[] {
  const bound = new Set(doc.parameters.filter((p) => p.property === "text" || p.property === "src").map((p) => p.layerId));
  const texts = doc.layers.filter((l) => l.type === "text" && !bound.has(l.id));
  const maxFont = Math.max(0, ...texts.map((l) => (l.type === "text" ? l.fontSize : 0)));
  let textN = 0;
  let imageN = 0;
  let working = doc;
  const out: TemplateParameter[] = [];
  for (const layer of doc.layers) {
    if (bound.has(layer.id)) continue;
    let param: TemplateParameter | null = null;
    if (layer.type === "text") {
      textN += 1;
      const t = layer.text.trim();
      const type: ParamInputType = DATE_RE.test(t)
        ? "date"
        : NUMBER_RE.test(t) && t.length > 0
          ? "number"
          : t.includes("\n")
            ? "multiline"
            : "text";
      const isTitle = texts.length > 1 && layer.fontSize === maxFont;
      const name =
        type === "date" ? `日期 ${textN}` : isTitle ? "主标题" : `文本 ${textN}`;
      param = createParameter(working, layer, type, name);
      // Numbers like "¥199" would fail the numeric check, so keep them as text.
      if (type === "number" && Number.isNaN(Number(t))) param = { ...param, type: "text" };
    } else if (layer.type === "image" && !layer.locked) {
      imageN += 1;
      param = createParameter(working, layer, "image", `图片 ${imageN}`);
    }
    if (param) {
      out.push(param);
      working = { ...working, parameters: [...working.parameters, param] };
    }
  }
  return out;
}
