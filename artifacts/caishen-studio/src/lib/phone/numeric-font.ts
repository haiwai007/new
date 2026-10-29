import { NUMERIC_FONT_DATA } from "./numeric-font-data";
import { DEVICE_LAYOUTS } from "./device-layouts";
import type { PhoneSettings } from "./schema";
export type NumericFontId = keyof typeof NUMERIC_FONT_DATA;
export function clockFontForSettings(
  settings: PhoneSettings,
): NumericFontId | undefined {
  if (settings.rendering !== "natural") return undefined;
  const record = DEVICE_LAYOUTS[settings.modelId];
  return record.versions[
    settings.styleId === "auto" ? record.defaultStyle : settings.styleId
  ]?.clockFont;
}
export function numericAdvance(fontId: NumericFontId, text: string): number {
  const font = NUMERIC_FONT_DATA[fontId];
  return [...text].reduce((width, char) => {
    const glyph = font.glyphs[char as keyof typeof font.glyphs];
    if (!glyph) throw Error("Unsupported status-bar numeric glyph");
    return width + glyph.advance / font.units;
  }, 0);
}
export function numericRun(
  fontId: NumericFontId,
  text: string,
  size: number,
  baseline: number,
  color: string,
  x = 0,
): string {
  const font = NUMERIC_FONT_DATA[fontId];
  let advance = x;
  const paths = [...text]
    .map((char) => {
      const glyph = font.glyphs[char as keyof typeof font.glyphs];
      if (!glyph) throw Error("Unsupported status-bar numeric glyph");
      const body = glyph.d
        ? `<path transform="translate(${advance} ${baseline}) scale(${size / font.units} ${-size / font.units})" d="${glyph.d}"/>`
        : "";
      advance += (glyph.advance * size) / font.units;
      return body;
    })
    .join("");
  return `<g data-numeric-font="${fontId}" fill="${color}">${paths}</g>`;
}
export function numericSvg(
  fontId: NumericFontId,
  text: string,
  size: number,
  height: number,
  width: number,
  color: string,
  baseline = height * 0.78,
): string {
  const fitted = Math.min(
    size,
    width / Math.max(0.01, numericAdvance(fontId, text)),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, Math.ceil(width))}" height="${Math.max(1, Math.ceil(height))}" viewBox="0 0 ${width} ${height}">${numericRun(fontId, text, fitted, baseline, color)}</svg>`;
}
