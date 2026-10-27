import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { edit, useEditor } from "@/stores/editor";
import { storeImageFile } from "@/pages/editor/_lib/actions";
import { applyParamValue } from "@/lib/template/params";
import {
  parameterLayerIds,
  resetParameter,
  parameterPreviewDoc,
} from "@/lib/parameters/document";
import type { TemplateDoc, TemplateParameter, Layer } from "@/types/template";
export default function ImageParameterInput({
  doc,
  param,
  disabled = false,
  trial = false,
}: {
  doc: TemplateDoc;
  param: TemplateParameter;
  disabled?: boolean;
  trial?: boolean;
}) {
  const file = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [crop, setCrop] = useState(false);
  const values = useEditor((s) => s.previewValues),
    patches = useEditor((s) => s.previewPatches);
  const view = trial ? parameterPreviewDoc(doc, values, patches) : doc;
  const layer = view.layers.find((l) => l.id === param.layerId);
  const setCropPatch = (patch: Partial<Layer>) => {
    if (trial && Object.prototype.hasOwnProperty.call(values, param.id))
      for (const id of parameterLayerIds(param))
        useEditor.getState().setPreviewPatch(id, patch);
    else
      edit(
        (d) => ({
          ...d,
          layers: d.layers.map((l) =>
            parameterLayerIds(param).includes(l.id)
              ? ({ ...l, ...patch } as Layer)
              : l,
          ),
        }),
        { coalesceKey: `crop:${param.id}` },
      );
  };
  return (
    <div className="space-y-2">
      <input
        ref={file}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={`上传${param.name}`}
        disabled={disabled || busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const workId = useEditor.getState().workId;
          setBusy(true);
          try {
            const asset = await storeImageFile(f);
            if (useEditor.getState().workId !== workId) return;
            const src = { kind: "asset" as const, assetId: asset.id };
            if (trial) {
              useEditor.getState().clearParamPreview(param.id);
              useEditor.getState().setParamPreview(param.id, src);
            } else edit((d) => applyParamValue(d, param, src));
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "图片上传失败");
          } finally {
            setBusy(false);
          }
        }}
      />
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || busy}
          onClick={() => file.current?.click()}
        >
          {busy ? "上传中…" : trial ? "上传示例图片" : "上传图片"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => setCrop(!crop)}
        >
          {param.imageRole === "logo" ? "调整位置" : "调整裁剪"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => {
            if (trial) useEditor.getState().clearParamPreview(param.id);
            else edit((d) => resetParameter(d, param));
          }}
        >
          恢复默认
        </Button>
      </div>
      {crop && layer?.type === "image" && (
        <div className="space-y-2 rounded border p-2">
          <p className="text-xs text-muted-foreground">
            拖动滑块取景；也可开启画布裁剪后拖动图片。
          </p>
          {[
            { key: "focusX", label: "水平焦点", min: 0, max: 1, step: 0.01 },
            { key: "focusY", label: "垂直焦点", min: 0, max: 1, step: 0.01 },
            {
              key: layer.fit === "contain" ? "containScale" : "cropZoom",
              label: layer.fit === "contain" ? "框内缩放" : "裁剪缩放",
              min: layer.fit === "contain" ? 0.1 : 1,
              max: layer.fit === "contain" ? 1 : 5,
              step: 0.05,
            },
          ].map(({ key, label, min, max, step }) => (
            <label className="block text-xs" key={key}>
              {label}
              <Input
                aria-label={`${param.name}${label}`}
                type="range"
                min={min}
                max={max}
                step={step}
                value={
                  layer[
                    key as "focusX" | "focusY" | "cropZoom" | "containScale"
                  ] ?? 1
                }
                onChange={(e) =>
                  setCropPatch({
                    [key]: Number(e.target.value),
                    autoFocus: false,
                  })
                }
              />
            </label>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              useEditor.getState().select([param.layerId]);
              useEditor
                .getState()
                .setDrawOptions({ cropMode: !useEditor.getState().cropMode });
            }}
          >
            开启／结束画布裁剪
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setCropPatch({
                focusX: 0.5,
                focusY: 0.5,
                cropZoom: 1,
                containScale: 1,
                autoFocus: false,
              })
            }
          >
            重置裁剪
          </Button>
        </div>
      )}
    </div>
  );
}
