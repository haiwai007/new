import type { TemplateDoc } from "../../types/template";
import { applyPhoneLayers, removePhoneLayers } from "../phone/layers";
import type { StatusLocation } from "./schema";
/** Work-only adjustments never write back to the source template. */
export function applyLocationToWork(
  doc: TemplateDoc,
  statusLocation: StatusLocation,
): TemplateDoc {
  const base = { ...removePhoneLayers(doc), statusLocation };
  if (statusLocation.state === "skipped" || !doc.phone) return base;
  const phone = {
    ...doc.phone,
    rendering: "natural" as const,
    placement: "overlay" as const,
    addedHeight: 0,
    scale: 100,
    offsetY: 0,
    insetX: 0,
    fusion: {
      ...doc.phone.fusion,
      enabled: true,
      handling: "manual" as const,
      locks: doc.phone.fusion.locks.filter(
        (k) => k !== "geometry" && k !== "coverage",
      ),
    },
  };
  try {
    return applyPhoneLayers(base, phone);
  } catch {
    return { ...base, phone };
  }
}
