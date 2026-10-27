import type { Layer, TemplateDoc, TemplateParameter } from "../../types/template.ts";
import { createImageLayer, createShapeLayer, createTextLayer } from "./layers.ts";
import { defaultGroupFor } from "./params.ts";
import { SCHEMA_VERSION } from "../../types/template.ts";

export type TemplateCategory =
  | "poster"
  | "social"
  | "ecommerce"
  | "notice"
  | "festival"
  | "general"
  | "blank";

export const CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: "poster", label: "宣传海报" },
  { id: "social", label: "社交媒体配图" },
  { id: "ecommerce", label: "电商商品图片" },
  { id: "notice", label: "活动通知" },
  { id: "festival", label: "节日祝福" },
  { id: "general", label: "通用图文设计" },
  { id: "blank", label: "空白画布" },
];

export type BuiltinTemplate = {
  id: string;
  name: string;
  tags?: string[];
  description?: string;
  category: TemplateCategory;
  popularity: number;
  addedAt: string;
  doc: TemplateDoc;
};

type Box = { x: number; y: number; width: number; height: number };

// Helpers that keep stable, readable ids so built-in parameters bind reliably.
const text = (id: string, box: Box, o: Parameters<typeof createTextLayer>[1]): Layer => ({
  ...createTextLayer(box, o),
  id,
});
const img = (id: string, box: Box, url: string, o: Parameters<typeof createImageLayer>[2] = {}): Layer => ({
  ...createImageLayer(box, { kind: "url", url }, o),
  id,
});
const shape = (
  id: string,
  kind: Parameters<typeof createShapeLayer>[0],
  box: Box,
  o: Parameters<typeof createShapeLayer>[2],
): Layer => ({ ...createShapeLayer(kind, box, o), id });

function param(
  id: string,
  name: string,
  type: TemplateParameter["type"],
  layerId: string,
  property: TemplateParameter["property"],
  defaultValue: TemplateParameter["defaultValue"],
  rules: TemplateParameter["rules"] = {},
  required = false,
): TemplateParameter {
  return {
    id,
    name,
    type,
    layerId,
    property,
    defaultValue,
    required,
    editable: true,
    allowEmpty: !required,
    rules,
    group: defaultGroupFor(type),
    description: "",
    placeholder: "",
  };
}

function doc(
  templateId: string,
  name: string,
  width: number,
  height: number,
  backgroundColor: string,
  layers: Layer[],
  parameters: TemplateParameter[],
): TemplateDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    templateId,
    name,
    canvas: { width, height, backgroundColor, backgroundImage: null },
    layers,
    parameters,
    source: null,
  };
}

const U = (id: string) => `/templates/unsplash/${id}.jpg`;

const coffee = doc(
  "bt_coffee",
  "咖啡新品海报",
  1080,
  1350,
  "#f3ead9",
  [
    img("img_hero", { x: 0, y: 0, width: 1080, height: 820 }, U("photo-1506188044630-210826194885"), { name: "主图" }),
    shape("rect_band", "rect", { x: 0, y: 760, width: 1080, height: 590 }, { name: "底部色块", fill: "#2b1d14" }),
    text("text_tag", { x: 80, y: 820, width: 400, height: 50 }, {
      name: "标签", text: "秋季限定 · NEW", fontSize: 32, fill: "#e8b04a", fontWeight: "bold", letterSpacing: 4,
    }),
    text("text_title", { x: 80, y: 890, width: 920, height: 200 }, {
      name: "主标题", text: "桂花燕麦拿铁", fontSize: 108, fill: "#fdf6ea", fontFamily: "Noto Serif SC", fontWeight: "bold", autoShrink: true, minFontSize: 48, maxLines: 1,
    }),
    text("text_sub", { x: 80, y: 1080, width: 700, height: 110 }, {
      name: "副标题", text: "一口秋天的香气\n燕麦奶 × 手工桂花酱", fontSize: 36, fill: "#d9cbb4", lineHeight: 1.5,
    }),
    shape("rect_price", "rect", { x: 760, y: 1110, width: 240, height: 140 }, { name: "价格底", fill: "#e8b04a", radius: 20 }),
    text("text_price", { x: 760, y: 1135, width: 240, height: 90 }, {
      name: "价格", text: "¥28", fontSize: 72, fill: "#2b1d14", fontWeight: "bold", textAlign: "center", verticalAlign: "middle",
    }),
  ],
  [
    param("p_title", "主标题", "text", "text_title", "text", "桂花燕麦拿铁", { maxLength: 12 }, true),
    param("p_sub", "副标题", "multiline", "text_sub", "text", "一口秋天的香气\n燕麦奶 × 手工桂花酱", { maxLength: 40 }),
    param("p_price", "价格", "text", "text_price", "text", "¥28", { maxLength: 6 }),
    param("p_hero", "主图", "image", "img_hero", "src", { kind: "url", url: U("photo-1506188044630-210826194885") }),
    param("p_band", "底部颜色", "color", "rect_band", "fill", "#2b1d14"),
    param("p_tag_show", "显示标签", "toggle", "text_tag", "visible", true),
  ],
);

