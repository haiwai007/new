import {
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Palette,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Type,
  FolderOpen,
  Smartphone,
  ScanLine,
} from "lucide-react";
import type { LeftPanel } from "@/stores/editor.ts";

export const LEFT_TOOLS: { id: LeftPanel; label: string; icon: typeof Type }[] =
  [
    { id: "templates", label: "模板", icon: LayoutTemplate },
    { id: "custom", label: "自定义", icon: Sparkles },
    { id: "layers", label: "图层", icon: Layers },
    { id: "text", label: "文字", icon: Type },
    { id: "image", label: "图片", icon: ImageIcon },
    { id: "shape", label: "形状", icon: Shapes },
    { id: "background", label: "背景", icon: Palette },
    { id: "assets", label: "素材", icon: FolderOpen },
    { id: "status-location", label: "状态栏定位", icon: ScanLine },
    { id: "phone", label: "手机", icon: Smartphone },
    { id: "params", label: "参数", icon: SlidersHorizontal },
  ];
