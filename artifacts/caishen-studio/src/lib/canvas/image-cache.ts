import { resolveImageUrl } from "../storage/assets.ts";
import type { ImageSource } from "../../types/template.ts";

const cache = new Map<string, Promise<HTMLImageElement>>();

export function sourceKey(src: ImageSource): string {
  return src.kind === "asset" ? `asset:${src.assetId}` : `url:${src.url}`;
}

function loadElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed so remote images don't taint the canvas and block export.
    if (!url.startsWith("blob:") && !url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = url;
  });
}

export function loadImage(src: ImageSource): Promise<HTMLImageElement> {
  const key = sourceKey(src);
  let p = cache.get(key);
  if (!p) {
    p = resolveImageUrl(src).then(loadElement);
    // Don't cache failures so a retry can succeed.
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}
