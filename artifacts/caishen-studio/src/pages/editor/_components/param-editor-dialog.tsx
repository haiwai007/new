import {DATE_PRECISIONS,dateParts,dateValue,type DatePrecision} from "@/lib/parameters/date";
import {removeParameterBinding} from "@/lib/parameters/document";
import OrderRuleEditor from "@/components/parameters/order-rule-editor";
import {defaultOrderRule} from "@/lib/parameters/order";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { edit, useEditor } from "@/stores/editor.ts";
import {
  MAX_PARAMETER_NAME,
  parameterNameError,
  DEFAULT_GROUPS,
  PARAM_TYPE_LABEL,
  PATTERN_PRESETS,
  PROPERTY_FOR_TYPE,
  allowedParamTypes,
  compilePattern,
  createParameter,
  defaultGroupFor,
  getParamValue,
  applyParamValue,
} from "@/lib/template/params.ts";
import type { Layer, ParamInputType, TemplateParameter } from "@/types/template.ts";

type Props =
  | { param: TemplateParameter; layer?: undefined; children: React.ReactNode }
  | { layer: Layer; param?: undefined; children: React.ReactNode };

const TEXTUAL: ParamInputType[] = ["text", "order", "multiline", "number", "date", "select"];
const NUMERIC: ParamInputType[] = ["number", "fontSize", "width", "height", "x", "y", "rotation", "opacity"];
const CUSTOM_PATTERN = "custom";
const NO_PATTERN = "none";

