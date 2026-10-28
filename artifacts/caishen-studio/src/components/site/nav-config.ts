import { Images, LayoutTemplate, type LucideIcon } from "lucide-react";

export type SectionTab = {
  to: string;
  label: string;
  match: (path: string, search: string) => boolean;
};
export type Section = {
  id: "templates" | "make";
  label: string;
  to: string;
  icon: LucideIcon;
  desc: string;
  tabs: SectionTab[];
};

// Two core sections; every page in a section shares its sub-tab bar.
export const SECTIONS: Section[] = [
  {
    id: "templates",
    label: "模板",
    to: "/templates",
    icon: LayoutTemplate,
    desc: "浏览模板库、管理我的模板，或上传图片生成可改参数的模板",
    tabs: [
      {
        to: "/templates",
        label: "模板库",
        match: (p, s) => p === "/templates" && !s.includes("category=custom"),
      },
      {
        to: "/templates?category=custom",
        label: "我的模板",
        match: (p, s) => p === "/templates" && s.includes("category=custom"),
      },
      { to: "/custom", label: "上传生成模板", match: (p) => p === "/custom" },
    ],
  },
  {
    id: "make",
    label: "做图",
    to: "/draw",
    icon: Images,
    desc: "选择模板，在同一页面生成单张或批量图片",
    tabs: [
      {
        to: "/draw",
        label: "作图工作台",
        match: (p) => p === "/draw" || p === "/batch",
      },
      { to: "/works", label: "我的作品", match: (p) => p === "/works" },
    ],
  },
];

export const MORE_LINKS = [
  { to: "/submit", label: "提交模板" },
  { to: "/admin", label: "管理后台" },
  { to: "/assets", label: "素材库" },
  { to: "/backup", label: "备份与恢复" },
  { to: "/account", label: "云端账户" },
  { to: "/help", label: "帮助中心" },
];

export function sectionFor(path: string): Section | undefined {
  return SECTIONS.find((s) => s.tabs.some((t) => t.match(path, "")));
}
