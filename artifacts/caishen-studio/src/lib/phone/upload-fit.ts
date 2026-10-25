import { PHONE_MODELS } from "./models";
/** Infer only screenshot-like aspect ratios; a cropped/non-phone image keeps the normal model bar. */
export function uploadCoverRatio(
  image: { width: number; height: number },
  canvas: { width: number; height: number },
): number {
  const ratio = image.height / image.width;
  if (ratio < 1.6 || ratio > 2.5) return 0;
  const nearest = [...PHONE_MODELS].sort(
    (a, b) =>
      Math.abs(a.height / a.width - ratio) -
      Math.abs(b.height / b.width - ratio),
  )[0];
  if (Math.abs(nearest.height / nearest.width - ratio) > 0.01) return 0;
  const scale = Math.max(
    canvas.width / image.width,
    canvas.height / image.height,
  );
  const cropTop = (image.height * scale - canvas.height) / 2;
  const bar = (image.width / nearest.points) * nearest.bar * scale;
  return Math.min(0.25, Math.max(0, (bar - cropTop) / canvas.height));
}
