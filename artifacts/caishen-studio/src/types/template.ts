import type { PhoneSettings } from "../lib/phone/schema";
// Core template data model. The template JSON is the single source of truth;
// the Fabric canvas is only a view rendered from it.

export const SCHEMA_VERSION = 1;

export type ImageSource =
  { kind: "asset"; assetId: string } | { kind: "url"; url: string };

export type LayoutRule = "relative" | "fixed";

export type Shadow = {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
};

type BaseLayer = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  editable: boolean;
  groupId: string | null;
  layout: LayoutRule;
};

export type TextAlign = "left" | "center" | "right" | "justify";
export type VerticalAlign = "top" | "middle" | "bottom";

export type TextLayer = BaseLayer & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  fill: string;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  lineHeight: number;
  letterSpacing: number;
  wrap: boolean;
  autoShrink: boolean;
  /** Let the box grow taller when text overflows (instead of shrinking the font). */
  autoGrow: boolean;
  minFontSize: number;
  maxLines: number;
  shadow: Shadow | null;
};

export type ImageFit = "cover" | "contain" | "stretch";

export type ImageLayer = BaseLayer & {
  type: "image";
  src: ImageSource | null;
  fit: ImageFit;
  focusX: number;
  focusY: number;
  cropZoom: number;
  radius: number;
  lockAspect: boolean;
  /** Pick the crop focus automatically (by image detail) whenever the picture is replaced. */
  autoFocus: boolean;
};

export type ShapeKind = "rect" | "ellipse" | "triangle" | "line";

export type ShapeLayer = BaseLayer & {
  type: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  shadow: Shadow | null;
  /** Masks cover parts of an original background image. */
  isMask: boolean;
};

export type Layer = TextLayer | ImageLayer | ShapeLayer;
export type LayerType = Layer["type"];

export type ParamInputType =
  | "text"
  | "multiline"
  | "number"
  | "date"
  | "image"
  | "color"
  | "font"
  | "fontSize"
  | "select"
  | "toggle"
  | "width"
  | "height"
  | "x"
  | "y"
  | "rotation"
  | "opacity";

export type BindableProperty =
  | "text"
  | "src"
  | "fill"
  | "fontFamily"
  | "fontSize"
  | "visible"
  | "x"
  | "y"
  | "width"
  | "height"
  | "rotation"
  | "opacity";

export type ParamValue = string | number | boolean | ImageSource | null;

export type ParamRules = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  /** Regular expression (source only) the text value must fully match. */
  pattern?: string;
  /** Message shown when `pattern` fails. */
  patternMessage?: string;
};

export type TemplateParameter = {
  id: string;
  name: string;
  type: ParamInputType;
  layerId: string;
  property: BindableProperty;
  defaultValue: ParamValue;
  required: boolean;
  editable: boolean;
  allowEmpty: boolean;
  rules: ParamRules;
  /** Section heading in the fill-in panel; empty = 未分组. */
  group: string;
  /** Short help text shown under the input. */
  description: string;
  /** Placeholder for text inputs. */
  placeholder: string;
};

export type ProcessingMode = "smart" | "background" | "manual";

export type TemplateSource = {
  originalAssetId: string;
  mode: ProcessingMode;
  originalWidth: number;
  originalHeight: number;
};

export type CanvasSettings = {
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage: ImageSource | null;
};

export type TemplateDoc = {
  /** Optional editable phone status-bar preset; rendered as ordinary layers. */
  phone?: PhoneSettings;
  schemaVersion: typeof SCHEMA_VERSION;
  templateId: string;
  name: string;
  canvas: CanvasSettings;
  layers: Layer[];
  parameters: TemplateParameter[];
  source: TemplateSource | null;
};
