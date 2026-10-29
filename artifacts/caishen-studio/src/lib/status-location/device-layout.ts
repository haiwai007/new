import { adjustInkTone } from "./source-fit";
import { numericAdvance, numericSvg } from "../phone/numeric-font";
import type { TemplateDoc, Layer, ImageSource } from "../../types/template";
import type { PhoneSettings } from "../phone/schema";
import { phoneModel } from "../phone/models";
import { effectiveProfile } from "../phone/profiles";
import { DEVICE_LAYOUTS } from "../phone/device-layouts";
import { builtinAppIconSource } from "../phone/app-icon-catalog";
import { createImageLayer, createTextLayer } from "../template/layers";
import { locationRenderKey, smallHash } from "./model";

type Helpers = {
  time: (p: PhoneSettings) => string;
  date: (p: PhoneSettings) => string;
  icons: (p: PhoneSettings) => string;
  color: (p: PhoneSettings) => string;
};
const source = (svg: string): ImageSource => ({
  kind: "url",
  url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
});
const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
/** Only the outer frame is authoritative; saved inner slots never constrain this layout. */
export function renderDeviceLocation(
  base: TemplateDoc,
  raw: PhoneSettings,
  helpers: Helpers,
): TemplateDoc {
  const location = base.statusLocation!,
    model = phoneModel(raw.modelId),
    profile = effectiveProfile(raw);
  const record = DEVICE_LAYOUTS[model.id];
  const version = raw.styleId === "auto" ? record.defaultStyle : raw.styleId;
  const layout = record.versions[version];
  if (!layout)
    throw new Error("该型号没有此版本的独立布局，请选择该型号支持的版本");
  const frame = {
    x: location.bounds.x * base.canvas.width,
    y: location.bounds.y * base.canvas.height,
    width: location.bounds.width * base.canvas.width,
    height: location.bounds.height * base.canvas.height,
  };
  const fill = location.fills[0];
  const fallback = /^#[0-9a-f]{6}$/i.test(base.canvas.backgroundColor)
    ? base.canvas.backgroundColor
    : "#ffffff";
  const top =
    location.background === "solid" ? location.color : (fill?.top ?? fallback);
  const bottom =
    location.background === "solid" ? location.color : (fill?.bottom ?? top);
  const lightness = (hex: string) =>
    [1, 3, 5].reduce(
      (sum, offset, i) =>
        sum +
        parseInt(hex.slice(offset, offset + 2), 16) *
          [0.2126, 0.7152, 0.0722][i],
      0,
    );
  const autoColour =
    raw.customColor || raw.fusion.locks.includes("color")
      ? helpers.color(raw)
      : ((location.background === "auto"
          ? location.sourceFit?.inkColor
          : undefined) ??
        ((lightness(top) + lightness(bottom)) / 2 > 140
          ? "#111111"
          : "#ffffff"));
  const colour =
    raw.customColor || raw.fusion.locks.includes("color")
      ? autoColour
      : adjustInkTone(autoColour, raw.toneAdjustment);
  const phone = {
    ...raw,
    groupId: base.phone?.groupId ?? raw.groupId,
    placement: "overlay" as const,
    addedHeight: 0,
    timeWeight: profile.weight,
    batteryStyle: profile.batteryStyle,
    theme: lightness(colour) > 140 ? ("light" as const) : ("dark" as const),
  };
  const layers: Layer[] = [];
  function add(role: string, layer: Layer) {
    layers.push({
      ...layer,
      id: `${phone.groupId}_${role}`,
      groupId: phone.groupId,
      locked: true,
      editable: false,
      layout: "fixed",
      name: `手机 · ${layer.name}`,
    });
  }
  add(
    "background",
    createImageLayer(
      frame,
      source(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(frame.width)}" height="${Math.ceil(frame.height)}" viewBox="0 0 ${frame.width} ${frame.height}"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="${frame.width}" height="${frame.height}" fill="url(#bg)"/></svg>`,
      ),
      { name: "外框内背景清理", fit: "stretch", autoFocus: false },
    ),
  );
  if (location.background === "auto" && location.backgroundPatch) {
    const background = layers[0];
    if (background.type === "image")
      background.src = { kind: "url", url: location.backgroundPatch };
  }
  const extras = [
    phone.showDate ? helpers.date(phone) : "",
    phone.showCarrier ? phone.carrier : "",
  ].filter(Boolean);
  const primaryHeight =
      frame.height / (1 + extras.length * layout.extraRowRatio),
    rowHeight = primaryHeight * layout.extraRowRatio;
  const unit = frame.width / model.points;
  const rightInset = Math.max(
    0,
    Math.min((layout.rightInset + phone.insetX) * unit, frame.width * 0.12),
  );
  const left =
    frame.x +
    Math.max(
      0,
      Math.min((layout.clockX + phone.insetX) * unit, frame.width * 0.3),
    );
  const gap = Math.min(layout.systemGap * unit, frame.width * 0.02);
  const middle = frame.x + frame.width / 2;
  const exclusion = Math.min(frame.width * 0.25, layout.centerReserve * unit);
  const rightStart =
    layout.clockAlign === "center" && !phone.appIcons.some((i) => i.visible)
      ? frame.x + frame.width * 0.64
      : middle + exclusion;
  const rightWidth = Math.max(
    0.001,
    frame.x + frame.width - rightInset - rightStart,
  );
  const icons = helpers.icons({ ...phone, customColor: colour });
  const nativeWidth = Number(icons.match(/\bwidth="([\d.]+)"/)?.[1] ?? 100);
  // Original visual scale leads; model size is a restrained proportional adjustment.
  const measuredFont = location.sourceFit
    ? (location.sourceFit.glyphRatio * primaryHeight) / 0.72
    : undefined;
  const modelAdjustment = Math.max(
    0.94,
    Math.min(1.06, Math.pow(layout.clockSize / 14, 0.2)),
  );
  const fitScale = measuredFont
    ? (measuredFont * modelAdjustment) / (layout.clockSize * unit)
    : 1;
  const targetFont = Math.max(
    0.001,
    Math.min(
      ((layout.clockSize * unit * phone.scale) / 100) * fitScale,
      primaryHeight / (location.sourceFit ? 0.9 : 1.6),
    ),
  );
  const iconHeight = Math.max(
    0.001,
    Math.min(
      ((layout.systemHeight * unit * phone.scale) / 100) * fitScale,
      primaryHeight * 0.68,
      (rightWidth * 20) / nativeWidth,
    ),
  );
  const iconWidth = (nativeWidth * iconHeight) / 20;
  function centerFor(ratio: number, glyphHeight: number) {
    return (
      frame.y +
      Math.max(
        glyphHeight / 2,
        Math.min(
          primaryHeight - glyphHeight / 2,
          primaryHeight *
            Math.max(
              0.2,
              Math.min(
                0.8,
                (location.sourceFit?.centerRatio ?? 0.5) + ratio - 0.5,
              ),
            ) +
            phone.offsetY * unit,
        ),
      )
    );
  }
  const centerY = centerFor(layout.systemCenterY ?? layout.centerY, iconHeight);
  add(
    "icons",
    createImageLayer(
      {
        x: frame.x + frame.width - rightInset - iconWidth,
        y: centerY - iconHeight / 2,
        width: iconWidth,
        height: iconHeight,
      },
      source(icons),
      { name: "信号、网络与电池", fit: "contain", autoFocus: false },
    ),
  );
  const visibleApps = phone.appIcons.filter((icon) => icon.visible);
  const time = helpers.time(phone),
    units =
      (layout.clockFont
        ? numericAdvance(layout.clockFont, time)
        : [...time].reduce(
            (n, ch) =>
              n +
              (/\d/.test(ch) ? 0.56 : ch === ":" || ch === " " ? 0.28 : 0.68),
            0,
          )) + 0.15;
  const leftEnd = Math.max(
    left + 0.001,
    Math.min(
      middle - exclusion,
      frame.x + frame.width - rightInset - iconWidth - gap,
    ),
  );
  const available = Math.max(0.001, leftEnd - left);
  const appRatio =
      ((layout.appSize / layout.clockSize) * phone.appIconSize) / 12,
    gapRatio = phone.appIconGap / phone.appIconSize;
  const font = Math.min(
    targetFont,
    available /
      Math.max(
        1,
        units +
          (visibleApps.length
            ? 0.35 +
              visibleApps.length * appRatio +
              Math.max(0, visibleApps.length - 1) * appRatio * gapRatio
            : 0),
      ),
  );
  const timeWidth = Math.min(available, font * units);
  const timeX =
    layout.clockAlign === "center" && !visibleApps.length
      ? frame.x + (frame.width - timeWidth) / 2
      : left;
  const textHeight = Math.max(
    0.001,
    Math.min(primaryHeight, font * (location.sourceFit ? 0.9 : 1.4)),
  );
  const textBaseline = location.sourceFit
    ? Math.min(textHeight, font * 0.8)
    : textHeight * 0.78;
  const clockCenter = centerFor(
    layout.clockCenterY ?? layout.centerY,
    textHeight,
  );
  const sourceBaseline = location.sourceFit?.baselineRatio;
  const modelNudge =
    primaryHeight *
    Math.max(
      -0.03,
      Math.min(0.03, (layout.clockCenterY ?? layout.centerY) - 0.5),
    );
  const timeY =
    sourceBaseline !== undefined
      ? frame.y +
        primaryHeight * sourceBaseline -
        textBaseline +
        phone.offsetY * unit +
        modelNudge
      : location.sourceFit
        ? frame.y +
          primaryHeight * location.sourceFit.centerRatio -
          (textBaseline - font * 0.36) +
          phone.offsetY * unit +
          modelNudge
        : clockCenter - textHeight / 2;
  add(
    "time",
    createImageLayer(
      {
        x: timeX,
        y: Math.max(
          frame.y,
          Math.min(frame.y + primaryHeight - textHeight, timeY),
        ),
        width: Math.max(0.001, timeWidth),
        height: textHeight,
      },
      source(
        layout.clockFont
          ? numericSvg(
              layout.clockFont,
              time,
              font,
              textHeight,
              timeWidth,
              colour,
              textBaseline,
            )
          : `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, Math.ceil(timeWidth))}" height="${Math.max(1, Math.ceil(textHeight))}" viewBox="0 0 ${timeWidth} ${textHeight}"><text x="0" y="${textBaseline}" font-family="Arial,sans-serif" font-size="${font}" font-weight="${layout.clockWeight ?? (profile.weight === "bold" ? 700 : 400)}" fill="${colour}">${escape(time)}</text></svg>`,
      ),
      { name: "时间", fit: "stretch", autoFocus: false },
    ),
  );
  const appSize = Math.max(
    0.001,
    Math.min(font * appRatio, primaryHeight * 0.65),
  );
  for (const [index, app] of visibleApps.entries())
    add(
      `app_${app.id}`,
      createImageLayer(
        {
          x: left + timeWidth + font * 0.35 + index * appSize * (1 + gapRatio),
          y: Math.max(
            frame.y,
            Math.min(
              frame.y + primaryHeight - appSize,
              centerFor(layout.clockCenterY ?? layout.centerY, appSize) -
                appSize / 2,
            ),
          ),
          width: appSize,
          height: appSize,
        },
        app.kind === "builtin"
          ? builtinAppIconSource(app.builtinId, true)
          : app.displaySrc && app.displayKey === smallHash(app.src)
            ? { kind: "url", url: app.displaySrc }
            : app.src,
        {
          name: `APP · ${app.name}`,
          fit: "contain",
          autoFocus: false,
          ...(app.kind === "custom" && phone.customAppStyle === "mono"
            ? { tint: colour }
            : {}),
        },
      ),
    );
  for (const [index, value] of extras.entries()) {
    const role = phone.showDate && index === 0 ? "date" : "carrier";
    const rowWidth = Math.max(0.001, frame.width - rightInset * 2);
    const fontSize = Math.max(
      0.001,
      Math.min(
        font * 0.75,
        rowHeight / 1.5,
        rowWidth / Math.max(1, [...value].length),
      ),
    );
    add(
      role,
      createTextLayer(
        {
          x: frame.x + rightInset,
          y: frame.y + primaryHeight + index * rowHeight,
          width: rowWidth,
          height: rowHeight,
        },
        {
          name: role === "date" ? "日期" : "运营商",
          text: value,
          fontFamily: "Noto Sans SC",
          fontSize,
          minFontSize: fontSize,
          wrap: false,
          autoGrow: false,
          fill: colour,
          lineHeight: 1,
          textAlign: "center",
          verticalAlign: "middle",
        },
      ),
    );
  }
  const result: TemplateDoc = {
    ...base,
    phone,
    layers: [...base.layers, ...layers],
  };
  return {
    ...result,
    phone: { ...phone, locationKey: locationRenderKey(result) },
  };
}
