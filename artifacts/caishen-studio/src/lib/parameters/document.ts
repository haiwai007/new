import type {
  Layer,
  TemplateDoc,
  TemplateParameter,
  ParamValue,
  ImageLayer,
} from "../../types/template";
import {
  createParameter,
  applyParamValue,
  getParamValue,
} from "../template/params";
import {
  createTextLayer,
  createImageLayer,
  createShapeLayer,
} from "../template/layers";
import { cloneLayers } from "../template/doc-ops";
import { newId } from "../template/ids";
import { defaultOrderRule, orderFromRank } from "./order";
export type RegionKind =
  "text" | "number" | "order" | "avatar" | "logo" | "image";
export type RegionBox = { x: number; y: number; width: number; height: number };
export const parameterLayerIds = (p: TemplateParameter) => [
  p.layerId,
  ...(p.linkedLayerIds ?? []),
];
export function imageDefaults(layer: ImageLayer) {
  return {
    fit: layer.fit,
    containAlign: layer.containAlign,
    containScale: layer.containScale,
    focusX: layer.focusX,
    focusY: layer.focusY,
    cropZoom: layer.cropZoom,
    radius: layer.radius,
  };
}
export function createRegionParameter(
  doc: TemplateDoc,
  box: RegionBox,
  kind: RegionKind,
  bindingId?: string,
): { doc: TemplateDoc; layerId: string; paramId: string } {
  const bound = doc.parameters.find((p) => p.id === bindingId);
  const source = bound && doc.layers.find((l) => l.id === bound.layerId);
  let layer: Layer;
  if (source) {
    const side = Math.min(box.width, box.height);
    const shape =
      source.type === "image" && bound?.imageRole === "avatar"
        ? {
            x: box.x + (box.width - side) / 2,
            y: box.y + (box.height - side) / 2,
            width: side,
            height: side,
            radius: side / 2,
          }
        : box;
    layer = {
      ...source,
      ...shape,
      id: newId(source.type),
      name: `${bound!.name} 显示位置`,
      locked: false,
      groupId: null,
    };
  } else if (["avatar", "logo", "image"].includes(kind)) {
    const square = kind === "avatar" ? Math.min(box.width, box.height) : null;
    const frame = square
      ? {
          x: box.x + (box.width - square) / 2,
          y: box.y + (box.height - square) / 2,
          width: square,
          height: square,
        }
      : box;
    layer = createImageLayer(frame, null, {
      name: kind === "avatar" ? "头像" : kind === "logo" ? "Logo" : "图片",
      fit: kind === "logo" ? "contain" : "cover",
      lockAspect: kind === "avatar",
      radius: kind === "avatar" ? frame.width / 2 : 0,
      autoFocus: false,
      containAlign: true,
      containScale: 1,
    });
  } else
    layer = createTextLayer(box, {
      name: kind === "order" ? "订单号" : kind === "number" ? "金额" : "文字",
      text:
        kind === "order"
          ? orderFromRank(defaultOrderRule(), 0n)
          : kind === "number"
            ? "0.00"
            : "输入文字",
      fontSize: Math.max(1, Math.round(box.height * 0.65)),
      minFontSize: Math.max(1, Math.min(12, box.height * 0.4)),
      fontFamily: "Noto Sans SC",
      autoShrink: true,
      wrap: false,
      verticalAlign: "middle",
    });
  let next = { ...doc, layers: [...doc.layers, layer] };
  if (bound) {
    next = {
      ...next,
      parameters: doc.parameters.map((p) =>
        p.id === bound.id
          ? { ...p, linkedLayerIds: [...(p.linkedLayerIds ?? []), layer.id] }
          : p,
      ),
    };
    return { doc: next, layerId: layer.id, paramId: bound.id };
  }
  let p = createParameter(
    next,
    layer,
    layer.type === "image"
      ? "image"
      : kind === "order"
        ? "order"
        : kind === "number"
          ? "number"
          : "text",
    `${layer.name} ${doc.parameters.length + 1}`,
  );
  p = {
    ...p,
    ...(layer.type === "image"
      ? {
          imageRole: kind as "avatar" | "logo" | "image",
          imageDefaults: imageDefaults(layer),
        }
      : {}),
    ...(kind === "number" ? { rules: { ...p.rules, decimals: 2 } } : {}),
    cleanup: {
      mode: "keep",
      color: "#ffffff",
      src: null,
      follow: true,
      rect: { ...box },
    },
  };
  next = { ...next, parameters: [...doc.parameters, p] };
  return { doc: next, layerId: layer.id, paramId: p.id };
}
export function duplicateParameter(
  doc: TemplateDoc,
  id: string,
  linked = false,
): TemplateDoc {
  const p = doc.parameters.find((p) => p.id === id);
  if (!p) return doc;
  const source = doc.layers.find((l) => l.id === p.layerId);
  if (!source) return doc;
  const [copy] = cloneLayers([source]);
  if (linked)
    return {
      ...doc,
      layers: [...doc.layers, copy],
      parameters: doc.parameters.map((q) =>
        q.id === id
          ? { ...q, linkedLayerIds: [...(q.linkedLayerIds ?? []), copy.id] }
          : q,
      ),
    };
  const next = {
    ...p,
    id: newId("param"),
    layerId: copy.id,
    linkedLayerIds: [],
    name: `${p.name} 副本`,
    cleanup: p.cleanup
      ? {
          ...p.cleanup,
          rect: {
            ...p.cleanup.rect,
            x: p.cleanup.rect.x + 20,
            y: p.cleanup.rect.y + 20,
          },
        }
      : undefined,
  };
  return {
    ...doc,
    layers: [...doc.layers, copy],
    parameters: [...doc.parameters, next],
  };
}
export function resetParameter(
  doc: TemplateDoc,
  p: TemplateParameter,
): TemplateDoc {
  const next = applyParamValue(doc, p, p.defaultValue);
  return {
    ...next,
    layers: next.layers.map((l) =>
      parameterLayerIds(p).includes(l.id) &&
      l.type === "image" &&
      p.imageDefaults
        ? { ...l, ...p.imageDefaults, radius: l.radius }
        : l,
    ),
  };
}
/** Derived cleanup layers are never saved over the original image or duplicated into the document. */
export function parameterRenderDoc(
  doc: TemplateDoc,
  interactive = false,
): TemplateDoc {
  if (
    !doc.parameters.some(
      (p) =>
        (p.cleanup?.mode !== "keep" && p.cleanup) ||
        p.imageRole ||
        p.imageBorder,
    )
  )
    return doc;
  const layers: Layer[] = [];
  for (const layer of doc.layers) {
    const p = doc.parameters.find(
      (p) =>
        parameterLayerIds(p).includes(layer.id) &&
        (p.property === "text" || p.property === "src"),
    );
    const emptyImage = layer.type === "image" && p?.imageRole && !layer.src;
    if (p?.cleanup && p.cleanup.mode !== "keep" && !emptyImage) {
      const c = p.cleanup,
        r = c.follow ? layer : c.rect;
      const cleanup =
        c.mode === "image" && c.src
          ? createImageLayer(r, c.src, { fit: "stretch" })
          : createShapeLayer("rect", r, {
              fill: c.color,
              strokeWidth: 0,
              isMask: true,
            });
      layers.push({
        ...cleanup,
        id: `${p.id}_cleanup_${layer.id}`,
        name: `${p.name} 底图清理`,
        locked: true,
        editable: false,
        visible: layer.visible,
        opacity: layer.opacity,
        rotation: c.follow ? layer.rotation : 0,
      });
    }
    layers.push(
      emptyImage
        ? { ...layer, opacity: 0, visible: interactive ? layer.visible : false }
        : layer,
    );
    if (layer.type === "image" && p?.imageBorder?.width && !emptyImage) {
      const border = createShapeLayer("rect", layer, {
        fill: "transparent",
        stroke: p.imageBorder.color,
        strokeWidth: p.imageBorder.width,
        radius: layer.radius,
      });
      layers.push({
        ...border,
        id: `${p.id}_border_${layer.id}`,
        name: `${p.name} 边框`,
        locked: true,
        editable: false,
        visible: layer.visible,
        opacity: layer.opacity,
        rotation: layer.rotation,
      });
    }
  }
  return { ...doc, layers };
}
export function setParameterDefault(
  doc: TemplateDoc,
  p: TemplateParameter,
  value: ParamValue,
  patches: Record<string, Partial<Layer>> = {},
): TemplateDoc {
  let next = applyParamValue(doc, p, value);
  next = {
    ...next,
    layers: next.layers.map((l) =>
      parameterLayerIds(p).includes(l.id) && patches[l.id]
        ? ({ ...l, ...patches[l.id] } as Layer)
        : l,
    ),
  };
  const layer = next.layers.find((l) => l.id === p.layerId);
  return {
    ...next,
    parameters: next.parameters.map((q) =>
      q.id === p.id
        ? {
            ...q,
            defaultValue: getParamValue(next, q),
            ...(layer?.type === "image"
              ? { imageDefaults: imageDefaults(layer) }
              : {}),
          }
        : q,
    ),
  };
}
export function parameterPreviewDoc(
  doc: TemplateDoc,
  values: Record<string, ParamValue>,
  patches: Record<string, Partial<Layer>>,
): TemplateDoc {
  const next = Object.keys(values).length
    ? Object.entries(values).reduce((d, [id, value]) => {
        const p = d.parameters.find((p) => p.id === id);
        return p ? applyParamValue(d, p, value) : d;
      }, doc)
    : doc;
  return Object.keys(patches).length
    ? {
        ...next,
        layers: next.layers.map((l) =>
          patches[l.id] ? ({ ...l, ...patches[l.id] } as Layer) : l,
        ),
      }
    : next;
}

