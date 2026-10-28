import {defaultCardRule,cardSummary,randomCard} from "@/lib/parameters/card";
import DateParameterInput from "@/components/parameters/date-parameter-input";
import ImageParameterInput from "@/components/parameters/image-parameter-input";
import {defaultOrderRule,randomOrder,orderSummary} from "@/lib/parameters/order";
import ParameterManager from "./parameter-manager";
import ParameterNameEditor from "./parameter-name-editor";
import { ChevronDown, ChevronUp, ImagePlus, Lock, Plus, RotateCcw, Settings2, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { edit, useEditor } from "@/stores/editor.ts";
import {
  applyParamValue,
  getParamValue,
  groupParameters,
  moveParameter,
  resetParamsToDefault,
  suggestParameters,
  validateAll,
  validateParamValue,
} from "@/lib/template/params.ts";
import { FONTS } from "@/lib/canvas/fonts.ts";
import type { ParamValue, TemplateDoc, TemplateParameter } from "@/types/template.ts";
import { ColorField, SliderField } from "./fields.tsx";
import { pickFile, storeImageFile } from "../_lib/actions.ts";
import ParamEditorDialog from "./param-editor-dialog.tsx";

function ParamInput({ doc, param, first, last }: { doc: TemplateDoc; param: TemplateParameter; first: boolean; last: boolean }) {
  const value = getParamValue(doc, param);
  // Show the error for the current value; recomputed every render so edits from
  // anywhere (canvas, undo, reset) stay in sync.
  const error = validateParamValue(param, value);
  const layer = doc.layers.find((l) => l.id === param.layerId);
  const apply = (v: ParamValue) => {
    const err = validateParamValue(param, v);
    // Invalid values still preview so the user sees the effect, except empties.
    if (err && (v === null || v === "")) {
      toast.error(err);
      return;
    }
    edit((d) => applyParamValue(d, param, v), { coalesceKey: `param:${param.id}` });
  };
  const disabled = !param.editable;
  const str = typeof value === "string" ? value : value === null ? "" : String(value);

  let control: React.ReactNode;
  switch (param.type) {
    case "card":
      control=<div className="space-y-1"><div className="flex gap-1"><Input aria-label={param.name} value={str} disabled={disabled} onChange={e=>apply(e.target.value)}/><Button size="sm" variant="secondary" disabled={disabled} aria-label={`随机生成${param.name}`} onClick={()=>apply(randomCard(param.card??defaultCardRule(),str))}>随机生成</Button></div><p className="text-[11px] text-muted-foreground">{cardSummary(param.card??defaultCardRule())}</p></div>;
      break;
    case "order":
      control=<div className="space-y-1"><div className="flex gap-1"><Input aria-label={param.name} value={str} disabled={disabled} onChange={e=>apply(e.target.value)}/><Button size="sm" variant="secondary" disabled={disabled} aria-label={`随机生成${param.name}`} onClick={()=>apply(randomOrder(param.order??defaultOrderRule(),str))}>随机生成</Button></div><p className="text-[11px] text-muted-foreground">{orderSummary(param.order??defaultOrderRule())}</p></div>;
      break;
    case "multiline":
      control = <Textarea value={str} rows={3} disabled={disabled} onChange={(e) => apply(e.target.value)} className="text-sm" />;
      break;
    case "select":
      control = (
        <Select value={str} onValueChange={apply} disabled={disabled}>
          <SelectTrigger className="h-8 w-full text-sm"><SelectValue placeholder="请选择" /></SelectTrigger>
          <SelectContent>
            {(param.rules.options?.length ? param.rules.options : [str]).filter(Boolean).map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    case "date":
      control = <DateParameterInput name={param.name} value={str} initialPrecision={param.rules.datePrecision} disabled={disabled} onChange={(next,precision)=>{
        edit(d=>{
          const updated={...param,rules:{...param.rules,datePrecision:precision}};
          const doc={...d,parameters:d.parameters.map(p=>p.id===param.id?updated:p)};
          return applyParamValue(doc,updated,next);
        },{coalesceKey:`param:${param.id}`});
      }}/>;
      break;
    case "color":
      control = <ColorField label="" value={str || "#000000"} disabled={disabled} onChange={apply} />;
      break;
    case "font":
      control = (
        <Select value={str} onValueChange={apply} disabled={disabled}>
          <SelectTrigger className="h-8 w-full text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f.family} value={f.family}><span style={{ fontFamily: f.family }}>{f.label}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    case "toggle":
      control = (
        <div className="flex items-center justify-between rounded-md border px-3 py-1.5">
          <span className="text-sm">{value ? "显示" : "隐藏"}</span>
          <Switch checked={Boolean(value)} disabled={disabled} onCheckedChange={apply} />
        </div>
      );
      break;
    case "opacity":
      control = (
        <SliderField label="" value={Number(value ?? 1)} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} disabled={disabled} onChange={apply} />
      );
      break;
    case "image":
      control=<ImageParameterInput doc={doc} param={param} disabled={disabled}/>;
      break;
    case "number":
    case "fontSize":
    case "width":
    case "height":
    case "x":
    case "y":
    case "rotation":
      control = (
        <Input
          type={param.type === "number" ? "text" : "number"}
          inputMode={param.type === "number" ? "decimal" : undefined}
          value={str}
          disabled={disabled}
          min={param.rules.min}
          max={param.rules.max}
          step={param.rules.step}
          placeholder={param.placeholder || undefined}
          onChange={(e) => apply(param.type === "number" ? e.target.value : e.target.value === "" ? "" : Number(e.target.value))}
          className="h-8 text-sm"
        />
      );
      break;
    default:
      control = (
        <Input value={str} disabled={disabled} maxLength={param.rules.maxLength} placeholder={param.placeholder || undefined} onChange={(e) => apply(e.target.value)} className="h-8 text-sm" />
      );
  }

  return (
    <div className="space-y-1.5" aria-label={`参数${param.name}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-1 text-xs">
          <ParameterNameEditor param={param} />
          {param.required && <span className="text-primary"> *</span>}
          {!param.editable && <Lock className="ml-1 inline size-3 text-muted-foreground" />}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {param.rules.maxLength && typeof value === "string" && (
            <span className="text-[10px] text-muted-foreground">{[...value].length}/{param.rules.maxLength}</span>
          )}
          <button type="button" className="cursor-pointer text-muted-foreground opacity-0 hover:text-foreground disabled:opacity-20 group-hover:opacity-100" aria-label="上移" disabled={first} onClick={() => edit((d) => moveParameter(d, param.id, -1))}>
            <ChevronUp className="size-3.5" />
          </button>
          <button type="button" className="cursor-pointer text-muted-foreground opacity-0 hover:text-foreground disabled:opacity-20 group-hover:opacity-100" aria-label="下移" disabled={last} onClick={() => edit((d) => moveParameter(d, param.id, 1))}>
            <ChevronDown className="size-3.5" />
          </button>
          <ParamEditorDialog param={param}>
            <button type="button" className="cursor-pointer text-muted-foreground hover:text-foreground" aria-label="参数设置">
              <Settings2 className="size-3.5" />
            </button>
          </ParamEditorDialog>
        </div>
      </div>
      {control}
      {param.description && !error && <p className="text-[11px] text-muted-foreground">{param.description}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {!layer && <p className="text-[11px] text-destructive">关联的图层已不存在</p>}
    </div>
  );
}

export default function ParamsPanel() {
  const doc = useEditor((s) => s.doc);
  const selectedIds = useEditor((s) => s.selectedIds);
  const isTemplate=useEditor(s=>s.isTemplate);
  if (!doc) return null;
  if(isTemplate)return <ParameterManager/>;

  const suggest = (): void => {
    const s = suggestParameters(doc);
    if (s.length === 0) {
      toast("没有可以自动生成参数的文字或图片图层");
      return;
    }
    edit((d) => ({ ...d, parameters: [...d.parameters, ...s] }));
    toast.success(`已生成 ${s.length} 个参数，点击名称可重命名，齿轮可调整类型和规则`);
  };

  const selected = doc.layers.find((l) => l.id === selectedIds[0]);

  if (doc.parameters.length === 0) {
    return (
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon"><SlidersHorizontal /></EmptyMedia>
          <EmptyTitle>还没有模板参数</EmptyTitle>
          <EmptyDescription>把文字、图片、颜色设为参数后，就能在这里直接填表改图。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="gap-2">
          <Button size="sm" onClick={suggest}><Sparkles className="size-4" /> 自动生成参数</Button>
          {selected && (
            <ParamEditorDialog layer={selected}>
              <Button size="sm" variant="secondary"><Plus className="size-4" /> 为「{selected.name}」添加参数</Button>
            </ParamEditorDialog>
          )}
        </EmptyContent>
      </Empty>
    );
  }

  const errors = validateAll(doc);
  const groups = groupParameters(doc.parameters);
  const order = new Map(doc.parameters.map((p, i) => [p.id, i]));
  const lastIdx = doc.parameters.length - 1;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap gap-2">
        {doc.parameters.some(p=>p.type==="card"&&p.editable)&&<Button size="sm" variant="secondary" onClick={()=>edit(d=>d.parameters.filter(p=>p.type==="card"&&p.editable).reduce((next,p)=>applyParamValue(next,p,randomCard(p.card??defaultCardRule(),String(getParamValue(next,p)??""))),d))}>随机全部卡号</Button>}
        {doc.parameters.some(p=>p.type==="order"&&p.editable)&&<Button size="sm" variant="secondary" onClick={()=>edit(d=>d.parameters.filter(p=>p.type==="order"&&p.editable).reduce((next,p)=>applyParamValue(next,p,randomOrder(p.order??defaultOrderRule(),String(getParamValue(next,p)??""))),d))}>随机全部订单号</Button>}
        <Button size="sm" variant="secondary" onClick={() => edit(resetParamsToDefault)}>
          <RotateCcw className="size-4" /> 恢复默认值
        </Button>
        <Button size="sm" variant="ghost" onClick={suggest}>
          <Sparkles className="size-4" /> 补充参数
        </Button>
      </div>
      {selected && (
        <ParamEditorDialog layer={selected}>
          <Button size="sm" variant="ghost" className="w-full justify-start">
            <Plus className="size-4" /> 为「{selected.name}」添加参数
          </Button>
        </ParamEditorDialog>
      )}
      {errors.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
          <p className="font-medium">{errors.length} 个参数未通过校验</p>
          {errors.map((e) => <p key={e.paramId}>{e.message}</p>)}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">全部 {doc.parameters.length} 个参数校验通过</p>
      )}
      <p className="text-[11px] text-muted-foreground">点击参数名称旁的铅笔自定义名称，例如“活动标题”“商品价格”。名称用于填写表单与批量规则，不改变画面内容。</p>
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.group} className="space-y-3">
            <h3 className="border-b pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground">{g.group}</h3>
            {g.params.map((p) => {
              const idx = order.get(p.id) ?? 0;
              return (
                <div
                  key={p.id}
                  className="group rounded-lg p-1 transition-colors hover:bg-muted/50"
                  onMouseEnter={() => useEditor.getState().select([p.layerId])}
                >
                  <ParamInput doc={doc} param={p} first={idx === 0} last={idx === lastIdx} />
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="w-full text-muted-foreground"
        onClick={() => edit((d) => ({ ...d, parameters: [] }))}
      >
        <Trash2 className="size-4" /> 清空全部参数
      </Button>
    </div>
  );
}
