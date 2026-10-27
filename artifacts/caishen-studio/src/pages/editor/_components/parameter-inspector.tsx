import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { edit, useEditor } from "@/stores/editor";
import {
  getParamValue,
  applyParamValue,
  PARAM_TYPE_LABEL,
  PROPERTY_FOR_TYPE,
  parameterNameError,
} from "@/lib/template/params";
import {
  defaultOrderRule,
  randomOrder,
  orderFromRank,
} from "@/lib/parameters/order";
import {
  parameterLayerIds,
  parameterPreviewDoc,
  setParameterDefault,
  imageDefaults,
} from "@/lib/parameters/document";
import { updateLayer, alignLayers } from "@/lib/template/doc-ops";
import { storeImageFile } from "../_lib/actions";
import type {
  Layer,
  ParamInputType,
  TemplateParameter,
} from "@/types/template";
import OrderRuleEditor from "@/components/parameters/order-rule-editor";
import ImageParameterInput from "@/components/parameters/image-parameter-input";
import TextProps from "./props/text-props";
import { NumberField, Section, ColorField, SliderField } from "./fields";
import ParamEditorDialog from "./param-editor-dialog";
export default function ParameterInspector() {
  const doc = useEditor((s) => s.doc),
    ids = useEditor((s) => s.selectedIds),
    active = useEditor((s) => s.activeParamId),
    values = useEditor((s) => s.previewValues),
    patches = useEditor((s) => s.previewPatches);
  const p =
    doc?.parameters.find(
      (p) =>
        p.id === active && parameterLayerIds(p).some((id) => ids.includes(id)),
    ) ??
    doc?.parameters.find((p) =>
      parameterLayerIds(p).some((id) => ids.includes(id)),
    );
  const [nameDraft, setNameDraft] = useState(""),
    [nameError, setNameError] = useState("");
  useEffect(() => {
    setNameDraft(p?.name ?? "");
    setNameError("");
  }, [p?.id, p?.name]);
  const view = useMemo(
    () => (doc ? parameterPreviewDoc(doc, values, patches) : null),
    [doc, values, patches],
  );
  if (!doc || !p || !view) return null;
  const layer =
    doc.layers.find(
      (l) => ids.includes(l.id) && parameterLayerIds(p).includes(l.id),
    ) ?? doc.layers.find((l) => l.id === p.layerId);
  if (!layer) return null;
  const display = view.layers.find((l) => l.id === layer.id) ?? layer;
  const isTrial = Object.prototype.hasOwnProperty.call(values, p.id);
  const change = (patch: Partial<TemplateParameter>) =>
    edit(
      (d) => ({
        ...d,
        parameters: d.parameters.map((q) =>
          q.id === p.id ? { ...q, ...patch } : q,
        ),
      }),
      {
        coalesceKey: `parameter-settings:${p.id}:${Object.keys(patch).join(",")}`,
      },
    );
  const set = (patch: Partial<Layer>, key?: string) => {
    if (
      "text" in patch &&
      typeof patch.text === "string" &&
      p.property === "text"
    ) {
      if (isTrial) useEditor.getState().setParamPreview(p.id, patch.text);
      else edit((d) => setParameterDefault(d, p, patch.text!));
      return;
    }
    const cropPatch =
      layer.type === "image" &&
      Object.keys(patch).some((k) =>
        ["focusX", "focusY", "cropZoom"].includes(k),
      );
    if (cropPatch && isTrial) {
      useEditor.getState().setPreviewPatch(layer.id, patch);
      return;
    }
    let nextPatch = { ...patch };
    if (layer.type === "image" && layer.lockAspect) {
      if (typeof patch.width === "number" && patch.height === undefined)
        nextPatch.height = (patch.width * layer.height) / layer.width;
      if (typeof patch.height === "number" && patch.width === undefined)
        nextPatch.width = (patch.height * layer.width) / layer.height;
    }
    if (
      layer.type === "image" &&
      p.imageRole === "avatar" &&
      layer.radius >= Math.min(layer.width, layer.height) / 2 - 1 &&
      ("width" in nextPatch || "height" in nextPatch)
    )
      nextPatch = {
        ...nextPatch,
        radius:
          Math.min(
            nextPatch.width ?? layer.width,
            nextPatch.height ?? layer.height,
          ) / 2,
      };
    edit(
      (d) => {
        const next = updateLayer(d, layer.id, nextPatch);
        const l = next.layers.find((l) => l.id === layer.id);
        return l?.type === "image"
          ? {
              ...next,
              parameters: next.parameters.map((q) =>
                q.id === p.id ? { ...q, imageDefaults: imageDefaults(l) } : q,
              ),
            }
          : next;
      },
      { coalesceKey: key ? `inspector:${p.id}:${key}` : undefined },
    );
  };
  const setDefault = (value: typeof p.defaultValue) => {
    edit((d) => setParameterDefault(d, p, value));
    useEditor.getState().clearParamPreview(p.id);
  };
  const changeType = (type: ParamInputType) => {
    let next = {
      ...p,
      type,
      property: PROPERTY_FOR_TYPE[type],
      order: type === "order" ? (p.order ?? defaultOrderRule()) : undefined,
    };
    if (type === "order" && p.type !== "order")
      next = { ...next, defaultValue: orderFromRank(next.order!, 0n) };
    edit((d) => {
      const updated = {
        ...d,
        parameters: d.parameters.map((q) => (q.id === p.id ? next : q)),
      };
      return applyParamValue(updated, next, next.defaultValue);
    });
    useEditor.getState().clearParamPreview(p.id);
  };
  return (
    <div aria-label="当前参数设置" className="min-w-0 pb-4">
      <Section title={`参数设置 · ${p.name}`}>
        <label className="block space-y-1 text-xs">
          参数名称
          <Input
            aria-label="当前参数名称"
            maxLength={80}
            value={nameDraft}
            onChange={(e) => {
              setNameDraft(e.target.value);
              setNameError("");
            }}
            onBlur={() => {
              const error = parameterNameError(nameDraft);
              if (error) setNameError(error);
              else if (nameDraft.trim() !== p.name)
                change({ name: nameDraft.trim() });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </label>
        {nameError && (
          <p role="alert" className="text-xs text-destructive">
            {nameError}
          </p>
        )}
        <label className="block space-y-1 text-xs">
          参数类型
          <select
            aria-label="当前参数类型"
            className="h-9 w-full rounded border bg-background px-2"
            value={p.type}
            onChange={(e) => changeType(e.target.value as ParamInputType)}
          >
            {(layer.type === "text"
              ? ["text", "multiline", "number", "order", "date", "select"]
              : layer.type === "image"
                ? ["image"]
                : [p.type]
            ).map((type) => (
              <option key={type} value={type}>
                {PARAM_TYPE_LABEL[type as ParamInputType]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-xs">
          填写提示
          <Input
            aria-label="参数填写提示"
            maxLength={100}
            value={p.placeholder}
            onChange={(e) => change({ placeholder: e.target.value })}
          />
        </label>
        <label className="block space-y-1 text-xs">
          填写说明
          <Input
            aria-label="参数填写说明"
            maxLength={200}
            value={p.description}
            onChange={(e) => change({ description: e.target.value })}
          />
        </label>
        {p.property === "text" && (
          <label className="block space-y-1 text-xs">
            正式默认内容
            <Input
              aria-label="参数正式默认内容"
              value={String(p.defaultValue ?? "")}
              onChange={(e) => setDefault(e.target.value)}
            />
          </label>
        )}
        <ParamEditorDialog param={p}>
          <Button size="sm" variant="ghost">
            更多参数规则与分组
          </Button>
        </ParamEditorDialog>
      </Section>
      {p.type === "order" && (
        <div className="px-3">
          <OrderRuleEditor
            value={p.order ?? defaultOrderRule()}
            onChange={(order) => change({ order })}
          />
        </div>
      )}
      {p.type === "number" && (
        <Section title="数字与金额规则">
          <NumberField
            label="金额保留小数位"
            value={p.rules.decimals ?? 0}
            min={0}
            max={8}
            onChange={(decimals) => {
              const rule = {
                ...p,
                rules: { ...p.rules, decimals: Math.round(decimals) },
              };
              edit((d) =>
                applyParamValue(
                  {
                    ...d,
                    parameters: d.parameters.map((q) =>
                      q.id === p.id ? rule : q,
                    ),
                  },
                  rule,
                  getParamValue(d, p),
                ),
              );
            }}
          />
        </Section>
      )}
      <Section title="当前画布试用">
        {p.type === "image" ? (
          <ImageParameterInput doc={doc} param={p} trial />
        ) : (
          <>
            <Input
              aria-label="参数临时示例"
              value={String(getParamValue(view, p) ?? "")}
              onChange={(e) =>
                useEditor.getState().setParamPreview(p.id, e.target.value)
              }
            />
            {p.type === "order" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  useEditor
                    .getState()
                    .setParamPreview(
                      p.id,
                      randomOrder(
                        p.order ?? defaultOrderRule(),
                        String(getParamValue(view, p) ?? ""),
                      ),
                    )
                }
              >
                随机示例
              </Button>
            )}
          </>
        )}
        {isTrial && (
          <p className="text-xs text-amber-700" role="status">
            临时示例，不写入默认值；保存和导出模板使用正式默认内容。
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={!isTrial}
            onClick={() => {
              edit((d) => setParameterDefault(d, p, values[p.id], patches));
              useEditor.getState().clearParamPreview(p.id);
            }}
          >
            设为默认值
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => useEditor.getState().clearParamPreview(p.id)}
          >
            恢复默认
          </Button>
        </div>
      </Section>
      <Section title="区域位置">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: "x", label: "参数 X" },
              { key: "y", label: "参数 Y" },
              { key: "width", label: "参数宽度" },
              { key: "height", label: "参数高度" },
            ] as const
          ).map((x) => (
            <NumberField
              key={x.key}
              label={x.label}
              value={layer[x.key]}
              min={x.key === "width" || x.key === "height" ? 1 : undefined}
              disabled={layer.locked}
              onChange={(v) => set({ [x.key]: v })}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            { label: "水平居中", a: "hcenter" },
            { label: "垂直居中", a: "vcenter" },
          ].map((x) => (
            <Button
              key={x.a}
              variant="ghost"
              size="sm"
              disabled={layer.locked}
              onClick={() =>
                edit((d) =>
                  alignLayers(d, [layer.id], x.a as "hcenter" | "vcenter"),
                )
              }
            >
              {x.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("haishen:focus-layer", {
                  detail: { id: layer.id, zoom: true },
                }),
              )
            }
          >
            放大到此区域
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {[-1, 1].map((step) => (
            <Button
              key={step}
              size="sm"
              variant="outline"
              disabled={layer.locked}
              onClick={() =>
                set({
                  x: layer.x - step,
                  y: layer.y - step,
                  width: Math.max(1, layer.width + step * 2),
                  height: Math.max(1, layer.height + step * 2),
                })
              }
            >
              {step === 1 ? "向外扩一圈" : "向内缩一圈"}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => set({ locked: !layer.locked })}
          >
            {layer.locked ? "解锁区域" : "锁定区域"}
          </Button>
        </div>
      </Section>
      {layer.type === "text" && (
        <TextProps
          layer={display.type === "text" ? display : layer}
          set={set}
        />
      )}
      {layer.type === "image" && (
        <Section title="图片样式">
          <label className="block space-y-1 text-xs">
            用途
            <select
              aria-label="图片参数用途"
              className="h-9 w-full rounded border bg-background px-2"
              value={p.imageRole ?? "image"}
              onChange={(e) => {
                const role = e.target.value as "avatar" | "logo" | "image";
                const side = Math.min(layer.width, layer.height);
                edit((d) => {
                  const next = updateLayer(d, layer.id, {
                    ...(role === "avatar"
                      ? {
                          x: layer.x + (layer.width - side) / 2,
                          y: layer.y + (layer.height - side) / 2,
                          width: side,
                          height: side,
                          radius: side / 2,
                          lockAspect: true,
                        }
                      : {}),
                    fit: role === "logo" ? "contain" : "cover",
                    containAlign: true,
                    containScale: layer.containScale ?? 1,
                  });
                  const l = next.layers.find((l) => l.id === layer.id)!;
                  return {
                    ...next,
                    parameters: next.parameters.map((q) =>
                      q.id === p.id
                        ? {
                            ...q,
                            imageRole: role,
                            imageDefaults:
                              l.type === "image" ? imageDefaults(l) : undefined,
                          }
                        : q,
                    ),
                  };
                });
              }}
            >
              <option value="avatar">头像</option>
              <option value="logo">Logo</option>
              <option value="image">普通图片</option>
            </select>
          </label>
          <label className="block space-y-1 text-xs">
            显示方式
            <select
              aria-label="图片参数显示方式"
              className="h-9 w-full rounded border bg-background px-2"
              value={layer.fit}
              onChange={(e) =>
                set({ fit: e.target.value as "cover" | "contain" | "stretch" })
              }
            >
              <option value="cover">铺满裁剪</option>
              <option value="contain">完整显示</option>
              <option value="stretch">拉伸</option>
            </select>
          </label>
          <label className="flex items-center justify-between text-xs">
            锁定比例
            <Switch
              aria-label="参数图片锁定比例"
              checked={layer.lockAspect}
              onCheckedChange={(lockAspect) => set({ lockAspect })}
            />
          </label>
          <div className="flex gap-1">
            {[
              { label: "正方形", ratio: 1 },
              { label: "横版 4:3", ratio: 4 / 3 },
              { label: "横版 16:9", ratio: 16 / 9 },
            ].map((x) => (
              <Button
                key={x.ratio}
                size="sm"
                variant="ghost"
                onClick={() => {
                  const height = layer.width / x.ratio;
                  set({
                    x: layer.x,
                    y: layer.y + (layer.height - height) / 2,
                    height,
                    width: layer.width,
                  });
                }}
              >
                {x.label}
              </Button>
            ))}
          </div>
          <NumberField
            label="参数图片圆角"
            value={layer.radius}
            min={0}
            onChange={(radius) => set({ radius })}
          />
          <NumberField
            label="参数图片边框粗细"
            value={p.imageBorder?.width ?? 0}
            min={0}
            max={200}
            onChange={(width) =>
              change({
                imageBorder: {
                  width,
                  color: p.imageBorder?.color ?? "#ffffff",
                },
              })
            }
          />
          <ColorField
            label="参数图片边框颜色"
            value={p.imageBorder?.color ?? "#ffffff"}
            onChange={(color) =>
              change({
                imageBorder: { color, width: p.imageBorder?.width ?? 0 },
              })
            }
          />
        </Section>
      )}
      <Section title="原内容处理">
        <label className="block text-xs">
          底图处理
          <select
            aria-label="参数底图处理"
            className="mt-1 h-9 w-full rounded border bg-background px-2"
            value={p.cleanup?.mode ?? "keep"}
            onChange={(e) =>
              change({
                cleanup: {
                  mode: e.target.value as "keep" | "solid" | "image",
                  color: p.cleanup?.color ?? "#ffffff",
                  src: p.cleanup?.src ?? null,
                  follow: p.cleanup?.follow ?? true,
                  rect: p.cleanup?.rect ?? {
                    x: layer.x,
                    y: layer.y,
                    width: layer.width,
                    height: layer.height,
                  },
                },
              })
            }
          >
            <option value="keep">保留底图</option>
            <option value="solid">纯色覆盖</option>
            <option value="image">自定义替换底图</option>
          </select>
        </label>
        {p.cleanup && p.cleanup.mode !== "keep" && (
          <>
            <ColorField
              label="参数覆盖底色"
              value={p.cleanup.color}
              onChange={(color) =>
                change({ cleanup: { ...p.cleanup!, color } })
              }
            />
            {p.cleanup.mode === "image" && (
              <label className="block text-xs">
                上传替换底图
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="上传参数替换底图"
                  className="mt-1 max-w-full text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) {
                      const workId = useEditor.getState().workId;
                      const a = await storeImageFile(file);
                      if (workId === useEditor.getState().workId)
                        change({
                          cleanup: {
                            ...p.cleanup!,
                            src: { kind: "asset", assetId: a.id },
                          },
                        });
                    }
                  }}
                />
              </label>
            )}
            <label className="flex items-center justify-between text-xs">
              清理范围跟随参数框
              <Switch
                aria-label="清理范围跟随参数框"
                checked={p.cleanup.follow}
                onCheckedChange={(follow) =>
                  change({
                    cleanup: {
                      ...p.cleanup!,
                      follow,
                      rect: follow
                        ? p.cleanup!.rect
                        : {
                            x: layer.x,
                            y: layer.y,
                            width: layer.width,
                            height: layer.height,
                          },
                    },
                  })
                }
              />
            </label>
            {!p.cleanup.follow && (
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <NumberField
                    key={key}
                    label={`清理范围 ${key}`}
                    min={key === "width" || key === "height" ? 1 : undefined}
                    value={p.cleanup!.rect[key]}
                    onChange={(value) =>
                      change({
                        cleanup: {
                          ...p.cleanup!,
                          rect: { ...p.cleanup!.rect, [key]: value },
                        },
                      })
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Section>
      <details className="mx-3 rounded border p-2">
        <summary className="cursor-pointer text-xs">更多显示设置</summary>
        <SliderField
          label="参数透明度"
          value={layer.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(opacity) => set({ opacity }, "opacity")}
        />
        <label className="flex items-center justify-between py-2 text-xs">
          作图中允许编辑
          <Switch
            checked={p.editable}
            onCheckedChange={(editable) => change({ editable })}
          />
        </label>
      </details>
    </div>
  );
}