const travel = doc(
  "bt_travel",
  "旅行社交配图",
  1080,
  1080,
  "#0f2a2e",
  [
    img("img_bg", { x: 0, y: 0, width: 1080, height: 1080 }, U("photo-1439853949127-fa647821eba0"), { name: "背景照片" }),
    shape("rect_shade", "rect", { x: 0, y: 620, width: 1080, height: 460 }, { name: "暗色遮罩", fill: "#0b1d20", opacity: 0.72 }),
    text("text_place", { x: 70, y: 670, width: 940, height: 140 }, {
      name: "地点", text: "露易丝湖", fontSize: 112, fill: "#ffffff", fontFamily: "Noto Serif SC", fontWeight: "bold", autoShrink: true, minFontSize: 40, maxLines: 1,
    }),
    text("text_quote", { x: 70, y: 830, width: 940, height: 110 }, {
      name: "文案", text: "把日子过成山和湖的样子", fontSize: 44, fill: "#d2ece8",
    }),
    text("text_date", { x: 70, y: 970, width: 600, height: 50 }, {
      name: "日期", text: "2026-10-01", fontSize: 30, fill: "#9cc9c2", letterSpacing: 3,
    }),
  ],
  [
    param("p_place", "地点", "text", "text_place", "text", "露易丝湖", { maxLength: 10 }, true),
    param("p_quote", "文案", "text", "text_quote", "text", "把日子过成山和湖的样子", { maxLength: 30 }),
    param("p_date", "日期", "date", "text_date", "text", "2026-10-01"),
    param("p_bg", "背景照片", "image", "img_bg", "src", { kind: "url", url: U("photo-1439853949127-fa647821eba0") }),
    param("p_shade", "遮罩透明度", "opacity", "rect_shade", "opacity", 0.72, { min: 0, max: 1 }),
  ],
);

const product = doc(
  "bt_product",
  "护肤品主图",
  800,
  800,
  "#f7eee9",
  [
    shape("ell_glow", "ellipse", { x: 140, y: 120, width: 520, height: 520 }, { name: "光晕圆", fill: "#efd3c7" }),
    img("img_product", { x: 200, y: 140, width: 400, height: 460 }, U("photo-1667769462514-1fd738b38498"), { name: "商品图", radius: 24 }),
    shape("rect_badge", "rect", { x: 40, y: 40, width: 200, height: 76 }, { name: "角标底", fill: "#c8102e", radius: 38 }),
    text("text_badge", { x: 40, y: 52, width: 200, height: 52 }, {
      name: "角标", text: "爆款直降", fontSize: 30, fill: "#ffffff", fontWeight: "bold", textAlign: "center", verticalAlign: "middle",
    }),
    text("text_name", { x: 40, y: 625, width: 720, height: 64 }, {
      name: "商品名", text: "玻尿酸水润精华 30ml", fontSize: 44, fill: "#3a2a24", fontWeight: "bold", textAlign: "center", autoShrink: true, minFontSize: 24, maxLines: 1,
    }),
    text("text_price", { x: 40, y: 700, width: 720, height: 70 }, {
      name: "价格", text: "到手价 ¥139", fontSize: 52, fill: "#c8102e", fontWeight: "bold", textAlign: "center",
    }),
  ],
  [
    param("p_name", "商品名", "text", "text_name", "text", "玻尿酸水润精华 30ml", { maxLength: 24 }, true),
    param("p_price", "价格", "text", "text_price", "text", "到手价 ¥139", { maxLength: 12 }),
    param("p_badge", "角标文字", "select", "text_badge", "text", "爆款直降", { options: ["爆款直降", "新品上市", "限时秒杀", "买一送一"] }),
    param("p_img", "商品图", "image", "img_product", "src", { kind: "url", url: U("photo-1667769462514-1fd738b38498") }),
    param("p_glow", "光晕颜色", "color", "ell_glow", "fill", "#efd3c7"),
  ],
);

