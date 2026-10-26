import { locationRenderKey } from "../status-location/model";
import type { TemplateDoc } from "../../types/template";

/** Export the display contents, excluding the device's physical camera cutout.
 * Keep system UI (time, battery, date, home indicator) and leave the editable work intact.
 */
export function phoneScreenContent(doc: TemplateDoc): TemplateDoc {
  if (!doc.phone) return doc;
  const cutoutId = `${doc.phone.groupId}_cutout`;
  const next: TemplateDoc = {
    ...doc,
    phone: { ...doc.phone, showCutout: false },
    layers: doc.layers.filter((layer) => layer.id !== cutoutId),
    parameters: doc.parameters.filter(
      (parameter) => parameter.layerId !== cutoutId,
    ),
  };
  // Removing the physical cutout is a trusted export-only transform. Keep the
  // validated status mask bound to the actual export document as well.
  if (doc.phone.locationKey && doc.phone.locationKey === locationRenderKey(doc))
    next.phone = { ...next.phone!, locationKey: locationRenderKey(next) };
  return next;
}