/** Removing a field must keep its currently visible artwork, including cleanup. */
export function removeParameterBinding(
  doc: TemplateDoc,
  id: string,
): TemplateDoc {
  const p = doc.parameters.find((p) => p.id === id);
  if (!p) return doc;
  const artwork = parameterRenderDoc({ ...doc, parameters: [p] });
  return {
    ...doc,
    layers: artwork.layers,
    parameters: doc.parameters.filter((p) => p.id !== id),
  };
}
/** Keep circular frames circular after direct canvas resize, without changing picture defaults in works. */
export function normalizeParameterGeometry(
  doc: TemplateDoc,
  previous: TemplateDoc,
  isTemplate: boolean,
): TemplateDoc {
  let layers = doc.layers.map((layer) => {
    if (layer.type !== "image") return layer;
    const old = previous.layers.find((l) => l.id === layer.id),
      p = doc.parameters.find((p) => parameterLayerIds(p).includes(layer.id));
    if (
      p?.imageRole === "avatar" &&
      old?.type === "image" &&
      old.radius >= Math.min(old.width, old.height) / 2 - 0.01 &&
      layer.radius === old.radius &&
      (layer.width !== old.width || layer.height !== old.height)
    )
      return { ...layer, radius: Math.min(layer.width, layer.height) / 2 };
    return layer;
  });
  const parameters = doc.parameters.map((p) => {
    if (!p.imageDefaults) return p;
    const current = layers.find((l) => l.id === p.layerId),
      old = previous.layers.find((l) => l.id === p.layerId);
    if (current?.type !== "image" || old?.type !== "image" || current === old)
      return p;
    if (isTemplate) return { ...p, imageDefaults: imageDefaults(current) };
    if (current.width !== old.width || current.height !== old.height)
      return {
        ...p,
        imageDefaults: {
          ...p.imageDefaults,
          radius:
            p.imageDefaults.radius *
            Math.min(current.width / old.width, current.height / old.height),
        },
      };
    return p;
  });
  return layers.some((l, i) => l !== doc.layers[i]) ||
    parameters.some((p, i) => p !== doc.parameters[i])
    ? { ...doc, layers, parameters }
    : doc;
}
