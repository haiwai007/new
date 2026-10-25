import type { TemplateDoc } from "@/types/template";

/** Export the display contents, excluding the device's physical camera cutout.
 * Keep system UI (time, battery, date, home indicator) and leave the editable work intact.
 */
export function phoneScreenContent(doc: TemplateDoc): TemplateDoc {
  if (!doc.phone) return doc;
  const cutoutId = `${doc.phone.groupId}_cutout`;
  return {
    ...doc,
    phone: { ...doc.phone, showCutout: false },
    layers: doc.layers.filter((layer) => layer.id !== cutoutId),
    parameters: doc.parameters.filter(
      (parameter) => parameter.layerId !== cutoutId,
    ),
  };
}
