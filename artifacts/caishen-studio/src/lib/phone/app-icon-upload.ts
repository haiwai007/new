import { normalizeIconCanvas } from "./app-icon-normalize";
import { importImageFile } from "../image/import";
import { saveAsset } from "../storage/assets";
export const MAX_APP_ICON_BYTES = 2 * 1024 * 1024;
export const MAX_APP_ICON_DIMENSION = 1024;
export const APP_ICON_CANVAS_SIZE = 128;
/** Decode locally, preserve transparency/aspect ratio, and store a small portable PNG. */
export async function uploadAppIcon(file: File) {
  if (file.size > MAX_APP_ICON_BYTES) throw new Error("APP 图标不能超过 2MB");
  const image = await importImageFile(file);
  try {
    if (
      image.width > MAX_APP_ICON_DIMENSION ||
      image.height > MAX_APP_ICON_DIMENSION
    )
      throw new Error("APP 图标尺寸不能超过 1024×1024");
    const bitmap = await createImageBitmap(image.blob);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = APP_ICON_CANVAS_SIZE;
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("当前浏览器无法处理图片");
      const scale =
        APP_ICON_CANVAS_SIZE / Math.max(bitmap.width, bitmap.height);
      const w = bitmap.width * scale,
        h = bitmap.height * scale;
      ctx.drawImage(
        bitmap,
        (APP_ICON_CANVAS_SIZE - w) / 2,
        (APP_ICON_CANVAS_SIZE - h) / 2,
        w,
        h,
      );
      const normalized = normalizeIconCanvas(canvas);
      const blob = await new Promise<Blob>((resolve, reject) =>
        (normalized ?? canvas).toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("图标转换失败")),
          "image/png",
        ),
      );
      if (normalized) normalized.width = normalized.height = 0;
      return await saveAsset(blob, {
        name: image.name.replace(/\.[^.]+$/, "").slice(0, 40) || "APP 图标",
        width: APP_ICON_CANVAS_SIZE,
        height: APP_ICON_CANVAS_SIZE,
        category: "状态栏 APP 图标",
        scope: "internal",
      });
    } finally {
      bitmap.close();
      canvas.width = canvas.height = 0;
    }
  } finally {
    URL.revokeObjectURL(image.previewUrl);
  }
}
