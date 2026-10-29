import { numericAdvance, numericRun } from "./numeric-font";
import { AOSP_GLYPH_DATA, type AospPath } from "./aosp-glyph-data";

type Part = { width: number; svg: (color: string) => string };
export type AospVersion = 14 | 15;
function paths(rows: AospPath[], color: string, prefix: string) {
  return rows
    .map((path, i) => {
      const clip = `${prefix}-${i}`;
      const body = `<path d="${path.d}" fill="${color}" fill-rule="${path.fillRule === "evenOdd" ? "evenodd" : "nonzero"}"/>`;
      return path.clipD
        ? `<defs><clipPath id="${clip}"><path d="${path.clipD}"/></clipPath></defs><g clip-path="url(#${clip})">${body}</g>`
        : body;
    })
    .join("");
}
export function aospSignal(
  level: number,
  version: AospVersion,
  small = false,
): Part {
  const state = Math.max(0, Math.min(4, Math.round(level)));
  return {
    width: small ? 13 : 17,
    svg: (color) =>
      `<g data-aosp-signal="${version}-${state}" transform="scale(${small ? 0.75 : 1})"><g transform="translate(-1.6 .4) scale(.8)">${paths(AOSP_GLYPH_DATA[version].signal[state], color, `signal-${version}-${small ? 1 : 0}`)}</g></g>`,
  };
}
export function aospWifi(level: number, version: AospVersion): Part {
  const state = Math.max(1, Math.min(4, Math.round(level)));
  return {
    width: 20,
    svg: (color) =>
      `<g data-aosp-wifi="${version}-${state}" transform="scale(.8333333333)">${paths(AOSP_GLYPH_DATA[version].wifi[state], color, `wifi-${version}`)}</g>`,
  };
}
export function aospAirplane(version: AospVersion): Part {
  return {
    width: 20,
    svg: (color) =>
      `<g data-airplane="aosp${version}"><g transform="translate(.8 .4) scale(.8)">${paths(AOSP_GLYPH_DATA[version].airplane, color, `plane-${version}`)}</g></g>`,
  };
}

/** AOSP BatteryMeterView places percentage after the 13dp-high ThemedBatteryDrawable. */
export function aospBattery(
  settings: import("./schema").PhoneSettings,
  color: string,
  version: AospVersion,
): Part {
  const battery = Math.max(0, Math.min(100, Math.round(settings.battery)));
  const paths = AOSP_GLYPH_DATA[version].battery;
  const scale = 13 / 15,
    bodyWidth = 12 * scale,
    bodyHeight = 20 * scale;
  const font = (14 / 15) * 20,
    padding = (4 / 15) * 20;
  const label = `${battery}${settings.spaceBeforePercent ? "\u00a0" : ""}%`;
  const labelWidth = font * numericAdvance("roboto-400", label);
  const levelColor = settings.lowPower
    ? "#FBBC04"
    : battery <= 20 && !settings.charging
      ? "#ef4444"
      : color;
  return {
    width:
      bodyWidth +
      (settings.showBatteryPercent ? padding + labelWidth + 0.3 : 0),
    svg: (ink) => {
      const chargeMask = `aosp-charge-${version}`;
      const fillClip = `aosp-fill-${version}`;
      const fillHeight = 14 * (battery >= 95 ? 1 : battery / 100);
      const body = `<path d="${paths.perimeter}" fill="${ink}"/><rect x="2" y="${18 - fillHeight}" width="8" height="${fillHeight}" fill="${levelColor}" clip-path="url(#${fillClip})"/>`;
      return `<g data-aosp-battery="${version}"><g transform="translate(0 ${(20 - bodyHeight) / 2}) scale(${scale})"><defs><clipPath id="${fillClip}"><path d="${paths.fillMask}"/></clipPath><mask id="${chargeMask}" maskUnits="userSpaceOnUse" x="0" y="0" width="12" height="20"><rect width="12" height="20" fill="white"/><path d="${paths.bolt}" fill="black"/></mask></defs>${settings.charging ? `<g mask="url(#${chargeMask})">${body}</g>${battery < 67 ? `<path d="${paths.bolt}" fill="${ink}"/>` : ""}` : body}${settings.lowPower && !settings.charging ? `<path d="${paths.plus}" fill="${ink}"/>` : ""}</g>${settings.showBatteryPercent ? numericRun("roboto-400", label, font, 10 + font * 0.36, ink, bodyWidth + padding) : ""}</g>`;
    },
  };
}
