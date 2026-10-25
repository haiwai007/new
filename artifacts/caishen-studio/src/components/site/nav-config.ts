import { Images, LayoutTemplate, type LucideIcon } from "lucide-react";

export type SectionTab = { to: string; label: string; match: (path: string, search: string) => boolean };
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
      { to: "/templates", label: "模板库", match: (p, s) => p === "/templates" && !s.includes("category=custom") },
      { to: "/templates?category=custom", label: "我的模板", match: (p, s) => p === "/templates" && s.includes("category=custom") },
      { to: "/custom", label: "上传生成模板", match: (p) => p === "/custom" },
    ],
  },
  {
    id: "make",
    label: "做图",
    to: "/works",
    icon: Images,
    desc: "编辑单张作品，或用参数面板一次批量生成多张图片",
    tabs: [
      { to: "/works", label: "我的作品", match: (p) => p === "/works" },
      { to: "/batch", label: "批量做图", match: (p) => p === "/batch" },
    ],
  },
];

export const MORE_LINKS = [
  { to: "/assets", label: "素材库" },
  { to: "/backup", label: "备份与恢复" },
  { to: "/account", label: "云端账户" },
  { to: "/help", label: "帮助中心" },
];

export function sectionFor(path: string): Section | undefined {
  return SECTIONS.find((s) => s.tabs.some((t) => t.to.split("?")[0] === path));
}
