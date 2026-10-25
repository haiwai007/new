// Fonts available in the editor. Self-hosted via pinned @fontsource packages; no third-party font requests.
export const FONTS: { family: string; label: string }[] = [
  { family: "Noto Sans SC", label: "思源黑体" },
  { family: "Noto Serif SC", label: "思源宋体" },
  { family: "ZCOOL XiaoWei", label: "站酷小薇" },
  { family: "ZCOOL QingKe HuangYou", label: "站酷庆科黄油体" },
  { family: "ZCOOL KuaiLe", label: "站酷快乐体" },
  { family: "Ma Shan Zheng", label: "马善政毛笔" },
  { family: "Long Cang", label: "龙藏体" },
  { family: "Zhi Mang Xing", label: "志莽行书" },
  { family: "Montserrat", label: "Montserrat" },
  { family: "Playfair Display", label: "Playfair Display" },
  { family: "Arial", label: "Arial（系统）" },
];

/**
 * Make sure the glyphs for the given text are loaded. Self-hosted CJK fonts are
 * split into unicode ranges, so we must request the actual text.
 */
export async function ensureFont(family: string, weight: string, style: string, text: string) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const spec = `${style} ${weight === "bold" ? 700 : 400} 32px "${family}"`;
  try {
    await document.fonts.load(spec, text.slice(0, 500) || "A");
  } catch {
    // Font failures fall back to system fonts; export checks report them.
  }
}

export function isFontAvailable(family: string, weight: string, text: string): boolean {
  if (typeof document === "undefined" || !("fonts" in document)) return true;
  if (family === "Arial") return true;
  if (!FONTS.some(font => font.family === family)) return false;
  try {
    return document.fonts.check(`${weight === "bold" ? 700 : 400} 32px "${family}"`, text.slice(0, 200) || "A");
  } catch {
    return false;
  }
}