const notice = doc(
  "bt_notice",
  "活动通知",
  1080,
  1920,
  "#fbf7f0",
  [
    shape("rect_top", "rect", { x: 0, y: 0, width: 1080, height: 640 }, { name: "顶部色块", fill: "#c8102e" }),
    text("text_kicker", { x: 90, y: 150, width: 900, height: 60 }, {
      name: "眉题", text: "NOTICE · 活动通知", fontSize: 38, fill: "#ffd9a0", letterSpacing: 6, fontWeight: "bold",
    }),
    text("text_title", { x: 90, y: 240, width: 900, height: 300 }, {
      name: "主标题", text: "年度会员\n答谢沙龙", fontSize: 128, fill: "#ffffff", fontFamily: "Noto Serif SC", fontWeight: "bold", lineHeight: 1.15, autoShrink: true, minFontSize: 60, maxLines: 2,
    }),
    img("img_photo", { x: 90, y: 560, width: 900, height: 520 }, U("photo-1522071820081-009f0129c71c"), { name: "活动照片", radius: 28 }),
    text("text_time_l", { x: 90, y: 1170, width: 200, height: 50 }, { name: "时间标签", text: "时间", fontSize: 34, fill: "#a08b6d" }),
    text("text_time", { x: 290, y: 1166, width: 700, height: 60 }, { name: "时间", text: "2026-11-15 14:00", fontSize: 42, fill: "#2a1f17", fontWeight: "bold" }),
    shape("line_1", "line", { x: 90, y: 1260, width: 900, height: 2 }, { name: "分割线", fill: "#e4d8c5" }),
    text("text_place_l", { x: 90, y: 1300, width: 200, height: 50 }, { name: "地点标签", text: "地点", fontSize: 34, fill: "#a08b6d" }),
    text("text_place", { x: 290, y: 1296, width: 700, height: 120 }, { name: "地点", text: "城市艺术中心 3 层多功能厅", fontSize: 42, fill: "#2a1f17", fontWeight: "bold" }),
    text("text_desc", { x: 90, y: 1460, width: 900, height: 260 }, {
      name: "说明", text: "现场设有新品体验区、嘉宾分享与抽奖环节。\n名额有限，请提前报名。", fontSize: 36, fill: "#5d4e3f", lineHeight: 1.6,
    }),
    text("text_footer", { x: 90, y: 1780, width: 900, height: 60 }, { name: "落款", text: "主办方：XX 品牌会员中心", fontSize: 30, fill: "#a08b6d" }),
  ],
  [
    param("p_title", "活动名称", "multiline", "text_title", "text", "年度会员\n答谢沙龙", { maxLength: 20 }, true),
    param("p_time", "时间", "text", "text_time", "text", "2026-11-15 14:00"),
    param("p_place", "地点", "text", "text_place", "text", "城市艺术中心 3 层多功能厅", { maxLength: 30 }),
    param("p_desc", "活动说明", "multiline", "text_desc", "text", "现场设有新品体验区、嘉宾分享与抽奖环节。\n名额有限，请提前报名。", { maxLength: 120 }),
    param("p_host", "落款", "text", "text_footer", "text", "主办方：XX 品牌会员中心"),
    param("p_photo", "活动照片", "image", "img_photo", "src", { kind: "url", url: U("photo-1522071820081-009f0129c71c") }),
    param("p_color", "主色", "color", "rect_top", "fill", "#c8102e"),
  ],
);

