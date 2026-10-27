import type {
  ImageLayer,
  ImageSource,
  Layer,
  ShapeKind,
  ShapeLayer,
  TextLayer,
} from "../../types/template.ts";
import { newId } from "./ids.ts";

type Box = { x: number; y: number; width: number; height: number };

const baseDefaults = {
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  editable: true,
  groupId: null,
  layout: "relative",
} as const;

export function createTextLayer(
  box: Box,
  overrides: Partial<Omit<TextLayer, "type" | "id">> = {},
  id = newId("text"),
): TextLayer {
  return {
    ...baseDefaults,
    ...box,
    id,
    type: "text",
    name: "文字",
    text: "双击编辑文字",
    fontFamily: "Noto Sans SC",
    fontSize: 48,
    fontWeight: "normal",
    fontStyle: "normal",
    fill: "#1f1f1f",
    textAlign: "left",
    verticalAlign: "top",
    lineHeight: 1.3,
    letterSpacing: 0,
    wrap: true,
    autoShrink: false,
    autoGrow: false,
    minFontSize: 12,
    maxLines: 0,
    shadow: null,
    ...overrides,
  };
}

export function createImageLayer(
  box: Box,
  src: ImageSource | null,
  overrides: Partial<Omit<ImageLayer, "type" | "id">> = {},
  id = newId("image"),
): ImageLayer {
  return {
    ...baseDefaults,
    ...box,
    id,
    type: "image",
    name: "图片",
    src,
    fit: "cover",
    focusX: 0.5,
    focusY: 0.5,
    cropZoom: 1,
    radius: 0,
    lockAspect: true,
    autoFocus: true,
    ...overrides,
  };
}

const SHAPE_NAMES: Record<ShapeKind, string> = {
  rect: "矩形",
  ellipse: "圆形",
  triangle: "三角形",
  line: "线条",
};

export function createShapeLayer(
  kind: ShapeKind,
  box: Box,
  overrides: Partial<Omit<ShapeLayer, "type" | "id">> = {},
  id = newId(kind),
): ShapeLayer {
  return {
    ...baseDefaults,
    ...box,
    id,
    type: kind,
    name: SHAPE_NAMES[kind],
    fill: kind === "line" ? "#1f1f1f" : "#e8b04a",
    stroke: "#1f1f1f",
    strokeWidth: 0,
    radius: 0,
    shadow: null,
    isMask: false,
    ...overrides,
  };
}

export const LAYER_TYPE_LABEL: Record<Layer["type"], string> = {
  text: "文字",
  image: "图片",
  rect: "矩形",
  ellipse: "圆形",
  triangle: "三角形",
  line: "线条",
};

export function isShape(layer: Layer): layer is ShapeLayer {
  return layer.type !== "text" && layer.type !== "image";
}
