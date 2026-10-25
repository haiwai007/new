import type { ImageFit } from "@/types/template.ts";

export type ImageGeometry = {
  cropX: number;
  cropY: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
};

/** Compute the Fabric image crop/scale that displays an image inside a box. */
export function computeImageGeometry(
  boxW: number,
  boxH: number,
  natW: number,
  natH: number,
  fit: ImageFit,
  focusX: number,
  focusY: number,
  zoom: number,
): ImageGeometry {
  if (fit === "stretch") {
    return { cropX: 0, cropY: 0, width: natW, height: natH, scaleX: boxW / natW, scaleY: boxH / natH };
  }
  if (fit === "contain") {
    const s = Math.min(boxW / natW, boxH / natH);
    return { cropX: 0, cropY: 0, width: natW, height: natH, scaleX: s, scaleY: s };
  }
  const boxAR = boxW / boxH;
  let sw = natW;
  let sh = natH;
  if (natW / natH > boxAR) sw = natH * boxAR;
  else sh = natW / boxAR;
  const z = Math.max(1, zoom);
  sw /= z;
  sh /= z;
  const s = boxW / sw;
  return {
    cropX: (natW - sw) * focusX,
    cropY: (natH - sh) * focusY,
    width: sw,
    height: sh,
    scaleX: s,
    scaleY: s,
  };
}