const festival = doc(
  "bt_festival",
  "新春祝福卡",
  1080,
  1440,
  "#b3001b",
  [
    shape("ell_sun", "ellipse", { x: 190, y: 220, width: 700, height: 700 }, { name: "圆形底", fill: "#d4142f" }),
    shape("ell_ring", "ellipse", { x: 240, y: 270, width: 600, height: 600 }, { name: "金色圆环", fill: "rgba(0,0,0,0)", stroke: "#f2c14e", strokeWidth: 6 }),
    text("text_big", { x: 240, y: 380, width: 600, height: 380 }, {
      name: "大字", text: "福", fontSize: 340, fill: "#f2c14e", fontFamily: "Ma Shan Zheng", textAlign: "center", verticalAlign: "middle",
    }),
    text("text_wish", { x: 90, y: 1000, width: 900, height: 120 }, {
      name: "祝福语", text: "新春快乐 · 万事顺意", fontSize: 72, fill: "#fff4d6", fontFamily: "Noto Serif SC", fontWeight: "bold", textAlign: "center", autoShrink: true, minFontSize: 36, maxLines: 1,
    }),
    text("text_from", { x: 90, y: 1180, width: 900, height: 60 }, {
      name: "署名", text: "—— 小王 敬贺", fontSize: 38, fill: "#f6cfa0", textAlign: "center",
    }),
    shape("rect_frame", "rect", { x: 40, y: 40, width: 1000, height: 1360 }, { name: "边框", fill: "rgba(0,0,0,0)", stroke: "#f2c14e", strokeWidth: 4, radius: 24 }),
  ],
  [
    param("p_big", "大字", "select", "text_big", "text", "福", { options: ["福", "春", "喜", "安", "顺"] }),
    param("p_wish", "祝福语", "text", "text_wish", "text", "新春快乐 · 万事顺意", { maxLength: 16 }, true),
    param("p_from", "署名", "text", "text_from", "text", "—— 小王 敬贺", { maxLength: 16 }),
    param("p_font", "大字字体", "font", "text_big", "fontFamily", "Ma Shan Zheng"),
  ],
);

const quote = doc(
  "bt_quote",
  "图文金句卡",
  1080,
  1350,
  "#eef0ea",
  [
    shape("rect_card", "rect", { x: 80, y: 80, width: 920, height: 1190 }, {
      name: "卡片", fill: "#ffffff", radius: 32, shadow: { color: "rgba(40,50,40,0.15)", blur: 40, offsetX: 0, offsetY: 16 },
    }),
    text("text_mark", { x: 150, y: 140, width: 200, height: 180 }, { name: "引号", text: "“", fontSize: 220, fill: "#2f6b4f", fontFamily: "Playfair Display" }),
    text("text_quote", { x: 150, y: 360, width: 780, height: 520 }, {
      name: "金句", text: "慢慢来，比较快。认真做好一件小事，就是在靠近更大的目标。", fontSize: 64, fill: "#1f2a24", fontFamily: "Noto Serif SC", lineHeight: 1.55, autoShrink: true, minFontSize: 32,
    }),
    shape("line_q", "line", { x: 150, y: 960, width: 120, height: 6 }, { name: "短线", fill: "#2f6b4f" }),
    text("text_author", { x: 150, y: 1000, width: 780, height: 60 }, { name: "作者", text: "每日一句 · 第 128 期", fontSize: 34, fill: "#6b7a70" }),
  ],
  [
    param("p_quote", "金句内容", "multiline", "text_quote", "text", "慢慢来，比较快。认真做好一件小事，就是在靠近更大的目标。", { maxLength: 80 }, true),
    param("p_author", "作者 / 期数", "text", "text_author", "text", "每日一句 · 第 128 期"),
    param("p_bg", "背景色（卡片外）", "color", "rect_card", "fill", "#ffffff"),
    param("p_size", "金句字号", "fontSize", "text_quote", "fontSize", 64, { min: 24, max: 120 }),
  ],
);

