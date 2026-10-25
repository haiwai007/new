import { Input } from "@/components/ui/input";
import { uploadCoverRatio } from "@/lib/phone/upload-fit";
import { createImageLayer } from "@/lib/template/layers";
import type { UploadMode } from "../_lib/create-upload-template";
import { useEffect, useState } from "react";
import PhoneModelPicker from "@/components/phone/model-picker";
import { defaultPhoneSettings, applyPhoneLayers } from "@/lib/phone/layers";
import { settingsForModel } from "@/lib/phone/profiles";
import { phoneModel } from "@/lib/phone/models";
import { analyseStrip } from "@/lib/phone/match";
import { phoneScreenContent } from "@/lib/phone/export";
import { renderDoc } from "@/lib/canvas/render";
import { SCHEMA_VERSION, type TemplateDoc } from "@/types/template";
import type { PhoneSettings } from "@/lib/phone/schema";
import type { ImportedImage } from "@/lib/image/import";
function previewDoc(
  image: ImportedImage,
  size: { width: number; height: number },
  mode: UploadMode,
): TemplateDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    templateId: "upload-preview",
    name: "状态栏适配预览",
    canvas: {
      ...size,
      backgroundColor: "#ffffff",
      backgroundImage:
        mode === "manual" ? null : { kind: "url", url: image.previewUrl },
    },
    layers:
      mode === "manual"
        ? [
            createImageLayer(
              { x: 0, y: 0, ...size },
              { kind: "url", url: image.previewUrl },
              { opacity: 0.35, fit: "cover" },
            ),
          ]
        : [],
    parameters: [],
    source: null,
  };
}
export default function UploadPhone({
  image,
  size,
  phone,
  onChange,
  disabled,
  mode,
  onReadyChange,
}: {
  image: ImportedImage | null;
  size: { width: number; height: number } | null;
  phone: PhoneSettings | undefined;
  onChange: (value: PhoneSettings | undefined) => void;
  disabled: boolean;
  mode: UploadMode;
  onReadyChange: (ready: boolean) => void;
}) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [matching, setMatching] = useState(false);
  // Match the top strip once per model/image/size change, without modifying the source image.
  useEffect(() => {
    if (!image || !size || !phone) {
      onReadyChange(true);
      return;
    }
    let alive = true;
    setMatching(true);
    onReadyChange(false);
    const selected = phone;
    renderDoc(previewDoc(image, size, mode), {
      multiplier: Math.min(1, 400 / size.width),
    })
      .then(({ canvas }) => {
        try {
          const model = phoneModel(selected.modelId);
          const scale = Math.min(
            size.width / model.points,
            size.height / (model.bar + 40),
          );
          const height = Math.min(
            canvas.height,
            Math.max(
              1,
              Math.round((canvas.height * model.bar * scale) / size.height),
            ),
          );
          const pixels = canvas
            .getContext("2d", { willReadFrequently: true })
            ?.getImageData(0, 0, canvas.width, height).data;
          const sample = pixels ? analyseStrip(pixels) : null;
          if (alive && sample)
            onChange({
              ...selected,
              theme: sample.lightIcons ? "light" : "dark",
              backgroundColor: sample.background,
              transparent: false,
              coverRatio: uploadCoverRatio(image, size),
            });
        } finally {
          canvas.width = canvas.height = 0;
        }
      })
      .catch(() => {
        if (alive) setError("自动取色失败，将使用默认配色；可在编辑器中调整。");
      })
      .finally(() => {
        if (alive) {
          setMatching(false);
          onReadyChange(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [
    image,
    size?.width,
    size?.height,
    phone?.modelId,
    onChange,
    mode,
    onReadyChange,
  ]);
  useEffect(() => {
    if (!image || !size || !phone) {
      setPreview("");
      return;
    }
    let alive = true;
    setError("");
    const doc = applyPhoneLayers(previewDoc(image, size, mode), phone);
    renderDoc(phoneScreenContent(doc), {
      multiplier: Math.min(1, 600 / Math.max(size.width, size.height)),
    })
      .then(({ canvas, warnings }) => {
        try {
          if (alive) {
            setPreview(canvas.toDataURL("image/png"));
            if (warnings.length) setError(warnings.join("；"));
          }
        } finally {
          canvas.width = canvas.height = 0;
        }
      })
      .catch((error) => {
        if (alive)
          setError(error instanceof Error ? error.message : "状态栏预览失败");
      });
    return () => {
      alive = false;
    };
  }, [image, size?.width, size?.height, phone, mode]);
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-medium">手机型号与状态栏</h2>
      <PhoneModelPicker
        value={phone?.modelId}
        allowNone
        disabled={disabled || !image}
        onChange={(id) =>
          onChange(
            id
              ? settingsForModel(phone ?? defaultPhoneSettings(), id)
              : undefined,
          )
        }
      />
      {phone && (
        <>
          <label className="block space-y-1 text-xs">
            <span>覆盖原状态栏高度（图片高度的 %）</span>
            <Input
              aria-label="原状态栏覆盖比例"
              type="number"
              min={0}
              max={25}
              step={0.1}
              value={Math.round(phone.coverRatio * 1000) / 10}
              disabled={disabled || matching}
              onChange={(e) =>
                onChange({
                  ...phone,
                  coverRatio:
                    Math.max(0, Math.min(25, Number(e.target.value) || 0)) /
                    100,
                })
              }
            />
          </label>
          <p className="text-xs text-muted-foreground">
            自动按截图比例识别原顶栏高度，并以新配色覆盖旧图标。若图片经过裁剪或修改，可手动调整覆盖高度。
          </p>
          <p className="text-xs text-muted-foreground">
            选取后立即替换状态栏格式并自动匹配顶栏配色，按当前图片画布缩放，不裁切或拉伸图片。生成模板后仍可修改时间、电量和图标。
          </p>
          {matching && (
            <p role="status" className="text-xs text-muted-foreground">
              正在适配图片配色…
            </p>
          )}
          {preview && (
            <figure className="rounded-lg bg-muted p-2">
              <img
                src={preview}
                alt="手机状态栏适配预览"
                className="mx-auto max-h-80 max-w-full object-contain"
              />
              <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                {size?.width}×{size?.height} ·
                仅屏幕内容，不包含手机外壳和硬件开孔
              </figcaption>
            </figure>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
