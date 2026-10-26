import { z } from "zod";
import { phoneSettingsSchema } from "../phone/schema";
import {
  SCHEMA_VERSION,
  type TemplateDoc,
} from "../../types/template.ts";

// Zod schema with defaults so older / partial documents are upgraded on parse.

const imageSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("asset"), assetId: z.string().min(1) }),
  z.object({ kind: z.literal("url"), url: z.string().min(1) }),
]);

const shadow = z
  .object({
    color: z.string(),
    blur: z.number(),
    offsetX: z.number(),
    offsetY: z.number(),
  })
  .nullable()
  .default(null);

const base = {
  id: z.string().min(1),
  name: z.string().default("图层"),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  rotation: z.number().finite().default(0),
  opacity: z.number().min(0).max(1).default(1),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  editable: z.boolean().default(true),
  groupId: z.string().nullable().default(null),
  layout: z.enum(["relative", "fixed"]).default("relative"),
};

const textLayer = z.object({
  ...base,
  type: z.literal("text"),
  text: z.string(),
  fontFamily: z.string().default("Noto Sans SC"),
  fontSize: z.number().positive().default(32),
  fontWeight: z.enum(["normal", "bold"]).default("normal"),
  fontStyle: z.enum(["normal", "italic"]).default("normal"),
  fill: z.string().default("#222222"),
  textAlign: z.enum(["left", "center", "right", "justify"]).default("left"),
  verticalAlign: z.enum(["top", "middle", "bottom"]).default("top"),
  lineHeight: z.number().positive().default(1.3),
  letterSpacing: z.number().default(0),
  wrap: z.boolean().default(true),
  autoShrink: z.boolean().default(false),
  autoGrow: z.boolean().default(false),
  minFontSize: z.number().positive().default(10),
  maxLines: z.number().int().min(0).default(0),
  shadow,
});

const imageLayer = z.object({
  ...base,
  type: z.literal("image"),
  src: imageSource.nullable().default(null),
  fit: z.enum(["cover", "contain", "stretch"]).default("cover"),
  focusX: z.number().min(0).max(1).default(0.5),
  focusY: z.number().min(0).max(1).default(0.5),
  cropZoom: z.number().min(1).max(5).default(1),
  radius: z.number().min(0).default(0),
  lockAspect: z.boolean().default(false),
  // Off for documents saved before this option existed, so their crops don't shift.
  autoFocus: z.boolean().default(false),
  tint: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const shapeFields = {
  ...base,
  fill: z.string().default("#cccccc"),
  stroke: z.string().default("#000000"),
  strokeWidth: z.number().min(0).default(0),
  radius: z.number().min(0).default(0),
  shadow,
  isMask: z.boolean().default(false),
};

const layer = z.discriminatedUnion("type", [
  textLayer,
  imageLayer,
  z.object({ ...shapeFields, type: z.literal("rect") }),
  z.object({ ...shapeFields, type: z.literal("ellipse") }),
  z.object({ ...shapeFields, type: z.literal("triangle") }),
  z.object({ ...shapeFields, type: z.literal("line") }),
]);

const paramValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  imageSource,
  z.null(),
]);

const parameter = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum([
    "text",
    "multiline",
    "number",
    "date",
    "image",
    "color",
    "font",
    "fontSize",
    "select",
    "toggle",
    "width",
    "height",
    "x",
    "y",
    "rotation",
    "opacity",
  ]),
  layerId: z.string().min(1),
  property: z.enum([
    "text",
    "src",
    "fill",
    "fontFamily",
    "fontSize",
    "visible",
    "x",
    "y",
    "width",
    "height",
    "rotation",
    "opacity",
  ]),
  defaultValue: paramValue.default(null),
  required: z.boolean().default(false),
  editable: z.boolean().default(true),
  allowEmpty: z.boolean().default(true),
  rules: z
    .object({
      minLength: z.number().int().positive().optional(),
      maxLength: z.number().int().positive().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().positive().optional(),
      options: z.array(z.string()).optional(),
      pattern: z.string().max(500).optional(),
      patternMessage: z.string().max(200).optional(),
    })
    .default({}),
  group: z.string().max(40).default(""),
  description: z.string().max(200).default(""),
  placeholder: z.string().max(100).default(""),
});

export const templateDocSchema = z.object({
  phone: phoneSettingsSchema.optional(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  templateId: z.string().min(1),
  name: z.string().default("未命名"),
  canvas: z.object({
    width: z.number().int().min(16).max(8000),
    height: z.number().int().min(16).max(8000),
    backgroundColor: z.string().default("#ffffff"),
    backgroundImage: imageSource.nullable().default(null),
  }),
  layers: z.array(layer).max(2000),
  parameters: z.array(parameter).default([]),
  source: z
    .object({
      originalAssetId: z.string(),
      mode: z.enum(["smart", "background", "manual"]),
      originalWidth: z.number(),
      originalHeight: z.number(),
    })
    .nullable()
    .default(null),
});

// Compile-time check: parsed output must match the hand-written type.
type Parsed = z.infer<typeof templateDocSchema>;
const _typeCheck = (p: Parsed): TemplateDoc => p;
void _typeCheck;
