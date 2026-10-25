import { describe, expect, it } from "vitest";
import { PHONE_MODELS, PHONE_BRANDS, phoneModel } from "./models";
import { settingsForModel, statusProfile } from "./profiles";
import {
  applyPhoneLayers,
  defaultPhoneSettings,
  statusIconsSvg,
} from "./layers";
import { phoneSettingsSchema } from "./schema";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { loadTemplateDoc } from "../template/migrate";
import { uploadCoverRatio } from "./upload-fit";

it("lists concrete, uniquely identified devices in brand groups while retaining old IDs", () => {
  expect(new Set(PHONE_MODELS.map((m) => m.id)).size).toBe(PHONE_MODELS.length);
  expect(
    PHONE_MODELS.filter((m) => m.style === "android").length,
  ).toBeGreaterThanOrEqual(50);
  expect(PHONE_BRANDS).toEqual(
    expect.arrayContaining([
      "Samsung",
      "小米",
      "Redmi",
      "华为",
      "荣耀",
      "OPPO",
      "一加",
      "vivo",
      "iQOO",
      "realme",
      "Google",
    ]),
  );
  expect(PHONE_MODELS.every((m) => !m.name.includes("通用"))).toBe(true);
  for (const id of [
    "iphone16",
    "pixel9",
    "galaxys24",
    "xiaomi14",
    "huaweimate60",
    "oppofindx7",
  ] as const)
    expect(phoneModel(id)).toBeDefined();
  expect(phoneModel("huaweimate60")).toMatchObject({
    width: 1212,
    height: 2616,
  });
});
it("switches model typography and battery defaults while preserving entered content", () => {
  const current = {
    ...defaultPhoneSettings(),
    time: "13:08",
    battery: 67,
    customColor: "#ff0000",
    date: "2024-02-29",
  };
  const samsung = settingsForModel(current, "galaxys24");
  expect(samsung).toMatchObject({
    time: current.time,
    battery: current.battery,
    date: current.date,
    groupId: current.groupId,
    customColor: current.customColor,
    modelId: "galaxys24",
    timeWeight: "normal",
    batteryStyle: "outline",
  });
  expect(statusProfile("pixel9").battery).toBe("vertical");
  expect(statusProfile("xiaomi14").battery).toBe("horizontal");
  expect(statusProfile("pixel9").signal).toBe("triangle");
  expect(statusProfile("galaxys25").battery).toBe("horizontal");
  expect(statusProfile("galaxys25").label).toBe("Samsung One UI 7");
});
it("renders distinct brand icon geometry, not merely different model names", () => {
  const current = {
    ...defaultPhoneSettings(),
    battery: 68,
    wifi: 3,
    signal: 3,
  };
  const icons = [
    "pixel9",
    "galaxys24",
    "xiaomi14",
    "huaweimate60",
    "honormagic6",
    "oppofindx7",
    "vivox100",
    "realmegt6",
  ].map((id) =>
    statusIconsSvg(
      settingsForModel(current, id as typeof current.modelId),
    ).replace(/data-system="[^"]+"/, ""),
  );
  expect(new Set(icons).size).toBe(icons.length);
});
describe("phone overlays fitted to image canvases", () => {
  it("keeps every generated layer within portrait, square, landscape and tiny canvases", () => {
    for (const model of PHONE_MODELS)
      for (const [width, height] of [
        [360, 800],
        [800, 360],
        [500, 500],
        [16, 16],
      ]) {
        const source = structuredClone(BUILTIN_TEMPLATES[0].doc);
        source.canvas = { ...source.canvas, width, height };
        const settings = {
          ...settingsForModel(defaultPhoneSettings(), model.id),
          scale: 150,
          offsetY: -30,
          timeFormat: "12h" as const,
          time: "23:59",
          showCarrier: true,
          carrier: "中国移动中国电信中国联通",
          showDate: true,
          bluetooth: true,
          vpn: true,
          dualSim: true,
          hd: true,
          alarm: true,
          location: true,
          mute: true,
          dnd: true,
        };
        const result = applyPhoneLayers(source, settings);
        expect(result.canvas).toEqual(source.canvas);
        expect(result.layers.slice(0, source.layers.length)).toEqual(
          source.layers,
        );
        expect(loadTemplateDoc(result).ok).toBe(true);
        for (const layer of result.layers.filter(
          (l) => l.groupId === result.phone!.groupId,
        )) {
          expect(layer.x, `${model.id}/${layer.name}/x`).toBeGreaterThanOrEqual(
            0,
          );
          expect(layer.y, `${model.id}/${layer.name}/y`).toBeGreaterThanOrEqual(
            0,
          );
          expect(
            layer.x + layer.width,
            `${model.id}/${layer.name}/right`,
          ).toBeLessThanOrEqual(width + 0.01);
          expect(
            layer.y + layer.height,
            `${model.id}/${layer.name}/bottom`,
          ).toBeLessThanOrEqual(height + 0.01);
        }
      }
  });
  it("loads legacy settings without coverage and accepts all new model IDs", () => {
    const legacy = { ...defaultPhoneSettings() } as Record<string, unknown>;
    delete legacy.coverRatio;
    for (const model of PHONE_MODELS)
      expect(
        phoneSettingsSchema.parse({ ...legacy, modelId: model.id }).coverRatio,
      ).toBe(0);
  });
});
it("covers the old iPhone top bar even when switching to a shorter Android status bar", () => {
  const image = { width: 1179, height: 2556 };
  const canvas = { width: 393, height: 852 };
  const ratio = uploadCoverRatio(image, canvas);
  expect(ratio).toBeCloseTo(59 / 852);
  const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
  doc.canvas = { ...doc.canvas, ...canvas };
  const next = applyPhoneLayers(doc, {
    ...settingsForModel(defaultPhoneSettings(), "galaxys24"),
    coverRatio: ratio,
  });
  expect(
    next.layers.find((l) => l.id.endsWith("_background"))!.height,
  ).toBeCloseTo(59);
  expect(
    uploadCoverRatio(
      { width: 1200, height: 800 },
      { width: 1200, height: 800 },
    ),
  ).toBe(0);
  expect(uploadCoverRatio(image, { width: 800, height: 300 })).toBe(0);
});
