import type { TemplateDoc, TemplateParameter, TextLayer } from "../../types/template.ts";

export const titleParam: TemplateParameter = {
  id: "param-title",
  name: "主标题",
  type: "text",
  layerId: "layer-title",
  property: "text",
  defaultValue: "默认标题",
  required: true,
  editable: true,
  allowEmpty: false,
  rules: { maxLength: 32 },
  group: "内容",
  description: "",
  placeholder: "",
};

export function textLayer(id: string, text: string): TextLayer {
  return {
    id,
    name: id,
    type: "text",
    x: 0,
    y: 0,
    width: 280,
    height: 60,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    editable: true,
    groupId: null,
    layout: "fixed",
    text,
    fontFamily: "Arial",
    fontSize: 32,
    fontWeight: "normal",
    fontStyle: "normal",
    fill: "#222222",
    textAlign: "left",
    verticalAlign: "top",
    lineHeight: 1,
    letterSpacing: 0,
    wrap: true,
    autoShrink: false,
    autoGrow: false,
    minFontSize: 10,
    maxLines: 1,
    shadow: null,
  };
}

export function makeTemplate(extra: { layers?: TextLayer[]; parameters?: TemplateParameter[] } = {}): TemplateDoc {
  return {
    schemaVersion: 1,
    templateId: "template-1",
    name: "测试模板",
    canvas: { width: 600, height: 400, backgroundColor: "#ffffff", backgroundImage: null },
    layers: [textLayer("layer-title", "默认标题"), ...(extra.layers ?? [])],
    parameters: [titleParam, ...(extra.parameters ?? [])],
    source: null,
  };
}