/** Create a new parameter for a layer, or edit an existing one's settings. */
export default function ParamEditorDialog(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{props.children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {open && <Form {...props} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function presetIdFor(pattern: string | undefined): string {
  if (!pattern) return NO_PATTERN;
  return PATTERN_PRESETS.find((p) => p.pattern === pattern)?.id ?? CUSTOM_PATTERN;
}

function Form({ param, layer: newLayer, onDone }: Props & { onDone: () => void }) {
  const doc = useEditor((s) => s.doc)!;
  const layerId = param?.layerId ?? newLayer!.id;
  const [boundLayerId, setBoundLayerId] = useState(layerId);
  const layer = doc.layers.find((l) => l.id === boundLayerId);
  const types = layer ? allowedParamTypes(layer) : [];
  const [order,setOrder]=useState(param?.order??defaultOrderRule());
  const [type, setType] = useState<ParamInputType>(param?.type ?? types[0] ?? "text");
  const [name, setName] = useState(param?.name ?? "");
  const [nameError, setNameError] = useState("");
  const [group, setGroup] = useState(param?.group ?? defaultGroupFor(param?.type ?? types[0] ?? "text"));
  const [description, setDescription] = useState(param?.description ?? "");
  const [placeholder, setPlaceholder] = useState(param?.placeholder ?? "");
  const [required, setRequired] = useState(param?.required ?? false);
  const [editable, setEditable] = useState(param?.editable ?? true);
  const [allowEmpty, setAllowEmpty] = useState(param?.allowEmpty ?? true);
  const [minLength, setMinLength] = useState(param?.rules.minLength?.toString() ?? "");
  const [maxLength, setMaxLength] = useState(param?.rules.maxLength?.toString() ?? "");
  const [datePrecision,setDatePrecision]=useState<DatePrecision>(param?.rules.datePrecision??dateParts(String(param?getParamValue(doc,param):layer?.type==="text"?layer.text:""))?.precision??"date");
  const [decimals,setDecimals]=useState(param?.rules.decimals?.toString()??"");
  const [min, setMin] = useState(param?.rules.min?.toString() ?? "");
  const [max, setMax] = useState(param?.rules.max?.toString() ?? "");
  const [step, setStep] = useState(param?.rules.step?.toString() ?? "");
  const [options, setOptions] = useState(param?.rules.options?.join("\n") ?? "");
  const [presetId, setPresetId] = useState(presetIdFor(param?.rules.pattern));
  const [pattern, setPattern] = useState(param?.rules.pattern ?? "");
  const [patternMessage, setPatternMessage] = useState(param?.rules.patternMessage ?? "");
  const [resetDefault, setResetDefault] = useState(!param);

  const isTextual = TEXTUAL.includes(type);
  const isNumeric = NUMERIC.includes(type);
  const supportsPattern = type === "text" || type === "multiline";
  const groups = [...new Set([...Object.values(DEFAULT_GROUPS), ...doc.parameters.map((p) => p.group).filter(Boolean)])];

  const changeType = (t: ParamInputType) => {
    // Follow the default group unless the user picked a custom one.
    if (group === defaultGroupFor(type)) setGroup(defaultGroupFor(t));
    setType(t);
  };

  const choosePreset = (id: string) => {
    setPresetId(id);
    const p = PATTERN_PRESETS.find((x) => x.id === id);
    if (p) {
      setPattern(p.pattern);
      setPatternMessage(p.message);
    } else if (id === NO_PATTERN) {
      setPattern("");
      setPatternMessage("");
    }
  };

  const save = (): void => {
    if (!layer) {
      toast.error("请选择关联图层");
      return;
    }
    if (!types.includes(type)) {
      toast.error("该图层不支持这种参数类型");
      return;
    }
    const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));
    const opts = options.split("\n").map((s) => s.trim()).filter(Boolean);
    if (type === "select" && opts.length === 0) {
      toast.error("下拉选项至少需要一个可选值");
      return;
    }
    const nMin = num(min);
    const nMax = num(max);
    if (nMin !== undefined && nMax !== undefined && nMin > nMax) {
      toast.error("最小值不能大于最大值");
      return;
    }
    const nMinLen = num(minLength);
    const nMaxLen = num(maxLength);
    if (nMinLen !== undefined && nMaxLen !== undefined && nMinLen > nMaxLen) {
      toast.error("最少字数不能大于最多字数");
      return;
    }
    const usePattern = supportsPattern && presetId !== NO_PATTERN && pattern.trim() !== "";
    if (usePattern && !compilePattern(pattern.trim())) {
      toast.error("格式规则无效或不受支持（不支持回溯引用和前后查找）");
      return;
    }
    const nStep = num(step);

    const base = param ?? createParameter(doc, layer, type);
    const displayName = name.trim() || (param ? "" : base.name);
    // Legacy long names remain valid when editing other parameter settings.
    const error = displayName === param?.name ? null : parameterNameError(displayName);
    if (error) {setNameError(error); return;}
    const next: TemplateParameter = {
      ...base,
      name: displayName,
      type,
      order: type === "order" ? order : undefined,
      layerId: layer.id,
      property: PROPERTY_FOR_TYPE[type],
      required,
      editable,
      allowEmpty: required ? false : allowEmpty,
      group: group.trim(),
      description: description.trim(),
      placeholder: isTextual ? placeholder.trim() : "",
      rules: {
        datePrecision:type==="date"?datePrecision:undefined,
        decimals: type==="number"&&decimals!==""?Math.max(0,Math.min(8,Math.floor(Number(decimals)||0))):undefined,
        minLength: isTextual && nMinLen && nMinLen > 0 ? Math.round(nMinLen) : undefined,
        maxLength: isTextual && nMaxLen && nMaxLen > 0 ? Math.round(nMaxLen) : undefined,
        min: isNumeric ? nMin : undefined,
        max: isNumeric ? nMax : undefined,
        step: isNumeric && nStep && nStep > 0 ? nStep : undefined,
        options: type === "select" ? opts : undefined,
        pattern: usePattern ? pattern.trim() : undefined,
        patternMessage: usePattern && patternMessage.trim() ? patternMessage.trim() : undefined,
      },
    };
    if (resetDefault || next.property !== base.property || next.layerId !== base.layerId) {
      next.defaultValue = getParamValue(doc, next);
    }
    const currentDate=String(getParamValue(doc,next)??"");
    const changeDatePrecision=type==="date"&&!!dateParts(currentDate)&&dateParts(currentDate)!.precision!==datePrecision;
    if(changeDatePrecision && typeof next.defaultValue==="string" && dateParts(next.defaultValue)) next.defaultValue=dateValue(next.defaultValue,datePrecision);
    edit((d) => {
      const updated={...d,parameters:param?d.parameters.map(p=>p.id===param.id?next:p):[...d.parameters,next]};
      return changeDatePrecision?applyParamValue(updated,next,dateValue(currentDate,datePrecision)):updated;
    });
    toast.success(param ? "参数已更新" : "参数已添加");
    onDone();
  };

  const remove = () => {
    if (!param) return;
    edit((d) => removeParameterBinding(d, param.id));
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{param ? "参数设置" : "添加参数"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>参数名称</Label>
            <Input aria-label="参数名称" maxLength={MAX_PARAMETER_NAME} value={name} onChange={(e) => {setName(e.target.value); setNameError("");}} placeholder="例如：活动标题、商品价格" aria-invalid={!!nameError} />
            {nameError && <p role="alert" className="text-xs text-destructive">{nameError}</p>}
          </div>
          <div className="space-y-1">
            <Label>所属分组</Label>
            <Input value={group} onChange={(e) => setGroup(e.target.value)} list="param-groups" placeholder="例如：内容" maxLength={40} />
            <datalist id="param-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>关联图层</Label>
            <Select value={boundLayerId} onValueChange={(v) => {
              setBoundLayerId(v);
              const l = doc.layers.find((x) => x.id === v);
              if (l && !allowedParamTypes(l).includes(type)) changeType(allowedParamTypes(l)[0]);
            }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[...doc.layers].reverse().map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>参数类型</Label>
            <Select value={type} onValueChange={(v) => changeType(v as ParamInputType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {types.map((t) => <SelectItem key={t} value={t}>{PARAM_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>填写说明</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例如：建议不超过 8 个字" maxLength={200} />
        </div>
        {type === "date" && <div className="space-y-1"><Label>日期精度（可选时间）</Label><Select value={datePrecision} onValueChange={v=>setDatePrecision(v as DatePrecision)}><SelectTrigger aria-label="日期参数精度"><SelectValue/></SelectTrigger><SelectContent>{DATE_PRECISIONS.map(p=><SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select></div>}
        {type === "order" && <OrderRuleEditor value={order} onChange={setOrder}/>}
        {isTextual && type !== "select" && type !== "order" && (
          <>
            <div className="space-y-1">
              <Label>输入框提示文字</Label>
              <Input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} placeholder="例如：请输入活动名称" maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>最少字数</Label>
                <Input type="number" min={0} value={minLength} onChange={(e) => setMinLength(e.target.value)} placeholder="不限" />
              </div>
              <div className="space-y-1">
                <Label>最多字数</Label>
                <Input type="number" min={0} value={maxLength} onChange={(e) => setMaxLength(e.target.value)} placeholder="不限" />
              </div>
            </div>
          </>
        )}
        {supportsPattern && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="space-y-1">
              <Label>格式校验</Label>
              <Select value={presetId} onValueChange={choosePreset}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PATTERN}>不校验格式</SelectItem>
                  {PATTERN_PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  <SelectItem value={CUSTOM_PATTERN}>自定义（正则表达式）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {presetId === CUSTOM_PATTERN && (
              <>
                <Input value={pattern} onChange={(e) => setPattern(e.target.value)} maxLength={500} placeholder="例如：[A-Z]{2}\d{4}" className="font-mono text-xs" />
                <Input value={patternMessage} onChange={(e) => setPatternMessage(e.target.value)} placeholder="不符合时的提示，例如：编号格式如 AB1234" />
                {pattern.trim() !== "" && !compilePattern(pattern.trim()) && <p className="text-xs text-destructive">规则无效或不受支持</p>}
              </>
            )}
          </div>
        )}
        {type === "select" && (
          <div className="space-y-1">
            <Label>可选值（每行一个）</Label>
            <textarea className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm" value={options} onChange={(e) => setOptions(e.target.value)} placeholder={"新品上市\n限时秒杀"} />
          </div>
        )}
        {type==="number"&&<div className="space-y-1"><Label>保留小数位（留空不格式化）</Label><Input aria-label="数字参数小数位" type="number" min={0} max={8} value={decimals} onChange={e=>setDecimals(e.target.value)}/></div>}
        {isNumeric && (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>最小值</Label><Input type="number" value={min} onChange={(e) => setMin(e.target.value)} /></div>
            <div className="space-y-1"><Label>最大值</Label><Input type="number" value={max} onChange={(e) => setMax(e.target.value)} /></div>
            <div className="space-y-1"><Label>步长</Label><Input type="number" min={0} value={step} onChange={(e) => setStep(e.target.value)} placeholder="1" /></div>
          </div>
        )}
        <div className="space-y-2 rounded-md border p-3">
          {[
            { label: "必填", v: required, set: setRequired },
            { label: "允许编辑（关闭后只显示，不能修改）", v: editable, set: setEditable },
            { label: "允许为空", v: allowEmpty && !required, set: setAllowEmpty, disabled: required },
            { label: "用图层当前值作为默认值", v: resetDefault, set: setResetDefault },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3">
              <Label className="font-normal">{r.label}</Label>
              <Switch checked={r.v} onCheckedChange={r.set} disabled={r.disabled} />
            </div>
          ))}
        </div>
      </div>
      <DialogFooter className="gap-2">
        {param && <Button variant="ghost" className="mr-auto text-destructive" onClick={remove}>删除参数</Button>}
        <Button onClick={save}>{param ? "保存" : "添加"}</Button>
      </DialogFooter>
    </>
  );
}