const sale = doc(
  "bt_sale",
  "促销横幅",
  1920,
  800,
  "#1b1b1f",
  [
    shape("tri_deco", "triangle", { x: 1280, y: -120, width: 760, height: 1040 }, { name: "装饰三角", fill: "#e8b04a", rotation: 0 }),
    img("img_cup", { x: 1300, y: 140, width: 520, height: 520 }, U("photo-1587302186428-d3753405ffed"), { name: "产品图", radius: 260 }),
    text("text_kicker", { x: 120, y: 150, width: 1000, height: 60 }, { name: "眉题", text: "DOUBLE 11 · 全场", fontSize: 40, fill: "#e8b04a", letterSpacing: 8, fontWeight: "bold" }),
    text("text_title", { x: 120, y: 230, width: 1080, height: 260 }, {
      name: "主标题", text: "满 300 减 50", fontSize: 180, fill: "#ffffff", fontWeight: "bold", autoShrink: true, minFontSize: 80, maxLines: 1,
    }),
    text("text_sub", { x: 120, y: 520, width: 1000, height: 70 }, { name: "副标题", text: "11月1日 - 11月11日 · 线上线下同享", fontSize: 44, fill: "#b9b6ad" }),
    shape("rect_btn", "rect", { x: 120, y: 630, width: 320, height: 90 }, { name: "按钮底", fill: "#c8102e", radius: 45 }),
    text("text_btn", { x: 120, y: 650, width: 320, height: 50 }, { name: "按钮文字", text: "立即抢购", fontSize: 38, fill: "#ffffff", fontWeight: "bold", textAlign: "center", verticalAlign: "middle" }),
  ],
  [
    param("p_title", "主标题", "text", "text_title", "text", "满 300 减 50", { maxLength: 14 }, true),
    param("p_sub", "副标题", "text", "text_sub", "text", "11月1日 - 11月11日 · 线上线下同享"),
    param("p_btn", "按钮文字", "text", "text_btn", "text", "立即抢购", { maxLength: 6 }),
    param("p_img", "产品图", "image", "img_cup", "src", { kind: "url", url: U("photo-1587302186428-d3753405ffed") }),
    param("p_accent", "装饰颜色", "color", "tri_deco", "fill", "#e8b04a"),
  ],
);

const blankSizes: { id: string; name: string; w: number; h: number }[] = [
  { id: "blank_square", name: "空白 方形 1080×1080", w: 1080, h: 1080 },
  { id: "blank_portrait", name: "空白 竖版 1080×1350", w: 1080, h: 1350 },
  { id: "blank_story", name: "空白 手机全屏 1080×1920", w: 1080, h: 1920 },
  { id: "blank_wide", name: "空白 横版 1920×1080", w: 1920, h: 1080 },
];

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  { id: coffee.templateId, name: coffee.name, category: "poster", popularity: 98, addedAt: "2026-10-12", doc: coffee },
  { id: travel.templateId, name: travel.name, category: "social", popularity: 91, addedAt: "2026-10-20", doc: travel },
  { id: product.templateId, name: product.name, category: "ecommerce", popularity: 95, addedAt: "2026-10-08", doc: product },
  { id: notice.templateId, name: notice.name, category: "notice", popularity: 80, addedAt: "2026-10-18", doc: notice },
  { id: festival.templateId, name: festival.name, category: "festival", popularity: 88, addedAt: "2026-10-22", doc: festival },
  { id: quote.templateId, name: quote.name, category: "general", popularity: 85, addedAt: "2026-10-15", doc: quote },
  { id: sale.templateId, name: sale.name, category: "poster", popularity: 90, addedAt: "2026-10-23", doc: sale },
  ...blankSizes.map((b, i) => ({
    id: b.id,
    name: b.name,
    category: "blank" as const,
    popularity: 50 - i,
    addedAt: "2026-10-01",
    doc: doc(b.id, b.name.replace(/ \d+×\d+$/, ""), b.w, b.h, "#ffffff", [], []),
  })),
];

export function findBuiltin(id: string): BuiltinTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

export function categoryLabel(id: TemplateCategory): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
