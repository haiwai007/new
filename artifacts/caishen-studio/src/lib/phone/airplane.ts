import type { StatusProfile } from "./profiles";

// Material Design flight silhouette (Apache-2.0), with system-specific orientation.
// See public/attributions/statusbar-system-icons.txt.
const PLANE =
  "M22 16v-2l-8.5-5V3.5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5V9L2 14v2l8.5-2.5V19L8 20.5V22l4-1 4 1v-1.5L13.5 19v-5.5z";
export function airplaneIcon(style: StatusProfile["airplane"]): {
  width: number;
  svg: (color: string) => string;
} {
  const rotation =
    style === "ios" ? 90 : style === "samsung" || style === "harmony" ? 45 : 0;
  const slender = style === "harmony" ? "translate(1.2 0) scale(.9 1)" : "";
  return {
    width: 20,
    svg: (color) =>
      `<g data-airplane="${style}" transform="translate(.4 .4) scale(.8)"><g transform="rotate(${rotation} 12 12) ${slender}"><path d="${PLANE}" fill="${color}"/></g></g>`,
  };
}
