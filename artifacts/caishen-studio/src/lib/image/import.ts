export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_DIMENSION = 8000;

export type ImportedImage = {
  blob: Blob;
  name: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  previewUrl: string;
};

export function formatLabel(mime: string): string {
  if (mime === "image/png") return "PNG";
  if (mime === "image/jpeg") return "JPEG";
  if (mime === "image/webp") return "WebP";
  return mime;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "仅支持 PNG、JPG、JPEG、WebP 格式的图片";
  }
  if (file.size > MAX_FILE_BYTES) return `图片不能超过 ${formatBytes(MAX_FILE_BYTES)}`;
  if (file.size === 0) return "图片文件为空";
  return null;
}

function decode(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("图片无法解码，文件可能已损坏"));
    img.src = url;
  });
}

export async function importImageFile(file: File): Promise<ImportedImage> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const previewUrl = URL.createObjectURL(file);
  try {
    const { width, height } = await decode(previewUrl);
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error(`图片尺寸不能超过 ${MAX_DIMENSION}×${MAX_DIMENSION} 像素`);
    }
    return {
      blob: file,
      name: file.name || "粘贴的图片",
      mime: file.type,
      size: file.size,
      width,
      height,
      previewUrl,
    };
  } catch (e) {
    URL.revokeObjectURL(previewUrl);
    throw e;
  }
}

/** Extract the first image from a clipboard paste event. */
export function imageFromClipboard(e: ClipboardEvent | React.ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) return new File([f], f.name || `粘贴图片.${f.type.split("/")[1] ?? "png"}`, { type: f.type });
    }
  }
  return null;
}
